/**
 * FilmMarket 数据库初始化脚本
 * 用途：创建数据库、表结构，并插入测试数据
 */

import mysql from 'mysql2/promise';

// 数据库连接配置
const config = {
  host: 'rm-bp1c9272p58gcdz1u5o.mysql.rds.aliyuncs.com',
  port: 3306,
  user: 'filmmarket',
  password: 'filmmarket@2006923',
};

// 数据库名称
const DB_NAME = 'filmmarket';

async function initDatabase() {
  console.log('🔌 正在连接数据库...');

  // 先连接 MySQL 服务器（不指定数据库）
  const connection = await mysql.createConnection(config);
  console.log('✅ 连接成功！\n');

  try {
    // 1. 创建数据库
    console.log('📦 创建数据库...');
    await connection.query(`CREATE DATABASE IF NOT EXISTS ${DB_NAME} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
    console.log(`✅ 数据库 ${DB_NAME} 创建完成！\n`);

    // 切换到目标数据库
    await connection.query(`USE ${DB_NAME}`);

    // 2. 创建表
    console.log('📋 创建数据表...');

    // 用户表
    await connection.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(36) PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        nickname VARCHAR(100),
        avatar_url VARCHAR(500),
        phone VARCHAR(20),
        seller_level ENUM('normal', 'verified', 'premium') DEFAULT 'normal',
        location VARCHAR(100) DEFAULT '',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    console.log('  ✅ users 表');

    // 商品表
    await connection.query(`
      CREATE TABLE IF NOT EXISTS products (
        id VARCHAR(36) PRIMARY KEY,
        user_id VARCHAR(36) NOT NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        price DECIMAL(10,2),
        category VARCHAR(50) NOT NULL,
        brand VARCHAR(100) DEFAULT '',
        model VARCHAR(100) DEFAULT '',
        \`condition\` VARCHAR(10) DEFAULT '9',
        type ENUM('sell', 'swap', 'both') DEFAULT 'sell',
        images JSON,
        views INT DEFAULT 0,
        likes INT DEFAULT 0,
        is_top BOOLEAN DEFAULT FALSE,
        is_featured BOOLEAN DEFAULT FALSE,
        status ENUM('active', 'sold', 'hidden') DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    console.log('  ✅ products 表');

    // 交换请求表
    await connection.query(`
      CREATE TABLE IF NOT EXISTS swap_requests (
        id VARCHAR(36) PRIMARY KEY,
        product_id VARCHAR(36) NOT NULL,
        requester_id VARCHAR(36) NOT NULL,
        offering TEXT,
        wanted_category JSON,
        wanted_description TEXT,
        status ENUM('pending', 'accepted', 'rejected') DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
        FOREIGN KEY (requester_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    console.log('  ✅ swap_requests 表');

    // 收藏表
    await connection.query(`
      CREATE TABLE IF NOT EXISTS favorites (
        id VARCHAR(36) PRIMARY KEY,
        user_id VARCHAR(36) NOT NULL,
        product_id VARCHAR(36) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
        UNIQUE KEY unique_fav (user_id, product_id)
      )
    `);
    console.log('  ✅ favorites 表\n');

    // 3. 插入测试数据
    console.log('📝 插入测试数据...');

    // 测试用户
    const testUsers = [
      { id: 'u1', email: 'user1@example.com', nickname: '胶片老炮儿', avatar_url: 'https://api.dicebear.com/7.x/initials/svg?seed=u1&backgroundColor=8B2323&textColor=ffffff', seller_level: 'premium', location: '北京' },
      { id: 'u2', email: 'user2@example.com', nickname: 'FilmWalker', avatar_url: 'https://api.dicebear.com/7.x/initials/svg?seed=u2&backgroundColor=8B2323&textColor=ffffff', seller_level: 'verified', location: '上海' },
      { id: 'u3', email: 'user3@example.com', nickname: '慢快门Aki', avatar_url: 'https://api.dicebear.com/7.x/initials/svg?seed=u3&backgroundColor=8B2323&textColor=ffffff', seller_level: 'verified', location: '成都' },
      { id: 'u4', email: 'user4@example.com', nickname: '快门猎人', avatar_url: 'https://api.dicebear.com/7.x/initials/svg?seed=u4&backgroundColor=8B2323&textColor=ffffff', seller_level: 'normal', location: '广州' },
      { id: 'u5', email: 'user5@example.com', nickname: 'Leica控', avatar_url: 'https://api.dicebear.com/7.x/initials/svg?seed=u5&backgroundColor=8B2323&textColor=ffffff', seller_level: 'premium', location: '深圳' },
    ];

    for (const user of testUsers) {
      await connection.query(
        `INSERT IGNORE INTO users (id, email, nickname, avatar_url, seller_level, location) VALUES (?, ?, ?, ?, ?, ?)`,
        [user.id, user.email, user.nickname, user.avatar_url, user.seller_level, user.location]
      );
    }
    console.log('  ✅ 5 个测试用户');

    // 测试商品
    const img = (id) => `https://picsum.photos/seed/${id}/600/400`;
    const testProducts = [
      { id: 'p1', user_id: 'u1', title: 'Leica M6 Classic 0.72x 成色极佳', description: '经典旁轴，德产精品，TTL测光，快门音沙哑悦耳，快门速度1/1000，无刮花，成色极佳。', price: 12800, category: 'rangefinder', brand: 'Leica', model: 'M6', condition: '9', type: 'sell', images: JSON.stringify([img(101), img(102)]), views: 1203, likes: 89, is_top: true, is_featured: true },
      { id: 'p2', user_id: 'u2', title: 'Contax T2 钛色 全套包装', description: '全球最受欢迎的胶片傻瓜机之一，Carl Zeiss T* 38mm f/2.8 镜头，钛色版本，保存完好全套包装。', price: 6800, category: 'point-and-shoot', brand: 'Contax', model: 'T2', condition: '9.5', type: 'both', images: JSON.stringify([img(201)]), views: 987, likes: 124, is_top: true, is_featured: true },
      { id: 'p3', user_id: 'u3', title: 'Nikon FM2 黑色机身 + 50mm f/1.4', description: '传奇单反，纯机械快门，1/4000秒，黑色机身搭配50mm f/1.4标准镜，成色良好无大伤。', price: 2200, category: 'slr', brand: 'Nikon', model: 'FM2', condition: '8', type: 'sell', images: JSON.stringify([img(301)]), views: 654, likes: 45, is_top: false, is_featured: false },
      { id: 'p4', user_id: 'u5', title: 'Rolleiflex 3.5F 双反相机', description: '德国制造双镜头反光相机，120中画幅胶片，Planar 75mm f/3.5 镜头，成色8成，腰平取景器正常。', price: 9500, category: 'tlr', brand: 'Rolleiflex', model: '3.5F', condition: '8', type: 'swap', images: JSON.stringify([img(401)]), views: 432, likes: 67, is_top: false, is_featured: true },
      { id: 'p5', user_id: 'u4', title: 'Kodak Portra 400 - 5卷装', description: '柯达Portra 400 彩色负片，5卷全新，日期2027年，冷藏保存，非常适合人像及户外拍摄。', price: 280, category: 'film', brand: 'Kodak', model: 'Portra 400', condition: 'N', type: 'sell', images: JSON.stringify([img(501)]), views: 321, likes: 38, is_top: false, is_featured: false },
      { id: 'p6', user_id: 'u3', title: 'Canon AE-1 Program 银黑经典', description: '入门经典款，程序自动曝光，FD卡口，搭配50mm f/1.8镜头，快门有轻微声音正常使用。适合新手入门。', price: 680, category: 'slr', brand: 'Canon', model: 'AE-1 Program', condition: '7', type: 'sell', images: JSON.stringify([img(601)]), views: 876, likes: 92, is_top: false, is_featured: false },
      { id: 'p7', user_id: 'u2', title: 'Olympus μ II 镀铬版', description: '小巧便携，35mm f/2.8 镜头，镀铬外观，自动对焦，日期功能，随拍利器。', price: 1800, category: 'point-and-shoot', brand: 'Olympus', model: 'μ II', condition: '9', type: 'sell', images: JSON.stringify([img(701)]), views: 543, likes: 71, is_top: false, is_featured: false },
      { id: 'p8', user_id: 'u1', title: 'Fujifilm Velvia 50 正片 - 5卷', description: '富士Velvia 50 反转片，饱和度极高，风光摄影首选，5卷全新冷藏保存。', price: 380, category: 'film', brand: 'Fujifilm', model: 'Velvia 50', condition: 'N', type: 'sell', images: JSON.stringify([img(801)]), views: 289, likes: 44, is_top: false, is_featured: false },
    ];

    for (const product of testProducts) {
      await connection.query(
        `INSERT IGNORE INTO products (id, user_id, title, description, price, category, brand, model, \`condition\`, type, images, views, likes, is_top, is_featured) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [product.id, product.user_id, product.title, product.description, product.price, product.category, product.brand, product.model, product.condition, product.type, product.images, product.views, product.likes, product.is_top, product.is_featured]
      );
    }
    console.log('  ✅ 8 个测试商品\n');

    console.log('🎉 数据库初始化完成！');
    console.log('\n📊 数据统计：');
    const [userCount] = await connection.query('SELECT COUNT(*) as count FROM users');
    const [productCount] = await connection.query('SELECT COUNT(*) as count FROM products');
    console.log(`   - 用户数：${userCount[0].count}`);
    console.log(`   - 商品数：${productCount[0].count}`);

  } catch (error) {
    console.error('❌ 初始化失败：', error.message);
    throw error;
  } finally {
    await connection.end();
    console.log('\n🔌 数据库连接已关闭');
  }
}

initDatabase().catch(console.error);
