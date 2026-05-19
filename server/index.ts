/**
 * FilmMarket API Server
 * 提供数据库操作的 RESTful API
 */

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import mysql from 'mysql2/promise';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import fs from 'fs';
import OSS from 'ali-oss';

// 获取当前文件路径
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 加载 .env 文件（优先 server/.env，其次项目根目录 .env）
dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'filmmarket_secret_2026';

// 用户评分缓存（避免 N+1 查询问题）
const userRatingCache = new Map<string, { rating: number; reviewCount: number }>();
const RATING_CACHE_TTL = 5 * 60 * 1000; // 5分钟过期
let ratingCacheTimestamp = 0;

// 批量获取用户评分
async function fetchUserRatings(userIds: string[]): Promise<Map<string, { rating: number; reviewCount: number }>> {
  const result = new Map<string, { rating: number; reviewCount: number }>();
  if (userIds.length === 0) return result;

  // 检查缓存是否过期
  const now = Date.now();
  const needsRefresh = now - ratingCacheTimestamp > RATING_CACHE_TTL ||
    userIds.some(id => !userRatingCache.has(id));

  if (needsRefresh) {
    try {
      // 批量查询所有用户的评分
      const placeholders = userIds.map(() => '?').join(',');
      const [rows] = await pool.query(`
        SELECT reviewee_id,
          AVG(rating) as avg_rating,
          COUNT(*) as review_count
        FROM reviews
        WHERE reviewee_id IN (${placeholders})
        GROUP BY reviewee_id
      `, userIds) as any[];

      // 更新缓存
      for (const row of rows) {
        const rating = row.avg_rating ? parseFloat(row.avg_rating.toFixed(1)) : 0;
        const reviewCount = row.review_count || 0;
        userRatingCache.set(row.reviewee_id, { rating, reviewCount });
        result.set(row.reviewee_id, { rating, reviewCount });
      }

      // 未评价的用户也缓存（默认评分）
      for (const id of userIds) {
        if (!userRatingCache.has(id)) {
          userRatingCache.set(id, { rating: 5.0, reviewCount: 0 });
          result.set(id, { rating: 5.0, reviewCount: 0 });
        }
      }

      ratingCacheTimestamp = now;
    } catch (error) {
      console.error('获取用户评分失败:', error);
    }
  } else {
    // 从缓存读取
    for (const id of userIds) {
      const cached = userRatingCache.get(id);
      if (cached) result.set(id, cached);
    }
  }

  return result;
}

// 中间件
app.use(cors({
  origin: ['http://localhost:5173', 'https://filmmarket.top', 'https://www.filmmarket.top'],
  credentials: true,
}));
app.use(express.json());

// 静态文件服务（用于访问上传的文件）
const uploadsDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express.static(uploadsDir));

// 配置 multer 存储
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (_req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 限制5MB
  fileFilter: (_req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) {
      cb(null, true);
    } else {
      cb(new Error('只支持图片文件 (jpeg, jpg, png, gif, webp)'));
    }
  },
});

// 数据库连接池
const pool = mysql.createPool({
  host: process.env.DB_HOST || process.env.host || 'rm-bp1c9272p58gcdz1u5o.mysql.rds.aliyuncs.com',
  port: parseInt(process.env.DB_PORT || process.env.port || '3306'),
  user: process.env.DB_USER || process.env.user || 'filmmarket',
  password: process.env.DB_PASSWORD || process.env.password || 'filmmarket@2006923',
  database: process.env.DB_NAME || process.env.database || 'filmmarket',
  waitForConnections: true,
  connectionLimit: 10,
});

// ==================== JWT 中间件 ====================

interface AuthRequest extends Request {
  user?: { id: string; email: string };
}

function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: '未登录，请先登录' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { id: string; email: string };
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: 'Token 已过期，请重新登录' });
  }
}

// ==================== 工具函数 ====================

function parseProduct(row: any) {
  if (!row) return null;
  const sellerLevel = row.seller_level || 'normal';
  const userId = String(row.user_id || row.id);
  // 从缓存获取评分（同步读取 Map）
  const cachedRating = userRatingCache.get(userId);
  const rating = cachedRating?.rating ?? 5.0;
  const reviewCount = cachedRating?.reviewCount ?? 0;

  return {
    id: row.id,
    title: row.title,
    brand: row.brand,
    model: row.model,
    category: row.category,
    condition: row.condition,
    price: row.price ? parseFloat(row.price) : 0,
    listingType: row.type,
    images: row.images ? (typeof row.images === 'string' ? JSON.parse(row.images) : row.images) : [],
    description: row.description || '',
    tags: row.tags ? (typeof row.tags === 'string' ? JSON.parse(row.tags) : row.tags) : [],
    views: row.views || 0,
    likes: row.likes || 0,
    seller: {
      id: userId,
      name: row.nickname || '胶片玩家',
      avatar: row.avatar_url || 'https://api.dicebear.com/7.x/thumbs/svg?seed=default',
      level: sellerLevel,
      badge: sellerLevel === 'premium' ? 'premium' : sellerLevel === 'verified' ? 'verified' : undefined,
      rating,
      reviewCount,
      location: '全国',
      joinedYear: row.created_at ? new Date(row.created_at).getFullYear() : new Date().getFullYear(),
    },
    createdAt: row.created_at,
    isTopListed: row.is_top === 1,
    isFeatured: row.is_featured === 1,
  };
}

// ==================== 健康检查 ====================

app.get('/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', db: 'connected', time: new Date().toISOString() });
  } catch (err: any) {
    res.json({ status: 'ok', db: 'error', dbError: err.message, time: new Date().toISOString() });
  }
});

app.get('/', (_req, res) => {
  res.json({ message: 'FilmMarket API Server', version: '1.0.0' });
});

// ==================== 认证 API ====================

// 注册
app.post('/api/auth/register', async (req: Request, res: Response) => {
  try {
    const { email, password, nickname } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: '邮箱和密码不能为空' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: '密码至少 6 位' });
    }

    // 检查邮箱是否已注册
    const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email]) as any[];
    if (existing.length > 0) {
      return res.status(400).json({ error: '该邮箱已被注册' });
    }

    const id = uuidv4();
    const hashedPassword = await bcrypt.hash(password, 10);
    const defaultNickname = nickname || email.split('@')[0];

    await pool.query(
      'INSERT INTO users (id, email, password_hash, nickname) VALUES (?, ?, ?, ?)',
      [id, email, hashedPassword, defaultNickname]
    );

    const token = jwt.sign({ id, email }, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      token,
      user: { id, email, nickname: defaultNickname },
      message: '注册成功',
    });
  } catch (error) {
    console.error('注册失败:', error);
    res.status(500).json({ error: '注册失败，请稍后重试' });
  }
});

// 登录
app.post('/api/auth/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: '邮箱和密码不能为空' });
    }

    const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email]) as any[];
    const user = rows[0];

    if (!user) {
      return res.status(401).json({ error: '邮箱或密码错误' });
    }

    // 如果没有密码（老数据），允许直接登录
    if (user.password_hash) {
      const validPassword = await bcrypt.compare(password, user.password_hash);
      if (!validPassword) {
        return res.status(401).json({ error: '邮箱或密码错误' });
      }
    }

    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        nickname: user.nickname,
        avatar_url: user.avatar_url,
        seller_level: user.seller_level,
      },
      message: '登录成功',
    });
  } catch (error) {
    console.error('登录失败:', error);
    res.status(500).json({ error: '登录失败，请稍后重试' });
  }
});

// 获取当前用户信息
app.get('/api/auth/me', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const [rows] = await pool.query('SELECT id, email, nickname, avatar_url, wechat_qr, seller_level, created_at FROM users WHERE id = ?', [req.user!.id]) as any[];
    if (!rows[0]) {
      return res.status(404).json({ error: '用户不存在' });
    }
    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ error: '获取用户信息失败' });
  }
});

// 更新用户信息
app.put('/api/auth/me', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { nickname, avatar_url, phone } = req.body;
    await pool.query(
      'UPDATE users SET nickname = ?, avatar_url = ?, phone = ? WHERE id = ?',
      [nickname, avatar_url, phone, req.user!.id]
    );
    const [rows] = await pool.query('SELECT id, email, nickname, avatar_url, seller_level FROM users WHERE id = ?', [req.user!.id]) as any[];
    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ error: '更新用户信息失败' });
  }
});

// ==================== 用户 API ====================

// 获取用户公开信息
app.get('/api/users/:id', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, email, nickname, avatar_url, seller_level, created_at FROM users WHERE id = ?',
      [req.params.id]
    ) as any[];
    res.json(rows[0] || null);
  } catch (error) {
    res.status(500).json({ error: '获取用户失败' });
  }
});

// 获取卖家联系方式（公开接口，需要登录才能查看微信二维码）
app.get('/api/users/:id/contact', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, nickname, avatar_url, seller_level, wechat_qr, created_at FROM users WHERE id = ?',
      [req.params.id]
    ) as any[];
    const user = rows[0];
    if (!user) {
      res.status(404).json({ error: '用户不存在' });
      return;
    }
    res.json({
      id: user.id,
      nickname: user.nickname || '胶片玩家',
      avatar_url: user.avatar_url || '',
      seller_level: user.seller_level || 'normal',
      wechat_qr: user.wechat_qr || '',
      joined_year: new Date(user.created_at).getFullYear(),
    });
  } catch (error) {
    res.status(500).json({ error: '获取联系方式失败' });
  }
});

// ==================== 商品 API ====================

// 获取商品列表
app.get('/api/products', async (req, res) => {
  try {
    const { category, type, page = 1, limit = 20, sort = 'created_at', q } = req.query;
    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

    let sql = `
      SELECT p.*, u.nickname, u.avatar_url, u.seller_level
      FROM products p
      JOIN users u ON p.user_id = u.id
      WHERE p.status = 'active'
    `;
    const params: any[] = [];

    if (q) {
      sql += ' AND (p.title LIKE ? OR p.description LIKE ? OR p.brand LIKE ?)';
      const searchTerm = `%${q}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }
    if (category) {
      sql += ' AND p.category = ?';
      params.push(category);
    }
    if (type) {
      sql += ' AND p.type = ?';
      params.push(type);
    }

    switch (sort) {
      case 'price_asc': sql += ' ORDER BY p.price ASC'; break;
      case 'price_desc': sql += ' ORDER BY p.price DESC'; break;
      case 'views': sql += ' ORDER BY p.views DESC'; break;
      default: sql += ' ORDER BY p.is_top DESC, p.created_at DESC';
    }

    sql += ' LIMIT ? OFFSET ?';
    params.push(parseInt(limit as string), offset);

    const [rows] = await pool.query(sql, params) as any[];

    // 填充卖家评分缓存
    const sellerIds = [...new Set(rows.map((r: any) => String(r.user_id)).filter(Boolean))];
    await fetchUserRatings(sellerIds);

    // 获取总数
    let countSql = `SELECT COUNT(*) as total FROM products p WHERE p.status = 'active'`;
    const countParams: any[] = [];
    if (category) { countSql += ' AND p.category = ?'; countParams.push(category); }
    if (type) { countSql += ' AND p.type = ?'; countParams.push(type); }
    const [countRows] = await pool.query(countSql, countParams) as any[];

    res.json({
      products: rows.map(parseProduct),
      total: countRows[0].total,
      page: parseInt(page as string),
      limit: parseInt(limit as string),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: '获取商品失败' });
  }
});

// 获取置顶商品
app.get('/api/products/top', async (_req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT p.*, u.nickname, u.avatar_url, u.seller_level
      FROM products p
      JOIN users u ON p.user_id = u.id
      WHERE p.status = 'active' AND p.is_top = 1
      ORDER BY p.created_at DESC
      LIMIT 6
    `) as any[];

    // 填充卖家评分缓存
    const sellerIds = [...new Set(rows.map((r: any) => String(r.user_id)).filter(Boolean))];
    await fetchUserRatings(sellerIds);

    res.json(rows.map(parseProduct));
  } catch (error) {
    res.status(500).json({ error: '获取置顶商品失败' });
  }
});

// 获取精选商品
app.get('/api/products/featured', async (_req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT p.*, u.nickname, u.avatar_url, u.seller_level
      FROM products p
      JOIN users u ON p.user_id = u.id
      WHERE p.status = 'active' AND p.is_featured = 1
      ORDER BY p.views DESC
      LIMIT 4
    `) as any[];

    // 填充卖家评分缓存
    const sellerIds = [...new Set(rows.map((r: any) => String(r.user_id)).filter(Boolean))];
    await fetchUserRatings(sellerIds);

    res.json(rows.map(parseProduct));
  } catch (error) {
    res.status(500).json({ error: '获取精选商品失败' });
  }
});

// 获取单个商品
app.get('/api/products/:id', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT p.*, u.nickname, u.avatar_url, u.seller_level
      FROM products p
      JOIN users u ON p.user_id = u.id
      WHERE p.id = ?
    `, [req.params.id]) as any[];

    if (rows[0]) {
      // 填充卖家评分缓存
      await fetchUserRatings([String(rows[0].user_id)]);
    }

    const product = parseProduct(rows[0]);
    if (product) {
      await pool.query('UPDATE products SET views = views + 1 WHERE id = ?', [req.params.id]);
    }
    res.json(product);
  } catch (error) {
    res.status(500).json({ error: '获取商品详情失败' });
  }
});

// 创建商品（需要登录）
app.post('/api/products', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { title, description, price, category, brand, model, condition, type, images } = req.body;
    const id = uuidv4();
    const user_id = req.user!.id;

    await pool.query(`
      INSERT INTO products (id, user_id, title, description, price, category, brand, model, \`condition\`, type, images)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [id, user_id, title, description, price, category, brand, model, condition || '9', type || 'sell', JSON.stringify(images || [])]);

    const [rows] = await pool.query(`
      SELECT p.*, u.nickname, u.avatar_url, u.seller_level
      FROM products p JOIN users u ON p.user_id = u.id
      WHERE p.id = ?
    `, [id]) as any[];

    // 填充卖家评分缓存
    if (rows[0]) {
      await fetchUserRatings([String(rows[0].user_id)]);
    }

    res.json(parseProduct(rows[0]));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: '创建商品失败' });
  }
});

// 更新商品（需要登录）
app.put('/api/products/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { title, description, price, category, brand, model, condition, type, images, status } = req.body;

    // 确认是商品所有者
    const [ownerRows] = await pool.query('SELECT user_id FROM products WHERE id = ?', [req.params.id]) as any[];
    if (!ownerRows[0] || ownerRows[0].user_id !== req.user!.id) {
      return res.status(403).json({ error: '无权限修改此商品' });
    }

    await pool.query(`
      UPDATE products SET title = ?, description = ?, price = ?, category = ?, brand = ?, model = ?, \`condition\` = ?, type = ?, images = ?, status = ?
      WHERE id = ?
    `, [title, description, price, category, brand, model, condition, type, JSON.stringify(images), status, req.params.id]);

    const [rows] = await pool.query(`
      SELECT p.*, u.nickname, u.avatar_url, u.seller_level
      FROM products p JOIN users u ON p.user_id = u.id
      WHERE p.id = ?
    `, [req.params.id]) as any[];

    // 填充卖家评分缓存
    if (rows[0]) {
      await fetchUserRatings([String(rows[0].user_id)]);
    }

    res.json(parseProduct(rows[0]));
  } catch (error) {
    res.status(500).json({ error: '更新商品失败' });
  }
});

// 删除商品（需要登录）
app.delete('/api/products/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const [ownerRows] = await pool.query('SELECT user_id FROM products WHERE id = ?', [req.params.id]) as any[];
    if (!ownerRows[0] || ownerRows[0].user_id !== req.user!.id) {
      return res.status(403).json({ error: '无权限删除此商品' });
    }
    await pool.query('DELETE FROM products WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: '删除商品失败' });
  }
});

// 获取用户的所有商品
app.get('/api/users/:id/products', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT p.*, u.nickname, u.avatar_url, u.seller_level
      FROM products p
      JOIN users u ON p.user_id = u.id
      WHERE p.user_id = ?
      ORDER BY p.created_at DESC
    `, [req.params.id]) as any[];

    // 填充卖家评分缓存
    const sellerIds = [...new Set(rows.map((r: any) => String(r.user_id)).filter(Boolean))];
    await fetchUserRatings(sellerIds);

    res.json(rows.map(parseProduct));
  } catch (error) {
    res.status(500).json({ error: '获取用户商品失败' });
  }
});

// ==================== 收藏 API ====================

app.get('/api/users/:id/favorites', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT p.*, u.nickname, u.avatar_url, u.seller_level
      FROM favorites f
      JOIN products p ON f.product_id = p.id
      JOIN users u ON p.user_id = u.id
      WHERE f.user_id = ?
      ORDER BY f.created_at DESC
    `, [req.params.id]) as any[];

    // 填充卖家评分缓存
    const sellerIds = [...new Set(rows.map((r: any) => String(r.user_id)).filter(Boolean))];
    await fetchUserRatings(sellerIds);

    res.json(rows.map(parseProduct));
  } catch (error) {
    res.status(500).json({ error: '获取收藏失败' });
  }
});

app.post('/api/favorites', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { product_id } = req.body;
    const user_id = req.user!.id;
    const id = uuidv4();

    await pool.query(
      'INSERT INTO favorites (id, user_id, product_id) VALUES (?, ?, ?)',
      [id, user_id, product_id]
    );
    await pool.query('UPDATE products SET likes = likes + 1 WHERE id = ?', [product_id]);

    res.json({ success: true, id });
  } catch (error: any) {
    if (error.code === 'ER_DUP_ENTRY') {
      res.status(400).json({ error: '已经收藏过了' });
    } else {
      res.status(500).json({ error: '添加收藏失败' });
    }
  }
});

app.delete('/api/favorites/:productId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const user_id = req.user!.id;
    const { productId } = req.params;

    await pool.query('DELETE FROM favorites WHERE user_id = ? AND product_id = ?', [user_id, productId]);
    await pool.query('UPDATE products SET likes = GREATEST(likes - 1, 0) WHERE id = ?', [productId]);

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: '取消收藏失败' });
  }
});

app.get('/api/favorites/:productId/check', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const [rows] = await pool.query(
      'SELECT id FROM favorites WHERE user_id = ? AND product_id = ?',
      [req.user!.id, req.params.productId]
    ) as any[];
    res.json({ favorited: rows.length > 0 });
  } catch (error) {
    res.status(500).json({ error: '检查收藏失败' });
  }
});

// ==================== 换物请求 API ====================

// 获取全部换物请求列表
app.get('/api/swaps', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT s.*, u.nickname, u.avatar_url, u.seller_level
      FROM swap_requests s
      JOIN users u ON s.requester_id = u.id
      WHERE s.status = 'open'
      ORDER BY s.created_at DESC
    `) as any[];
    const swaps = rows.map((row: any) => ({
      id: row.id,
      offering: row.offering || '',
      offeringImage: row.offering_image || '/images/products/p5-kodak-portra.png',
      wantedCategory: row.wanted_category ? (typeof row.wanted_category === 'string' ? JSON.parse(row.wanted_category) : row.wanted_category) : [],
      wantedDescription: row.wanted_description || '',
      status: row.status,
      createdAt: row.created_at,
      user: {
        id: row.requester_id,
        name: row.nickname || '胶片玩家',
        avatar: row.avatar_url || 'https://api.dicebear.com/7.x/thumbs/svg?seed=default',
        badge: row.seller_level === 'premium' ? 'premium' : row.seller_level === 'verified' ? 'verified' : 'none',
        rating: 5.0,
        reviewCount: 0,
        location: '全国',
        joinedYear: row.created_at ? new Date(row.created_at).getFullYear() : new Date().getFullYear(),
      },
    }));
    res.json(swaps);
  } catch (error) {
    console.error('获取换物列表失败:', error);
    res.status(500).json({ error: '获取换物列表失败' });
  }
});

// 获取某商品下的换物请求
app.get('/api/products/:id/swaps', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT s.*, u.nickname, u.avatar_url, u.seller_level
      FROM swap_requests s
      JOIN users u ON s.requester_id = u.id
      WHERE s.product_id = ?
      ORDER BY s.created_at DESC
    `, [req.params.id]) as any[];
    const swaps = rows.map((row: any) => ({
      id: row.id,
      offering: row.offering || '',
      offeringImage: row.offering_image || '',
      wantedCategory: row.wanted_category ? (typeof row.wanted_category === 'string' ? JSON.parse(row.wanted_category) : row.wanted_category) : [],
      wantedDescription: row.wanted_description || '',
      status: row.status,
      createdAt: row.created_at,
      user: {
        id: row.requester_id,
        name: row.nickname || '胶片玩家',
        avatar: row.avatar_url || 'https://api.dicebear.com/7.x/thumbs/svg?seed=default',
        badge: row.seller_level === 'premium' ? 'premium' : row.seller_level === 'verified' ? 'verified' : 'none',
        rating: 5.0,
        reviewCount: 0,
        location: '全国',
        joinedYear: row.created_at ? new Date(row.created_at).getFullYear() : new Date().getFullYear(),
      },
    }));
    res.json(swaps);
  } catch (error) {
    res.status(500).json({ error: '获取交换请求失败' });
  }
});

// 创建换物请求
app.post('/api/swaps', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { product_id, offering, offering_image, wanted_category, wanted_description, message } = req.body;
    const id = uuidv4();

    await pool.query(`
      INSERT INTO swap_requests (id, product_id, requester_id, offering, offering_image, wanted_category, wanted_description, message, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'open')
    `, [id, product_id || null, req.user!.id, offering || '', offering_image || '', wanted_category ? JSON.stringify(wanted_category) : '[]', wanted_description || '', message || '']);

    const [rows] = await pool.query(`
      SELECT s.*, u.nickname, u.avatar_url, u.seller_level
      FROM swap_requests s
      JOIN users u ON s.requester_id = u.id
      WHERE s.id = ?
    `, [id]) as any[];
    const row = rows[0];
    res.json({
      id: row.id,
      offering: row.offering || '',
      offeringImage: row.offering_image || '',
      wantedCategory: row.wanted_category ? (typeof row.wanted_category === 'string' ? JSON.parse(row.wanted_category) : row.wanted_category) : [],
      wantedDescription: row.wanted_description || '',
      status: row.status,
      createdAt: row.created_at,
      user: {
        id: row.requester_id,
        name: row.nickname || '胶片玩家',
        avatar: row.avatar_url || 'https://api.dicebear.com/7.x/thumbs/svg?seed=default',
        badge: row.seller_level === 'premium' ? 'premium' : row.seller_level === 'verified' ? 'verified' : 'none',
        rating: 5.0,
        reviewCount: 0,
        location: '全国',
        joinedYear: row.created_at ? new Date(row.created_at).getFullYear() : new Date().getFullYear(),
      },
    });
  } catch (error) {
    console.error('创建交换请求失败:', error);
    res.status(500).json({ error: '创建交换请求失败' });
  }
});

// 更新换物请求状态
app.put('/api/swaps/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { status } = req.body;
    await pool.query('UPDATE swap_requests SET status = ? WHERE id = ?', [status, req.params.id]);
    const [rows] = await pool.query('SELECT * FROM swap_requests WHERE id = ?', [req.params.id]) as any[];
    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ error: '更新交换请求失败' });
  }
});

// ==================== 统计 API ====================

app.get('/api/stats', async (_req, res) => {
  try {
    const [userCount] = await pool.query('SELECT COUNT(*) as count FROM users') as any[];
    const [productCount] = await pool.query("SELECT COUNT(*) as count FROM products WHERE status = 'active'") as any[];
    const [swapCount] = await pool.query("SELECT COUNT(*) as count FROM swap_requests WHERE status = 'pending'") as any[];

    res.json({
      users: userCount[0].count,
      products: productCount[0].count,
      pendingSwaps: swapCount[0].count,
    });
  } catch (error) {
    res.status(500).json({ error: '获取统计失败' });
  }
});

// ==================== 数据库迁移 API ====================

// 安全运行 SQL（仅内部使用，生产可删除）
app.post('/api/admin/migrate', async (_req, res) => {
  try {
    // 扩展 swap_requests 表（新增字段兼容旧数据）
    for (const colDef of [
      'ADD COLUMN IF NOT EXISTS offering VARCHAR(500) DEFAULT \'\'',
      'ADD COLUMN IF NOT EXISTS offering_image VARCHAR(500) DEFAULT \'\'',
      'ADD COLUMN IF NOT EXISTS wanted_category JSON DEFAULT (\'[]\')',
      'ADD COLUMN IF NOT EXISTS wanted_description TEXT DEFAULT \'\'',
    ]) {
      try {
        await pool.query(`ALTER TABLE swap_requests ${colDef}`);
        console.log('✅ swap_requests:', colDef);
      } catch (e: any) {
        console.log('ℹ️ swap_requests 字段:', e.message);
      }
    }

    // 强制添加微信二维码字段（如果已存在会报错，但会被捕获）
    try {
      await pool.query(`
        ALTER TABLE users
        ADD COLUMN wechat_qr VARCHAR(500) DEFAULT '' COMMENT '微信收款二维码'
      `);
      console.log('✅ 已添加 wechat_qr 字段');
    } catch (err: any) {
      // 字段已存在或其他错误
      console.log('ℹ️ wechat_qr 字段处理:', err.message);
    }

    // 创建 orders 表
    await pool.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id VARCHAR(36) PRIMARY KEY,
        product_id VARCHAR(36) NOT NULL,
        buyer_id VARCHAR(36) NOT NULL,
        seller_id VARCHAR(36) NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        status ENUM('pending','paid','confirmed','cancelled','refunded') NOT NULL DEFAULT 'pending',
        buyer_name VARCHAR(100) NOT NULL,
        buyer_phone VARCHAR(20) NOT NULL,
        buyer_address TEXT NOT NULL,
        buyer_note TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        paid_at TIMESTAMP NULL,
        confirmed_at TIMESTAMP NULL,
        INDEX idx_buyer (buyer_id),
        INDEX idx_seller (seller_id),
        INDEX idx_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `).catch(() => {});

    // 创建 reviews 表
    await pool.query(`
      CREATE TABLE IF NOT EXISTS reviews (
        id VARCHAR(36) PRIMARY KEY,
        order_id VARCHAR(36) NOT NULL,
        product_id VARCHAR(36) NOT NULL,
        reviewer_id VARCHAR(36) NOT NULL COMMENT '评价人ID（买家）',
        reviewee_id VARCHAR(36) NOT NULL COMMENT '被评价人ID（卖家）',
        rating TINYINT NOT NULL COMMENT '评分 1-5',
        content TEXT COMMENT '评价内容',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_order (order_id),
        INDEX idx_reviewee (reviewee_id),
        INDEX idx_product (product_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `).catch(() => {}); // 忽略已存在报错

    // 创建 notifications 表
    await pool.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id VARCHAR(36) PRIMARY KEY,
        user_id VARCHAR(36) NOT NULL COMMENT '通知接收者ID',
        type VARCHAR(50) NOT NULL COMMENT '通知类型',
        title VARCHAR(200) NOT NULL,
        content TEXT,
        data JSON COMMENT '额外数据',
        is_read TINYINT(1) NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_user (user_id),
        INDEX idx_user_read (user_id, is_read)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `).catch(() => {});

    // 给 products 表加 status
    await pool.query(`
      ALTER TABLE products
      ADD COLUMN IF NOT EXISTS status ENUM('active','sold','deleted') NOT NULL DEFAULT 'active'
      AFTER is_featured
    `).catch(() => {});

    res.json({ ok: true, message: '迁移完成' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== 订单 API ====================

// 创建订单
app.post('/api/orders', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { product_id, buyer_name, buyer_phone, buyer_address, buyer_note } = req.body;

    if (!product_id || !buyer_name || !buyer_phone || !buyer_address) {
      res.status(400).json({ error: '缺少必填字段' });
      return;
    }

    // 获取商品信息
    const [products] = await pool.query(
      'SELECT * FROM products WHERE id = ? AND status = "active"',
      [product_id]
    ) as any[];
    if (!products.length) {
      res.status(404).json({ error: '商品不存在或已下架' });
      return;
    }
    const product = products[0];

    // 不能买自己的东西
    if (product.user_id === req.user!.id) {
      res.status(400).json({ error: '不能购买自己的商品' });
      return;
    }

    const id = uuidv4();
    await pool.query(`
      INSERT INTO orders (id, product_id, buyer_id, seller_id, amount, buyer_name, buyer_phone, buyer_address, buyer_note)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [id, product_id, req.user!.id, product.user_id, product.price, buyer_name, buyer_phone, buyer_address, buyer_note || '']);

    // 查订单 + 卖家信息（包含微信二维码）
    const [rows] = await pool.query(`
      SELECT o.*,
        p.title as product_title, p.images as product_images,
        s.nickname as seller_nickname, s.avatar_url as seller_avatar, s.wechat_qr as seller_wechat_qr,
        b.nickname as buyer_nickname
      FROM orders o
      JOIN products p ON o.product_id = p.id
      JOIN users s ON o.seller_id = s.id
      JOIN users b ON o.buyer_id = b.id
      WHERE o.id = ?
    `, [id]) as any[];

    // 通知卖家：有新订单
    const buyerNickname = rows[0]?.buyer_nickname || '某买家';
    await createNotification(
      product.user_id,
      'order_created',
      '📦 新订单通知',
      `「${buyerNickname}」购买了你的「${product.title}」，请尽快处理`,
      { orderId: id, productId: product_id }
    );

    res.json(rows[0]);
  } catch (error: any) {
    res.status(500).json({ error: error.message || '创建订单失败' });
  }
});

// 获取我的订单（买家视角）
app.get('/api/orders', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const type = req.query.type as string; // 'buy' | 'sell'
    let sql = `
      SELECT o.*,
        p.title as product_title, p.images as product_images, p.price as product_price,
        b.nickname as buyer_nickname, b.avatar_url as buyer_avatar,
        s.nickname as seller_nickname, s.avatar_url as seller_avatar, s.wechat_qr as seller_wechat_qr
      FROM orders o
      JOIN products p ON o.product_id = p.id
      JOIN users b ON o.buyer_id = b.id
      JOIN users s ON o.seller_id = s.id
    `;

    if (type === 'sell') {
      sql += ' WHERE o.seller_id = ? ORDER BY o.created_at DESC';
      const [rows] = await pool.query(sql, [req.user!.id]) as any[];
      res.json(rows);
    } else {
      sql += ' WHERE o.buyer_id = ? ORDER BY o.created_at DESC';
      const [rows] = await pool.query(sql, [req.user!.id]) as any[];
      res.json(rows);
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message || '获取订单失败' });
  }
});

// 买家点击"我已付款"
app.put('/api/orders/:id/paid', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const [orders] = await pool.query('SELECT * FROM orders WHERE id = ?', [req.params.id]) as any[];
    if (!orders.length) { res.status(404).json({ error: '订单不存在' }); return; }
    const order = orders[0];
    if (order.buyer_id !== req.user!.id) { res.status(403).json({ error: '无权操作' }); return; }
    if (order.status !== 'pending') { res.status(400).json({ error: '订单状态不对' }); return; }

    await pool.query('UPDATE orders SET status = ?, paid_at = NOW() WHERE id = ?', ['paid', req.params.id]);

    // 获取订单详情用于通知
    const [orderDetail] = await pool.query(`
      SELECT o.*,
        p.title as product_title,
        b.nickname as buyer_nickname
      FROM orders o
      JOIN products p ON o.product_id = p.id
      JOIN users b ON o.buyer_id = b.id
      WHERE o.id = ?
    `, [req.params.id]) as any[];

    // 通知卖家：买家已付款
    await createNotification(
      order.seller_id,
      'order_paid',
      '💰 买家已付款',
      `「${orderDetail[0]?.buyer_nickname}」已购买「${orderDetail[0]?.product_title}」并付款，请确认收款`,
      { orderId: req.params.id, productId: order.product_id }
    );

    const [rows] = await pool.query(`
      SELECT o.*,
        p.title as product_title, p.images as product_images,
        s.nickname as seller_nickname, s.avatar_url as seller_avatar, s.wechat_qr as seller_wechat_qr,
        b.nickname as buyer_nickname, b.avatar_url as buyer_avatar
      FROM orders o
      JOIN products p ON o.product_id = p.id
      JOIN users s ON o.seller_id = s.id
      JOIN users b ON o.buyer_id = b.id
      WHERE o.id = ?
    `, [req.params.id]) as any[];
    res.json(rows[0]);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 卖家确认收款
app.put('/api/orders/:id/confirm', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const [orders] = await pool.query('SELECT * FROM orders WHERE id = ?', [req.params.id]) as any[];
    if (!orders.length) { res.status(404).json({ error: '订单不存在' }); return; }
    const order = orders[0];
    if (order.seller_id !== req.user!.id) { res.status(403).json({ error: '无权操作' }); return; }
    if (order.status !== 'paid') { res.status(400).json({ error: '买家还未付款' }); return; }

    await pool.query('UPDATE orders SET status = ?, confirmed_at = NOW() WHERE id = ?', ['confirmed', req.params.id]);
    // 商品自动下架
    await pool.query('UPDATE products SET status = ? WHERE id = ?', ['sold', order.product_id]);

    // 获取订单详情用于通知
    const [orderDetail] = await pool.query(`
      SELECT o.*,
        p.title as product_title,
        s.nickname as seller_nickname
      FROM orders o
      JOIN products p ON o.product_id = p.id
      JOIN users s ON o.seller_id = s.id
      WHERE o.id = ?
    `, [req.params.id]) as any[];

    // 通知买家：订单已完成
    await createNotification(
      order.buyer_id,
      'order_confirmed',
      '✅ 交易完成',
      `「${orderDetail[0]?.seller_nickname}」已确认收款，「${orderDetail[0]?.product_title}」交易成功！别忘了给卖家评价哦~`,
      { orderId: req.params.id, productId: order.product_id }
    );

    const [rows] = await pool.query(`
      SELECT o.*,
        p.title as product_title, p.images as product_images,
        s.nickname as seller_nickname, s.avatar_url as seller_avatar, s.wechat_qr as seller_wechat_qr,
        b.nickname as buyer_nickname, b.avatar_url as buyer_avatar
      FROM orders o
      JOIN products p ON o.product_id = p.id
      JOIN users s ON o.seller_id = s.id
      JOIN users b ON o.buyer_id = b.id
      WHERE o.id = ?
    `, [req.params.id]) as any[];
    res.json(rows[0]);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 取消订单
app.put('/api/orders/:id/cancel', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const [orders] = await pool.query('SELECT * FROM orders WHERE id = ?', [req.params.id]) as any[];
    if (!orders.length) { res.status(404).json({ error: '订单不存在' }); return; }
    const order = orders[0];
    // 买家可取消 pending 订单，卖家可取消 paid 订单
    const isBuyer = order.buyer_id === req.user!.id;
    const isSeller = order.seller_id === req.user!.id;
    const canCancel = (isBuyer && order.status === 'pending')
      || (isSeller && order.status === 'paid');
    if (!canCancel) { res.status(403).json({ error: '无权取消此订单' }); return; }

    await pool.query('UPDATE orders SET status = ? WHERE id = ?', ['cancelled', req.params.id]);

    // 获取订单详情用于通知
    const [orderDetail] = await pool.query(`
      SELECT o.*,
        p.title as product_title
      FROM orders o
      JOIN products p ON o.product_id = p.id
      WHERE o.id = ?
    `, [req.params.id]) as any[];

    // 通知对方：订单被取消
    const notifyUserId = isBuyer ? order.seller_id : order.buyer_id;
    const cancelType = isBuyer ? '买家取消了订单' : '卖家取消了订单';
    await createNotification(
      notifyUserId,
      'order_cancelled',
      '❌ 订单已取消',
      `${cancelType}：「${orderDetail[0]?.product_title}」`,
      { orderId: req.params.id, productId: order.product_id }
    );

    const [rows] = await pool.query(`
      SELECT o.*,
        p.title as product_title, p.images as product_images,
        s.nickname as seller_nickname, s.avatar_url as seller_avatar, s.wechat_qr as seller_wechat_qr,
        b.nickname as buyer_nickname, b.avatar_url as buyer_avatar
      FROM orders o
      JOIN products p ON o.product_id = p.id
      JOIN users s ON o.seller_id = s.id
      JOIN users b ON o.buyer_id = b.id
      WHERE o.id = ?
    `, [req.params.id]) as any[];
    res.json(rows[0]);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== 通知 API ====================

// 创建通知（内部函数）
async function createNotification(
  userId: string,
  type: string,
  title: string,
  content: string,
  data: any = {}
): Promise<void> {
  const id = uuidv4();
  await pool.query(
    'INSERT INTO notifications (id, user_id, type, title, content, data) VALUES (?, ?, ?, ?, ?, ?)',
    [id, userId, type, title, content, JSON.stringify(data)]
  );
}

// 获取我的通知列表
app.get('/api/notifications', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;
    const unreadOnly = req.query.unread === 'true';

    let whereClause = 'WHERE user_id = ?';
    if (unreadOnly) {
      whereClause += ' AND is_read = 0';
    }

    const [rows] = await pool.query(`
      SELECT id, type, title, content, data, is_read, created_at
      FROM notifications
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `, [req.user!.id, limit, offset]) as any[];

    // 解析 data 字段
    const notifications = rows.map((row: any) => ({
      ...row,
      data: row.data ? (typeof row.data === 'string' ? JSON.parse(row.data) : row.data) : {},
    }));

    // 获取未读数量
    const [unreadResult] = await pool.query(
      'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0',
      [req.user!.id]
    ) as any[];

    // 获取总数
    const [totalResult] = await pool.query(
      `SELECT COUNT(*) as count FROM notifications WHERE user_id = ?`,
      [req.user!.id]
    ) as any[];

    res.json({
      notifications,
      unreadCount: unreadResult[0].count,
      total: totalResult[0].count,
      page,
      limit,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || '获取通知失败' });
  }
});

// 获取未读通知数量（轻量接口）
app.get('/api/notifications/count', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const [result] = await pool.query(
      'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0',
      [req.user!.id]
    ) as any[];
    res.json({ unreadCount: result[0].count });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 标记单条通知为已读
app.put('/api/notifications/:id/read', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const [rows] = await pool.query(
      'SELECT id FROM notifications WHERE id = ? AND user_id = ?',
      [req.params.id, req.user!.id]
    ) as any[];
    if (!rows.length) {
      res.status(404).json({ error: '通知不存在' });
      return;
    }
    await pool.query('UPDATE notifications SET is_read = 1 WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 标记所有通知为已读
app.put('/api/notifications/read-all', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    await pool.query('UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0', [req.user!.id]);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 删除通知
app.delete('/api/notifications/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const [rows] = await pool.query(
      'SELECT id FROM notifications WHERE id = ? AND user_id = ?',
      [req.params.id, req.user!.id]
    ) as any[];
    if (!rows.length) {
      res.status(404).json({ error: '通知不存在' });
      return;
    }
    await pool.query('DELETE FROM notifications WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== 评价 API ====================

// 创建评价（订单完成后双向评价）
app.post('/api/reviews', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { order_id, rating, content, role } = req.body;

    if (!order_id || !rating) {
      return res.status(400).json({ error: '缺少必填字段' });
    }
    if (rating < 1 || rating > 5) {
      return res.status(400).json({ error: '评分必须在 1-5 之间' });
    }

    // 检查订单是否存在且已完成
    const [orders] = await pool.query('SELECT * FROM orders WHERE id = ?', [order_id]) as any[];
    if (!orders.length) {
      return res.status(404).json({ error: '订单不存在' });
    }
    const order = orders[0];

    // 验证评价者身份和角色
    const isBuyer = order.buyer_id === req.user!.id;
    const isSeller = order.seller_id === req.user!.id;

    if (!isBuyer && !isSeller) {
      return res.status(403).json({ error: '只有订单双方可以评价' });
    }

    // 订单必须已完成
    if (order.status !== 'confirmed') {
      return res.status(400).json({ error: '订单完成前不能评价' });
    }

    // 根据角色确定被评价者
    let revieweeId: number;
    let reviewerId = req.user!.id;

    if (role === 'buyer_to_seller') {
      if (!isBuyer) return res.status(403).json({ error: '只有买家可以此角色评价' });
      revieweeId = order.seller_id;
    } else if (role === 'seller_to_buyer') {
      if (!isSeller) return res.status(403).json({ error: '只有卖家可以此角色评价' });
      revieweeId = order.buyer_id;
    } else {
      // 兼容旧接口：默认买家评价卖家
      if (!isBuyer) return res.status(403).json({ error: '只有买家可以评价' });
      revieweeId = order.seller_id;
    }

    // 检查该角色是否已评价
    const [existing] = await pool.query(
      'SELECT id FROM reviews WHERE order_id = ? AND reviewer_id = ?',
      [order_id, reviewerId]
    ) as any[];
    if (existing.length > 0) {
      return res.status(400).json({ error: '您已评价过此订单' });
    }

    const id = uuidv4();
    await pool.query(`
      INSERT INTO reviews (id, order_id, product_id, reviewer_id, reviewee_id, rating, content, role)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [id, order_id, order.product_id, reviewerId, revieweeId, rating, content || '', role || 'buyer_to_seller']);

    // 获取双方用户信息用于通知
    const [users] = await pool.query(
      'SELECT id, nickname FROM users WHERE id IN (?, ?)',
      [order.buyer_id, order.seller_id]
    ) as any[];
    const buyer = users.find((u: any) => u.id === order.buyer_id);
    const seller = users.find((u: any) => u.id === order.seller_id);
    const reviewer = isBuyer ? buyer : seller;
    const reviewee = isBuyer ? seller : buyer;

    // 更新被评价者平均评分
    const [avgResult] = await pool.query(
      'SELECT AVG(rating) as avg_rating, COUNT(*) as review_count FROM reviews WHERE reviewee_id = ?',
      [revieweeId]
    ) as any[];

    // 获取详情用于通知
    const [reviewDetail] = await pool.query(`
      SELECT r.*,
        u.nickname as reviewer_nickname, u.avatar_url as reviewer_avatar,
        p.title as product_title
      FROM reviews r
      JOIN users u ON r.reviewer_id = u.id
      JOIN products p ON r.product_id = p.id
      WHERE r.id = ?
    `, [id]) as any[];

    // 通知被评价者：收到新评价
    const stars = '⭐'.repeat(rating);
    await createNotification(
      revieweeId,
      'review_received',
      `${stars} 收到新评价`,
      `「${reviewer?.nickname}」对「${reviewDetail[0]?.product_title}」给了 ${rating} 星评价`,
      { reviewId: id, orderId: order_id, productId: order.product_id }
    );

    res.json({
      ...reviewDetail[0],
      reviewee_avg_rating: avgResult[0].avg_rating,
      reviewee_review_count: avgResult[0].review_count,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || '创建评价失败' });
  }
});

// 获取卖家收到的评价列表
app.get('/api/users/:id/reviews', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT r.*,
        u.nickname as reviewer_nickname, u.avatar_url as reviewer_avatar,
        p.title as product_title
      FROM reviews r
      JOIN users u ON r.reviewer_id = u.id
      JOIN products p ON r.product_id = p.id
      WHERE r.reviewee_id = ?
      ORDER BY r.created_at DESC
    `, [req.params.id]) as any[];

    // 获取平均评分
    const [avgResult] = await pool.query(
      'SELECT AVG(rating) as avg_rating, COUNT(*) as review_count FROM reviews WHERE reviewee_id = ?',
      [req.params.id]
    ) as any[];

    res.json({
      reviews: rows,
      avgRating: avgResult[0].avg_rating ? parseFloat(avgResult[0].avg_rating.toFixed(1)) : 0,
      reviewCount: avgResult[0].review_count || 0,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || '获取评价列表失败' });
  }
});

// 获取订单的评价状态（双向）
app.get('/api/orders/:id/reviews', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const [rows] = await pool.query(`
      SELECT r.*,
        u.nickname as reviewer_nickname, u.avatar_url as reviewer_avatar
      FROM reviews r
      JOIN users u ON r.reviewer_id = u.id
      WHERE r.order_id = ?
    `, [req.params.id]) as any[];

    // 区分买家评价和卖家评价
    const buyerReview = rows.find((r: any) => r.role === 'buyer_to_seller');
    const sellerReview = rows.find((r: any) => r.role === 'seller_to_buyer');

    res.json({
      buyerReview: buyerReview || null,
      sellerReview: sellerReview || null,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 获取用户双向信用评分
app.get('/api/users/:id/credit', async (req, res) => {
  try {
    const userId = req.params.id;

    // 作为卖家的评分（买家评价卖家）
    const [sellerStats] = await pool.query(`
      SELECT AVG(rating) as avg_rating, COUNT(*) as review_count
      FROM reviews
      WHERE reviewee_id = ? AND role = 'buyer_to_seller'
    `, [userId]) as any[];

    // 作为买家的评分（卖家评价买家）
    const [buyerStats] = await pool.query(`
      SELECT AVG(rating) as avg_rating, COUNT(*) as review_count
      FROM reviews
      WHERE reviewee_id = ? AND role = 'seller_to_buyer'
    `, [userId]) as any[];

    res.json({
      sellerCredit: {
        avgRating: sellerStats[0]?.avg_rating ? parseFloat(sellerStats[0].avg_rating.toFixed(1)) : 0,
        reviewCount: sellerStats[0]?.review_count || 0,
      },
      buyerCredit: {
        avgRating: buyerStats[0]?.avg_rating ? parseFloat(buyerStats[0].avg_rating.toFixed(1)) : 0,
        reviewCount: buyerStats[0]?.review_count || 0,
      },
      overallCredit: {
        avgRating: (() => {
          const sellerR = sellerStats[0]?.avg_rating || 0;
          const buyerR = buyerStats[0]?.avg_rating || 0;
          const sellerC = sellerStats[0]?.review_count || 0;
          const buyerC = buyerStats[0]?.review_count || 0;
          const total = sellerC + buyerC;
          if (total === 0) return 0;
          return parseFloat(((sellerR * sellerC + buyerR * buyerC) / total).toFixed(1));
        })(),
        reviewCount: (sellerStats[0]?.review_count || 0) + (buyerStats[0]?.review_count || 0),
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== 聊天/私信 API ====================

// 获取我的对话列表
app.get('/api/conversations', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    // 获取与当前用户相关的所有对话
    const [rows] = await pool.query(`
      SELECT c.*,
        u1.nickname as user1_nickname, u1.avatar_url as user1_avatar,
        u2.nickname as user2_nickname, u2.avatar_url as user2_avatar,
        p.title as product_title, p.images as product_images, p.price as product_price
      FROM conversations c
      JOIN users u1 ON c.user1_id = u1.id
      JOIN users u2 ON c.user2_id = u2.id
      LEFT JOIN products p ON c.product_id = p.id
      WHERE c.user1_id = ? OR c.user2_id = ?
      ORDER BY c.last_message_at DESC, c.updated_at DESC
    `, [userId, userId]) as any[];

    // 计算未读消息数并获取对方信息
    const conversations = await Promise.all(rows.map(async (row: any) => {
      // 获取未读消息数
      const [unreadRows] = await pool.query(`
        SELECT COUNT(*) as count FROM messages
        WHERE conversation_id = ? AND sender_id != ? AND is_read = 0
      `, [row.id, userId]) as any[];

      // 确定对方信息
      const isUser1 = row.user1_id === userId;
      const otherUser = {
        id: isUser1 ? row.user2_id : row.user1_id,
        nickname: isUser1 ? row.user2_nickname : row.user1_nickname,
        avatar: isUser1 ? row.user2_avatar : row.user1_avatar,
      };

      // 解析商品图片
      let productImages: string[] = [];
      if (row.product_images) {
        try {
          productImages = typeof row.product_images === 'string'
            ? JSON.parse(row.product_images)
            : row.product_images;
        } catch {}
      }

      return {
        id: row.id,
        otherUser,
        product: row.product_id ? {
          id: row.product_id,
          title: row.product_title,
          images: productImages,
          price: row.product_price,
        } : null,
        lastMessage: row.last_message,
        lastMessageAt: row.last_message_at,
        unreadCount: unreadRows[0]?.count || 0,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    }));

    res.json(conversations);
  } catch (error: any) {
    console.error('获取对话列表失败:', error);
    res.status(500).json({ error: error.message || '获取对话列表失败' });
  }
});

// 获取未读对话数（轻量接口）
app.get('/api/conversations/unread-count', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    // 获取所有未读消息数
    const [result] = await pool.query(`
      SELECT COUNT(*) as count
      FROM messages m
      JOIN conversations c ON m.conversation_id = c.id
      WHERE (c.user1_id = ? OR c.user2_id = ?)
        AND m.sender_id != ?
        AND m.is_read = 0
    `, [userId, userId, userId]) as any[];

    res.json({ unreadCount: result[0]?.count || 0 });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 创建或获取与某用户的对话
app.post('/api/conversations', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { targetUserId, productId, initialMessage } = req.body;

    if (!targetUserId) {
      res.status(400).json({ error: '请指定要聊天的用户' });
      return;
    }

    if (targetUserId === userId) {
      res.status(400).json({ error: '不能和自己聊天' });
      return;
    }

    // 检查目标用户是否存在
    const [targetUserRows] = await pool.query(
      'SELECT id, nickname, avatar_url FROM users WHERE id = ?',
      [targetUserId]
    ) as any[];

    if (!targetUserRows.length) {
      res.status(404).json({ error: '用户不存在' });
      return;
    }

    // 查找是否已存在对话（确保 user1_id < user2_id 以便唯一性约束）
    const [smallerId, largerId] = userId < targetUserId
      ? [userId, targetUserId]
      : [targetUserId, userId];

    let [existingRows] = await pool.query(`
      SELECT id FROM conversations WHERE user1_id = ? AND user2_id = ?
    `, [smallerId, largerId]) as any[];

    let conversationId: string;

    if (existingRows.length > 0) {
      // 对话已存在
      conversationId = existingRows[0].id;
    } else {
      // 创建新对话
      conversationId = uuidv4();
      await pool.query(`
        INSERT INTO conversations (id, user1_id, user2_id, product_id)
        VALUES (?, ?, ?, ?)
      `, [conversationId, smallerId, largerId, productId || null]);
    }

    // 如果有初始消息，发送它
    if (initialMessage) {
      const msgId = uuidv4();
      await pool.query(`
        INSERT INTO messages (id, conversation_id, sender_id, content, type)
        VALUES (?, ?, ?, ?, 'text')
      `, [msgId, conversationId, userId, initialMessage]);

      await pool.query(`
        UPDATE conversations SET last_message = ?, last_message_at = NOW() WHERE id = ?
      `, [initialMessage.substring(0, 100), conversationId]);
    }

    // 返回对话信息
    const [rows] = await pool.query(`
      SELECT c.*,
        u1.nickname as user1_nickname, u1.avatar_url as user1_avatar,
        u2.nickname as user2_nickname, u2.avatar_url as user2_avatar,
        p.title as product_title, p.images as product_images, p.price as product_price
      FROM conversations c
      JOIN users u1 ON c.user1_id = u1.id
      JOIN users u2 ON c.user2_id = u2.id
      LEFT JOIN products p ON c.product_id = p.id
      WHERE c.id = ?
    `, [conversationId]) as any[];

    const row = rows[0];
    const isUser1 = row.user1_id === userId;
    const otherUser = {
      id: isUser1 ? row.user2_id : row.user1_id,
      nickname: isUser1 ? row.user2_nickname : row.user1_nickname,
      avatar: isUser1 ? row.user2_avatar : row.user1_avatar,
    };

    let productImages: string[] = [];
    if (row.product_images) {
      try {
        productImages = typeof row.product_images === 'string'
          ? JSON.parse(row.product_images)
          : row.product_images;
      } catch {}
    }

    res.json({
      id: row.id,
      otherUser,
      product: row.product_id ? {
        id: row.product_id,
        title: row.product_title,
        images: productImages,
        price: row.product_price,
      } : null,
      lastMessage: row.last_message,
      lastMessageAt: row.last_message_at,
      unreadCount: 0,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  } catch (error: any) {
    console.error('创建对话失败:', error);
    res.status(500).json({ error: error.message || '创建对话失败' });
  }
});

// 获取对话详情
app.get('/api/conversations/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const conversationId = req.params.id;

    // 验证用户是否是对话参与者
    const [rows] = await pool.query(`
      SELECT c.*,
        u1.nickname as user1_nickname, u1.avatar_url as user1_avatar,
        u2.nickname as user2_nickname, u2.avatar_url as user2_avatar,
        p.title as product_title, p.images as product_images, p.price as product_price
      FROM conversations c
      JOIN users u1 ON c.user1_id = u1.id
      JOIN users u2 ON c.user2_id = u2.id
      LEFT JOIN products p ON c.product_id = p.id
      WHERE c.id = ?
    `, [conversationId]) as any[];

    if (!rows.length) {
      res.status(404).json({ error: '对话不存在' });
      return;
    }

    const row = rows[0];
    if (row.user1_id !== userId && row.user2_id !== userId) {
      res.status(403).json({ error: '无权访问此对话' });
      return;
    }

    const isUser1 = row.user1_id === userId;
    const otherUser = {
      id: isUser1 ? row.user2_id : row.user1_id,
      nickname: isUser1 ? row.user2_nickname : row.user1_nickname,
      avatar: isUser1 ? row.user2_avatar : row.user1_avatar,
    };

    let productImages: string[] = [];
    if (row.product_images) {
      try {
        productImages = typeof row.product_images === 'string'
          ? JSON.parse(row.product_images)
          : row.product_images;
      } catch {}
    }

    // 获取未读消息数
    const [unreadRows] = await pool.query(`
      SELECT COUNT(*) as count FROM messages
      WHERE conversation_id = ? AND sender_id != ? AND is_read = 0
    `, [conversationId, userId]) as any[];

    res.json({
      id: row.id,
      otherUser,
      product: row.product_id ? {
        id: row.product_id,
        title: row.product_title,
        images: productImages,
        price: row.product_price,
      } : null,
      lastMessage: row.last_message,
      lastMessageAt: row.last_message_at,
      unreadCount: unreadRows[0]?.count || 0,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || '获取对话详情失败' });
  }
});

// 获取对话中的消息列表
app.get('/api/conversations/:id/messages', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const conversationId = req.params.id;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = (page - 1) * limit;

    // 验证用户是否是对话参与者
    const [convRows] = await pool.query(`
      SELECT user1_id, user2_id FROM conversations WHERE id = ?
    `, [conversationId]) as any[];

    if (!convRows.length) {
      res.status(404).json({ error: '对话不存在' });
      return;
    }

    const conv = convRows[0];
    if (conv.user1_id !== userId && conv.user2_id !== userId) {
      res.status(403).json({ error: '无权访问此对话' });
      return;
    }

    // 获取消息列表
    const [rows] = await pool.query(`
      SELECT m.*, u.nickname as sender_nickname, u.avatar_url as sender_avatar
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      WHERE m.conversation_id = ?
      ORDER BY m.created_at ASC
      LIMIT ? OFFSET ?
    `, [conversationId, limit, offset]) as any[];

    // 获取消息总数
    const [countRows] = await pool.query(`
      SELECT COUNT(*) as total FROM messages WHERE conversation_id = ?
    `, [conversationId]) as any[];

    // 将发送给自己的消息标记为已读
    await pool.query(`
      UPDATE messages SET is_read = 1
      WHERE conversation_id = ? AND sender_id != ? AND is_read = 0
    `, [conversationId, userId]);

    res.json({
      messages: rows.map(row => ({
        id: row.id,
        conversationId: row.conversation_id,
        sender: {
          id: row.sender_id,
          nickname: row.sender_nickname,
          avatar: row.sender_avatar,
        },
        content: row.content,
        type: row.type,
        isRead: row.is_read === 1,
        createdAt: row.created_at,
      })),
      total: countRows[0]?.total || 0,
      page,
      limit,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || '获取消息列表失败' });
  }
});

// 发送消息
app.post('/api/conversations/:id/messages', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const conversationId = req.params.id;
    const { content, type = 'text' } = req.body;

    if (!content || !content.trim()) {
      res.status(400).json({ error: '消息内容不能为空' });
      return;
    }

    // 验证用户是否是对话参与者
    const [convRows] = await pool.query(`
      SELECT user1_id, user2_id FROM conversations WHERE id = ?
    `, [conversationId]) as any[];

    if (!convRows.length) {
      res.status(404).json({ error: '对话不存在' });
      return;
    }

    const conv = convRows[0];
    if (conv.user1_id !== userId && conv.user2_id !== userId) {
      res.status(403).json({ error: '无权在此对话中发送消息' });
      return;
    }

    // 插入消息
    const messageId = uuidv4();
    await pool.query(`
      INSERT INTO messages (id, conversation_id, sender_id, content, type)
      VALUES (?, ?, ?, ?, ?)
    `, [messageId, conversationId, userId, content.trim(), type]);

    // 更新对话的最后消息
    await pool.query(`
      UPDATE conversations SET last_message = ?, last_message_at = NOW() WHERE id = ?
    `, [content.trim().substring(0, 100), conversationId]);

    // 获取发送者信息
    const [userRows] = await pool.query(`
      SELECT nickname, avatar_url FROM users WHERE id = ?
    `, [userId]) as any[];

    res.json({
      id: messageId,
      conversationId,
      sender: {
        id: userId,
        nickname: userRows[0]?.nickname || '用户',
        avatar: userRows[0]?.avatar_url || '',
      },
      content: content.trim(),
      type,
      isRead: false,
      createdAt: new Date().toISOString(),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || '发送消息失败' });
  }
});

// 标记对话中的消息全部已读
app.put('/api/conversations/:id/read', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const conversationId = req.params.id;

    // 验证用户是否是对话参与者
    const [convRows] = await pool.query(`
      SELECT user1_id, user2_id FROM conversations WHERE id = ?
    `, [conversationId]) as any[];

    if (!convRows.length) {
      res.status(404).json({ error: '对话不存在' });
      return;
    }

    const conv = convRows[0];
    if (conv.user1_id !== userId && conv.user2_id !== userId) {
      res.status(403).json({ error: '无权操作此对话' });
      return;
    }

    // 标记所有消息为已读
    await pool.query(`
      UPDATE messages SET is_read = 1
      WHERE conversation_id = ? AND sender_id != ?
    `, [conversationId, userId]);

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 删除对话
app.delete('/api/conversations/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const conversationId = req.params.id;

    // 验证用户是否是对话参与者
    const [convRows] = await pool.query(`
      SELECT user1_id, user2_id FROM conversations WHERE id = ?
    `, [conversationId]) as any[];

    if (!convRows.length) {
      res.status(404).json({ error: '对话不存在' });
      return;
    }

    const conv = convRows[0];
    if (conv.user1_id !== userId && conv.user2_id !== userId) {
      res.status(403).json({ error: '无权删除此对话' });
      return;
    }

    // 删除对话中的所有消息
    await pool.query('DELETE FROM messages WHERE conversation_id = ?', [conversationId]);

    // 删除对话
    await pool.query('DELETE FROM conversations WHERE id = ?', [conversationId]);

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== 文件上传 API ====================

// multer 错误中间件（处理文件类型/大小错误）
const handleMulterError = (err: any, req: any, res: any, next: any) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ error: '文件大小不能超过 5MB' });
  }
  if (err.message && err.message.includes('只支持')) {
    return res.status(400).json({ error: err.message });
  }
  next(err);
};

// 获取上传文件的 base URL（支持环境变量覆盖，方便接入 OSS）
function getUploadBaseUrl(req: Request): string {
  // 如果配置了 UPLOAD_BASE_URL，直接使用（例如 OSS 地址）
  if (process.env.UPLOAD_BASE_URL) {
    return process.env.UPLOAD_BASE_URL.replace(/\/$/, '');
  }
  return `${req.protocol}://${req.get('host')}`;
}

// ==================== OSS 上传支持 ====================

let ossClient: any = null;

function getOSSClient(): any | null {
  if (ossClient) return ossClient;

  // 调试：检查 OSS 环境变量
  console.log('[OSS] OSS_REGION:', process.env.OSS_REGION);
  console.log('[OSS] OSS_ACCESS_KEY_ID:', process.env.OSS_ACCESS_KEY_ID ? '已设置' : '未设置');
  console.log('[OSS] OSS_BUCKET:', process.env.OSS_BUCKET);

  const region = process.env.OSS_REGION;
  const accessKeyId = process.env.OSS_ACCESS_KEY_ID;
  const accessKeySecret = process.env.OSS_ACCESS_KEY_SECRET;
  const bucket = process.env.OSS_BUCKET;

  if (!region || !accessKeyId || !accessKeySecret || !bucket) {
    return null;
  }

  ossClient = new OSS({
    region,
    accessKeyId,
    accessKeySecret,
    bucket,
  });

  return ossClient;
}

async function uploadToOSS(localFilePath: string, filename: string): Promise<string | null> {
  const oss = getOSSClient();
  if (!oss) return null;

  try {
    const key = 'uploads/' + filename;
    const result = await oss.put(key, localFilePath, {
      headers: { 'x-oss-object-acl': 'public-read' },
    });
    console.log('[OSS] 上传成功，URL:', result.url);

    const baseUrl = process.env.OSS_BASE_URL || ('https://' + process.env.OSS_BUCKET + '.' + process.env.OSS_REGION + '.aliyuncs.com');
    return baseUrl + '/' + key;
  } catch (err: any) {
    console.error('[OSS] 上传失败，详细错误:', err.name, err.message, err.code);
    return null;
  }
}

// 上传文件（用于微信收款码等）
app.post('/api/upload', authMiddleware, upload.single('file'), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '请选择要上传的文件' });
    }

    let fileUrl: string;

    // 优先尝试 OSS 上传（如果配置了 OSS 凭证）
    const ossUrl = await uploadToOSS(req.file.path, req.file.filename);
    if (ossUrl) {
      // OSS 上传成功，删除本地临时文件
      try { fs.unlinkSync(req.file.path); } catch {}
      fileUrl = ossUrl;
    } else {
      // OSS 未配置或上传失败，降级到本地存储
      const baseUrl = getUploadBaseUrl(req);
      fileUrl = baseUrl + '/uploads/' + req.file.filename;
    }

    res.json({
      url: fileUrl,
      filename: req.file.filename,
      originalname: req.file.originalname,
      size: req.file.size,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}, handleMulterError);

// 上传卖家微信收款码
app.put('/api/auth/wechat-qr', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { wechat_qr } = req.body;
    if (!wechat_qr) { res.status(400).json({ error: '请提供微信二维码URL' }); return; }
    await pool.query('UPDATE users SET wechat_qr = ? WHERE id = ?', [wechat_qr, req.user!.id]);
    const [rows] = await pool.query('SELECT * FROM users WHERE id = ?', [req.user!.id]) as any[];
    res.json(rows[0]);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== 搜索 API ====================

// 热门搜索词（固定配置 + 数据库统计）
app.get('/api/search/hot', async (_req, res) => {
  try {
    // 固定热门标签（胶片相机相关）
    const fixedHot = [
      'Leica', '徕卡', 'Contax', '尼康', 'Canon', '富士',
      '胶片', '135', '120', '旁轴', '单反', '自动对焦',
      '蔡司', '哈苏', ' Rolleiflex'
    ];

    // 从数据库获取最近搜索的品牌/型号
    const [recentProducts] = await pool.query(`
      SELECT brand, COUNT(*) as cnt
      FROM products
      WHERE status = 'active' AND brand IS NOT NULL AND brand != ''
      GROUP BY brand
      ORDER BY cnt DESC
      LIMIT 10
    `) as any[];

    // 合并并去重
    const dbHot = recentProducts.map((p: any) => p.brand).filter(Boolean);
    const combined = [...new Set([...fixedHot.slice(0, 8), ...dbHot])].slice(0, 12);

    res.json({ hot: combined });
  } catch (error: any) {
    res.json({ hot: fixedHot.slice(0, 10) });
  }
});

// ==================== 启动服务器 ====================

// 自动运行数据库迁移（仅首次启动时执行）
const runMigrations = async () => {
  try {
    // 0. 创建核心基础表 users / products / favorites / swap_requests
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(36) PRIMARY KEY,
        email VARCHAR(200) NOT NULL UNIQUE,
        password_hash VARCHAR(200) NOT NULL,
        nickname VARCHAR(100) NOT NULL DEFAULT '',
        avatar_url VARCHAR(500) DEFAULT '',
        phone VARCHAR(20) DEFAULT '',
        wechat_qr VARCHAR(500) DEFAULT '',
        seller_level ENUM('normal','verified','premium') NOT NULL DEFAULT 'normal',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_email (email)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `).catch(() => {});
    console.log('✅ users 表就绪');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS products (
        id VARCHAR(36) PRIMARY KEY,
        user_id VARCHAR(36) NOT NULL,
        title VARCHAR(200) NOT NULL,
        description TEXT,
        price DECIMAL(10,2) NOT NULL DEFAULT 0,
        category VARCHAR(50) NOT NULL DEFAULT '',
        brand VARCHAR(100) DEFAULT '',
        model VARCHAR(100) DEFAULT '',
        \`condition\` VARCHAR(10) NOT NULL DEFAULT '9',
        type ENUM('sell','swap','free') NOT NULL DEFAULT 'sell',
        images JSON,
        views INT NOT NULL DEFAULT 0,
        likes INT NOT NULL DEFAULT 0,
        is_featured TINYINT(1) NOT NULL DEFAULT 0,
        status ENUM('active','sold','deleted') NOT NULL DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_user (user_id),
        INDEX idx_category (category),
        INDEX idx_status (status),
        INDEX idx_created (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `).catch(() => {});
    console.log('✅ products 表就绪');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS favorites (
        id VARCHAR(36) PRIMARY KEY,
        user_id VARCHAR(36) NOT NULL,
        product_id VARCHAR(36) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE INDEX idx_user_product (user_id, product_id),
        INDEX idx_user (user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `).catch(() => {});
    console.log('✅ favorites 表就绪');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS swap_requests (
        id VARCHAR(36) PRIMARY KEY,
        product_id VARCHAR(36) NOT NULL,
        requester_id VARCHAR(36) NOT NULL,
        offering VARCHAR(500) DEFAULT '',
        offering_image VARCHAR(500) DEFAULT '',
        wanted_category JSON,
        wanted_description TEXT,
        status ENUM('pending','accepted','rejected') NOT NULL DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_product (product_id),
        INDEX idx_requester (requester_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `).catch(() => {});
    console.log('✅ swap_requests 表就绪');

    // 1. 添加微信二维码字段（MySQL 不支持 IF NOT EXISTS）
    try {
      await pool.query(`
        ALTER TABLE users
        ADD COLUMN wechat_qr VARCHAR(500) DEFAULT '' COMMENT '微信收款二维码'
      `);
      console.log('✅ 已添加 wechat_qr 字段');
    } catch (err: any) {
      console.log('ℹ️ wechat_qr 字段处理:', err.message);
    }

    // 2. 创建 orders 表
    await pool.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id VARCHAR(36) PRIMARY KEY,
        product_id VARCHAR(36) NOT NULL,
        buyer_id VARCHAR(36) NOT NULL,
        seller_id VARCHAR(36) NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        status ENUM('pending','paid','confirmed','cancelled','refunded') NOT NULL DEFAULT 'pending',
        buyer_name VARCHAR(100) NOT NULL,
        buyer_phone VARCHAR(20) NOT NULL,
        buyer_address TEXT NOT NULL,
        buyer_note TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        paid_at TIMESTAMP NULL,
        confirmed_at TIMESTAMP NULL,
        INDEX idx_buyer (buyer_id),
        INDEX idx_seller (seller_id),
        INDEX idx_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `).catch(() => {});

    // 3. 给 products 表加 status
    await pool.query(`
      ALTER TABLE products
      ADD COLUMN IF NOT EXISTS status ENUM('active','sold','deleted') NOT NULL DEFAULT 'active'
      AFTER is_featured
    `).catch(() => {});

    // 4. 创建 reviews 表
    await pool.query(`
      CREATE TABLE IF NOT EXISTS reviews (
        id VARCHAR(36) PRIMARY KEY,
        order_id VARCHAR(36) NOT NULL,
        product_id VARCHAR(36) NOT NULL,
        reviewer_id VARCHAR(36) NOT NULL COMMENT '评价人ID（买家）',
        reviewee_id VARCHAR(36) NOT NULL COMMENT '被评价人ID（卖家）',
        rating TINYINT NOT NULL COMMENT '评分 1-5',
        content TEXT COMMENT '评价内容',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_order (order_id),
        INDEX idx_reviewee (reviewee_id),
        INDEX idx_product (product_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `).catch(() => {});

    // 5. 创建 notifications 表
    await pool.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id VARCHAR(36) PRIMARY KEY,
        user_id VARCHAR(36) NOT NULL COMMENT '通知接收者ID',
        type VARCHAR(50) NOT NULL COMMENT '通知类型：order_created/order_paid/order_confirmed/order_cancelled/review_received',
        title VARCHAR(200) NOT NULL COMMENT '通知标题',
        content TEXT COMMENT '通知内容',
        data JSON COMMENT '额外数据（订单ID、商品ID等）',
        is_read TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否已读',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_user (user_id),
        INDEX idx_user_read (user_id, is_read),
        INDEX idx_created (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `).catch(() => {});

    // 6. 创建 conversations 表（聊天会话）
    await pool.query(`
      CREATE TABLE IF NOT EXISTS conversations (
        id VARCHAR(36) PRIMARY KEY,
        user1_id VARCHAR(36) NOT NULL COMMENT '用户1 ID',
        user2_id VARCHAR(36) NOT NULL COMMENT '用户2 ID',
        product_id VARCHAR(36) DEFAULT NULL COMMENT '关联商品ID（可选）',
        last_message TEXT COMMENT '最后一条消息摘要',
        last_message_at TIMESTAMP NULL COMMENT '最后消息时间',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_user1 (user1_id),
        INDEX idx_user2 (user2_id),
        INDEX idx_product (product_id),
        INDEX idx_last_message (last_message_at),
        UNIQUE INDEX idx_unique_pair (user1_id, user2_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `).catch(() => {});

    // 7. 创建 messages 表（聊天消息）
    await pool.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id VARCHAR(36) PRIMARY KEY,
        conversation_id VARCHAR(36) NOT NULL COMMENT '对话ID',
        sender_id VARCHAR(36) NOT NULL COMMENT '发送者ID',
        content TEXT NOT NULL COMMENT '消息内容',
        type ENUM('text', 'image') NOT NULL DEFAULT 'text' COMMENT '消息类型',
        is_read TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否已读',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_conversation (conversation_id),
        INDEX idx_sender (sender_id),
        INDEX idx_created (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `).catch(() => {});

    // 8. 给 reviews 表加 role 字段（支持双向评价）
    try {
      await pool.query(`
        ALTER TABLE reviews
        ADD COLUMN role ENUM('buyer_to_seller', 'seller_to_buyer') NOT NULL DEFAULT 'buyer_to_seller'
        COMMENT '评价方向'
        AFTER content
      `);
      console.log('✅ 已添加 reviews.role 字段');
    } catch (err: any) {
      if (err.message.includes('Duplicate')) {
        console.log('ℹ️ reviews.role 字段已存在');
      } else {
        console.log('ℹ️ reviews.role 字段处理:', err.message);
      }
    }

    // 9. 创建 user_addresses 表（收货地址管理）
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_addresses (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id VARCHAR(36) NOT NULL,
        name VARCHAR(100) NOT NULL COMMENT '收货人姓名',
        phone VARCHAR(20) NOT NULL COMMENT '收货人电话',
        province VARCHAR(50) NOT NULL COMMENT '省份',
        city VARCHAR(50) NOT NULL COMMENT '城市',
        district VARCHAR(50) NOT NULL COMMENT '区/县',
        detail VARCHAR(200) NOT NULL COMMENT '详细地址',
        is_default BOOLEAN NOT NULL DEFAULT false COMMENT '是否默认地址',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_user (user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `).catch(() => {});
    console.log('✅ user_addresses 表就绪');

    // 10. 创建 user_payment_methods 表（支付方式管理）
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_payment_methods (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id VARCHAR(36) NOT NULL,
        type ENUM('wechat', 'alipay', 'bank_card') NOT NULL COMMENT '支付类型',
        qr_code_url VARCHAR(500) DEFAULT '' COMMENT '收款二维码URL（微信/支付宝）',
        bank_name VARCHAR(100) DEFAULT '' COMMENT '银行名称（银行卡类型）',
        bank_account_encrypted VARCHAR(500) DEFAULT '' COMMENT '银行卡号（加密存储）',
        account_name VARCHAR(100) DEFAULT '' COMMENT '开户人姓名',
        is_default BOOLEAN NOT NULL DEFAULT false COMMENT '是否默认支付方式',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_user (user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `).catch(() => {});
    console.log('✅ user_payment_methods 表就绪');

    // 11. 创建 notification_settings 表（通知推送管理）
    // message/system 是 MySQL 保留字，用反引号转义
    await pool.query(`
      CREATE TABLE IF NOT EXISTS notification_settings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id VARCHAR(36) NOT NULL UNIQUE,
        order_update BOOLEAN NOT NULL DEFAULT true COMMENT '订单更新通知',
        price_alert BOOLEAN NOT NULL DEFAULT true COMMENT '价格提醒',
        \`message\` BOOLEAN NOT NULL DEFAULT true COMMENT '消息通知',
        \`system\` BOOLEAN NOT NULL DEFAULT true COMMENT '系统通知',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `).catch(() => {});
    console.log('✅ notification_settings 表就绪');

    // 修复：将 user_id 从 INT 改为 VARCHAR(36) 以匹配 users.id 类型
    try {
      await pool.query(`ALTER TABLE user_addresses MODIFY COLUMN user_id VARCHAR(36) NOT NULL`);
      console.log('✅ user_addresses.user_id 已改为 VARCHAR(36)');
    } catch (e: any) {
      if (!e.message?.includes('Duplicate')) console.log('ℹ️ user_addresses.user_id:', e.message);
    }
    try {
      await pool.query(`ALTER TABLE user_payment_methods MODIFY COLUMN user_id VARCHAR(36) NOT NULL`);
      console.log('✅ user_payment_methods.user_id 已改为 VARCHAR(36)');
    } catch (e: any) {
      if (!e.message?.includes('Duplicate')) console.log('ℹ️ user_payment_methods.user_id:', e.message);
    }
    try {
      await pool.query(`ALTER TABLE notification_settings MODIFY COLUMN user_id VARCHAR(36) NOT NULL UNIQUE`);
      console.log('✅ notification_settings.user_id 已改为 VARCHAR(36)');
    } catch (e: any) {
      if (!e.message?.includes('Duplicate')) console.log('ℹ️ notification_settings.user_id:', e.message);
    }

    // 清理之前错误存储的无效数据（user_id 为 0 或 NULL）
    try {
      await pool.query(`DELETE FROM user_addresses WHERE user_id = '0' OR user_id IS NULL OR user_id = ''`);
      await pool.query(`DELETE FROM user_payment_methods WHERE user_id = '0' OR user_id IS NULL OR user_id = ''`);
      await pool.query(`DELETE FROM notification_settings WHERE user_id = '0' OR user_id IS NULL OR user_id = ''`);
    } catch {}

    console.log('✅ 数据库迁移完成');
  } catch (err) {
    console.error('⚠️ 迁移警告:', err);
  }
};

pool.getConnection()
  .then(async conn => {
    conn.release();
    console.log('✅ 数据库连接成功');
    await runMigrations();
  })
  .catch(err => {
    console.error('❌ 数据库连接失败:', err.message);
  });

// ==================== 收货地址管理 API ====================

// 获取用户地址列表
app.get('/api/addresses', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM user_addresses WHERE user_id = ? ORDER BY is_default DESC, id DESC',
      [req.user!.id]
    );
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 添加新地址
app.post('/api/addresses', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { name, phone, province, city, district, detail, is_default } = req.body;
    
    if (!name || !phone || !province || !city || !district || !detail) {
      return res.status(400).json({ error: '请填写完整地址信息' });
    }

    // 如果设置为默认地址，先取消其他默认地址
    if (is_default) {
      await pool.query(
        'UPDATE user_addresses SET is_default = false WHERE user_id = ?',
        [req.user!.id]
      );
    }

    const [result] = await pool.query(
      `INSERT INTO user_addresses (user_id, name, phone, province, city, district, detail, is_default)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.user!.id, name, phone, province, city, district, detail, is_default || false]
    );

    const insertResult = result as any;
    const [newAddress] = await pool.query(
      'SELECT * FROM user_addresses WHERE id = ?',
      [insertResult.insertId]
    );

    res.json((newAddress as any)[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 更新地址
app.put('/api/addresses/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { name, phone, province, city, district, detail, is_default } = req.body;
    const addressId = req.params.id;

    // 验证地址属于当前用户
    const [rows] = await pool.query(
      'SELECT * FROM user_addresses WHERE id = ? AND user_id = ?',
      [addressId, req.user!.id]
    );

    if (!(rows as any[]).length) {
      return res.status(404).json({ error: '地址不存在' });
    }

    // 如果设置为默认地址，先取消其他默认地址
    if (is_default) {
      await pool.query(
        'UPDATE user_addresses SET is_default = false WHERE user_id = ?',
        [req.user!.id]
      );
    }

    await pool.query(
      `UPDATE user_addresses 
       SET name = ?, phone = ?, province = ?, city = ?, district = ?, detail = ?, is_default = ?
       WHERE id = ? AND user_id = ?`,
      [name, phone, province, city, district, detail, is_default || false, addressId, req.user!.id]
    );

    const [updatedAddress] = await pool.query(
      'SELECT * FROM user_addresses WHERE id = ?',
      [addressId]
    );

    res.json((updatedAddress as any)[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 删除地址
app.delete('/api/addresses/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const addressId = req.params.id;

    const [result] = await pool.query(
      'DELETE FROM user_addresses WHERE id = ? AND user_id = ?',
      [addressId, req.user!.id]
    );

    const deleteResult = result as any;
    if (deleteResult.affectedRows === 0) {
      return res.status(404).json({ error: '地址不存在' });
    }

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 设置默认地址
app.put('/api/addresses/:id/default', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const addressId = req.params.id;

    // 验证地址属于当前用户
    const [rows] = await pool.query(
      'SELECT * FROM user_addresses WHERE id = ? AND user_id = ?',
      [addressId, req.user!.id]
    );

    if (!(rows as any[]).length) {
      return res.status(404).json({ error: '地址不存在' });
    }

    // 取消其他默认地址
    await pool.query(
      'UPDATE user_addresses SET is_default = false WHERE user_id = ?',
      [req.user!.id]
    );

    // 设置当前地址为默认
    await pool.query(
      'UPDATE user_addresses SET is_default = true WHERE id = ?',
      [addressId]
    );

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== 支付方式管理 API ====================

// 获取用户支付方式列表
app.get('/api/payment-methods', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM user_payment_methods WHERE user_id = ? ORDER BY is_default DESC, id DESC',
      [req.user!.id]
    );
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 添加支付方式
app.post('/api/payment-methods', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { type, qr_code_url, bank_name, bank_account_encrypted, account_name, is_default } = req.body;
    
    if (!type) {
      return res.status(400).json({ error: '请选择支付类型' });
    }

    // 如果设置为默认支付方式，先取消其他默认支付方式
    if (is_default) {
      await pool.query(
        'UPDATE user_payment_methods SET is_default = false WHERE user_id = ?',
        [req.user!.id]
      );
    }

    const [result] = await pool.query(
      `INSERT INTO user_payment_methods (user_id, type, qr_code_url, bank_name, bank_account_encrypted, account_name, is_default)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [req.user!.id, type, qr_code_url || '', bank_name || '', bank_account_encrypted || '', account_name || '', is_default || false]
    );

    const insertResult = result as any;
    const [newPaymentMethod] = await pool.query(
      'SELECT * FROM user_payment_methods WHERE id = ?',
      [insertResult.insertId]
    );

    res.json((newPaymentMethod as any)[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 更新支付方式
app.put('/api/payment-methods/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { type, qr_code_url, bank_name, bank_account_encrypted, account_name, is_default } = req.body;
    const paymentMethodId = req.params.id;

    // 验证支付方式属于当前用户
    const [rows] = await pool.query(
      'SELECT * FROM user_payment_methods WHERE id = ? AND user_id = ?',
      [paymentMethodId, req.user!.id]
    );

    if (!(rows as any[]).length) {
      return res.status(404).json({ error: '支付方式不存在' });
    }

    // 如果设置为默认支付方式，先取消其他默认支付方式
    if (is_default) {
      await pool.query(
        'UPDATE user_payment_methods SET is_default = false WHERE user_id = ?',
        [req.user!.id]
      );
    }

    await pool.query(
      `UPDATE user_payment_methods 
       SET type = ?, qr_code_url = ?, bank_name = ?, bank_account_encrypted = ?, account_name = ?, is_default = ?
       WHERE id = ? AND user_id = ?`,
      [type, qr_code_url || '', bank_name || '', bank_account_encrypted || '', account_name || '', is_default || false, paymentMethodId, req.user!.id]
    );

    const [updatedPaymentMethod] = await pool.query(
      'SELECT * FROM user_payment_methods WHERE id = ?',
      [paymentMethodId]
    );

    res.json((updatedPaymentMethod as any)[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 删除支付方式
app.delete('/api/payment-methods/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const paymentMethodId = req.params.id;

    const [result] = await pool.query(
      'DELETE FROM user_payment_methods WHERE id = ? AND user_id = ?',
      [paymentMethodId, req.user!.id]
    );

    const deleteResult = result as any;
    if (deleteResult.affectedRows === 0) {
      return res.status(404).json({ error: '支付方式不存在' });
    }

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 设置默认支付方式
app.put('/api/payment-methods/:id/default', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const paymentMethodId = req.params.id;

    // 验证支付方式属于当前用户
    const [rows] = await pool.query(
      'SELECT * FROM user_payment_methods WHERE id = ? AND user_id = ?',
      [paymentMethodId, req.user!.id]
    );

    if (!(rows as any[]).length) {
      return res.status(404).json({ error: '支付方式不存在' });
    }

    // 取消其他默认支付方式
    await pool.query(
      'UPDATE user_payment_methods SET is_default = false WHERE user_id = ?',
      [req.user!.id]
    );

    // 设置当前支付方式为默认
    await pool.query(
      'UPDATE user_payment_methods SET is_default = true WHERE id = ?',
      [paymentMethodId]
    );

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== 通知设置管理 API ====================

// 获取用户通知设置
app.get('/api/notification-settings', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM notification_settings WHERE user_id = ?',
      [req.user!.id]
    );

    if (!(rows as any[]).length) {
      // 如果不存在设置记录，创建默认设置
      await pool.query(
        'INSERT INTO notification_settings (user_id, order_update, price_alert, `message`, `system`) VALUES (?, true, true, true, true)',
        [req.user!.id]
      );

      const [newSettings] = await pool.query(
        'SELECT * FROM notification_settings WHERE user_id = ?',
        [req.user!.id]
      );

      return res.json((newSettings as any)[0]);
    }

    res.json((rows as any)[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 更新用户通知设置
app.put('/api/notification-settings', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { order_update, price_alert, message, system } = req.body;

    const [rows] = await pool.query(
      'SELECT * FROM notification_settings WHERE user_id = ?',
      [req.user!.id]
    );

    if (!(rows as any[]).length) {
      // 如果不存在设置记录，创建新记录
      await pool.query(
        `INSERT INTO notification_settings (user_id, order_update, price_alert, \`message\`, \`system\`)
         VALUES (?, ?, ?, ?, ?)`,
        [req.user!.id, order_update !== undefined ? order_update : true, price_alert !== undefined ? price_alert : true, message !== undefined ? message : true, system !== undefined ? system : true]
      );
    } else {
      // 更新现有记录
      await pool.query(
        `UPDATE notification_settings 
         SET order_update = ?, price_alert = ?, \`message\` = ?, \`system\` = ?
         WHERE user_id = ?`,
        [order_update !== undefined ? order_update : true, price_alert !== undefined ? price_alert : true, message !== undefined ? message : true, system !== undefined ? system : true, req.user!.id]
      );
    }

    const [updatedSettings] = await pool.query(
      'SELECT * FROM notification_settings WHERE user_id = ?',
      [req.user!.id]
    );

    res.json((updatedSettings as any)[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`
🚀 FilmMarket API Server 运行中！
   地址: http://localhost:${PORT}
   健康检查: http://localhost:${PORT}/health
   商品列表: http://localhost:${PORT}/api/products
  `);
});
