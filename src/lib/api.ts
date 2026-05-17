import type { UserAddress, UserPaymentMethod, NotificationSettings, PaymentType } from '../types';

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export interface ApiUser {
  id: number;
  email: string;
  nickname: string;
  avatar?: string;
  avatar_url?: string;
  wechat_qr?: string;
  seller_level: 'normal' | 'verified' | 'premium';
  created_at: string;
}

export interface AuthResponse {
  token: string;
  user: ApiUser;
}

export interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}

// 获取 JWT token
export function getToken(): string | null {
  return localStorage.getItem('fm_token');
}

export function setToken(token: string): void {
  localStorage.setItem('fm_token', token);
}

export function removeToken(): void {
  localStorage.removeItem('fm_token');
}

// 通用请求封装
async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, { ...options, headers });
  } catch {
    throw new Error('网络连接失败，请检查网络后重试');
  }

  // 安全解析 JSON，避免服务器返回 HTML 时崩溃
  const text = await res.text();
  let json: any;
  try {
    json = JSON.parse(text);
  } catch {
    // 返回的不是 JSON（如 HTML 错误页），给出友好提示
    if (res.status === 401) throw new Error('请先登录');
    if (res.status === 403) throw new Error('没有权限');
    if (res.status === 404) throw new Error('资源不存在');
    throw new Error(`服务暂时不可用 (${res.status})`);
  }

  if (!res.ok) {
    throw new Error(json.error || json.message || '请求失败');
  }

  return json as T;
}

// 注册
export async function register(email: string, password: string, nickname: string): Promise<AuthResponse> {
  return request<AuthResponse>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password, nickname }),
  });
}

// 登录
export async function login(email: string, password: string): Promise<AuthResponse> {
  return request<AuthResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

// 获取当前用户资料
export async function getProfile(): Promise<ApiUser> {
  // 后端直接返回用户对象（rows[0]），不是 { user: ... } 包装格式
  return request<ApiUser>('/api/auth/me');
}

// 更新资料
export async function updateProfile(updates: Partial<ApiUser & { avatar_url?: string; phone?: string }>): Promise<ApiUser> {
  // 后端直接返回用户对象（rows[0]），不是 { user: ... } 包装格式
  return request<ApiUser>('/api/auth/me', {
    method: 'PUT',
    body: JSON.stringify(updates),
  });
}

// ==================== 商品 API ====================

export interface ApiProduct {
  id: string;
  title: string;
  brand: string;
  model: string;
  category: string;
  condition: string;
  price: number;
  listingType: 'sell' | 'swap' | 'both';
  images: string[];
  description: string;
  tags: string[];
  views: number;
  likes: number;
  createdAt: string;
  isTopListed: boolean;
  isFeatured: boolean;
  seller: {
    id: string;
    name: string;
    avatar: string;
    level: string;
  };
}

export interface ProductsResponse {
  products: ApiProduct[];
  total: number;
  page: number;
  limit: number;
}

// 获取商品列表
export async function getProducts(params: {
  category?: string;
  type?: string;
  page?: number;
  limit?: number;
  sort?: string;
  q?: string;
} = {}): Promise<ProductsResponse> {
  const search = new URLSearchParams();
  if (params.category) search.set('category', params.category);
  if (params.type) search.set('type', params.type);
  if (params.page) search.set('page', String(params.page));
  if (params.limit) search.set('limit', String(params.limit));
  if (params.sort) search.set('sort', params.sort);
  if (params.q) search.set('q', params.q);
  const qs = search.toString();
  return request<ProductsResponse>(`/api/products${qs ? '?' + qs : ''}`);
}

// 获取我的商品
export async function getMyProducts(userId: string | number): Promise<ApiProduct[]> {
  return request<ApiProduct[]>(`/api/users/${userId}/products`);
}

// 发布商品
export async function createProduct(data: {
  title: string;
  description: string;
  price: number;
  category: string;
  brand: string;
  model: string;
  condition: string;
  type: 'sell' | 'swap' | 'both';
  images: string[];
  tags?: string[];
}): Promise<ApiProduct> {
  return request<ApiProduct>('/api/products', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// 删除商品
export async function deleteProduct(productId: string): Promise<void> {
  return request<void>(`/api/products/${productId}`, { method: 'DELETE' });
}

// 更新商品
export async function updateProduct(
  productId: string,
  data: {
    title?: string;
    description?: string;
    price?: number;
    category?: string;
    brand?: string;
    model?: string;
    condition?: string;
    type?: 'sell' | 'swap' | 'both';
    images?: string[];
    tags?: string[];
  }
): Promise<ApiProduct> {
  return request<ApiProduct>(`/api/products/${productId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

// ==================== 收藏 API ====================

// 获取我的收藏列表
export async function getMyFavorites(userId: string | number): Promise<ApiProduct[]> {
  return request<ApiProduct[]>(`/api/users/${userId}/favorites`);
}

// 添加收藏
export async function addFavorite(productId: string): Promise<{ success: boolean; id: string }> {
  return request('/api/favorites', {
    method: 'POST',
    body: JSON.stringify({ product_id: productId }),
  });
}

// 取消收藏
export async function removeFavorite(productId: string): Promise<void> {
  return request(`/api/favorites/${productId}`, { method: 'DELETE' });
}

// 检查是否已收藏
export async function checkFavorite(productId: string): Promise<{ favorited: boolean }> {
  return request(`/api/favorites/${productId}/check`);
}

// ==================== 订单 API ====================

export type OrderStatus = 'pending' | 'paid' | 'confirmed' | 'cancelled' | 'refunded';

export interface ApiOrder {
  id: string;
  product_id: string;
  buyer_id: string;
  seller_id: string;
  amount: number;
  status: OrderStatus;
  buyer_name: string;
  buyer_phone: string;
  buyer_address: string;
  buyer_note?: string;
  created_at: string;
  updated_at: string;
  paid_at?: string;
  confirmed_at?: string;
  // 关联数据（JOIN 查询结果）
  product_title?: string;
  product_images?: string;
  product_price?: number;
  buyer_nickname?: string;
  buyer_avatar?: string;
  seller_nickname?: string;
  seller_avatar?: string;
  seller_wechat_qr?: string;
}

// 创建订单
export async function createOrder(data: {
  product_id: string;
  buyer_name: string;
  buyer_phone: string;
  buyer_address: string;
  buyer_note?: string;
}): Promise<ApiOrder> {
  return request<ApiOrder>('/api/orders', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// 获取我的订单（type=buy 买家视角，type=sell 卖家视角）
export async function getOrders(type: 'buy' | 'sell'): Promise<ApiOrder[]> {
  return request<ApiOrder[]>(`/api/orders?type=${type}`);
}

// 买家点击"我已付款"
export async function markOrderPaid(orderId: string): Promise<ApiOrder> {
  return request<ApiOrder>(`/api/orders/${orderId}/paid`, { method: 'PUT' });
}

// 卖家确认收款
export async function confirmOrder(orderId: string): Promise<ApiOrder> {
  return request<ApiOrder>(`/api/orders/${orderId}/confirm`, { method: 'PUT' });
}

// 取消订单
export async function cancelOrder(orderId: string): Promise<ApiOrder> {
  return request<ApiOrder>(`/api/orders/${orderId}/cancel`, { method: 'PUT' });
}

// 上传微信收款码
export async function uploadWechatQR(url: string): Promise<ApiUser> {
  return request<ApiUser>('/api/auth/wechat-qr', {
    method: 'PUT',
    body: JSON.stringify({ wechat_qr: url }),
  });
}

// 上传文件（FormData，不走 JSON Content-Type）
export async function uploadFile(file: File): Promise<{ url: string }> {
  const token = getToken();
  const formData = new FormData();
  formData.append('file', file);

  let res: Response;
  try {
    res = await fetch(`${BASE}/api/upload`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });
  } catch {
    throw new Error('网络连接失败，请检查网络后重试');
  }

  const text = await res.text();
  let json: any;
  try {
    json = JSON.parse(text);
  } catch {
    if (res.status === 401) throw new Error('请先登录');
    throw new Error('上传服务暂时不可用 (' + res.status + ')');
  }

  if (!res.ok) throw new Error(json.error || '上传失败');
  return json as { url: string };
}

// 获取卖家联系方式（需登录）
export interface SellerContact {
  id: string;
  nickname: string;
  avatar_url: string;
  seller_level: 'normal' | 'verified' | 'premium';
  wechat_qr: string;
  joined_year: number;
}

export async function getSellerContact(sellerId: string): Promise<SellerContact> {
  return request<SellerContact>(`/api/users/${sellerId}/contact`);
}

// 运行数据库迁移（首次部署后调用一次）
export async function runMigration(): Promise<{ ok: boolean; message: string }> {
  return request('/api/admin/migrate', { method: 'POST' });
}

// ==================== 评价 API ====================

export interface ApiReview {
  id: string;
  order_id: string;
  product_id: string;
  reviewer_id: string;
  reviewee_id: string;
  rating: number;
  content: string;
  created_at: string;
  reviewer_nickname?: string;
  reviewer_avatar?: string;
  product_title?: string;
  reviewee_avg_rating?: number;
  reviewee_review_count?: number;
}

export interface ReviewsResponse {
  reviews: ApiReview[];
  avgRating: number;
  reviewCount: number;
}



// ==================== 通知 API ====================

export interface ApiNotification {
  id: string;
  user_id: string;
  type: 'order_created' | 'order_paid' | 'order_confirmed' | 'order_cancelled' | 'review_received';
  title: string;
  content: string;
  data: {
    orderId?: string;
    productId?: string;
    reviewId?: string;
    [key: string]: any;
  };
  is_read: boolean;
  created_at: string;
}

export interface NotificationsResponse {
  notifications: ApiNotification[];
  unreadCount: number;
  total: number;
  page: number;
  limit: number;
}

// 获取通知列表
export async function getNotifications(page = 1, limit = 20): Promise<NotificationsResponse> {
  return request<NotificationsResponse>(`/api/notifications?page=${page}&limit=${limit}`);
}

// 获取未读通知数量
export async function getUnreadCount(): Promise<{ unreadCount: number }> {
  return request<{ unreadCount: number }>('/api/notifications/count');
}

// 标记单条通知为已读
export async function markNotificationRead(id: string): Promise<{ success: boolean }> {
  return request<{ success: boolean }>(`/api/notifications/${id}/read`, { method: 'PUT' });
}

// 标记所有通知为已读
export async function markAllNotificationsRead(): Promise<{ success: boolean }> {
  return request<{ success: boolean }>('/api/notifications/read-all', { method: 'PUT' });
}

// 删除通知
export async function deleteNotification(id: string): Promise<{ success: boolean }> {
  return request<{ success: boolean }>(`/api/notifications/${id}`, { method: 'DELETE' });
}

// ==================== 聊天/私信 API ====================

export interface ChatUser {
  id: string;
  nickname: string;
  avatar?: string;
}

export interface ChatProduct {
  id: string;
  title: string;
  images: string[];
  price: number;
}

export interface Conversation {
  id: string;
  otherUser: ChatUser;
  product: ChatProduct | null;
  lastMessage: string | null;
  lastMessageAt: string | null;
  unreadCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  sender: ChatUser;
  content: string;
  type: 'text' | 'image';
  isRead: boolean;
  createdAt: string;
}

export interface MessagesResponse {
  messages: ChatMessage[];
  total: number;
  page: number;
  limit: number;
}

// 获取对话列表
export async function getConversations(): Promise<Conversation[]> {
  return request<Conversation[]>('/api/conversations');
}

// 获取未读消息数
export async function getUnreadMessageCount(): Promise<{ unreadCount: number }> {
  return request<{ unreadCount: number }>('/api/conversations/unread-count');
}

// 创建或获取对话
export async function getOrCreateConversation(
  targetUserId: string,
  productId?: string,
  initialMessage?: string
): Promise<Conversation> {
  return request<Conversation>('/api/conversations', {
    method: 'POST',
    body: JSON.stringify({ targetUserId, productId, initialMessage }),
  });
}

// 获取对话详情
export async function getConversation(id: string): Promise<Conversation> {
  return request<Conversation>(`/api/conversations/${id}`);
}

// 获取消息列表
export async function getMessages(
  conversationId: string,
  page = 1,
  limit = 50
): Promise<MessagesResponse> {
  return request<MessagesResponse>(
    `/api/conversations/${conversationId}/messages?page=${page}&limit=${limit}`
  );
}

// 发送消息
export async function sendMessage(
  conversationId: string,
  content: string,
  type: 'text' | 'image' = 'text'
): Promise<ChatMessage> {
  return request<ChatMessage>(
    `/api/conversations/${conversationId}/messages`,
    {
      method: 'POST',
      body: JSON.stringify({ content, type }),
    }
  );
}

// 标记消息已读
export async function markConversationRead(conversationId: string): Promise<{ success: boolean }> {
  return request<{ success: boolean }>(
    `/api/conversations/${conversationId}/read`,
    { method: 'PUT' }
  );
}

// 删除对话
export async function deleteConversation(conversationId: string): Promise<{ success: boolean }> {
  return request<{ success: boolean }>(
    `/api/conversations/${conversationId}`,
    { method: 'DELETE' }
  );
}

// ==================== 换物请求 API ====================

export interface SwapRequest {
  id: string;
  offering: string;
  offeringImage: string;
  wantedCategory: string[];
  wantedDescription: string;
  status: 'open' | 'accepted' | 'rejected';
  createdAt: string;
  user: {
    id: string;
    name: string;
    avatar: string;
    badge: 'none' | 'verified' | 'premium';
    rating: number;
    reviewCount: number;
    location: string;
    joinedYear: number;
  };
}

// 获取全部换物请求列表
export async function getSwaps(): Promise<SwapRequest[]> {
  return request<SwapRequest[]>('/api/swaps');
}

// 创建换物请求
export async function createSwap(data: {
  product_id?: string;
  offering: string;
  offering_image?: string;
  wanted_category: string[];
  wanted_description: string;
  message?: string;
}): Promise<SwapRequest> {
  return request<SwapRequest>('/api/swaps', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// 更新换物请求状态（接受/拒绝）
export async function updateSwap(
  id: string,
  status: 'accepted' | 'rejected'
): Promise<{ success: boolean }> {
  return request<{ success: boolean }>(`/api/swaps/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ status }),
  });
}

// ==================== 双向信用评价 API ====================

export interface CreditStats {
  avgRating: number;
  reviewCount: number;
}

export interface UserCredit {
  sellerCredit: CreditStats;
  buyerCredit: CreditStats;
  overallCredit: CreditStats;
}

// 获取用户双向信用评分
export async function getUserCredit(userId: string | number): Promise<UserCredit> {
  return request<UserCredit>(`/api/users/${userId}/credit`);
}

// 获取订单的双向评价状态
export async function getOrderReviews(orderId: string): Promise<{
  buyerReview: ApiReview | null;
  sellerReview: ApiReview | null;
}> {
  return request(`/api/orders/${orderId}/reviews`);
}

// 创建评价（支持双向）
export async function createReview(data: {
  order_id: string;
  rating: number;
  content?: string;
  role: 'buyer_to_seller' | 'seller_to_buyer';
}): Promise<ApiReview & { reviewee_avg_rating: number; reviewee_review_count: number }> {
  return request('/api/reviews', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// ==================== 收货地址管理 API ====================

// 获取用户地址列表
export async function getAddresses(): Promise<UserAddress[]> {
  return request<UserAddress[]>('/api/addresses');
}

// 添加新地址
export async function addAddress(data: {
  name: string;
  phone: string;
  province: string;
  city: string;
  district: string;
  detail: string;
  is_default?: boolean;
}): Promise<UserAddress> {
  return request<UserAddress>('/api/addresses', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// 更新地址
export async function updateAddress(
  id: number,
  data: {
    name: string;
    phone: string;
    province: string;
    city: string;
    district: string;
    detail: string;
    is_default?: boolean;
  }
): Promise<UserAddress> {
  return request<UserAddress>(`/api/addresses/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

// 删除地址
export async function deleteAddress(id: number): Promise<{ success: boolean }> {
  return request<{ success: boolean }>(`/api/addresses/${id}`, {
    method: 'DELETE',
  });
}

// 设置默认地址
export async function setDefaultAddress(id: number): Promise<{ success: boolean }> {
  return request<{ success: boolean }>(`/api/addresses/${id}/default`, {
    method: 'PUT',
  });
}

// ==================== 支付方式管理 API ====================

// 获取用户支付方式列表
export async function getPaymentMethods(): Promise<UserPaymentMethod[]> {
  return request<UserPaymentMethod[]>('/api/payment-methods');
}

// 添加支付方式
export async function addPaymentMethod(data: {
  type: PaymentType;
  qr_code_url?: string;
  bank_name?: string;
  bank_account_encrypted?: string;
  account_name?: string;
  is_default?: boolean;
}): Promise<UserPaymentMethod> {
  return request<UserPaymentMethod>('/api/payment-methods', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// 更新支付方式
export async function updatePaymentMethod(
  id: number,
  data: {
    type: PaymentType;
    qr_code_url?: string;
    bank_name?: string;
    bank_account_encrypted?: string;
    account_name?: string;
    is_default?: boolean;
  }
): Promise<UserPaymentMethod> {
  return request<UserPaymentMethod>(`/api/payment-methods/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

// 删除支付方式
export async function deletePaymentMethod(id: number): Promise<{ success: boolean }> {
  return request<{ success: boolean }>(`/api/payment-methods/${id}`, {
    method: 'DELETE',
  });
}

// 设置默认支付方式
export async function setDefaultPaymentMethod(id: number): Promise<{ success: boolean }> {
  return request<{ success: boolean }>(`/api/payment-methods/${id}/default`, {
    method: 'PUT',
  });
}

// ==================== 通知设置管理 API ====================

// 获取通知设置
export async function getNotificationSettings(): Promise<NotificationSettings> {
  return request<NotificationSettings>('/api/notification-settings');
}

// 更新通知设置
export async function updateNotificationSettings(data: {
  order_update?: boolean;
  price_alert?: boolean;
  message?: boolean;
  system?: boolean;
}): Promise<NotificationSettings> {
  return request<NotificationSettings>('/api/notification-settings', {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

// ==================== 搜索 API ====================

// 获取热门搜索词
export async function getHotSearchTerms(): Promise<string[]> {
  const res = await request<{ hot: string[] }>('/api/search/hot');
  return res.hot;
}
