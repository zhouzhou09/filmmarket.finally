import { useState } from 'react';
import { Star, X, Loader2, Send, User, ShoppingBag } from 'lucide-react';

interface ReviewModalProps {
  orderId: string;
  productTitle: string;
  targetName: string;
  role: 'buyer_to_seller' | 'seller_to_buyer';
  onSubmit: (rating: number, content: string) => Promise<void>;
  onClose: () => void;
}

export default function ReviewModal({ orderId, productTitle, targetName, role, onSubmit, onClose }: ReviewModalProps) {
  const [rating, setRating] = useState(5);
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const isBuyerReviewing = role === 'buyer_to_seller';
  const title = isBuyerReviewing ? '评价卖家' : '评价买家';
  const subtitle = isBuyerReviewing ? '评价后将帮助其他买家了解卖家' : '评价后将帮助其他卖家了解买家';
  const placeholder = isBuyerReviewing
    ? '分享你的购买体验，如：商品描述相符、发货速度快、卖家态度好...'
    : '分享你的交易体验，如：买家爽快、付款及时、沟通顺畅...';

  const handleSubmit = async () => {
    if (submitting) return;
    setSubmitting(true);
    setError('');
    try {
      await onSubmit(rating, content);
    } catch (err: any) {
      setError(err.message || '提交失败，请重试');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-paper border-2 border-ink shadow-retro-lg w-full max-w-md animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-paper-dark">
          <div>
            <h3 className="font-display text-lg text-ink">{title}</h3>
            <p className="font-sans text-xs text-ink-muted mt-0.5">{subtitle}</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center hover:bg-paper-dark transition-colors cursor-pointer"
          >
            <X className="w-5 h-5 text-ink" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          {/* 交易信息 */}
          <div className="bg-paper-warm border border-paper-dark p-3 mb-4">
            <div className="flex items-center gap-2 mb-2">
              {isBuyerReviewing ? (
                <ShoppingBag className="w-4 h-4 text-ink-muted" />
              ) : (
                <User className="w-4 h-4 text-ink-muted" />
              )}
              <span className="text-xs font-sans text-ink-muted">{title}</span>
            </div>
            <p className="font-sans font-semibold text-sm text-ink">{targetName}</p>
            <div className="text-xs font-sans text-ink-muted mt-1">商品：{productTitle}</div>
          </div>

          {/* 评分 */}
          <div className="mb-4">
            <label className="block text-xs font-sans font-bold text-ink-muted uppercase mb-2">
              评分 *
            </label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => setRating(star)}
                  className="p-2 hover:scale-110 transition-transform cursor-pointer"
                >
                  <Star
                    className={`w-8 h-8 ${
                      star <= rating
                        ? 'fill-amber-film text-amber-film'
                        : 'text-paper-dark'
                    }`}
                  />
                </button>
              ))}
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-xs font-sans text-ink-muted">
                {['', '很差', '较差', '一般', '满意', '非常满意'][rating]}
              </span>
              <span className="text-xs font-sans text-amber-film font-semibold">{rating}分</span>
            </div>
          </div>

          {/* 评价内容 */}
          <div className="mb-4">
            <label className="block text-xs font-sans font-bold text-ink-muted uppercase mb-2">
              评价内容（选填）
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={4}
              maxLength={200}
              placeholder={placeholder}
              className="w-full px-3 py-2.5 border-2 border-paper-dark bg-white font-sans text-sm text-ink outline-none focus:border-amber-film transition-colors resize-none"
            />
            <div className="text-right text-xs font-sans text-ink-muted mt-1">
              {content.length}/200
            </div>
          </div>

          {/* 提示 */}
          <div className="text-xs font-sans text-ink-muted mb-4 p-2 bg-paper-warm border border-paper-dark">
            💡 评价是匿名的，你的真实反馈将帮助平台营造更好的交易环境
          </div>

          {/* 错误提示 */}
          {error && (
            <div className="mb-4 p-3 bg-film-red/10 border border-film-red/30 text-film-red text-sm font-sans">
              {error}
            </div>
          )}

          {/* 按钮 */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 border-2 border-paper-dark text-ink font-sans font-semibold text-sm hover:bg-paper-warm transition-colors cursor-pointer"
            >
              取消
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="flex-1 py-2.5 bg-amber-film text-white font-sans font-bold text-sm hover:bg-amber-film/90 transition-colors cursor-pointer flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  提交中...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  提交评价
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
