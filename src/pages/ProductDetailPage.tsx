import { ArrowLeft, Heart, Share2, Eye, Star, MapPin, Shield, ArrowLeftRight, ChevronLeft, ChevronRight, Package, X, ZoomIn, ZoomOut, RotateCcw, Maximize2, Move } from 'lucide-react';
import { useState, useEffect, useRef, useCallback } from 'react';
import type { Product } from '../types';
import { conditionLabels } from '../data/mockData';
import ProductCard from '../components/ProductCard';
import { useAppData } from '../context/DataContext';
import { useAuth } from '../hooks/useAuth';
import { addFavorite, removeFavorite, checkFavorite } from '../lib/api';
import OrderModal from '../components/OrderModal';
import ContactSellerModal from '../components/ContactSellerModal';
import type { Conversation } from '../lib/api';

interface ProductDetailPageProps {
  product: Product;
  onBack: () => void;
  onProductClick: (product: Product) => void;
  onNavigate?: (page: import('../types').NavPage) => void;
  onStartChat?: (conversation: Conversation) => void;
}

export default function ProductDetailPage({ product, onBack, onProductClick, onNavigate, onStartChat }: ProductDetailPageProps) {
  const { products, isFavorite, toggleFavorite } = useAppData();
  const { isAuthenticated } = useAuth();
  const [currentImage, setCurrentImage] = useState(0);
  const [isHovering, setIsHovering] = useState(false);
  const [zoomPosition, setZoomPosition] = useState({ x: 50, y: 50 });
  const [showLightbox, setShowLightbox] = useState(false);
  const [lightboxZoom, setLightboxZoom] = useState(1);
  const [lightboxDrag, setLightboxDrag] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [apiLiked, setApiLiked] = useState<boolean | null>(null);
  const [likeLoading, setLikeLoading] = useState(false);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);
  
  const mainImageRef = useRef<HTMLDivElement>(null);
  const thumbnailRef = useRef<HTMLDivElement>(null);
  
  // 已登录时从 API 检查收藏状态
  useEffect(() => {
    if (isAuthenticated && product.id) {
      checkFavorite(String(product.id))
        .then(res => setApiLiked(res.favorited))
        .catch(() => setApiLiked(null));
    }
  }, [isAuthenticated, product.id]);

  // 收藏/取消收藏
  const liked = isAuthenticated && apiLiked !== null ? apiLiked : isFavorite(product.id);

  const handleToggleLike = async () => {
    if (!isAuthenticated) {
      // 未登录：走本地收藏
      toggleFavorite(product.id);
      return;
    }
    if (likeLoading) return;
    setLikeLoading(true);
    try {
      if (liked) {
        await removeFavorite(String(product.id));
        setApiLiked(false);
      } else {
        await addFavorite(String(product.id));
        setApiLiked(true);
      }
    } catch {
      // 静默处理
    } finally {
      setLikeLoading(false);
    }
  };

  const related = products.filter(p => p.id !== product.id && p.category === product.category).slice(0, 4);

  // 悬停时计算缩放位置
  const handleImageHover = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!mainImageRef.current) return;
    const rect = mainImageRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setZoomPosition({ x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) });
  }, []);

  // 滚轮切换图片
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (product.images.length <= 1) return;
    if (e.deltaX > 30 || e.deltaX < -30) {
      // 水平滚动
      setCurrentImage(prev => e.deltaX > 0 
        ? Math.min(product.images.length - 1, prev + 1) 
        : Math.max(0, prev - 1)
      );
    }
  }, [product.images.length]);

  // 上一张/下一张
  const prevImage = () => setCurrentImage(prev => Math.max(0, prev - 1));
  const nextImage = () => setCurrentImage(prev => Math.min(product.images.length - 1, prev + 1));

  // ESC 键关闭灯箱
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowLightbox(false);
        setLightboxZoom(1);
        setLightboxDrag({ x: 0, y: 0 });
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, []);

  // 键盘导航图片
  useEffect(() => {
    const handleKeyNav = (e: KeyboardEvent) => {
      if (showLightbox) {
        if (e.key === 'ArrowLeft') {
          prevImage();
          setLightboxZoom(1);
          setLightboxDrag({ x: 0, y: 0 });
        } else if (e.key === 'ArrowRight') {
          nextImage();
          setLightboxZoom(1);
          setLightboxDrag({ x: 0, y: 0 });
        } else if (e.key === '+' || e.key === '=') {
          setLightboxZoom(prev => Math.min(3, prev + 0.5));
        } else if (e.key === '-') {
          setLightboxZoom(prev => Math.max(0.5, prev - 0.5));
        }
      }
    };
    window.addEventListener('keydown', handleKeyNav);
    return () => window.removeEventListener('keydown', handleKeyNav);
  }, [showLightbox]);

  // 灯箱拖拽
  const handleLightboxMouseDown = (e: React.MouseEvent) => {
    if (lightboxZoom > 1) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - lightboxDrag.x, y: e.clientY - lightboxDrag.y });
    }
  };

  const handleLightboxMouseMove = (e: React.MouseEvent) => {
    if (isDragging && lightboxZoom > 1) {
      setLightboxDrag({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  const handleLightboxMouseUp = () => {
    setIsDragging(false);
  };

  // 重置灯箱状态
  const resetLightbox = () => {
    setLightboxZoom(1);
    setLightboxDrag({ x: 0, y: 0 });
  };

  // 缩放级别选项
  const zoomLevels = [1, 1.5, 2, 2.5, 3];

  return (
    <div className="min-h-screen bg-paper pb-16">
      {/* Back button */}
      <div className="bg-paper-warm border-b border-paper-dark sticky top-14 z-20">
        <div className="section-container py-2">
          <button onClick={onBack} className="flex items-center gap-1.5 text-sm font-sans text-ink-muted hover:text-ink transition-colors cursor-pointer group">
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            返回列表
          </button>
        </div>
      </div>

      <div className="section-container py-6 lg:py-8">
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-12">
          {/* Left: Images */}
          <div className="animate-scale-in">
            {/* Main image with magnifier */}
            <div className="relative">
              <div 
                ref={mainImageRef}
                className="relative aspect-square bg-paper-warm border-2 border-ink overflow-hidden mb-3"
                onMouseEnter={() => setIsHovering(true)}
                onMouseLeave={() => setIsHovering(false)}
                onMouseMove={handleImageHover}
                onWheel={handleWheel}
                onClick={() => setShowLightbox(true)}
              >
                {/* 主图 */}
                <img
                  src={product.images[currentImage]}
                  alt={product.title}
                  className="w-full h-full object-cover transition-all duration-200"
                  style={{
                    transform: `scale(${isHovering ? 1.5 : 1})`,
                    transformOrigin: `${zoomPosition.x}% ${zoomPosition.y}%`
                  }}
                />
                
                {/* 放大镜提示 */}
                <div className="absolute bottom-3 right-3 bg-ink/70 text-white px-2 py-1 flex items-center gap-1 text-xs font-sans transition-opacity duration-200"
                  style={{ opacity: isHovering ? 1 : 0.5 }}
                >
                  <Maximize2 className="w-3 h-3" />
                  <span>悬停放大 · 点击全屏</span>
                </div>

                {/* 放大镜光标 */}
                {isHovering && (
                  <div 
                    className="absolute w-24 h-24 border-2 border-amber-film bg-white/10 pointer-events-none transform -translate-x-1/2 -translate-y-1/2"
                    style={{
                      left: `${zoomPosition.x}%`,
                      top: `${zoomPosition.y}%`,
                    }}
                  />
                )}

                {/* Condition badge */}
                <span className="condition-badge text-sm">{conditionLabels[product.condition]}</span>

                {/* Image navigation arrows */}
                {product.images.length > 1 && (
                  <>
                    <button
                      onClick={(e) => { e.stopPropagation(); prevImage(); }}
                      className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-ink/70 text-white flex items-center justify-center hover:bg-ink transition-all duration-200 cursor-pointer"
                      style={{ opacity: isHovering ? 1 : 0.7 }}
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); nextImage(); }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-ink/70 text-white flex items-center justify-center hover:bg-ink transition-all duration-200 cursor-pointer"
                      style={{ opacity: isHovering ? 1 : 0.7 }}
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </>
                )}

                {/* Top listed badge */}
                {product.isTopListed && (
                  <div className="absolute top-2 right-2 bg-amber-film px-2 py-0.5 animate-pulse">
                    <span className="text-white text-xs font-sans font-bold">⭐ 置顶</span>
                  </div>
                )}

                {/* Image counter */}
                <div className="absolute bottom-3 left-3 bg-ink/70 text-white px-2 py-1 text-xs font-sans">
                  {currentImage + 1} / {product.images.length}
                </div>

                {/* Drag hint */}
                {product.images.length > 1 && (
                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 text-white/50 text-xs font-sans"
                    style={{ opacity: isHovering ? 0 : 0.5 }}>
                    ← 滑动切换 →
                  </div>
                )}
              </div>
            </div>

            {/* Thumbnails with enhanced navigation */}
            {product.images.length > 1 && (
              <div className="relative group">
                <div 
                  ref={thumbnailRef}
                  className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide snap-x snap-mandatory touch-pan-x"
                >
                  {product.images.map((img, i) => (
                    <button
                      key={i}
                      onClick={() => setCurrentImage(i)}
                      className={`flex-shrink-0 w-16 h-16 lg:w-20 lg:h-20 border-2 overflow-hidden cursor-pointer transition-all duration-200 snap-center
                        ${currentImage === i 
                          ? 'border-amber-film scale-110 shadow-retro-sm z-10' 
                          : 'border-paper-dark hover:border-ink hover:scale-105'}`}
                    >
                      <img src={img} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
                
                {/* Thumbnail scroll indicators */}
                {product.images.length > 4 && (
                  <>
                    <div className="absolute left-0 top-0 bottom-6 w-8 bg-gradient-to-r from-paper to-transparent pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="absolute right-0 top-0 bottom-6 w-8 bg-gradient-to-l from-paper to-transparent pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity" />
                  </>
                )}
              </div>
            )}

            {/* Stats with animation */}
            <div className="flex gap-6 mt-4 text-ink-muted text-sm font-sans">
              <span className="flex items-center gap-1.5 hover:text-ink transition-colors">
                <Eye className="w-4 h-4" /> 
                <span className="font-sans">{product.views}</span> 次浏览
              </span>
              <span className="flex items-center gap-1.5 hover:text-film-red transition-colors cursor-pointer">
                <Heart className={`w-4 h-4 transition-transform hover:scale-110 ${liked ? 'fill-film-red text-film-red animate-pulse' : ''}`} /> 
                <span className="font-sans">{product.likes + (liked ? 1 : 0)}</span> 人收藏
              </span>
            </div>
          </div>

          {/* Right: Details */}
          <div>
            {/* Tags */}
            <div className="flex flex-wrap gap-1.5 mb-3">
              {product.tags.map(tag => (
                <span key={tag} className="badge-vintage">{tag}</span>
              ))}
            </div>

            {/* Title */}
            <h1 className="font-sans font-bold text-2xl text-ink leading-snug mb-4">{product.title}</h1>

            {/* Price / Swap */}
            <div className="bg-paper-warm border border-paper-dark p-4 mb-5">
              {product.listingType === 'swap' ? (
                <div>
                  <div className="font-display text-3xl text-amber-film mb-1">仅换不卖</div>
                  {product.swapFor && (
                    <p className="font-sans text-sm text-ink-muted">
                      <ArrowLeftRight className="inline w-3.5 h-3.5 mr-1" />
                      想换：{product.swapFor}
                    </p>
                  )}
                </div>
              ) : (
                <div>
                  <div className="font-display text-4xl text-ink mb-1">¥{product.price.toLocaleString()}</div>
                  {product.listingType === 'both' && product.swapFor && (
                    <p className="font-sans text-sm text-amber-film">
                      <ArrowLeftRight className="inline w-3.5 h-3.5 mr-1" />
                      也接受换物：{product.swapFor}
                    </p>
                  )}
                </div>
              )}

              {/* Condition */}
              <div className="mt-3 pt-3 border-t border-paper-dark flex items-center gap-3">
                <span className="text-xs font-sans text-ink-muted">成色：</span>
                <span className="px-2 py-0.5 bg-ink text-paper text-xs font-sans font-bold">
                  {conditionLabels[product.condition]}
                </span>
                <span className="text-xs font-sans text-ink-muted ml-auto">
                  <Package className="inline w-3.5 h-3.5 mr-0.5" />
                  {product.seller.location} 发货
                </span>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-3 mb-6">
              {product.listingType !== 'swap' && (
                <button
                  onClick={() => {
                    if (!isAuthenticated) {
                      onNavigate?.('auth');
                      return;
                    }
                    setShowOrderModal(true);
                  }}
                  className="btn-primary flex-1 justify-center"
                >
                  立即购买
                </button>
              )}
              {(product.listingType === 'swap' || product.listingType === 'both') && (
                <button
                  onClick={() => {
                    if (!isAuthenticated) {
                      onNavigate?.('auth');
                      return;
                    }
                    // 跳转到换物页，带入目标商品
                    onNavigate?.('swap');
                  }}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-paper text-ink font-sans font-semibold text-sm border-2 border-amber-film hover:bg-amber-film hover:text-white transition-all duration-150 cursor-pointer"
                >
                  <ArrowLeftRight className="w-4 h-4" />
                  发起换物
                </button>
              )}
              <button
                onClick={handleToggleLike}
                className={`px-3 py-2.5 border-2 transition-all duration-150 cursor-pointer
                  ${liked ? 'bg-film-red border-film-red text-white' : 'border-ink text-ink hover:border-film-red hover:text-film-red'}`}
              >
                <Heart className={`w-5 h-5 ${liked ? 'fill-white' : ''}`} />
              </button>
              <button
                onClick={() => {
                  const shareText = `${product.title} — ¥${product.price} | FilmMarket 胶片交易平台`;
                  if (navigator.share) {
                    navigator.share({ title: product.title, text: shareText, url: window.location.href });
                  } else {
                    navigator.clipboard.writeText(`${shareText}\n${window.location.href}`).then(() => {
                      alert('链接已复制到剪贴板！');
                    });
                  }
                }}
                title="分享商品"
                className="px-3 py-2.5 border-2 border-ink text-ink hover:bg-paper-warm transition-all duration-150 cursor-pointer"
              >
                <Share2 className="w-5 h-5" />
              </button>
            </div>

            {/* Description */}
            <div className="mb-6">
              <h3 className="font-sans font-bold text-sm text-ink uppercase tracking-wider mb-2 border-b border-paper-dark pb-2">商品描述</h3>
              <p className="font-body text-sm text-ink-muted leading-relaxed">{product.description}</p>
            </div>

            {/* Seller info */}
            <div className="border-2 border-ink p-4">
              <h3 className="font-sans font-bold text-xs text-ink uppercase tracking-wider mb-3">卖家信息</h3>
              <div className="flex items-center gap-3 mb-3">
                <img
                  src={product.seller.avatar}
                  alt={product.seller.name}
                  className="w-12 h-12 rounded-full border-2 border-ink object-cover"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-sans font-bold text-ink">{product.seller.name}</span>
                    {product.seller.badge === 'premium' && (
                      <span className="text-xs bg-amber-film text-white px-1.5 py-0.5 font-sans font-bold">品质商家</span>
                    )}
                    {product.seller.badge === 'verified' && (
                      <span className="text-xs bg-ink text-paper px-1.5 py-0.5 font-sans font-bold">认证</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-xs font-sans text-ink-muted">
                    <span className="flex items-center gap-0.5">
                      <Star className="w-3 h-3 fill-amber-film text-amber-film" />
                      {product.seller.rating} ({product.seller.reviewCount}条评价)
                    </span>
                    <span className="flex items-center gap-0.5">
                      <MapPin className="w-3 h-3" />
                      {product.seller.location}
                    </span>
                  </div>
                </div>
              </div>

              {/* Trust indicators */}
              <div className="grid grid-cols-3 gap-2 pt-3 border-t border-paper-dark text-center">
                <div>
                  <div className="font-sans font-bold text-ink text-sm">{product.seller.reviewCount}</div>
                  <div className="text-xs font-sans text-ink-muted">成交评价</div>
                </div>
                <div>
                  <div className="font-sans font-bold text-ink text-sm">{2026 - product.seller.joinedYear}年</div>
                  <div className="text-xs font-sans text-ink-muted">入驻时长</div>
                </div>
                <div>
                  <div className="flex justify-center"><Shield className="w-4 h-4 text-film-green" /></div>
                  <div className="text-xs font-sans text-film-green">交易保障</div>
                </div>
              </div>

              <button
                onClick={() => setShowContactModal(true)}
                className="w-full mt-3 py-2 border border-ink text-ink font-sans font-semibold text-sm hover:bg-ink hover:text-paper transition-colors cursor-pointer">
                联系卖家
              </button>
            </div>
          </div>
        </div>

        {/* Related products */}
        {related.length > 0 && (
          <div className="mt-14">
            <h2 className="section-title mb-6">同类好物</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {related.map((p, index) => (
                <div key={p.id} className="animate-fade-up" style={{ animationDelay: `${index * 100}ms` }}>
                  <ProductCard product={p} onClick={onProductClick} />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Enhanced Lightbox */}
      {showLightbox && (
        <div 
          className="fixed inset-0 z-50 bg-ink/98 flex flex-col animate-fade-in"
          onClick={() => setShowLightbox(false)}
          onMouseMove={handleLightboxMouseMove}
          onMouseUp={handleLightboxMouseUp}
          onMouseLeave={handleLightboxMouseUp}
        >
          {/* Top controls */}
          <div className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-ink/80 to-transparent p-4">
            <div className="flex items-center justify-between">
              {/* Image info */}
              <div className="text-white font-sans">
                <span className="text-lg font-bold">{currentImage + 1}</span>
                <span className="text-white/50"> / {product.images.length}</span>
              </div>
              
              {/* Control buttons */}
              <div className="flex items-center gap-2">
                {/* Zoom level buttons */}
                <div className="flex items-center gap-1 mr-2">
                  <span className="text-white/50 text-xs font-sans mr-1">缩放:</span>
                  {zoomLevels.map(level => (
                    <button
                      key={level}
                      onClick={(e) => { e.stopPropagation(); setLightboxZoom(level); }}
                      className={`px-2 py-1 text-xs font-sans transition-colors cursor-pointer
                        ${lightboxZoom === level 
                          ? 'bg-amber-film text-white' 
                          : 'bg-white/10 text-white/70 hover:bg-white/20'}`}
                    >
                      {level}x
                    </button>
                  ))}
                </div>
                
                <button
                  onClick={(e) => { e.stopPropagation(); prevImage(); resetLightbox(); }}
                  className="w-10 h-10 bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-colors cursor-pointer"
                  title="上一张 (←)"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); nextImage(); resetLightbox(); }}
                  className="w-10 h-10 bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-colors cursor-pointer"
                  title="下一张 (→)"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); resetLightbox(); }}
                  className="w-10 h-10 bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-colors cursor-pointer"
                  title="重置"
                >
                  <RotateCcw className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setShowLightbox(false)}
                  className="w-10 h-10 bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-colors cursor-pointer"
                  title="关闭 (Esc)"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>

          {/* Main image area */}
          <div 
            className="flex-1 flex items-center justify-center overflow-hidden cursor-grab active:cursor-grabbing"
            onClick={(e) => e.stopPropagation()}
            onMouseDown={handleLightboxMouseDown}
          >
            <img
              src={product.images[currentImage]}
              alt={product.title}
              className="max-w-full max-h-full object-contain transition-transform duration-200 select-none"
              style={{ 
                transform: `scale(${lightboxZoom}) translate(${lightboxDrag.x / lightboxZoom}px, ${lightboxDrag.y / lightboxZoom}px)`,
                cursor: lightboxZoom > 1 ? (isDragging ? 'grabbing' : 'grab') : 'zoom-in'
              }}
              draggable={false}
            />
            
            {/* Drag hint */}
            {lightboxZoom > 1 && !isDragging && (
              <div className="absolute bottom-20 left-1/2 -translate-x-1/2 bg-ink/70 text-white/70 px-3 py-1 rounded-full text-xs font-sans flex items-center gap-1">
                <Move className="w-3 h-3" />
                拖拽移动
              </div>
            )}
          </div>

          {/* Bottom thumbnail strip */}
          <div className="absolute bottom-0 left-0 right-0 z-10 bg-gradient-to-t from-ink/80 to-transparent p-4">
            <div className="flex justify-center">
              <div className="flex gap-2 bg-ink/50 p-2 rounded-lg backdrop-blur-sm max-w-full overflow-x-auto scrollbar-hide">
                {product.images.map((img, i) => (
                  <button
                    key={i}
                    onClick={(e) => { e.stopPropagation(); setCurrentImage(i); resetLightbox(); }}
                    className={`flex-shrink-0 w-14 h-14 border-2 overflow-hidden cursor-pointer transition-all duration-200
                      ${currentImage === i 
                        ? 'border-amber-film scale-110 ring-2 ring-amber-film/50' 
                        : 'border-white/20 hover:border-white/60'}`}
                  >
                    <img src={img} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
            
            {/* Keyboard shortcuts hint */}
            <div className="text-center mt-2 text-white/30 text-xs font-sans">
              ← → 切换图片 · +/- 缩放 · Esc 关闭
            </div>
          </div>
        </div>
      )}

      {/* 订单购买弹窗 */}
      {showOrderModal && (
        <OrderModal
          product={product}
          onClose={() => setShowOrderModal(false)}
        />
      )}

      {/* 联系卖家弹窗 */}
      {showContactModal && (
        <ContactSellerModal
          product={product}
          onClose={() => setShowContactModal(false)}
          onLoginRequest={() => onNavigate?.('auth')}
          onStartChat={onStartChat}
        />
      )}
    </div>
  );
}
