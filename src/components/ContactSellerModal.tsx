import { X, QrCode, Copy, Check, Shield, Star, Award, MessageCircle, Loader2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { getSellerContact, getOrCreateConversation, type SellerContact } from '../lib/api';
import { useAuth } from '../hooks/useAuth';
import type { Product } from '../types';
import type { Conversation } from '../lib/api';

interface ContactSellerModalProps {
  product: Product;
  onClose: () => void;
  onLoginRequest: () => void;
  onStartChat?: (conversation: Conversation) => void;
}

const levelLabel: Record<string, { text: string; color: string }> = {
  normal: { text: '普通用户', color: 'text-ink-muted' },
  verified: { text: '认证用户', color: 'text-film-blue' },
  premium: { text: '品质商家', color: 'text-amber-film' },
};

// 判断是否是真实数据库 ID（纯数字字符串）
function isRealSellerId(id: string | number): boolean {
  return /^\d+$/.test(String(id));
}

// mock 数据 seller 转换为 SellerContact 格式
function mockToContact(seller: Product['seller']): SellerContact {
  return {
    id: String(seller.id),
    nickname: seller.name,
    avatar_url: seller.avatar,
    seller_level: (seller.badge as 'normal' | 'verified' | 'premium') || 'normal',
    wechat_qr: '',
    joined_year: seller.joinedYear || 2024,
  };
}

export default function ContactSellerModal({ product, onClose, onLoginRequest, onStartChat }: ContactSellerModalProps) {
  const { isAuthenticated } = useAuth();
  const [contact, setContact] = useState<SellerContact | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [startingChat, setStartingChat] = useState(false);

  const sellerId = String(product.seller.id);
  const isMockSeller = !isRealSellerId(sellerId);

  const fetchContact = () => {
    if (isMockSeller) {
      // mock 数据直接展示
      setContact(mockToContact(product.seller));
      return;
    }
    setLoading(true);
    setError('');
    getSellerContact(sellerId)
      .then(data => {
        setContact(data);
      })
      .catch(err => {
        setError(err.message || '获取联系方式失败');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!isAuthenticated) return;
    fetchContact();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, sellerId]);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // 发起聊天
  const handleStartChat = async () => {
    if (!contact || startingChat) return;
    setStartingChat(true);
    try {
      const conversation = await getOrCreateConversation(contact.id, product.id);
      onClose();
      onStartChat?.(conversation);
    } catch (err: any) {
      alert(err.message || '发起聊天失败');
    } finally {
      setStartingChat(false);
    }
  };

  const levelInfo = levelLabel[contact?.seller_level || product.seller.badge || 'normal'] ||
    levelLabel['normal'];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 sm:p-0">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-ink/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-paper border-2 border-ink shadow-retro-lg w-full max-w-sm animate-scale-in overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b-2 border-ink bg-paper-warm">
          <div className="flex items-center gap-2">
            <MessageCircle className="w-4 h-4 text-amber-film" />
            <h2 className="font-display text-base font-bold text-ink">联系卖家</h2>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-paper-dark cursor-pointer transition-colors">
            <X className="w-5 h-5 text-ink" />
          </button>
        </div>

        <div className="p-5">
          {/* 商品摘要 */}
          <div className="flex gap-3 bg-paper-warm border border-paper-dark p-3 mb-5">
            {(() => {
              const imgs = Array.isArray(product.images)
                ? product.images
                : (() => { try { return JSON.parse(product.images as any); } catch { return [product.images]; } })();
              return (
                <img
                  src={imgs[0] || '/images/placeholder.png'}
                  alt={product.title}
                  className="w-14 h-14 object-cover flex-shrink-0 border border-paper-dark"
                />
              );
            })()}
            <div className="flex-1 min-w-0">
              <p className="font-sans font-semibold text-sm text-ink line-clamp-1">{product.title}</p>
              <p className="font-display text-amber-film text-base mt-0.5">¥{product.price.toLocaleString()}</p>
              <p className="font-sans text-xs text-ink-muted">{product.condition} 成新</p>
            </div>
          </div>

          {/* 未登录提示 */}
          {!isAuthenticated && (
            <div className="text-center py-6 space-y-4">
              <div className="w-14 h-14 mx-auto rounded-full bg-paper-warm border-2 border-paper-dark flex items-center justify-center">
                <Shield className="w-7 h-7 text-ink-muted" />
              </div>
              <div>
                <p className="font-sans font-semibold text-ink mb-1">登录后可查看联系方式</p>
                <p className="font-sans text-sm text-ink-muted">保护买卖双方信息安全</p>
              </div>
              <button
                onClick={() => { onClose(); onLoginRequest(); }}
                className="btn-primary w-full justify-center py-3"
              >
                立即登录
              </button>
            </div>
          )}

          {/* 加载中 */}
          {isAuthenticated && loading && (
            <div className="text-center py-8 space-y-2">
              <Loader2 className="w-8 h-8 text-amber-film mx-auto animate-spin" />
              <p className="font-sans text-sm text-ink-muted">加载联系方式...</p>
            </div>
          )}

          {/* 加载失败 */}
          {isAuthenticated && !loading && error && (
            <div className="text-center py-6 space-y-3">
              <p className="font-sans text-sm text-film-red">{error}</p>
              <button
                onClick={fetchContact}
                className="btn-secondary text-sm"
              >
                重试
              </button>
            </div>
          )}

          {/* 卖家信息 + 微信二维码 */}
          {isAuthenticated && !loading && contact && (
            <div className="space-y-4 animate-fade-up">
              {/* 卖家名片 */}
              <div className="flex items-center gap-3 p-3 border border-paper-dark bg-white">
                <img
                  src={contact.avatar_url || product.seller.avatar}
                  alt={contact.nickname}
                  className="w-12 h-12 rounded-full border-2 border-ink object-cover flex-shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="font-sans font-bold text-ink truncate">{contact.nickname}</span>
                    {contact.seller_level === 'premium' && (
                      <span className="flex-shrink-0 flex items-center gap-0.5 text-xs bg-amber-film text-white px-1.5 py-0.5 font-sans font-bold">
                        <Award className="w-3 h-3" />品质商家
                      </span>
                    )}
                    {contact.seller_level === 'verified' && (
                      <span className="flex-shrink-0 flex items-center gap-0.5 text-xs bg-ink text-paper px-1.5 py-0.5 font-sans font-bold">
                        <Check className="w-3 h-3" />已认证
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs font-sans text-ink-muted">
                    <span className="flex items-center gap-0.5">
                      <Star className="w-3 h-3 fill-amber-film text-amber-film" />
                      {product.seller.rating?.toFixed(1) || '5.0'}
                    </span>
                    <span>入驻 {new Date().getFullYear() - (contact.joined_year || 2024)} 年</span>
                    <span className={levelInfo.color}>{levelInfo.text}</span>
                  </div>
                </div>
              </div>

              {/* 发起聊天按钮 */}
              <button
                onClick={handleStartChat}
                disabled={startingChat}
                className="w-full flex items-center justify-center gap-2 py-3 bg-amber-film text-white font-sans font-semibold hover:bg-amber-film/90 transition-colors disabled:opacity-50 cursor-pointer"
              >
                {startingChat ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <MessageCircle className="w-5 h-5" />
                )}
                {startingChat ? '正在进入...' : '发起聊天'}
              </button>

              {/* 微信昵称复制 */}
              <div>
                <p className="font-sans text-xs font-bold text-ink-muted uppercase tracking-wider mb-2">微信搜索</p>
                <div className="flex items-center gap-2 bg-white border border-paper-dark px-3 py-2.5">
                  <span className="flex-1 font-sans text-sm text-ink font-semibold">{contact.nickname}</span>
                  <button
                    onClick={() => handleCopy(contact.nickname)}
                    className="flex items-center gap-1 text-xs font-sans text-ink-muted hover:text-amber-film transition-colors cursor-pointer px-2 py-1 border border-paper-dark hover:border-amber-film"
                  >
                    {copied ? (
                      <><Check className="w-3 h-3 text-film-green" />已复制</>
                    ) : (
                      <><Copy className="w-3 h-3" />复制</>
                    )}
                  </button>
                </div>
              </div>

              {/* 微信收款码 */}
              <div>
                <p className="font-sans text-xs font-bold text-ink-muted uppercase tracking-wider mb-2">微信收款码</p>
                {contact.wechat_qr ? (
                  <div className="flex flex-col items-center">
                    <div className="bg-white border-2 border-ink inline-block p-3">
                      <img
                        src={contact.wechat_qr}
                        alt="微信收款码"
                        className="w-48 h-48 object-contain"
                      />
                    </div>
                    <p className="font-sans text-xs text-ink-muted mt-2 text-center">
                      长按识别添加卖家微信
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-6 border-2 border-dashed border-paper-dark bg-paper-warm gap-2">
                    <QrCode className="w-10 h-10 text-ink-muted" />
                    <p className="font-sans text-sm text-ink-muted text-center">
                      卖家暂未上传收款码
                    </p>
                    <p className="font-sans text-xs text-ink-muted">
                      可通过微信搜索昵称联系
                    </p>
                  </div>
                )}
              </div>

              {/* 安全提示 */}
              <div className="bg-amber-film/10 border border-amber-film/30 p-3">
                <p className="font-sans text-xs text-amber-film font-semibold mb-1 flex items-center gap-1">
                  <Shield className="w-3 h-3" /> 安全交易提醒
                </p>
                <ul className="font-sans text-xs text-ink-muted space-y-0.5">
                  <li>• 建议通过平台下单，享受交易保障</li>
                  <li>• 转账时请核对对方身份</li>
                  <li>• 不要轻信低价诱惑，谨防诈骗</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
