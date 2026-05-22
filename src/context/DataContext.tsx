import React, { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import type { Product, SwapRequest, Seller } from '../types';
import { products as initialProducts, swapRequests as initialSwapRequests, sellers } from '../data/mockData';
import { getProducts, getUserCredit, type ApiProduct } from '../lib/api';
import type { ApiUser } from '../lib/api';

// ApiProduct → Product 格式转换
function apiToProduct(p: ApiProduct): Product {
  return {
    id: p.id,
    title: p.title,
    brand: p.brand,
    model: p.model,
    category: p.category as any,
    condition: p.condition as any,
    price: p.price,
    listingType: p.listingType,
    images: Array.isArray(p.images) ? p.images : (typeof p.images === 'string' ? (() => { try { return JSON.parse(p.images as any); } catch { return [p.images as any]; } })() : []),
    description: p.description,
    tags: Array.isArray(p.tags) ? p.tags : (typeof p.tags === 'string' ? (() => { try { return JSON.parse(p.tags as any); } catch { return []; } })() : []),
    views: p.views,
    likes: p.likes,
    createdAt: p.createdAt,
    isTopListed: p.isTopListed,
    isFeatured: p.isFeatured,
    seller: {
      id: p.seller.id,
      name: p.seller.name,
      avatar: p.seller.avatar,
      badge: (p.seller.level as any) || 'none',
      rating: 5.0,
      reviewCount: 0,
      location: '',
      joinedYear: new Date().getFullYear(),
    },
  };
}

interface AppState {
  // 商品列表
  products: Product[];
  addProduct: (product: Omit<Product, 'id' | 'views' | 'likes' | 'createdAt'>) => Product;
  updateProduct: (id: string, updates: Partial<Product>) => void;
  deleteProduct: (id: string) => void;
  
  // 换物请求
  swapRequests: SwapRequest[];
  addSwapRequest: (request: Omit<SwapRequest, 'id' | 'createdAt' | 'status'>) => SwapRequest;
  
  // 收藏
  favorites: string[];
  toggleFavorite: (productId: string) => void;
  isFavorite: (productId: string) => boolean;
  
  // 当前登录用户（mock）
  currentUser: Seller | null;
  login: (user: Seller) => void;
  logout: () => void;
  updateAvatar: (avatar: string) => void;
  syncWithAuthUser: (authUser: import('../lib/api').ApiUser | null) => Promise<void>;
}

const DataContext = createContext<AppState | null>(null);

// 生成唯一 ID
const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

export function DataProvider({ children }: { children: ReactNode }) {
  // 商品列表状态（先用 mock 渲染，API 数据回来后替换）
  const [products, setProducts] = useState<Product[]>(initialProducts);
  
  // 从真实 API 拉取商品数据，与 mock 数据合并（保留 mock 中独有的产品如 CCD）
  useEffect(() => {
    getProducts({ limit: 50, sort: 'newest' })
      .then(res => {
        if (res.products && res.products.length > 0) {
          const apiProducts = res.products.map(apiToProduct);
          const apiIds = new Set(apiProducts.map(p => p.id));
          // 保留 mock 中 API 没有的产品（如 CCD 相机）
          const mockOnlyProducts = initialProducts.filter(p => !apiIds.has(p.id));
          setProducts([...apiProducts, ...mockOnlyProducts]);
        }
      })
      .catch(() => {
        // API 不可用，保持 mock 数据
      });
  }, []);
  
  // 换物请求状态
  const [swapRequests, setSwapRequests] = useState<SwapRequest[]>(initialSwapRequests);
  
  // 收藏列表
  const [favorites, setFavorites] = useState<string[]>([]);
  
  // 当前登录用户 (默认 null 表示未登录)
  const [currentUser, setCurrentUser] = useState<Seller | null>(null);

  // 从 AuthContext 同步用户数据（字段名映射：nickname → name, avatar_url → avatar）
  const syncWithAuthUser = useCallback(async (authUser: ApiUser | null) => {
    if (!authUser) {
      setCurrentUser(null);
      return;
    }

    // 如果已有所需的 rating/reviewCount 则直接使用，否则用默认值
    let rating = 5.0;
    let reviewCount = 0;

    try {
      const credit = await getUserCredit(authUser.id);
      rating = credit.overallCredit.avgRating;
      reviewCount = credit.overallCredit.reviewCount;
    } catch {
      // 忽略错误，使用默认值
    }

    setCurrentUser({
      id: String(authUser.id),
      name: authUser.nickname || authUser.email?.split('@')[0] || '用户',
      avatar: authUser.avatar_url || (authUser as any).avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(authUser.email || String(authUser.id))}&backgroundColor=8B2323,DAA520&textColor=ffffff`,
      rating,
      reviewCount,
      badge: (authUser.seller_level as any) || 'none',
      location: (authUser as any).location || '',
      joinedYear: (authUser as any).joined_year || new Date().getFullYear(),
    });
  }, []);

  // 添加商品
  const addProduct = useCallback((product: Omit<Product, 'id' | 'views' | 'likes' | 'createdAt'>): Product => {
    const newProduct: Product = {
      ...product,
      id: generateId(),
      views: 0,
      likes: 0,
      createdAt: new Date().toISOString().split('T')[0],
    };
    setProducts(prev => [newProduct, ...prev]);
    return newProduct;
  }, []);

  // 更新商品
  const updateProduct = useCallback((id: string, updates: Partial<Product>) => {
    setProducts(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
  }, []);

  // 删除商品
  const deleteProduct = useCallback((id: string) => {
    setProducts(prev => prev.filter(p => p.id !== id));
  }, []);

  // 添加换物请求
  const addSwapRequest = useCallback((request: Omit<SwapRequest, 'id' | 'createdAt' | 'status'>): SwapRequest => {
    const newRequest: SwapRequest = {
      ...request,
      id: generateId(),
      createdAt: new Date().toISOString().split('T')[0],
      status: 'open',
    };
    setSwapRequests(prev => [newRequest, ...prev]);
    return newRequest;
  }, []);

  // 切换收藏
  const toggleFavorite = useCallback((productId: string) => {
    setFavorites(prev => 
      prev.includes(productId) 
        ? prev.filter(id => id !== productId)
        : [...prev, productId]
    );
  }, []);

  // 检查是否已收藏
  const isFavorite = useCallback((productId: string) => {
    return favorites.includes(productId);
  }, [favorites]);

  // 登录
  const login = useCallback((user: Seller) => {
    setCurrentUser(user);
  }, []);

  // 登出
  const logout = useCallback(() => {
    setCurrentUser(null); // 退出登录
  }, []);

  // 更新头像（AuthContext 更新后同步调用）
  const updateAvatar = useCallback((avatar: string) => {
    setCurrentUser(prev => prev ? { ...prev, avatar } : null);
  }, []);

  const value: AppState = {
    products,
    addProduct,
    updateProduct,
    deleteProduct,
    swapRequests,
    addSwapRequest,
    favorites,
    toggleFavorite,
    isFavorite,
    currentUser,
    login,
    logout,
    updateAvatar,
    syncWithAuthUser,
  };

  return (
    <DataContext.Provider value={value}>
      {children}
    </DataContext.Provider>
  );
}

export function useAppData() {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useAppData must be used within DataProvider');
  }
  return context;
}
