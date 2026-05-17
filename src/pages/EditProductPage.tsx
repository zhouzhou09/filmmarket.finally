import { useState, useRef, useEffect } from 'react';
import { Upload, X, Check, Loader2, AlertCircle } from 'lucide-react';
import { categories } from '../data/mockData';
import { updateProduct, uploadFile, type ApiProduct } from '../lib/api';
import type { NavPage } from '../types';

interface EditProductPageProps {
  product: ApiProduct;
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

export default function EditProductPage({ product, onBack, onNavigate }: EditProductPageProps) {
  // 处理 images 字段（可能是字符串或数组）
  const initialImages = Array.isArray(product.images)
    ? product.images
    : typeof product.images === 'string'
      ? (() => {
          try { return JSON.parse(product.images); } catch { return [product.images]; }
        })()
      : [];

  // 处理 tags 字段
  const initialTags = Array.isArray(product.tags)
    ? product.tags
    : typeof product.tags === 'string'
      ? (() => {
          try { return JSON.parse(product.tags); } catch { return []; }
        })()
      : [];

  // 从 description 中提取 swapFor（如果 type 包含 swap）
  const swapForMatch = product.description?.match(/想换[：:]\s*(.+?)(?:\n|$)/);
  const initialSwapFor = swapForMatch ? swapForMatch[1] : '';

  const [listingType, setListingType] = useState<'sell' | 'swap' | 'both'>(
    (product.listingType as 'sell' | 'swap' | 'both') || 'sell'
  );
  const [images, setImages] = useState<string[]>(initialImages);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);

  // 表单数据
  const [formData, setFormData] = useState<{
    title: string;
    category: string;
    brand: string;
    condition: string;
    price: string;
    swapFor: string;
    description: string;
    tags: string[];
  }>({
    title: product.title || '',
    category: product.category || '',
    brand: product.brand || '',
    condition: product.condition || '',
    price: product.price ? String(product.price) : '',
    swapFor: initialSwapFor,
    description: product.description?.replace(/想换[：:]\s*.+?(?:\n|$)/g, '').trim() || '',
    tags: initialTags,
  });
  const [tagInput, setTagInput] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 图片上传
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    const remaining = 9 - images.length;
    if (remaining <= 0) {
      alert('最多只能上传9张图片');
      return;
    }
    const toUpload = files.slice(0, remaining);
    setUploadingImages(true);
    try {
      const urls = await Promise.all(toUpload.map(f => uploadFile(f).then(r => r.url)));
      setImages(prev => [...prev, ...urls]);
    } catch (err: any) {
      alert('图片上传失败：' + (err.message || '请重试'));
    } finally {
      setUploadingImages(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemoveImage = (index: number) => {
    setImages(imgs => imgs.filter((_, i) => i !== index));
  };

  // 标签操作
  const handleAddTag = () => {
    if (tagInput.trim() && formData.tags.length < 5 && !formData.tags.includes(tagInput.trim())) {
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

  // 提交更新
  const handleSubmit = async () => {
    if (!formData.title.trim()) {
      alert('请填写商品标题');
      return;
    }
    if (!formData.category) {
      alert('请选择商品品类');
      return;
    }
    if (!formData.condition) {
      alert('请选择商品成色');
      return;
    }
    if ((listingType === 'sell' || listingType === 'both') && !formData.price) {
      alert('请填写商品价格');
      return;
    }
    if (images.length === 0) {
      alert('请至少上传一张图片');
      return;
    }

    setIsSubmitting(true);
    setSubmitError('');
    try {
      const description = formData.description + (
        (listingType === 'swap' || listingType === 'both') && formData.swapFor
          ? `\n\n想换：${formData.swapFor}`
          : ''
      );

      await updateProduct(product.id, {
        title: formData.title,
        brand: formData.brand || formData.title,
        model: formData.brand ? `${formData.brand} ${formData.title}` : formData.title,
        category: formData.category,
        condition: formData.condition,
        price: formData.price ? parseInt(formData.price) : 0,
        type: listingType,
        images,
        description,
        tags: formData.tags,
      });
      setSubmitSuccess(true);
    } catch (err: any) {
      setSubmitError(err.message || '保存失败，请重试');
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
          <h2 className="font-display text-3xl text-ink mb-3">保存成功！</h2>
          <p className="font-sans text-ink-muted mb-8">你的商品信息已更新</p>
          <div className="flex gap-4 justify-center">
            <button onClick={onBack} className="btn-primary">
              返回
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
          <span className="font-display text-lg text-ink">编辑商品</span>
          <div className="text-sm font-sans text-ink-muted">编辑中</div>
        </div>
      </div>

      <div className="section-container py-6">
        {/* 基本信息 */}
        <div className="animate-fade-up">
          <h2 className="font-sans font-bold text-lg text-ink mb-6 flex items-center gap-2">
            <span className="w-6 h-6 bg-amber-film text-white text-xs font-bold rounded-full flex items-center justify-center">1</span>
            基本信息
          </h2>

          {/* 发布类型 */}
          <div className="mb-6">
            <label className="block text-xs font-sans font-bold text-ink-muted uppercase tracking-wider mb-2">发布类型</label>
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
                  ↔️ 以物换物
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

          {/* 标题 */}
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

          {/* 品类 & 品牌 */}
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
              <label className="block text-xs font-sans font-bold text-ink-muted uppercase tracking-wider mb-2">品牌</label>
              <input
                type="text"
                placeholder="如：Leica / Nikon / Kodak"
                value={formData.brand}
                onChange={(e) => setFormData(prev => ({ ...prev, brand: e.target.value }))}
                className="w-full px-3 py-2.5 border-2 border-paper-dark bg-white font-sans text-sm text-ink outline-none focus:border-amber-film transition-colors"
              />
            </div>
          </div>

          {/* 成色 */}
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

          {/* 价格 */}
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

          {/* 想换什么 */}
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
        </div>

        {/* 分隔线 */}
        <div className="border-t border-paper-dark my-8"></div>

        {/* 图片与描述 */}
        <div className="animate-fade-up">
          <h2 className="font-sans font-bold text-lg text-ink mb-6 flex items-center gap-2">
            <span className="w-6 h-6 bg-amber-film text-white text-xs font-bold rounded-full flex items-center justify-center">2</span>
            图片与描述
          </h2>

          {/* 图片上传 */}
          <div className="mb-6">
            <label className="block text-xs font-sans font-bold text-ink-muted uppercase tracking-wider mb-2">商品图片 * (最多9张)</label>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {images.map((img, i) => (
                <div key={i} className="relative aspect-square border-2 border-paper-dark overflow-hidden group">
                  <img src={img} alt="" className="w-full h-full object-cover" />
                  <button
                    onClick={() => handleRemoveImage(i)}
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

          {/* 描述 */}
          <div className="mb-6">
            <label className="block text-xs font-sans font-bold text-ink-muted uppercase tracking-wider mb-2">商品描述 *</label>
            <textarea
              rows={6}
              placeholder="详细描述商品状况，包括：购买时间、使用频率、是否有维修/翻新、功能是否正常、包装配件是否齐全等"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              className="w-full px-3 py-2.5 border-2 border-paper-dark bg-white font-sans text-sm text-ink outline-none focus:border-amber-film transition-colors resize-none"
            />
            <div className="text-right text-xs font-sans text-ink-muted mt-1">建议不少于50字</div>
          </div>

          {/* 标签 */}
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
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddTag();
                }
              }}
              className="w-full px-3 py-2.5 border-2 border-paper-dark bg-white font-sans text-sm text-ink outline-none focus:border-amber-film transition-colors"
            />
          </div>
        </div>

        {/* 错误提示 */}
        {submitError && (
          <div className="mb-4 p-4 bg-film-red/10 border border-film-red/30 flex items-center gap-2 text-film-red">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span className="text-sm font-sans">{submitError}</span>
          </div>
        )}

        {/* 提交按钮 */}
        <div className="flex gap-3 mt-8">
          <button onClick={onBack} className="btn-secondary flex-1 justify-center">
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="btn-primary flex-1 justify-center disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                保存中...
              </>
            ) : '保存修改'}
          </button>
        </div>
      </div>
    </div>
  );
}
