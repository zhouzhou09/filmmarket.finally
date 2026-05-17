import { useState, useRef } from 'react';
import { Upload, X, ArrowLeftRight, Camera, Check, Loader2 } from 'lucide-react';
import { categories } from '../data/mockData';
import { useAuth } from '../hooks/useAuth';
import { createProduct, uploadFile } from '../lib/api';
import type { NavPage } from '../types';

interface PostPageProps {
  onBack: () => void;
  onNavigate: (page: NavPage) => void;
}

const conditions = [
  { value: 'N', label: '全新未拆' },
  { value: '9.5', label: '95新（几乎全新）' },
  { value: '9', label: '9成新（正常使用）' },
  { value: '8', label: '8成新（有轻微使用痕迹）' },
  { value: '7', label: '7成新（明显磨损）' },
  { value: 'P', label: '配件机（有故障）' },
];

const topPackages = [
  {
    id: 'basic',
    name: '基础曝光',
    price: 29,
    duration: '3天',
    desc: '适合个人卖家，快速出手',
    features: ['置顶3天', '首页分类展示'],
  },
  {
    id: 'hot',
    name: '热门推荐',
    price: 69,
    duration: '7天',
    desc: '适合频繁卖家，持续曝光',
    features: ['置顶7天', '热门推荐位', '更多曝光'],
    recommended: true,
  },
  {
    id: 'spotlight',
    name: '首页焦点',
    price: 199,
    duration: '7天',
    desc: '适合商家/高价商品',
    features: ['首页焦点位置', '永久置顶7天', '专属标签'],
  },
];

export default function PostPage({ onBack, onNavigate }: PostPageProps) {
  const { isAuthenticated } = useAuth();
  const [step, setStep] = useState(1);
  const [listingType, setListingType] = useState<'sell' | 'swap' | 'both'>('sell');
  const [images, setImages] = useState<string[]>([]);
  const [selectedPackage, setSelectedPackage] = useState<string>('none');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [uploadingImages, setUploadingImages] = useState(false);
  // 表单数据
  const [formData, setFormData] = useState({
    title: '',
    category: '',
    brand: '',
    condition: '',
    price: '',
    swapFor: '',
    description: '',
    tags: [] as string[],
  });
  const [tagInput, setTagInput] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 真实图片上传
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    const remaining = 9 - images.length;
    const toUpload = files.slice(0, remaining);
    setUploadingImages(true);
    try {
      const urls = await Promise.all(toUpload.map(f => uploadFile(f).then(r => r.url)));
      setImages(prev => [...prev, ...urls]);
    } catch (err: any) {
      alert('图片上传失败：' + (err.message || '请重试'));
    } finally {
      setUploadingImages(false);
      // 清空 input，允许重复选同一文件
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleAddTag = () => {
    if (tagInput.trim() && formData.tags.length < 5) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, tagInput.trim()]
      }));
      setTagInput('');
    }
  };

  const handleRemoveTag = (index: number) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = async () => {
    if (!isAuthenticated) {
      alert('请先登录');
      onNavigate('auth');
      return;
    }
    if (!formData.title || !formData.category || !formData.condition) {
      alert('请填写必填项（标题、品类、成色）');
      return;
    }
    if ((listingType === 'sell' || listingType === 'both') && !formData.price) {
      alert('请填写价格');
      return;
    }
    if (listingType === 'swap' && !formData.swapFor) {
      alert('请填写想换的物品');
      return;
    }
    if (images.length === 0) {
      alert('请上传至少一张图片');
      return;
    }

    setIsSubmitting(true);
    setSubmitError('');
    try {
      await createProduct({
        title: formData.title,
        brand: formData.brand || formData.title,
        model: formData.brand ? `${formData.brand} ${formData.title}` : formData.title,
        category: formData.category,
        condition: formData.condition,
        price: formData.price ? parseInt(formData.price) : 0,
        type: listingType,
        images,
        description: formData.description + (formData.swapFor ? `\n\n想换：${formData.swapFor}` : ''),
        tags: formData.tags,
      });
      setSubmitSuccess(true);
    } catch (err: any) {
      setSubmitError(err.message || '发布失败，请重试');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 提交成功后的成功页面
  if (submitSuccess) {
    return (
      <div className="min-h-screen bg-paper pb-16 flex items-center justify-center">
        <div className="text-center px-6">
          <div className="w-20 h-20 bg-film-green rounded-full flex items-center justify-center mx-auto mb-6">
            <Check className="w-10 h-10 text-white" />
          </div>
          <h2 className="font-display text-3xl text-ink mb-3">发布成功！</h2>
          <p className="font-sans text-ink-muted mb-8">你的商品已成功发布，快去看看吧</p>
          <div className="flex gap-4 justify-center">
            <button onClick={() => onNavigate('discover')} className="btn-primary">
              去逛逛
            </button>
            <button onClick={onBack} className="btn-secondary">
              再发一条
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper pb-16">
      {/* Header */}
      <div className="bg-paper-warm border-b-2 border-ink sticky top-14 z-20">
        <div className="section-container py-3 flex items-center justify-between">
          <button onClick={onBack} className="flex items-center gap-1.5 text-sm font-sans text-ink-muted hover:text-ink transition-colors cursor-pointer">
            ← 返回
          </button>
          <span className="font-display text-lg text-ink">发布商品</span>
          <div className="text-sm font-sans text-ink-muted">{step}/3</div>
        </div>
        {/* Progress */}
        <div className="section-container pb-3">
          <div className="flex gap-2">
            {[1, 2, 3].map((s) => (
              <div key={s} className={`flex-1 h-1 ${step >= s ? 'bg-amber-film' : 'bg-paper-dark'} transition-colors`} />
            ))}
          </div>
        </div>
      </div>

      <div className="section-container py-8">
        {/* Step 1: Basic Info */}
        {step === 1 && (
          <div className="animate-fade-up">
            <h2 className="font-sans font-bold text-lg text-ink mb-6">基本信息</h2>

            {/* Listing type */}
            <div className="mb-6">
              <label className="block text-xs font-sans font-bold text-ink-muted uppercase tracking-wider mb-2">发布类型 *</label>
              <div className="grid grid-cols-3 gap-3">
                <button
                  onClick={() => setListingType('sell')}
                  className={`p-4 border-2 text-left cursor-pointer transition-all
                    ${listingType === 'sell' ? 'border-ink bg-paper-warm' : 'border-paper-dark hover:border-ink'}`}
                >
                  <div className="font-sans font-bold text-sm text-ink mb-1">💰 出售</div>
                  <div className="text-xs font-sans text-ink-muted">明码标价，快速成交</div>
                </button>
                <button
                  onClick={() => setListingType('swap')}
                  className={`p-4 border-2 text-left cursor-pointer transition-all
                    ${listingType === 'swap' ? 'border-amber-film bg-amber-film/5' : 'border-paper-dark hover:border-amber-film'}`}
                >
                  <div className="font-sans font-bold text-sm text-ink mb-1 flex items-center gap-1">
                    <ArrowLeftRight className="w-4 h-4 text-amber-film" />
                    以物换物
                  </div>
                  <div className="text-xs font-sans text-ink-muted">换你想要的，不花钱</div>
                </button>
                <button
                  onClick={() => setListingType('both')}
                  className={`p-4 border-2 text-left cursor-pointer transition-all
                    ${listingType === 'both' ? 'border-ink bg-paper-warm' : 'border-paper-dark hover:border-ink'}`}
                >
                  <div className="font-sans font-bold text-sm text-ink mb-1">🔄 售/换均可</div>
                  <div className="text-xs font-sans text-ink-muted">灵活选择，买家可协商</div>
                </button>
              </div>
            </div>

            {/* Title */}
            <div className="mb-5">
              <label className="block text-xs font-sans font-bold text-ink-muted uppercase tracking-wider mb-2">商品标题 *</label>
              <input
                type="text"
                placeholder="如：Leica M6 经典旁轴 成色极佳"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                className="w-full px-3 py-2.5 border-2 border-paper-dark bg-white font-sans text-sm text-ink outline-none focus:border-amber-film transition-colors"
              />
            </div>

            {/* Category & Brand */}
            <div className="grid grid-cols-2 gap-4 mb-5">
              <div>
                <label className="block text-xs font-sans font-bold text-ink-muted uppercase tracking-wider mb-2">品类 *</label>
                <select 
                  value={formData.category}
                  onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                  className="w-full px-3 py-2.5 border-2 border-paper-dark bg-white font-sans text-sm text-ink outline-none focus:border-amber-film transition-colors cursor-pointer"
                >
                  <option value="">选择品类</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-sans font-bold text-ink-muted uppercase tracking-wider mb-2">品牌 *</label>
                <input
                  type="text"
                  placeholder="如：Leica / Nikon / Kodak"
                  value={formData.brand}
                  onChange={(e) => setFormData(prev => ({ ...prev, brand: e.target.value }))}
                  className="w-full px-3 py-2.5 border-2 border-paper-dark bg-white font-sans text-sm text-ink outline-none focus:border-amber-film transition-colors"
                />
              </div>
            </div>

            {/* Condition */}
            <div className="mb-6">
              <label className="block text-xs font-sans font-bold text-ink-muted uppercase tracking-wider mb-2">成色 *</label>
              <div className="grid grid-cols-3 gap-2">
                {conditions.map(c => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, condition: c.value }))}
                    className={`px-3 py-2 border-2 text-left font-sans text-sm cursor-pointer transition-colors bg-white
                      ${formData.condition === c.value 
                        ? 'border-amber-film bg-amber-film/5' 
                        : 'border-paper-dark hover:border-ink'}`}
                  >
                    <div className="font-bold">{c.label}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Price */}
            {(listingType === 'sell' || listingType === 'both') && (
              <div className="mb-5">
                <label className="block text-xs font-sans font-bold text-ink-muted uppercase tracking-wider mb-2">出售价格 (¥) *</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-sans text-ink-muted">¥</span>
                  <input
                    type="number"
                    placeholder="0"
                    value={formData.price}
                    onChange={(e) => setFormData(prev => ({ ...prev, price: e.target.value }))}
                    className="w-full pl-8 pr-3 py-2.5 border-2 border-paper-dark bg-white font-sans text-lg font-bold text-ink outline-none focus:border-amber-film transition-colors"
                  />
                </div>
              </div>
            )}

            {/* Swap for */}
            {(listingType === 'swap' || listingType === 'both') && (
              <div className="mb-5">
                <label className="block text-xs font-sans font-bold text-ink-muted uppercase tracking-wider mb-2">
                  想换什么 *
                </label>
                <input
                  type="text"
                  placeholder="描述你想换到的物品，如：Contax T2 / Ricoh GR1s"
                  value={formData.swapFor}
                  onChange={(e) => setFormData(prev => ({ ...prev, swapFor: e.target.value }))}
                  className="w-full px-3 py-2.5 border-2 border-paper-dark bg-white font-sans text-sm text-ink outline-none focus:border-amber-film transition-colors"
                />
              </div>
            )}

            <button onClick={() => setStep(2)} className="btn-primary w-full justify-center mt-4">
              下一步：添加图片与描述
            </button>
          </div>
        )}

        {/* Step 2: Images & Description */}
        {step === 2 && (
          <div className="animate-fade-up">
            <h2 className="font-sans font-bold text-lg text-ink mb-6">图片与描述</h2>

            {/* Image upload */}
            <div className="mb-6">
              <label className="block text-xs font-sans font-bold text-ink-muted uppercase tracking-wider mb-2">商品图片 * (最多9张)</label>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {images.map((img, i) => (
                  <div key={i} className="relative aspect-square border-2 border-paper-dark overflow-hidden group">
                    <img src={img} alt="" className="w-full h-full object-cover" />
                    <button
                      onClick={() => setImages(imgs => imgs.filter((_, idx) => idx !== i))}
                      className="absolute top-1 right-1 w-5 h-5 bg-ink/80 text-white flex items-center justify-center cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-3 h-3" />
                    </button>
                    {i === 0 && (
                      <div className="absolute bottom-0 left-0 right-0 bg-ink/80 text-paper text-center text-xs font-sans py-0.5">封面</div>
                    )}
                  </div>
                ))}
                {images.length < 9 && (
                  <>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={handleImageUpload}
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingImages}
                      className="aspect-square border-2 border-dashed border-paper-dark hover:border-amber-film flex flex-col items-center justify-center gap-1 cursor-pointer bg-paper-warm/50 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {uploadingImages ? (
                        <Loader2 className="w-6 h-6 text-ink-muted animate-spin" />
                      ) : (
                        <Upload className="w-6 h-6 text-ink-muted" />
                      )}
                      <span className="text-xs font-sans text-ink-muted">{uploadingImages ? '上传中...' : '上传图片'}</span>
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Description */}
            <div className="mb-6">
              <label className="block text-xs font-sans font-bold text-ink-muted uppercase tracking-wider mb-2">商品描述 *</label>
              <textarea
                rows={6}
                placeholder="详细描述商品状况，包括：购买时间、使用频率、是否有维修/翻新、功能是否正常、包装配件是否齐全等。描述越详细，买家越信任！"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                className="w-full px-3 py-2.5 border-2 border-paper-dark bg-white font-sans text-sm text-ink outline-none focus:border-amber-film transition-colors resize-none"
              />
              <div className="text-right text-xs font-sans text-ink-muted mt-1">建议不少于50字</div>
            </div>

            {/* Tags */}
            <div className="mb-6">
              <label className="block text-xs font-sans font-bold text-ink-muted uppercase tracking-wider mb-2">标签（选填，最多5个）</label>
              <div className="flex flex-wrap gap-2 mb-2">
                {formData.tags.map((tag, i) => (
                  <span key={i} className="inline-flex items-center gap-1 px-2 py-1 bg-ink/10 text-ink text-xs font-sans">
                    {tag}
                    <button 
                      type="button"
                      onClick={() => handleRemoveTag(i)}
                      className="hover:text-film-red cursor-pointer"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
              <input
                type="text"
                placeholder="输入标签，按回车添加，如：德产 / 蔡司镜头 / 人像推荐"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                className="w-full px-3 py-2.5 border-2 border-paper-dark bg-white font-sans text-sm text-ink outline-none focus:border-amber-film transition-colors"
              />
            </div>

            <div className="flex gap-3">
              <button onClick={() => setStep(1)} className="btn-secondary flex-1 justify-center">上一步</button>
              <button onClick={() => setStep(3)} className="btn-primary flex-1 justify-center">下一步：推广与发布</button>
            </div>
          </div>
        )}

        {/* Step 3: Promotion & Publish */}
        {step === 3 && (
          <div className="animate-fade-up">
            <h2 className="font-sans font-bold text-lg text-ink mb-2">推广与发布</h2>
            <p className="font-sans text-sm text-ink-muted mb-6">置顶推广让商品获得更多曝光，快速成交</p>

            {/* Promotion packages */}
            <div className="mb-6">
              <label className="block text-xs font-sans font-bold text-ink-muted uppercase tracking-wider mb-3">选择推广套餐（可选）</label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {topPackages.map(pkg => (
                  <button
                    key={pkg.id}
                    onClick={() => setSelectedPackage(selectedPackage === pkg.id ? 'none' : pkg.id)}
                    className={`p-4 border-2 text-left cursor-pointer transition-all relative
                      ${selectedPackage === pkg.id ? 'border-amber-film bg-amber-film/5' : 'border-paper-dark hover:border-ink'}`}
                  >
                    {pkg.recommended && (
                      <div className="absolute -top-2.5 left-3 bg-amber-film px-2 py-0.5 text-white text-xs font-sans font-bold">推荐</div>
                    )}
                    <div className="flex items-start justify-between mb-2">
                      <span className="font-sans font-bold text-sm text-ink">{pkg.name}</span>
                      <span className="font-display text-lg text-amber-film">¥{pkg.price}</span>
                    </div>
                    <div className="text-xs font-sans text-ink-muted mb-2">{pkg.duration}</div>
                    <ul className="space-y-0.5">
                      {pkg.features.map(f => (
                        <li key={f} className="flex items-center gap-1 text-xs font-sans text-ink-muted">
                          <Check className="w-3 h-3 text-film-green flex-shrink-0" />
                          {f}
                        </li>
                      ))}
                    </ul>
                    {selectedPackage === pkg.id && (
                      <div className="mt-3 pt-2 border-t border-amber-film/20">
                        <span className="text-xs font-sans text-amber-film font-bold flex items-center gap-1">
                          <Check className="w-3 h-3" /> 已选择
                        </span>
                      </div>
                    )}
                  </button>
                ))}
              </div>
              <p className="text-xs font-sans text-ink-muted mt-2 flex items-center gap-1">
                <Camera className="w-3 h-3" />
                不选择则按普通方式发布，无需付费
              </p>
            </div>

            {/* Fee summary */}
            <div className="bg-paper-warm border border-paper-dark p-4 mb-6">
              <h3 className="font-sans font-bold text-sm text-ink mb-3">费用明细</h3>
              <div className="space-y-2 text-sm font-sans">
                <div className="flex justify-between">
                  <span className="text-ink-muted">平台服务费</span>
                  <span className="text-ink">成交价 3%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-muted">置顶推广</span>
                  <span className="text-ink">
                    {selectedPackage === 'none' ? '暂不选择' : `¥${topPackages.find(p => p.id === selectedPackage)?.price}`}
                  </span>
                </div>
                <div className="border-t border-paper-dark pt-2 flex justify-between font-bold">
                  <span className="text-ink">应付总额</span>
                  <span className="text-amber-film">
                    {selectedPackage === 'none' ? '¥0（发布免费）' : `¥${topPackages.find(p => p.id === selectedPackage)?.price}`}
                  </span>
                </div>
              </div>
            </div>

            {/* Agreement */}
            <div className="mb-5 text-xs font-sans text-ink-muted leading-relaxed">
              点击"立即发布"即表示你同意
              <a href="#" className="text-amber-film hover:underline cursor-pointer mx-1">《FilmMarket用户协议》</a>
              并确认所发布商品信息真实有效。
              禁止发布假冒伪劣商品，违规将冻结账号。
            </div>

            <div className="flex gap-3">
              <button onClick={() => setStep(2)} className="btn-secondary flex-1 justify-center">上一步</button>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="btn-primary flex-1 justify-center disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    发布中...
                  </>
                ) : '立即发布'}
              </button>
            </div>
            {submitError && (
              <p className="mt-3 text-center text-sm font-sans text-film-red">{submitError}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
