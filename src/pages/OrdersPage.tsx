import { useState, useEffect, useCallback } from 'react';
import {
  ShoppingBag, Package, Clock, CheckCircle2, XCircle,
  ChevronLeft, Loader2, RefreshCw, QrCode, Star, MessageSquare, User
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import {
  getOrders, confirmOrder, cancelOrder, getOrderReviews, createReview,
  type ApiOrder, type OrderStatus, type ApiReview
} from '../lib/api';
import ReviewModal from '../components/ReviewModal';
import type { NavPage } from '../types';

interface OrdersPageProps {
  onBack: () => void;
  onNavigate: (page: NavPage) => void;
}

const statusConfig: Record<OrderStatus, { label: string; color: string; icon: React.ReactNode }> = {
  pending: { label: '待付款', color: 'text-amber-film', icon: <Clock className="w-4 h-4" /> },
  paid: { label: '待确认', color: 'text-blue-600', icon: <Loader2 className="w-4 h-4 animate-spin" /> },
  confirmed: { label: '已完成', color: 'text-film-green', icon: <CheckCircle2 className="w-4 h-4" /> },
  cancelled: { label: '已取消', color: 'text-film-red', icon: <XCircle className="w-4 h-4" /> },
  refunded: { label: '已退款', color: 'text-film-red', icon: <XCircle className="w-4 h-4" /> },
};

function parseImages(raw: string | string[] | undefined): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try { return JSON.parse(raw); } catch { return [raw]; }
}

function OrderCard({
  order,
  view,
  onConfirm,
  onCancel,
  onShowQR,
  onReview,
  reviews,
}: {
  order: ApiOrder;
  view: 'buy' | 'sell';
  onConfirm: (id: string) => void;
  onCancel: (id: string) => void;
  onShowQR: (qr: string) => void;
  onReview: (order: ApiOrder, role: 'buyer_to_seller' | 'seller_to_buyer') => void;
  reviews?: { buyerReview: ApiReview | null; sellerReview: ApiReview | null };
}) {
  const images = parseImages(order.product_images);
  const status = statusConfig[order.status] || statusConfig.pending;
  const [acting, setActing] = useState(false);

  // 买家评价卖家
  const buyerReview = reviews?.buyerReview;
  // 卖家评价买家
  const sellerReview = reviews?.sellerReview;

  const doAction = async (fn: () => void) => {
    if (acting) return;
    setActing(true);
    try { await fn(); } finally { setActing(false); }
  };

  const renderStars = (rating: number) => (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`w-3.5 h-3.5 ${
            star <= rating ? 'fill-amber-film text-amber-film' : 'text-paper-dark'
          }`}
        />
      ))}
    </div>
  );

  return (
    <div className="bg-paper border-2 border-paper-dark hover:border-ink transition-colors">
      {/* Order header */}
      <div className="flex items-center justify-between px-4 py-2 bg-paper-warm border-b border-paper-dark">
        <span className="font-mono text-xs text-ink-muted">#{order.id.slice(0, 8).toUpperCase()}</span>
        <span className={`flex items-center gap-1 text-xs font-sans font-semibold ${status.color}`}>
          {status.icon} {status.label}
        </span>
      </div>

      <div className="p-4">
        {/* Product info */}
        <div className="flex gap-3 mb-4">
          <img
            src={images[0] || '/images/placeholder.png'}
            alt={order.product_title || '商品'}
            className="w-16 h-16 object-cover flex-shrink-0 border border-paper-dark"
            onError={e => { (e.target as HTMLImageElement).src = '/images/placeholder.png'; }}
          />
          <div className="flex-1 min-w-0">
            <p className="font-sans font-semibold text-sm text-ink line-clamp-1 mb-0.5">
              {order.product_title || '商品'}
            </p>
            <p className="font-display text-amber-film text-lg">¥{(order.amount || 0).toLocaleString()}</p>
            <p className="font-sans text-xs text-ink-muted mt-0.5">
              {view === 'buy' ? `卖家：${order.seller_nickname || '—'}` : `买家：${order.buyer_nickname || '—'}`}
            </p>
          </div>
        </div>

        {/* Delivery info (buy view) */}
        {view === 'buy' && (
          <div className="bg-paper-warm border border-paper-dark p-3 mb-3 text-xs font-sans space-y-1">
            <div className="flex gap-2">
              <span className="text-ink-muted w-14 flex-shrink-0">收货人</span>
              <span className="text-ink">{order.buyer_name}</span>
            </div>
            <div className="flex gap-2">
              <span className="text-ink-muted w-14 flex-shrink-0">手机号</span>
              <span className="text-ink">{order.buyer_phone}</span>
            </div>
            <div className="flex gap-2">
              <span className="text-ink-muted w-14 flex-shrink-0">地址</span>
              <span className="text-ink">{order.buyer_address}</span>
            </div>
            {order.buyer_note && (
              <div className="flex gap-2">
                <span className="text-ink-muted w-14 flex-shrink-0">备注</span>
                <span className="text-ink">{order.buyer_note}</span>
              </div>
            )}
          </div>
        )}

        {/* Seller view: buyer info */}
        {view === 'sell' && (
          <div className="bg-paper-warm border border-paper-dark p-3 mb-3 text-xs font-sans space-y-1">
            <div className="flex gap-2">
              <span className="text-ink-muted w-14 flex-shrink-0">收货人</span>
              <span className="text-ink">{order.buyer_name}</span>
            </div>
            <div className="flex gap-2">
              <span className="text-ink-muted w-14 flex-shrink-0">手机号</span>
              <span className="text-ink">{order.buyer_phone}</span>
            </div>
            <div className="flex gap-2">
              <span className="text-ink-muted w-14 flex-shrink-0">地址</span>
              <span className="text-ink">{order.buyer_address}</span>
            </div>
          </div>
        )}

        {/* 已完成订单的双向评价状态 */}
        {order.status === 'confirmed' && (
          <div className="bg-paper-warm border border-paper-dark p-3 mb-3">
            <div className="flex items-center gap-4 text-xs font-sans">
              {/* 买家→卖家 */}
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-3.5 h-3.5 text-ink-muted" />
                <span className="text-ink-muted">评价卖家</span>
                {buyerReview ? (
                  <div className="flex items-center gap-1">
                    {renderStars(buyerReview.rating)}
                    <span className="text-xs text-ink-muted">已评</span>
                  </div>
                ) : (
                  <button
                    onClick={() => onReview(order, 'buyer_to_seller')}
                    className="text-xs text-amber-film hover:underline"
                  >
                    去评价
                  </button>
                )}
              </div>
              {/* 卖家→买家 */}
              <div className="flex items-center gap-2">
                <User className="w-3.5 h-3.5 text-ink-muted" />
                <span className="text-ink-muted">评价买家</span>
                {sellerReview ? (
                  <div className="flex items-center gap-1">
                    {renderStars(sellerReview.rating)}
                    <span className="text-xs text-ink-muted">已评</span>
                  </div>
                ) : (
                  <button
                    onClick={() => onReview(order, 'seller_to_buyer')}
                    className="text-xs text-amber-film hover:underline"
                  >
                    去评价
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          {/* 买家：待付款时可查看收款码 */}
          {view === 'buy' && order.status === 'pending' && order.seller_wechat_qr && (
            <button
              onClick={() => onShowQR(order.seller_wechat_qr!)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 border-2 border-amber-film text-amber-film text-sm font-sans font-semibold hover:bg-amber-film/5 transition-colors cursor-pointer"
            >
              <QrCode className="w-4 h-4" /> 查看收款码
            </button>
          )}

          {/* 买家：已付款/待确认时显示等待 */}
          {view === 'buy' && order.status === 'paid' && (
            <div className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-paper-warm border border-paper-dark text-ink-muted text-sm font-sans">
              <Loader2 className="w-4 h-4 animate-spin" /> 等待卖家确认收款
            </div>
          )}

          {/* 买家：待付款可取消 */}
          {view === 'buy' && order.status === 'pending' && (
            <button
              onClick={() => doAction(() => onCancel(order.id))}
              disabled={acting}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 border-2 border-paper-dark text-ink-muted text-sm font-sans hover:border-film-red hover:text-film-red transition-colors cursor-pointer disabled:opacity-60"
            >
              {acting ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
              取消订单
            </button>
          )}

          {/* 卖家：买家已付款，可确认收款 */}
          {view === 'sell' && order.status === 'paid' && (
            <button
              onClick={() => doAction(() => onConfirm(order.id))}
              disabled={acting}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-ink text-paper text-sm font-sans font-semibold hover:bg-ink/80 transition-colors cursor-pointer disabled:opacity-60"
            >
              {acting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              确认收款，完成交易
            </button>
          )}

          {/* 卖家：待付款可取消 */}
          {view === 'sell' && order.status === 'pending' && (
            <button
              onClick={() => doAction(() => onCancel(order.id))}
              disabled={acting}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 border-2 border-paper-dark text-ink-muted text-sm font-sans hover:border-film-red hover:text-film-red transition-colors cursor-pointer disabled:opacity-60"
            >
              {acting ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
              取消订单
            </button>
          )}

          {/* 已完成 */}
          {order.status === 'confirmed' && (
            <div className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-film-green/10 border border-film-green/30 text-film-green text-sm font-sans font-semibold">
              <CheckCircle2 className="w-4 h-4" /> 交易已完成
            </div>
          )}

          {/* 已取消/退款 */}
          {(order.status === 'cancelled' || order.status === 'refunded') && (
            <div className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-paper-warm border border-paper-dark text-ink-muted text-sm font-sans">
              <XCircle className="w-4 h-4" /> 订单已关闭
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function OrdersPage({ onBack, onNavigate }: OrdersPageProps) {
  const { isAuthenticated } = useAuth();
  const [view, setView] = useState<'buy' | 'sell'>('buy');
  const [orders, setOrders] = useState<ApiOrder[]>([]);
  const [orderReviews, setOrderReviews] = useState<Record<string, { buyerReview: ApiReview | null; sellerReview: ApiReview | null }>>({});
  const [loading, setLoading] = useState(false);
  const [qrModal, setQrModal] = useState<string | null>(null);
  const [reviewModal, setReviewModal] = useState<{ order: ApiOrder; role: 'buyer_to_seller' | 'seller_to_buyer' } | null>(null);
  const [reviewLoading, setReviewLoading] = useState(false);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getOrders(view);
      setOrders(data);

      // 获取已完成的订单的双向评价状态
      const confirmedOrders = data.filter(o => o.status === 'confirmed');
      const reviewPromises = confirmedOrders.map(async (order) => {
        try {
          const reviews = await getOrderReviews(order.id);
          return { orderId: order.id, reviews };
        } catch {
          return { orderId: order.id, reviews: { buyerReview: null, sellerReview: null } };
        }
      });
      const results = await Promise.all(reviewPromises);
      const reviewMap: Record<string, { buyerReview: ApiReview | null; sellerReview: ApiReview | null }> = {};
      results.forEach(({ orderId, reviews }) => {
        reviewMap[orderId] = reviews;
      });
      setOrderReviews(reviewMap);
    } catch (err: any) {
      console.error('获取订单失败', err);
    } finally {
      setLoading(false);
    }
  }, [view]);

  useEffect(() => {
    if (isAuthenticated) fetchOrders();
  }, [isAuthenticated, fetchOrders]);

  const handleConfirm = async (id: string) => {
    await confirmOrder(id);
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status: 'confirmed' as OrderStatus } : o));
  };

  const handleCancel = async (id: string) => {
    await cancelOrder(id);
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status: 'cancelled' as OrderStatus } : o));
  };

  const handleReview = (order: ApiOrder, role: 'buyer_to_seller' | 'seller_to_buyer') => {
    setReviewModal({ order, role });
  };

  const handleSubmitReview = async (rating: number, content: string) => {
    if (!reviewModal) return;
    setReviewLoading(true);
    try {
      const review = await createReview({
        order_id: reviewModal.order.id,
        rating,
        content,
        role: reviewModal.role,
      });

      // 更新本地评价状态
      setOrderReviews(prev => {
        const current = prev[reviewModal.order.id] || { buyerReview: null, sellerReview: null };
        return {
          ...prev,
          [reviewModal.order.id]: {
            ...current,
            [reviewModal.role === 'buyer_to_seller' ? 'buyerReview' : 'sellerReview']: review,
          },
        };
      });
      setReviewModal(null);
    } finally {
      setReviewLoading(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-paper pb-16 flex items-center justify-center">
        <div className="text-center px-6">
          <ShoppingBag className="w-16 h-16 text-ink-muted mx-auto mb-4" />
          <h2 className="font-display text-2xl text-ink mb-2">请先登录</h2>
          <p className="font-sans text-ink-muted mb-6">登录后查看您的订单</p>
          <button onClick={() => onNavigate('auth')} className="btn-primary">去登录</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper pb-16">
      {/* Header */}
      <div className="bg-paper-warm border-b-2 border-ink sticky top-14 z-20">
        <div className="section-container py-3 flex items-center justify-between">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-sm font-sans text-ink-muted hover:text-ink transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" /> 返回
          </button>
          <span className="font-display text-lg text-ink">我的订单</span>
          <button
            onClick={fetchOrders}
            disabled={loading}
            className="p-1.5 hover:bg-paper-dark rounded cursor-pointer transition-colors"
            title="刷新"
          >
            <RefreshCw className={`w-4 h-4 text-ink-muted ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Tab */}
        <div className="section-container pb-0">
          <div className="flex">
            {[
              { key: 'buy', label: '我买的', icon: ShoppingBag },
              { key: 'sell', label: '我卖的', icon: Package },
            ].map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setView(key as 'buy' | 'sell')}
                className={`flex items-center gap-1.5 px-5 py-3 text-sm font-sans font-semibold border-b-2 transition-colors cursor-pointer
                  ${view === key
                    ? 'border-ink text-ink'
                    : 'border-transparent text-ink-muted hover:text-ink'}`}
              >
                <Icon className="w-4 h-4" /> {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="section-container py-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-ink-muted animate-spin" />
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-20">
            <ShoppingBag className="w-16 h-16 text-ink-muted mx-auto mb-4 opacity-40" />
            <p className="font-sans text-ink-muted">
              {view === 'buy' ? '还没有购买记录' : '还没有卖出记录'}
            </p>
            {view === 'buy' && (
              <button onClick={() => onNavigate('discover')} className="btn-primary mt-4">
                去逛逛
              </button>
            )}
            {view === 'sell' && (
              <button onClick={() => onNavigate('post')} className="btn-primary mt-4">
                去发布
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map(order => (
              <OrderCard
                key={order.id}
                order={order}
                view={view}
                onConfirm={handleConfirm}
                onCancel={handleCancel}
                onShowQR={setQrModal}
                onReview={handleReview}
                reviews={order.status === 'confirmed' ? orderReviews[order.id] : undefined}
              />
            ))}
          </div>
        )}
      </div>

      {/* 收款码弹窗 */}
      {qrModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-ink/60 backdrop-blur-sm" onClick={() => setQrModal(null)} />
          <div className="relative bg-paper border-2 border-ink shadow-retro-lg p-6 w-full max-w-xs text-center animate-scale-in">
            <h3 className="font-display text-lg text-ink mb-4 flex items-center justify-center gap-2">
              <QrCode className="w-5 h-5" /> 卖家收款码
            </h3>
            <div className="bg-white border-2 border-ink inline-block p-3 mb-4">
              <img src={qrModal} alt="收款码" className="w-52 h-52 object-contain" />
            </div>
            <p className="font-sans text-xs text-ink-muted mb-4">
              转账时备注「FilmMarket」方便卖家识别
            </p>
            <button onClick={() => setQrModal(null)} className="btn-secondary w-full justify-center">
              关闭
            </button>
          </div>
        </div>
      )}

      {/* 评价弹窗 */}
      {reviewModal && (
        <ReviewModal
          orderId={reviewModal.order.id}
          productTitle={reviewModal.order.product_title || '商品'}
          targetName={reviewModal.role === 'buyer_to_seller'
            ? (reviewModal.order.seller_nickname || '卖家')
            : (reviewModal.order.buyer_nickname || '买家')
          }
          role={reviewModal.role}
          onSubmit={handleSubmitReview}
          onClose={() => setReviewModal(null)}
        />
      )}
    </div>
  );
}
