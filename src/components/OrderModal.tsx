import { X, Check, Copy, QrCode, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { createOrder, markOrderPaid, type ApiOrder } from '../lib/api';
import type { Product } from '../types';

interface OrderModalProps {
  product: Product;
  onClose: () => void;
  onSuccess?: (order: ApiOrder) => void;
}

type Step = 'address' | 'qr' | 'paid_wait' | 'confirmed' | 'error';

const statusText: Record<string, { label: string; color: string }> = {
  pending: { label: '待付款', color: 'text-amber-film' },
  paid: { label: '待确认', color: 'text-blue-600' },
  confirmed: { label: '已完成', color: 'text-film-green' },
  cancelled: { label: '已取消', color: 'text-film-red' },
  refunded: { label: '已退款', color: 'text-film-red' },
};

export default function OrderModal({ product, onClose, onSuccess }: OrderModalProps) {
  const [step, setStep] = useState<Step>('address');
  const [order, setOrder] = useState<ApiOrder | null>(null);
  const [error, setError] = useState('');

  // 地址表单
  const [form, setForm] = useState({ name: '', phone: '', address: '', note: '' });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!form.name.trim()) { setError('请填写收货人'); return; }
    if (!form.phone.trim() || !/^1\d{10}$/.test(form.phone)) { setError('请填写正确的手机号'); return; }
    if (!form.address.trim()) { setError('请填写收货地址'); return; }

    setSubmitting(true);
    setError('');
    try {
      // images 可能是字符串数组或 JSON 字符串
      let images: string[] = [];
      if (typeof product.images === 'string') {
        try { images = JSON.parse(product.images); } catch { images = [product.images]; }
      } else if (Array.isArray(product.images)) {
        images = product.images;
      }

      const created = await createOrder({
        product_id: String(product.id),
        buyer_name: form.name.trim(),
        buyer_phone: form.phone.trim(),
        buyer_address: form.address.trim(),
        buyer_note: form.note.trim(),
      });
      setOrder(created);
      setStep('qr');
    } catch (err: any) {
      setError(err.message || '创建订单失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePaid = async () => {
    if (!order) return;
    setSubmitting(true);
    try {
      const updated = await markOrderPaid(order.id);
      setOrder(updated);
      setStep('paid_wait');
    } catch (err: any) {
      setError(err.message || '操作失败');
    } finally {
      setSubmitting(false);
    }
  };

  // 解析商品图片
  let productImages: string[] = [];
  if (typeof product.images === 'string') {
    try { productImages = JSON.parse(product.images); } catch { productImages = [product.images]; }
  } else if (Array.isArray(product.images)) {
    productImages = product.images;
  }

  // 解析卖家微信二维码
  const sellerWechatQR = order?.seller_wechat_qr || '';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-ink/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-paper border-2 border-ink shadow-retro-lg w-full max-w-md animate-scale-in overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b-2 border-ink bg-paper-warm">
          <h2 className="font-display text-lg font-bold text-ink">
            {step === 'address' ? '确认订单' :
             step === 'qr' ? '扫码付款' :
             step === 'paid_wait' ? '等待卖家确认' :
             step === 'confirmed' ? '交易完成' : '订单信息'}
          </h2>
          <button onClick={onClose} className="p-1.5 hover:bg-paper-dark cursor-pointer transition-colors">
            <X className="w-5 h-5 text-ink" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5">

          {/* ===== Step 1: 地址表单 ===== */}
          {step === 'address' && (
            <div className="animate-fade-up space-y-4">
              {/* 商品摘要 */}
              <div className="flex gap-3 bg-paper-warm border border-paper-dark p-3">
                <img
                  src={productImages[0] || '/images/placeholder.png'}
                  alt={product.title}
                  className="w-16 h-16 object-cover flex-shrink-0 border border-paper-dark"
                />
                <div className="flex-1 min-w-0">
                  <p className="font-sans font-semibold text-sm text-ink line-clamp-1">{product.title}</p>
                  <p className="font-display text-amber-film text-lg mt-0.5">¥{product.price.toLocaleString()}</p>
                  <p className="font-sans text-xs text-ink-muted">{product.condition}成新</p>
                </div>
              </div>

              {/* 收货信息 */}
              <div>
                <h3 className="font-sans font-bold text-sm text-ink mb-2">收货信息</h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-sans text-ink-muted mb-1">收货人 *</label>
                    <input
                      type="text"
                      value={form.name}
                      onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                      placeholder="请输入收货人姓名"
                      className="w-full px-3 py-2.5 border-2 border-paper-dark bg-white font-sans text-sm text-ink outline-none focus:border-amber-film transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-sans text-ink-muted mb-1">手机号 *</label>
                    <input
                      type="tel"
                      value={form.phone}
                      onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                      placeholder="请输入手机号码"
                      maxLength={11}
                      className="w-full px-3 py-2.5 border-2 border-paper-dark bg-white font-sans text-sm text-ink outline-none focus:border-amber-film transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-sans text-ink-muted mb-1">收货地址 *</label>
                    <textarea
                      value={form.address}
                      onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                      placeholder="省市区 + 详细地址"
                      rows={2}
                      className="w-full px-3 py-2.5 border-2 border-paper-dark bg-white font-sans text-sm text-ink outline-none focus:border-amber-film transition-colors resize-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-sans text-ink-muted mb-1">备注（选填）</label>
                    <input
                      type="text"
                      value={form.note}
                      onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                      placeholder="给卖家留言"
                      className="w-full px-3 py-2.5 border-2 border-paper-dark bg-white font-sans text-sm text-ink outline-none focus:border-amber-film transition-colors"
                    />
                  </div>
                </div>
              </div>

              {error && <p className="text-sm font-sans text-film-red">{error}</p>}

              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="btn-primary w-full justify-center py-3 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> 提交订单中...</>
                ) : (
                  <>提交订单，确认 ¥{product.price.toLocaleString()}</>
                )}
              </button>
            </div>
          )}

          {/* ===== Step 2: 显示微信二维码 ===== */}
          {step === 'qr' && order && (
            <div className="animate-fade-up text-center space-y-4">
              {/* 订单信息 */}
              <div className="bg-paper-warm border border-paper-dark p-3 text-left">
                <div className="flex justify-between font-sans text-sm mb-1">
                  <span className="text-ink-muted">订单号</span>
                  <span className="text-ink font-mono text-xs">{order.id.slice(0, 8)}...</span>
                </div>
                <div className="flex justify-between font-sans text-sm">
                  <span className="text-ink-muted">应付金额</span>
                  <span className="font-display text-amber-film text-lg">¥{order.amount.toLocaleString()}</span>
                </div>
              </div>

              {/* 卖家微信二维码 */}
              <div>
                <p className="font-sans font-bold text-sm text-ink mb-3 flex items-center justify-center gap-1.5">
                  <QrCode className="w-4 h-4 text-film-green" />
                  请向卖家扫码转账
                </p>

                {sellerWechatQR ? (
                  <div className="bg-white border-2 border-ink inline-block p-3">
                    <img
                      src={sellerWechatQR}
                      alt="卖家微信收款码"
                      className="w-56 h-56 object-contain"
                    />
                  </div>
                ) : (
                  <div className="w-56 h-56 mx-auto border-2 border-dashed border-paper-dark flex flex-col items-center justify-center bg-paper-warm">
                    <QrCode className="w-12 h-12 text-ink-muted mb-2" />
                    <p className="font-sans text-sm text-ink-muted text-center px-4">
                      卖家暂未上传<br />收款二维码
                    </p>
                    <p className="font-sans text-xs text-ink-muted mt-1">
                      请联系卖家确认转账方式
                    </p>
                  </div>
                )}
              </div>

              {/* 卖家联系方式提示 */}
              <div className="bg-amber-film/10 border border-amber-film/30 p-3 text-left">
                <p className="font-sans text-xs text-amber-film font-semibold mb-1">💡 交易提示</p>
                <ul className="font-sans text-xs text-ink-muted space-y-0.5">
                  <li>• 转账时备注「FilmMarket」方便卖家识别</li>
                  <li>• 转账完成后点击下方按钮通知卖家</li>
                  <li>• 卖家确认后订单自动完成</li>
                </ul>
              </div>

              <button
                onClick={handlePaid}
                disabled={submitting}
                className="btn-primary w-full justify-center py-3 text-base disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> 处理中...</>
                ) : (
                  <><Check className="w-4 h-4" /> 我已付款，通知卖家</>
                )}
              </button>
            </div>
          )}

          {/* ===== Step 3: 等待卖家确认 ===== */}
          {step === 'paid_wait' && order && (
            <div className="animate-fade-up text-center space-y-4">
              <div className="w-16 h-16 mx-auto bg-amber-film/10 border-2 border-amber-film rounded-full flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-amber-film animate-spin" />
              </div>

              <div>
                <p className="font-display text-xl font-bold text-amber-film mb-1">付款成功！</p>
                <p className="font-sans text-sm text-ink-muted">
                  已通知卖家，请等待卖家确认收款
                </p>
              </div>

              <div className="bg-paper-warm border border-paper-dark p-4 text-left space-y-2">
                <div className="flex justify-between font-sans text-sm">
                  <span className="text-ink-muted">订单号</span>
                  <span className="text-ink font-mono text-xs">{order.id}</span>
                </div>
                <div className="flex justify-between font-sans text-sm">
                  <span className="text-ink-muted">付款金额</span>
                  <span className="font-display text-amber-film">¥{order.amount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between font-sans text-sm">
                  <span className="text-ink-muted">订单状态</span>
                  <span className="text-blue-600 font-semibold">等待卖家确认</span>
                </div>
              </div>

              <p className="font-sans text-xs text-ink-muted">
                卖家确认后系统会自动更新订单状态，请保持手机畅通
              </p>

              <button onClick={onClose} className="btn-secondary w-full justify-center">
                关闭
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
