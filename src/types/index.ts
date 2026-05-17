// Product types
export type ProductCategory = 'rangefinder' | 'slr' | 'tlr' | 'point-and-shoot' | 'film' | 'lens' | 'accessory';
export type Condition = 'N' | '9.5' | '9' | '8' | '7' | 'P';
export type ListingType = 'sell' | 'swap' | 'both';

// Supabase 数据库类型
export interface DbUser {
  id: string;
  email: string;
  nickname: string | null;
  avatar_url: string | null;
  phone: string | null;
  seller_level: 'normal' | 'verified' | 'premium';
  created_at: string;
  updated_at: string;
}

export interface DbProduct {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  price: number | null;
  category: string;
  condition: string;
  type: 'sell' | 'swap' | 'both';
  images: string[];
  views: number;
  is_top: boolean;
  status: 'active' | 'sold' | 'hidden';
  created_at: string;
  updated_at: string;
}

export interface DbSwapRequest {
  id: string;
  product_id: string;
  requester_id: string;
  message: string | null;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
}

export interface DbFavorite {
  id: string;
  user_id: string;
  product_id: string;
  created_at: string;
}

// 本地展示类型（兼容前端组件）
export interface Seller {
  id: string;
  name: string;
  avatar: string;
  rating: number;
  reviewCount: number;
  badge: 'none' | 'verified' | 'premium';
  location: string;
  joinedYear: number;
}

export interface Product {
  id: string;
  title: string;
  brand: string;
  model: string;
  category: ProductCategory;
  condition: Condition;
  price: number;
  swapFor?: string;
  listingType: ListingType;
  images: string[];
  description: string;
  tags: string[];
  seller: Seller;
  views: number;
  likes: number;
  createdAt: string;
  isTopListed: boolean;
  isFeatured: boolean;
}

export interface SwapRequest {
  id: string;
  user: Seller;
  offering: string;
  offeringImage: string;
  wantedCategory: ProductCategory[];
  wantedDescription: string;
  createdAt: string;
  status: 'open' | 'matched' | 'completed';
}

export type NavPage = 'home' | 'discover' | 'detail' | 'swap' | 'post' | 'profile' | 'auth' | 'orders' | 'notifications' | 'chat-list' | 'chat-room' | 'edit' | 'search';

// ==================== 用户设置类型 ====================

// 收货地址
export interface UserAddress {
  id: number;
  user_id: string;
  name: string;
  phone: string;
  province: string;
  city: string;
  district: string;
  detail: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

// 支付方式
export type PaymentType = 'wechat' | 'alipay' | 'bank_card';

export interface UserPaymentMethod {
  id: number;
  user_id: string;
  type: PaymentType;
  qr_code_url: string;
  bank_name: string;
  bank_account_encrypted: string;
  account_name: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

// 通知设置
export interface NotificationSettings {
  id: number;
  user_id: string;
  order_update: boolean;
  price_alert: boolean;
  message: boolean;
  system: boolean;
  created_at: string;
  updated_at: string;
}
