import { useState, useEffect } from 'react';
import { ArrowLeftRight, Filter, Plus, Star, MapPin, ChevronDown, ArrowLeft, Check, X, Send, Image as ImageIcon, Loader2 } from 'lucide-react';
import { categories } from '../data/mockData';
import type { ProductCategory, Product } from '../types';
import { useAuth } from '../hooks/useAuth';
import { getSwaps, createSwap, type SwapRequest } from '../lib/api';

interface SwapPageProps {
  onBack: () => void;
  targetProduct?: Product | null;
}

// swapTypes → 对应的 wantedCategory ID 列表
const swapTypeCategories: Record<string, string[]> = {
  camera: ['rangefinder', 'slr', 'tlr', 'point-and-shoot'],
  film: ['film'],
  lens: ['lens'],
};

const swapTypes = [
  { value: 'all', label: '全部换物' },
  { value: 'camera', label: '相机换相机' },
  { value: 'film', label: '胶卷交换' },
  { value: 'lens', label: '镜头换镜头' },
];

export default function SwapPage({ onBack, targetProduct }: SwapPageProps) {
  const { user, isAuthenticated } = useAuth();
  const [swaps, setSwaps] = useState<SwapRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedType, setSelectedType] = useState('all');
  const [showPostForm, setShowPostForm] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  
  // 换物邀约模态框状态
  const [showOfferModal, setShowOfferModal] = useState(false);
  const [selectedSwap, setSelectedSwap] = useState<SwapRequest | null>(null);
  const [offerMessage, setOfferMessage] = useState('');
  const [showOfferSuccess, setShowOfferSuccess] = useState(false);
  
  // 换物表单状态
  const [swapForm, setSwapForm] = useState({
    offering: '',
    offeringImage: '/images/products/p5-kodak-portra.png',
    wantedCategory: [] as string[],
    wantedDescription: '',
  });

  // 加载换物列表
  useEffect(() => {
    loadSwaps();
  }, []);

  // 当带入目标商品时，自动展开表单并预填
  useEffect(() => {
    if (targetProduct) {
      setShowPostForm(true);
      setSwapForm(prev => ({
        ...prev,
        wantedDescription: `想要：${targetProduct.title}（${targetProduct.brand} ${targetProduct.model}）`,
      }));
    }
  }, [targetProduct]);

  const loadSwaps = async () => {
    setLoading(true);
    try {
      const data = await getSwaps();
      setSwaps(data);
    } catch (err) {
      console.error('加载换物列表失败:', err);
    } finally {
      setLoading(false);
    }
  };

  const filtered = selectedType === 'all'
    ? swaps
    : swaps.filter(s => {
        const targetCats = swapTypeCategories[selectedType] || [];
        return targetCats.some(cat => s.wantedCategory.includes(cat));
      });

  const handleSubmitSwap = async () => {
    if (!swapForm.offering.trim()) {
      alert('请填写你想用来交换的物品');
      return;
    }
    if (swapForm.wantedCategory.length === 0) {
      alert('请至少选择一种期望物品类型');
      return;
    }
    if (!swapForm.wantedDescription.trim()) {
      alert('请填写期望物品描述');
      return;
    }
    if (!isAuthenticated || !user) {
      alert('请先登录后再发布换物请求');
      return;
    }
    setSubmitting(true);
    try {
      const newSwap = await createSwap({
        product_id: targetProduct?.id,
        offering: swapForm.offering,
        offering_image: swapForm.offeringImage,
        wanted_category: swapForm.wantedCategory,
        wanted_description: swapForm.wantedDescription,
      });
      // 将后端返回的完整 swap 对象加入列表
      setSwaps(prev => [newSwap, ...prev]);
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        setShowPostForm(false);
        setSwapForm({
          offering: '',
          offeringImage: '/images/products/p5-kodak-portra.png',
          wantedCategory: [],
          wantedDescription: '',
        });
      }, 1500);
    } catch (err: any) {
      alert(err.message || '发布失败，请重试');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleWantedCategory = (catId: string) => {
    setSwapForm(prev => ({
      ...prev,
      wantedCategory: prev.wantedCategory.includes(catId)
        ? prev.wantedCategory.filter(c => c !== catId)
        : [...prev.wantedCategory, catId]
    }));
  };

  // 发起换物邀约
  const handleOfferSwap = (swap: SwapRequest) => {
    if (!isAuthenticated || !user) {
      alert('请先登录后再发起换物邀约');
      return;
    }
    setSelectedSwap(swap);
    setShowOfferModal(true);
    setOfferMessage(`你好！我想用我的物品交换你的「${swap.offering}」，请看看是否合适~`);
  };

  // 提交换物邀约
  const handleSubmitOffer = () => {
    if (!offerMessage.trim()) {
      alert('请填写换物说明');
      return;
    }
    setShowOfferSuccess(true);
    setTimeout(() => {
      setShowOfferModal(false);
      setShowOfferSuccess(false);
      setSelectedSwap(null);
      setOfferMessage('');
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-paper pb-16">
      {/* Header */}
      <div className="bg-ink grain-overlay sticky top-14 z-20">
        <div className="section-container py-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="w-2 h-2 bg-amber-film rounded-full animate-pulse"></span>
                <span className="text-xs font-sans font-bold text-amber-film uppercase tracking-widest">换物广场</span>
              </div>
              <h1 className="font-display text-3xl text-white">
                以物换物<span className="text-amber-film">·</span> 零成本换新
              </h1>
            </div>
            <button
              onClick={() => setShowPostForm(!showPostForm)}
              className="btn-primary"
            >
              <Plus className="w-4 h-4" />
              发起换物
            </button>
          </div>
          <p className="font-sans text-white/50 text-sm mt-2">
            双向押金锁定保障，{swaps.length} 个换物请求正在等待
          </p>
        </div>

        {/* Filter tabs */}
        <div className="border-t border-white/10">
          <div className="section-container">
            <div className="flex gap-2 overflow-x-auto py-3">
              {swapTypes.map(t => (
                <button
                  key={t.value}
                  onClick={() => setSelectedType(t.value)}
                  className={`flex-shrink-0 px-4 py-1.5 text-sm font-sans font-semibold border cursor-pointer transition-colors
                    ${selectedType === t.value
                      ? 'bg-amber-film text-white border-amber-film'
                      : 'bg-transparent text-white/70 border-white/20 hover:border-white/50'}`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="section-container py-6">
        {/* Swap mechanism explainer */}
        <div className="bg-paper-warm border-2 border-ink p-4 mb-6 grid grid-cols-1 sm:grid-cols-4 gap-4">
          {[
            { step: '1', title: '发起换物', desc: '发布你想交换的物品' },
            { step: '2', title: '双向确认', desc: '双方同意换物意向' },
            { step: '3', title: '押金锁定', desc: '各付¥9.9保障履约' },
            { step: '4', title: '完成交换', desc: '确认收货后退押金' },
          ].map(item => (
            <div key={item.step} className="text-center">
              <div className="w-7 h-7 bg-ink text-amber-film font-sans font-bold text-sm flex items-center justify-center mx-auto mb-1.5">
                {item.step}
              </div>
              <div className="font-sans font-bold text-xs text-ink mb-0.5">{item.title}</div>
              <div className="font-sans text-xs text-ink-muted">{item.desc}</div>
            </div>
          ))}
        </div>

        {/* 换物表单 */}
        {showPostForm && (
          <div className="bg-paper border-2 border-amber-film p-5 mb-6 animate-scale-in">
            {/* 换物目标提示 */}
            {targetProduct && (
              <div className="bg-amber-film/10 border border-amber-film/30 p-3 mb-4 flex items-center gap-3">
                <div className="w-14 h-14 flex-shrink-0 border border-amber-film/50 overflow-hidden">
                  <img
                    src={targetProduct.images[0]}
                    alt={targetProduct.title}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div>
                  <div className="text-xs font-sans text-amber-film font-bold uppercase mb-0.5">你的换物目标</div>
                  <p className="font-sans font-bold text-sm text-ink">{targetProduct.title}</p>
                  <p className="text-xs font-sans text-ink-muted">{targetProduct.seller.name} 的物品</p>
                </div>
              </div>
            )}

            <h3 className="font-display text-xl text-ink mb-4 flex items-center gap-2">
              <ArrowLeftRight className="w-5 h-5 text-amber-film" />
              {targetProduct ? '发起换物邀约' : '发布换物请求'}
            </h3>

            {/* 你的物品 */}
            <div className="mb-4">
              <label className="block text-xs font-sans font-bold text-ink-muted uppercase mb-2">
                我想用以下物品交换
              </label>
              <input
                type="text"
                value={swapForm.offering}
                onChange={e => setSwapForm(p => ({ ...p, offering: e.target.value }))}
                placeholder="描述你想用来交换的物品（品牌、型号、成色等）"
                className="w-full px-3 py-2.5 border-2 border-paper-dark bg-white font-sans text-sm text-ink outline-none focus:border-amber-film transition-colors"
              />
            </div>

            {/* 期望品类 */}
            <div className="mb-4">
              <label className="block text-xs font-sans font-bold text-ink-muted uppercase mb-2">
                期望物品类型（可多选）
              </label>
              <div className="flex flex-wrap gap-2">
                {categories.map(cat => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => toggleWantedCategory(cat.id)}
                    className={`px-3 py-1.5 text-xs font-sans font-semibold border-2 transition-colors cursor-pointer
                      ${swapForm.wantedCategory.includes(cat.id)
                        ? 'bg-amber-film border-amber-film text-white'
                        : 'border-paper-dark text-ink-muted hover:border-amber-film/50'}`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 期望描述 */}
            <div className="mb-4">
              <label className="block text-xs font-sans font-bold text-ink-muted uppercase mb-2">
                {targetProduct ? '补充说明' : '期望物品描述'}
              </label>
              <textarea
                value={swapForm.wantedDescription}
                onChange={e => setSwapForm(p => ({ ...p, wantedDescription: e.target.value }))}
                rows={3}
                placeholder={targetProduct ? '可以补充说明你的物品优势、期望的交换条件等...' : '描述你希望换到什么样的物品'}
                className="w-full px-3 py-2.5 border-2 border-paper-dark bg-white font-sans text-sm text-ink outline-none focus:border-amber-film transition-colors resize-none"
              />
            </div>

            {/* 提交按钮 */}
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowPostForm(false);
                  setSwapForm({ offering: '', offeringImage: '/images/products/p5-kodak-portra.png', wantedCategory: [], wantedDescription: '' });
                }}
                className="px-5 py-2.5 border-2 border-paper-dark text-ink font-sans font-semibold text-sm hover:bg-paper-warm transition-colors cursor-pointer"
              >
                取消
              </button>
              <button
                onClick={handleSubmitSwap}
                className="flex-1 py-2.5 bg-amber-film text-white font-sans font-bold text-sm hover:bg-amber-film/90 transition-colors cursor-pointer flex items-center justify-center gap-2"
              >
                <Send className="w-4 h-4" />
                {submitting ? (
                  <><Loader2 className="w-4 h-4 animate-spin" />发布中...</>
                ) : (
                  targetProduct ? '发送换物邀约' : '发布换物请求'
                )}
              </button>
            </div>
          </div>
        )}

        {/* Swap list */}
        {loading ? (
          <div className="text-center py-20">
            <Loader2 className="w-8 h-8 text-amber-film mx-auto mb-3 animate-spin" />
            <p className="font-sans text-ink-muted text-sm">加载中...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">🔄</div>
            <p className="font-sans font-bold text-ink text-lg mb-2">暂无换物请求</p>
            <p className="font-sans text-ink-muted text-sm mb-4">你是第一个想换这个品类的！</p>
            <button onClick={() => setShowPostForm(true)} className="btn-primary">
              <Plus className="w-4 h-4" />
              发起换物
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((swap) => (
            <div
              key={swap.id}
              className="border-2 border-ink bg-white hover:shadow-retro transition-all duration-150 cursor-pointer group overflow-hidden"
            >
              {/* Image */}
              <div className="relative aspect-video overflow-hidden">
                <img
                  src={swap.offeringImage}
                  alt={swap.offering}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-ink/60 to-transparent"></div>
                <div className="absolute bottom-3 left-3 right-3">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-film text-white text-xs font-sans font-bold uppercase">
                    <ArrowLeftRight className="w-3 h-3" />
                    换物请求
                  </span>
                </div>
              </div>

              {/* Content */}
              <div className="p-4">
                {/* User info */}
                <div className="flex items-center gap-2 mb-3">
                  <img
                    src={swap.user.avatar}
                    alt={swap.user.name}
                    className="w-8 h-8 rounded-full border-2 border-paper-dark object-cover"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      <span className="font-sans font-bold text-sm text-ink truncate">{swap.user.name}</span>
                      {swap.user.badge === 'premium' && (
                        <span className="text-xs bg-amber-film text-white px-1 font-sans font-bold flex-shrink-0">🏆</span>
                      )}
                      {swap.user.badge === 'verified' && (
                        <span className="text-xs bg-ink text-paper px-1 font-sans font-bold flex-shrink-0">✅</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs font-sans text-ink-muted">
                      <span className="flex items-center gap-0.5">
                        <Star className="w-3 h-3 fill-amber-film text-amber-film" />
                        {swap.user.rating}
                      </span>
                      <span className="flex items-center gap-0.5">
                        <MapPin className="w-3 h-3" />
                        {swap.user.location}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Offering */}
                <div className="mb-3 pb-3 border-b border-paper-dark">
                  <div className="flex items-center gap-1 mb-1">
                    <span className="text-xs font-sans text-film-green font-bold uppercase">我有</span>
                  </div>
                  <p className="font-sans font-semibold text-sm text-ink line-clamp-2">{swap.offering}</p>
                </div>

                {/* Wanted */}
                <div className="mb-3">
                  <div className="flex items-center gap-1 mb-1">
                    <span className="text-xs font-sans text-amber-film font-bold uppercase">我想换</span>
                  </div>
                  <p className="font-sans text-sm text-ink-muted line-clamp-2">{swap.wantedDescription}</p>
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {swap.wantedCategory.map(cat => {
                      const catLabel = categories.find(c => c.id === cat)?.label || cat;
                      return (
                        <span key={cat} className="badge-vintage text-xs">{catLabel}</span>
                      );
                    })}
                  </div>
                </div>

                {/* Time */}
                <div className="text-xs font-sans text-ink-muted mb-3">
                  发布于 {swap.createdAt}
                </div>

                {/* CTA */}
                <button 
                  onClick={() => handleOfferSwap(swap)}
                  className="w-full py-2 border-2 border-amber-film text-amber-film font-sans font-bold text-sm hover:bg-amber-film hover:text-white transition-colors cursor-pointer uppercase tracking-wider"
                >
                  发起换物邀约
                </button>
              </div>
            </div>
          ))}
        </div>
        )}
      </div>

      {/* 换物邀约模态框 */}
      {showOfferModal && selectedSwap && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/60">
          <div className="bg-paper border-2 border-ink w-full max-w-md animate-scale-in">
            {/* 模态框头部 */}
            <div className="flex items-center justify-between p-4 border-b border-paper-dark">
              <div className="flex items-center gap-2">
                <ArrowLeftRight className="w-5 h-5 text-amber-film" />
                <span className="font-sans font-bold text-ink">发起换物邀约</span>
              </div>
              <button 
                onClick={() => setShowOfferModal(false)}
                className="w-8 h-8 flex items-center justify-center hover:bg-paper-dark transition-colors cursor-pointer"
              >
                <X className="w-5 h-5 text-ink" />
              </button>
            </div>

            {/* 模态框内容 */}
            <div className="p-4">
              {/* 目标换物信息 */}
              <div className="bg-paper-warm border border-paper-dark p-3 mb-4">
                <div className="text-xs font-sans text-amber-film uppercase mb-1">对方想换</div>
                <p className="font-sans font-bold text-sm text-ink mb-2">{selectedSwap.offering}</p>
                <div className="flex items-center gap-2">
                  <img
                    src={selectedSwap.user.avatar}
                    alt={selectedSwap.user.name}
                    className="w-6 h-6 rounded-full border border-paper-dark"
                  />
                  <span className="text-xs font-sans text-ink-muted">{selectedSwap.user.name}</span>
                </div>
              </div>

              {/* 换物说明 */}
              <div className="mb-4">
                <label className="block text-xs font-sans font-bold text-ink-muted uppercase mb-2">
                  换物说明
                </label>
                <textarea
                  value={offerMessage}
                  onChange={(e) => setOfferMessage(e.target.value)}
                  rows={4}
                  placeholder="介绍一下你想用来交换的物品，让对方更了解你的诚意~"
                  className="w-full px-3 py-2.5 border-2 border-paper-dark bg-white font-sans text-sm text-ink outline-none focus:border-amber-film transition-colors resize-none"
                />
              </div>

              {/* 提示 */}
              <div className="text-xs font-sans text-ink-muted mb-4 p-2 bg-paper-warm border border-paper-dark">
                💡 发起邀约后，对方会收到通知，双方确认后可进行换物交易
              </div>

              {/* 按钮 */}
              <div className="flex gap-3">
                <button
                  onClick={() => setShowOfferModal(false)}
                  className="flex-1 py-2.5 border-2 border-paper-dark text-ink font-sans font-semibold text-sm hover:bg-paper-warm transition-colors cursor-pointer"
                >
                  取消
                </button>
                <button
                  onClick={handleSubmitOffer}
                  className="flex-1 py-2.5 bg-amber-film text-white font-sans font-bold text-sm hover:bg-amber-film/90 transition-colors cursor-pointer flex items-center justify-center gap-2"
                >
                  <Send className="w-4 h-4" />
                  发送邀约
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 发送成功提示 */}
      {showOfferSuccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/60">
          <div className="bg-paper border-2 border-film-green p-8 text-center animate-scale-in">
            <div className="w-16 h-16 bg-film-green rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8 text-white" />
            </div>
            <h3 className="font-display text-2xl text-ink mb-2">邀约已发送！</h3>
            <p className="font-sans text-sm text-ink-muted">等待对方回复...</p>
          </div>
        </div>
      )}
    </div>
  );
}
