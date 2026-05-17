import { useState } from 'react';
import { Clock, CheckCircle2, XCircle, Loader2, ShoppingBag, Truck } from 'lucide-react';
import { confirmOrder, cancelOrder, type ApiOrder } from '../lib/api';

interface OrderCardProps {
  order: ApiOrder;
  view: 'buy' | 'sell'; // buy=买家视角 sell=卖家视角
  onUpdate: (order: ApiOrder) => void;
}

const statusConfig = {
  pending: { label: '待付款', color: 'text-amber-film bg-amber-film/10', icon: Clock },
  paid: { label: '待确认', color: 'text-blue-600 bg-blue-50', icon: Loader2 },
  confirmed: { label: '已完成', color: 'text-film-green bg-film-green/10', icon: CheckCircle2 },
  cancelled: { label: '已取消', color: 'text-film-red bg-film-red/10', icon: XCircle },
  refunded: { label: '已退款', color: 'text-film-red bg-film-red/10', icon: XCircle },
};

// 解析图片字段
function getImages(images: string | string[] | undefined): string[] {
  if (!images) return ['/images/placeholder.png'];
  if (typeof images === 'string') {
    try { return JSON.parse(images); } catch { return [images]; }
  }
  return images;
}

export default function OrderCard({ order, view, onUpdate }: OrderCardProps) {
  const [loading, setLoading] = useState(false);
  const cfg = statusConfig[order.status] || statusConfig.pending;
  const Icon = cfg.icon;
  const images = getImages(order.product_images);

  // 买家视角：可取消 pending 订单
  const canCancelBuyer = view === 'buy' && order.status === 'pending';
  // 卖家视角：可确认 paid 订单
  const canConfirmSeller = view === 'sell' && order.status === 'paid';

  const handleConfirm = async () => {
    if (!confirm('确认收到货款了吗？确认后金额将结算给你。')) return;
    setLoading(true);
    try {
      const updated = await confirmOrder(order.id);
      onUpdate(updated);
    } catch (err: any) {
      alert(err.message || '操作失败');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!confirm('确定要取消此订单吗？')) return;
    setLoading(true);
    try {
      const updated = await cancelOrder(order.id);
      onUpdate(updated);
    } catch (err: any) {
      alert(err.message || '操作失败');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  return (
    <div className="bg-white border border-paper-dark hover:border-ink transition-colors">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-paper-dark bg-paper-warm">
        <span className={`inline-flex items-center gap-1 text-xs font-sans font-semibold px-2 py-0.5 ${cfg.color}`}>
          <Icon className={`w-3.5 h-3.5 ${order.status === 'paid' ? 'animate-spin' : ''}`} />
          {cfg.label}
        </span>
        <span className="text-xs font-sans text-ink-muted font-mono">
          {order.id.slice(0, 8)}...
        </span>
      </div>

      {/* Product */}
      <div className="flex gap-3 p-3">
        <img
          src={images[0] || '/images/placeholder.png'}
          alt={order.product_title || '商品'}
          className="w-16 h-16 object-cover flex-shrink-0 border border-paper-dark"
        />
        <div className="flex-1 min-w-0">
          <p className="font-sans font-semibold text-sm text-ink line-clamp-1">{order.product_title}</p>
          <p className="font-display text-amber-film text-base mt-0.5">¥{Number(order.amount).toLocaleString()}</p>

          {/* 收货信息（仅买家能看到） */}
          {view === 'buy' && (
            <div className="mt-1.5 text-xs font-sans text-ink-muted space-y-0.5">
              <p>📍 {order.buyer_address}</p>
              <p>👤 {order.buyer_name} {order.buyer_phone}</p>
            </div>
          )}

          {/* 卖家收款码（仅买家看 paid 状态） */}
          {view === 'buy' && order.status === 'paid' && order.seller_wechat_qr && (
            <div className="mt-2 p-2 bg-amber-film/5 border border-amber-film/30">
              <p className="text-xs font-sans text-amber-film font-semibold mb-1">⚠️ 已付款，请等待卖家确认</p>
              <p className="text-xs font-sans text-ink-muted">卖家确认后自动完成交易</p>
            </div>
          )}

          {/* 卖家视角显示买家信息 */}
          {view === 'sell' && (
            <div className="mt-1.5 text-xs font-sans text-ink-muted space-y-0.5">
              <p>买家：{order.buyer_nickname || '未知'}</p>
              <p>📍 {order.buyer_address}</p>
              <p>👤 {order.buyer_name} {order.buyer_phone}</p>
              {order.buyer_note && <p>📝 备注：{order.buyer_note}</p>}
            </div>
          )}
        </div>
      </div>

      {/* Footer actions */}
      <div className="flex items-center justify-between px-3 py-2 border-t border-paper-dark bg-paper-warm">
        <span className="text-xs font-sans text-ink-muted">
          {formatDate(order.created_at)}
        </span>
        <div className="flex gap-2">
          {canCancelBuyer && (
            <button
              onClick={handleCancel}
              disabled={loading}
              className="px-3 py-1 text-xs font-sans border border-film-red text-film-red hover:bg-film-red/5 disabled:opacity-50 transition-colors cursor-pointer"
            >
              {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : '取消订单'}
            </button>
          )}
          {canConfirmSeller && (
            <button
              onClick={handleConfirm}
              disabled={loading}
              className="px-3 py-1 text-xs font-sans bg-film-green text-white hover:bg-film-green/90 disabled:opacity-50 transition-colors cursor-pointer flex items-center gap-1"
            >
              {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <><CheckCircle2 className="w-3 h-3" /> 确认收款</>}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
