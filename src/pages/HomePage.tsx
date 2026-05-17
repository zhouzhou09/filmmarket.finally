import { ArrowRight, Camera, Zap, Shield, ArrowLeftRight, TrendingUp, Star, ChevronRight } from 'lucide-react';
import { useState, useEffect } from 'react';
import { categories } from '../data/mockData';
import ProductCard from '../components/ProductCard';
import type { NavPage, Product } from '../types';
import { useAppData } from '../context/DataContext';
import { getSwaps, type SwapRequest } from '../lib/api';

interface HomePageProps {
  onNavigate: (page: NavPage) => void;
  onProductClick: (product: Product) => void;
  onNavigateToCategory?: (category: string) => void;
}

const stats = [
  { label: '在售商品', value: '12,840+' },
  { label: '认证卖家', value: '2,300+' },
  { label: '换物成功', value: '8,600+' },
  { label: '活跃玩家', value: '45,000+' },
];

// Hero 轮播数据
const heroSlides = [
  {
    id: 1,
    image: '/images/hero1.webp',
    tag: '🔥 热门推荐',
    title: 'Leica M6 Classic',
    subtitle: '成色极佳，仅换不卖',
    price: '¥12,800',
  },
  {
    id: 2,
    image: '/images/hero2.webp',
    tag: '⭐ 精选',
    title: 'Nikon FM2 钛金版',
    subtitle: '附赠原装镜头，成色95新',
    price: '¥4,500',
  },
  {
    id: 3,
    image: '/images/hero3.webp',
    tag: '🎁 以物换物',
    title: 'Rolleiflex 3.5F',
    subtitle: '想换徕卡M系列',
    price: '仅换不卖',
  },
];

export default function HomePage({ onNavigate, onProductClick, onNavigateToCategory }: HomePageProps) {
  const { products } = useAppData();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);
  const [isHovering, setIsHovering] = useState(false);
  const [homeSwaps, setHomeSwaps] = useState<SwapRequest[]>([]);

  const featuredProducts = products.filter((p) => p.isFeatured).slice(0, 4);
  const recentProducts = products.slice(0, 8);
  const openSwaps = homeSwaps.slice(0, 3);

  // 加载换物广场数据
  useEffect(() => {
    getSwaps().then(setHomeSwaps).catch(() => {});
  }, []);

  // 自动轮播
  useEffect(() => {
    if (isAutoPlaying && !isHovering) {
      const timer = setInterval(() => {
        setCurrentSlide((prev) => (prev + 1) % heroSlides.length);
      }, 5000);
      return () => clearInterval(timer);
    }
  }, [isAutoPlaying, isHovering]);

  const nextSlide = () => setCurrentSlide((prev) => (prev + 1) % heroSlides.length);
  const prevSlide = () => setCurrentSlide((prev) => (prev - 1 + heroSlides.length) % heroSlides.length);

  return (
    <div className="min-h-screen">
      {/* ─── HERO CAROUSEL ─── */}
      <section 
        className="relative h-[500px] lg:h-[550px] overflow-hidden"
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
      >
        {/* Slides */}
        {heroSlides.map((slide, index) => (
          <div
            key={slide.id}
            className={`absolute inset-0 transition-opacity duration-1000 ${
              index === currentSlide ? 'opacity-100' : 'opacity-0'
            }`}
          >
            {/* Background Image */}
            <div className="absolute inset-0 bg-cover bg-center transform scale-105 transition-transform duration-[5000ms]"
              style={{ 
                backgroundImage: `url(${slide.image})`,
                transform: index === currentSlide ? 'scale(1)' : 'scale(1.05)'
              }}
            />
            {/* Overlay */}
            <div className="absolute inset-0 bg-gradient-to-r from-ink/90 via-ink/70 to-ink/40" />
            {/* Grain texture */}
            <div className="absolute inset-0 bg-grain opacity-30" />
          </div>
        ))}

        {/* Content */}
        <div className="relative z-10 h-full flex items-center">
          <div className="section-container">
            <div className="max-w-2xl">
              {/* Tag */}
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-film/90 text-white text-xs font-sans font-bold uppercase tracking-wider mb-6">
                <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></span>
                {heroSlides[currentSlide].tag}
              </div>

              {/* Title */}
              <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl text-white leading-tight mb-4">
                {heroSlides[currentSlide].title}
              </h1>

              {/* Subtitle */}
              <p className="font-body text-white/80 text-lg mb-6">
                {heroSlides[currentSlide].subtitle}
              </p>

              {/* Price & CTA */}
              <div className="flex items-center gap-6">
                <span className="font-display text-3xl text-amber-film">
                  {heroSlides[currentSlide].price}
                </span>
                <button onClick={() => onNavigate('discover')} className="btn-primary">
                  <Camera className="w-4 h-4" />
                  查看详情
                </button>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 mt-12 pt-8 border-t border-white/20">
                {stats.map((stat) => (
                  <div key={stat.label}>
                    <div className="font-display text-2xl text-amber-film">{stat.value}</div>
                    <div className="text-white/50 text-xs font-sans mt-0.5">{stat.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Arrows */}
        <button
          onClick={prevSlide}
          className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/10 backdrop-blur-sm border border-white/20 text-white flex items-center justify-center hover:bg-white/20 transition-all duration-200 z-20 cursor-pointer"
        >
          ‹
        </button>
        <button
          onClick={nextSlide}
          className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/10 backdrop-blur-sm border border-white/20 text-white flex items-center justify-center hover:bg-white/20 transition-all duration-200 z-20 cursor-pointer"
        >
          ›
        </button>

        {/* Dots */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2 z-20">
          {heroSlides.map((slide, index) => (
            <button
              key={slide.id}
              onClick={() => setCurrentSlide(index)}
              className={`w-2 h-2 rounded-full transition-all duration-300 cursor-pointer ${
                index === currentSlide 
                  ? 'w-8 bg-amber-film' 
                  : 'bg-white/50 hover:bg-white/80'
              }`}
            />
          ))}
        </div>

        {/* Auto-play toggle */}
        <button
          onClick={() => setIsAutoPlaying(!isAutoPlaying)}
          className="absolute bottom-6 right-6 w-10 h-10 bg-white/10 backdrop-blur-sm border border-white/20 text-white flex items-center justify-center hover:bg-white/20 transition-all duration-200 z-20 cursor-pointer"
        >
          {isAutoPlaying ? '⏸' : '▶'}
        </button>
      </section>

      {/* ─── CATEGORY NAV ─── */}
      <section className="bg-paper-warm border-b-2 border-ink">
        <div className="section-container">
          <div className="flex overflow-x-auto gap-0 scrollbar-hide">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => onNavigateToCategory ? onNavigateToCategory(cat.id) : onNavigate('discover')}
                className="flex-shrink-0 flex flex-col items-center gap-1.5 px-6 py-4 
                           border-r border-paper-dark last:border-r-0
                           hover:bg-ink hover:text-paper group transition-colors duration-150 cursor-pointer"
              >
                <span className="text-2xl">{cat.icon}</span>
                <span className="text-xs font-sans font-semibold text-ink group-hover:text-paper whitespace-nowrap">
                  {cat.label}
                </span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ─── FEATURES BANNER ─── */}
      <section className="py-12 bg-paper">
        <div className="section-container">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="flex items-start gap-4 p-5 border-2 border-ink bg-paper hover:shadow-retro transition-all duration-150">
              <div className="w-10 h-10 bg-amber-film flex items-center justify-center flex-shrink-0">
                <Shield className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-sans font-bold text-ink mb-1">交易保障</h3>
                <p className="font-sans text-sm text-ink-muted">全程担保，先验货再放款，杜绝假冒伪劣</p>
              </div>
            </div>
            <div className="flex items-start gap-4 p-5 border-2 border-ink bg-paper hover:shadow-retro transition-all duration-150">
              <div className="w-10 h-10 bg-ink flex items-center justify-center flex-shrink-0">
                <ArrowLeftRight className="w-5 h-5 text-amber-film" />
              </div>
              <div>
                <h3 className="font-sans font-bold text-ink mb-1">以物换物</h3>
                <p className="font-sans text-sm text-ink-muted">独特换物机制，双向押金锁定，安心置换</p>
              </div>
            </div>
            <div className="flex items-start gap-4 p-5 border-2 border-ink bg-paper hover:shadow-retro transition-all duration-150">
              <div className="w-10 h-10 bg-ink flex items-center justify-center flex-shrink-0">
                <Zap className="w-5 h-5 text-amber-film" />
              </div>
              <div>
                <h3 className="font-sans font-bold text-ink mb-1">专业鉴定</h3>
                <p className="font-sans text-sm text-ink-muted">认证卖家 + 社区鉴定，每台相机都有口碑</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── FEATURED LISTINGS ─── */}
      <section className="py-14 bg-paper">
        <div className="section-container">
          <div className="flex items-end justify-between mb-8">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="w-4 h-4 text-amber-film" />
                <span className="text-xs font-sans font-bold text-amber-film uppercase tracking-wider">热门精选</span>
              </div>
              <h2 className="section-title">今日推荐</h2>
            </div>
            <button
              onClick={() => onNavigate('discover')}
              className="flex items-center gap-1 text-sm font-sans font-medium text-ink-muted hover:text-ink transition-colors cursor-pointer group"
            >
              查看全部
              <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>

          {/* Enhanced product grid with hover effects */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 lg:gap-6">
            {recentProducts.map((product, index) => (
              <div 
                key={product.id} 
                className="animate-fade-up group"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <ProductCard product={product} onClick={onProductClick} />
              </div>
            ))}
          </div>

          {/* Category quick links */}
          <div className="mt-10 pt-8 border-t border-paper-dark">
            <h3 className="font-sans font-bold text-sm text-ink-muted uppercase tracking-wider mb-4">快速分类</h3>
            <div className="flex flex-wrap gap-3">
              {categories.slice(0, 6).map((cat, index) => (
                <button
                  key={cat.id}
                  onClick={() => onNavigateToCategory ? onNavigateToCategory(cat.id) : onNavigate('discover')}
                  className="px-4 py-2 bg-paper-warm border border-paper-dark hover:border-amber-film hover:bg-amber-film/5 text-sm font-sans text-ink 
                             hover:text-amber-film transition-all duration-200 cursor-pointer group flex items-center gap-2"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <span>{cat.icon}</span>
                  <span>{cat.label}</span>
                  <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ─── SWAP ZONE ─── */}
      <section className="py-14 bg-ink grain-overlay">
        <div className="section-container">
          <div className="flex items-end justify-between mb-8">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <ArrowLeftRight className="w-4 h-4 text-amber-film" />
                <span className="text-xs font-sans font-bold text-amber-film uppercase tracking-wider">换物广场</span>
              </div>
              <h2 className="font-display text-3xl sm:text-4xl text-white">以物换物</h2>
              <p className="font-sans text-white/60 text-sm mt-1">不用花钱，用你的相机换一台新体验</p>
            </div>
            <button
              onClick={() => onNavigate('swap')}
              className="flex items-center gap-1 text-sm font-sans font-medium text-white/60 hover:text-white transition-colors cursor-pointer"
            >
              查看全部
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            {openSwaps.map((swap) => (
              <div
                key={swap.id}
                onClick={() => onNavigate('swap')}
                className="bg-white/5 border border-white/10 hover:border-amber-film/50 hover:bg-white/10 transition-all duration-200 cursor-pointer p-4 group"
              >
                {/* Offering image */}
                <div className="relative aspect-video mb-4 overflow-hidden">
                  <img
                    src={swap.offeringImage}
                    alt={swap.offering}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-ink/50 to-transparent"></div>
                </div>

                {/* User */}
                <div className="flex items-center gap-2 mb-3">
                  <img
                    src={swap.user.avatar}
                    alt={swap.user.name}
                    className="w-7 h-7 rounded-full border-2 border-amber-film/50 object-cover"
                  />
                  <div>
                    <p className="text-white text-xs font-sans font-semibold">{swap.user.name}</p>
                    <p className="text-white/40 text-xs font-sans">{swap.user.location}</p>
                  </div>
                  <div className="ml-auto flex items-center gap-0.5 text-amber-film text-xs font-sans">
                    <Star className="w-3 h-3 fill-amber-film" />
                    {swap.user.rating}
                  </div>
                </div>

                {/* Offering */}
                <div className="mb-2">
                  <span className="text-xs text-white/40 font-sans uppercase tracking-wider">我有</span>
                  <p className="text-white font-sans font-semibold text-sm mt-0.5 line-clamp-1">{swap.offering}</p>
                </div>

                {/* Wanted */}
                <div className="border-t border-white/10 pt-2">
                  <span className="text-xs text-amber-film font-sans uppercase tracking-wider">想换</span>
                  <p className="text-white/70 font-sans text-xs mt-0.5 line-clamp-2">{swap.wantedDescription}</p>
                </div>

                <button
                  onClick={(e) => { e.stopPropagation(); onNavigate('swap'); }}
                  className="w-full mt-3 py-2 border border-amber-film/50 text-amber-film text-xs font-sans font-bold uppercase tracking-wider 
                             hover:bg-amber-film hover:text-white transition-colors duration-150 cursor-pointer"
                >
                  提出换物邀约
                </button>
              </div>
            ))}
          </div>

          <div className="text-center">
            <button onClick={() => onNavigate('swap')} className="btn-primary mx-auto">
              <ArrowLeftRight className="w-4 h-4" />
              发起以物换物
            </button>
          </div>
        </div>
      </section>

      {/* ─── SELLER CTA ─── */}
      <section className="py-14 bg-paper-warm border-t-2 border-ink">
        <div className="section-container">
          <div className="grid lg:grid-cols-2 gap-10 items-center">
            <div>
              <span className="text-xs font-sans font-bold text-amber-film uppercase tracking-widest">卖家认证计划</span>
              <h2 className="section-title mt-2 mb-4">成为认证卖家<br />享受更多权益</h2>
              <div className="space-y-3 mb-6">
                {[
                  ['✅ 认证徽章', '展示专业信誉，获得更多买家信任'],
                  ['⭐ 优先展示', '商品在同类目中优先排名'],
                  ['🎁 月免3次置顶', '每月免费置顶推广 3 次'],
                ].map(([title, desc]) => (
                  <div key={title} className="flex items-start gap-3">
                    <span className="font-sans font-bold text-sm text-ink w-24 flex-shrink-0">{title}</span>
                    <span className="font-sans text-sm text-ink-muted">{desc}</span>
                  </div>
                ))}
              </div>
              <div className="flex gap-3">
                <button onClick={() => onNavigate('profile')} className="btn-primary">
                  立即申请认证
                  <ArrowRight className="w-4 h-4" />
                </button>
                <button onClick={() => onNavigate('profile')} className="btn-ghost">
                  了解详情
                </button>
              </div>
            </div>

            {/* Price cards */}
            <div className="grid grid-cols-2 gap-4">
              <div className="border-2 border-ink p-5 bg-white hover:shadow-retro transition-all duration-150">
                <div className="font-sans font-bold text-xs uppercase tracking-wider text-ink-muted mb-2">✅ 认证卖家</div>
                <div className="font-display text-3xl text-ink mb-1">¥99</div>
                <div className="font-sans text-xs text-ink-muted mb-4">/年</div>
                <ul className="space-y-1.5 text-sm font-sans text-ink-muted">
                  <li>• 认证徽章</li>
                  <li>• 优先展示</li>
                  <li>• 月免3次置顶</li>
                  <li>• 专属客服</li>
                </ul>
              </div>
              <div className="border-2 border-amber-film p-5 bg-amber-film/5 hover:shadow-retro-amber transition-all duration-150 relative">
                <div className="absolute -top-3 left-4 bg-amber-film px-2 py-0.5 text-white text-xs font-sans font-bold">推荐</div>
                <div className="font-sans font-bold text-xs uppercase tracking-wider text-amber-film mb-2">🏆 品质商家</div>
                <div className="font-display text-3xl text-ink mb-1">¥299</div>
                <div className="font-sans text-xs text-ink-muted mb-4">/年</div>
                <ul className="space-y-1.5 text-sm font-sans text-ink-muted">
                  <li>• 专属店铺页</li>
                  <li>• 0佣金优惠</li>
                  <li>• 官方推荐</li>
                  <li>• 优先客服</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── FOOTER ─── */}
      <footer className="bg-ink text-white/60 py-10 border-t-2 border-ink">
        <div className="section-container">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 bg-amber-film flex items-center justify-center">
                  <Camera className="w-4 h-4 text-white" />
                </div>
                <span className="font-display text-xl text-white">FilmMarket</span>
              </div>
              <p className="text-sm font-sans text-white/40">胶片玩家的专属交易市集</p>
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm font-sans">
              <a href="#" className="hover:text-white transition-colors cursor-pointer">关于我们</a>
              <a href="#" className="hover:text-white transition-colors cursor-pointer">使用条款</a>
              <a href="#" className="hover:text-white transition-colors cursor-pointer">隐私政策</a>
              <a href="#" className="hover:text-white transition-colors cursor-pointer">帮助中心</a>
            </div>
          </div>
          <div className="border-t border-white/10 mt-8 pt-6 text-xs font-sans text-white/30 text-center">
            © 2026 FilmMarket. All rights reserved. 交易佣金 3% · 置顶推广 · 卖家认证
          </div>
        </div>
      </footer>
    </div>
  );
}
