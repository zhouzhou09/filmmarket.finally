import { Heart, Eye, ArrowLeftRight, Star, Camera } from 'lucide-react';
import { useState, useCallback } from 'react';
import type { Product } from '../types';
import { conditionLabels } from '../data/mockData';
import { useAppData } from '../context/DataContext';

interface ProductCardProps {
  product: Product;
  onClick: (product: Product) => void;
}

// 默认占位图片 - 使用可靠的图片服务
const FALLBACK_IMAGE = '/images/products/p1-leica-m6.webp';

export default function ProductCard({ product, onClick }: ProductCardProps) {
  const [imageError, setImageError] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isPressed, setIsPressed] = useState(false);
  const { isFavorite, toggleFavorite } = useAppData();

  const imageUrl = imageError || !product.images[0] ? FALLBACK_IMAGE : product.images[0];
  const liked = isFavorite(product.id);

  const handleFavorite = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    toggleFavorite(product.id);
  }, [product.id, toggleFavorite]);

  return (
    <div 
      className={`card-product cursor-pointer group transition-all duration-300
        ${isPressed ? 'scale-95' : 'hover:scale-[1.02]'} 
        hover:shadow-retro`}
      onClick={() => onClick(product)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onMouseDown={() => setIsPressed(true)}
      onMouseUp={() => setIsPressed(false)}
    >
      {/* Image */}
      <div className="relative aspect-[4/3] overflow-hidden bg-paper-warm">
        <img
          src={imageUrl}
          alt={product.title}
          className={`w-full h-full object-cover transition-transform duration-500
            ${isHovered ? 'scale-110' : 'scale-100'}`}
          onError={() => setImageError(true)}
        />
        
        {/* Image overlay on hover */}
        <div className={`absolute inset-0 bg-ink/0 group-hover:bg-ink/20 transition-all duration-300 flex items-center justify-center
          ${isHovered ? 'opacity-100' : 'opacity-0'}`}>
          <span className="bg-white/90 text-ink px-4 py-2 font-sans font-bold text-sm transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300">
            查看详情
          </span>
        </div>

        {/* Condition badge */}
        <span className="condition-badge group-hover:scale-110 transition-transform duration-200">
          {conditionLabels[product.condition]}
        </span>
        
        {/* Favorite button */}
        <button
          onClick={handleFavorite}
          className={`absolute top-2 right-2 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 z-10
            ${liked ? 'bg-film-red text-white scale-110' : 'bg-white/80 text-ink hover:bg-white hover:scale-110'}
            ${isHovered ? 'opacity-100' : 'opacity-0 lg:opacity-0'}`}
        >
          <Heart className={`w-4 h-4 ${liked ? 'fill-white' : ''}`} />
        </button>

        {/* Swap badge */}
        {(product.listingType === 'swap' || product.listingType === 'both') && (
          <span className="swap-badge group-hover:-translate-x-1 group-hover:-translate-y-1 transition-transform duration-200">
            <ArrowLeftRight className="inline w-3 h-3 mr-0.5" />
            可换
          </span>
        )}
        
        {/* Top listed ribbon */}
        {product.isTopListed && (
          <div className="absolute bottom-0 left-0 right-0 bg-amber-film/90 px-2 py-0.5 text-center animate-pulse">
            <span className="text-white text-xs font-sans font-bold uppercase tracking-wider">⭐ 置顶推荐</span>
          </div>
        )}

        {/* Featured badge */}
        {product.isFeatured && (
          <div className="absolute top-2 left-2 bg-film-red/90 text-white px-1.5 py-0.5 text-xs font-sans font-bold">
            精选
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-3">
        {/* Seller */}
        <div className="flex items-center gap-1.5 mb-2">
          <img
            src={product.seller.avatar}
            alt={product.seller.name}
            className="w-5 h-5 rounded-full border border-paper-dark object-cover"
          />
          <span className="text-xs font-sans text-ink-muted group-hover:text-ink transition-colors">{product.seller.name}</span>
          {product.seller.badge !== 'none' && (
            <span className={`text-xs font-sans font-bold transition-transform duration-200 ${product.seller.badge === 'premium' ? 'text-amber-film group-hover:scale-110' : 'text-film-blue'}`}>
              {product.seller.badge === 'premium' ? '🏆' : '✅'}
            </span>
          )}
          <span className="ml-auto text-xs font-sans text-ink-muted flex items-center gap-0.5">
            <Star className="w-3 h-3 fill-amber-film text-amber-film" />
            {product.seller.rating}
          </span>
        </div>

        {/* Title */}
        <h3 className="font-sans font-semibold text-sm text-ink leading-snug line-clamp-2 mb-2 group-hover:text-amber-film transition-colors duration-200">
          {product.title}
        </h3>

        {/* Tags */}
        <div className="flex flex-wrap gap-1 mb-3">
          {product.tags.slice(0, 2).map((tag, index) => (
            <span 
              key={tag} 
              className="badge-vintage transform transition-all duration-200"
              style={{ transitionDelay: `${index * 50}ms` }}
            >
              {tag}
            </span>
          ))}
        </div>

        {/* Price & Stats */}
        <div className="flex items-center justify-between">
          <div>
            {product.listingType === 'swap' ? (
              <span className="font-sans font-bold text-amber-film text-sm">仅换不卖</span>
            ) : product.price > 0 ? (
              <span className="font-sans font-bold text-ink text-lg group-hover:text-amber-film transition-colors">
                ¥{product.price.toLocaleString()}
              </span>
            ) : (
              <span className="font-sans font-bold text-ink-muted text-sm">价格面议</span>
            )}
            {product.listingType === 'both' && (
              <span className="font-sans text-xs text-ink-muted ml-1">/ 可换</span>
            )}
          </div>
          <div className="flex items-center gap-3 text-ink-muted">
            <span className="flex items-center gap-0.5 text-xs font-sans group-hover:text-ink transition-colors">
              <Eye className="w-3.5 h-3.5" />
              {product.views}
            </span>
            <span className="flex items-center gap-0.5 text-xs font-sans group-hover:text-film-red transition-colors">
              <Heart className={`w-3.5 h-3.5 ${liked ? 'fill-film-red text-film-red' : ''}`} />
              {product.likes + (liked ? 1 : 0)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
