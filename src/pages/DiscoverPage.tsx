import { useState } from 'react';
import { Search, SlidersHorizontal, ChevronDown, X } from 'lucide-react';
import { categories, conditionLabels } from '../data/mockData';
import ProductCard from '../components/ProductCard';
import type { Product } from '../types';
import { useAppData } from '../context/DataContext';

interface DiscoverPageProps {
  onProductClick: (product: Product) => void;
  initialCategory?: string;
}

const sortOptions = [
  { value: 'latest', label: '最新发布' },
  { value: 'price-asc', label: '价格升序' },
  { value: 'price-desc', label: '价格降序' },
  { value: 'popular', label: '最多浏览' },
];

const listingTypes = [
  { value: 'all', label: '全部' },
  { value: 'sell', label: '出售' },
  { value: 'swap', label: '换物' },
  { value: 'both', label: '售/换均可' },
];

export default function DiscoverPage({ onProductClick, initialCategory }: DiscoverPageProps) {
  const { products } = useAppData();
  const [selectedCategory, setSelectedCategory] = useState<string>(initialCategory || 'all');
  const [selectedCondition, setSelectedCondition] = useState<string>('all');
  const [selectedListing, setSelectedListing] = useState<string>('all');
  const [sortBy, setSortBy] = useState('latest');
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [priceMin, setPriceMin] = useState('');
  const [priceMax, setPriceMax] = useState('');

  // Filter logic
  let filtered = products.filter((p) => {
    const matchCat = selectedCategory === 'all' || p.category === selectedCategory;
    const matchCond = selectedCondition === 'all' || p.condition === selectedCondition;
    const matchListing = selectedListing === 'all' || p.listingType === selectedListing || (selectedListing === 'swap' && (p.listingType === 'both' || p.listingType === 'swap'));
    const matchSearch = !searchQuery || p.title.toLowerCase().includes(searchQuery.toLowerCase()) || p.brand.toLowerCase().includes(searchQuery.toLowerCase());
    const matchMin = !priceMin || (p.price > 0 && p.price >= parseInt(priceMin));
    const matchMax = !priceMax || (p.price > 0 && p.price <= parseInt(priceMax));
    return matchCat && matchCond && matchListing && matchSearch && matchMin && matchMax;
  });

  // Sort
  if (sortBy === 'price-asc') filtered = [...filtered].sort((a, b) => (a.price || 0) - (b.price || 0));
  else if (sortBy === 'price-desc') filtered = [...filtered].sort((a, b) => (b.price || 0) - (a.price || 0));
  else if (sortBy === 'popular') filtered = [...filtered].sort((a, b) => b.views - a.views);

  const clearFilters = () => {
    setSelectedCategory('all');
    setSelectedCondition('all');
    setSelectedListing('all');
    setPriceMin('');
    setPriceMax('');
    setSearchQuery('');
  };

  const hasActiveFilters = selectedCategory !== 'all' || selectedCondition !== 'all' || selectedListing !== 'all' || priceMin || priceMax;

  return (
    <div className="min-h-screen bg-paper pb-16">
      {/* Page Header */}
      <div className="bg-paper-warm border-b-2 border-ink py-8">
        <div className="section-container">
          <h1 className="section-title mb-2">发现好物</h1>
          <p className="font-sans text-ink-muted text-sm">共 {filtered.length} 件商品</p>

          {/* Search bar */}
          <div className="relative mt-4 max-w-xl">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-muted" />
            <input
              type="text"
              placeholder="搜索品牌、型号或关键词..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-white border-2 border-ink font-sans text-sm text-ink placeholder-ink-muted/60 outline-none focus:border-amber-film transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer"
              >
                <X className="w-4 h-4 text-ink-muted" />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="section-container py-6">
        {/* Filter Bar */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          {/* Category tabs */}
          <div className="flex overflow-x-auto gap-2 flex-1 min-w-0">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`flex-shrink-0 px-3 py-1.5 text-xs font-sans font-semibold border transition-colors cursor-pointer
                ${selectedCategory === 'all' ? 'bg-ink text-paper border-ink' : 'bg-white text-ink border-paper-dark hover:border-ink'}`}
            >
              全部
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`flex-shrink-0 px-3 py-1.5 text-xs font-sans font-semibold border transition-colors cursor-pointer
                  ${selectedCategory === cat.id ? 'bg-ink text-paper border-ink' : 'bg-white text-ink border-paper-dark hover:border-ink'}`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Advanced filter toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-sans font-semibold border cursor-pointer transition-colors flex-shrink-0
              ${showFilters ? 'bg-ink text-paper border-ink' : 'bg-white text-ink border-paper-dark hover:border-ink'}`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            筛选
          </button>

          {/* Sort */}
          <div className="relative flex-shrink-0">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="appearance-none bg-white border border-paper-dark pl-3 pr-8 py-1.5 text-xs font-sans font-semibold text-ink cursor-pointer outline-none hover:border-ink transition-colors"
            >
              {sortOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-ink-muted pointer-events-none" />
          </div>
        </div>

        {/* Advanced Filters Panel */}
        {showFilters && (
          <div className="bg-paper-warm border border-paper-dark p-4 mb-6 grid grid-cols-2 sm:grid-cols-4 gap-4 animate-fade-up">
            {/* Condition */}
            <div>
              <label className="block text-xs font-sans font-bold text-ink-muted uppercase tracking-wider mb-2">成色</label>
              <div className="flex flex-wrap gap-1.5">
                {['all', ...Object.keys(conditionLabels)].map((c) => (
                  <button
                    key={c}
                    onClick={() => setSelectedCondition(c)}
                    className={`px-2 py-0.5 text-xs font-sans border cursor-pointer transition-colors
                      ${selectedCondition === c ? 'bg-ink text-paper border-ink' : 'bg-white text-ink border-paper-dark hover:border-ink'}`}
                  >
                    {c === 'all' ? '全部' : conditionLabels[c]}
                  </button>
                ))}
              </div>
            </div>

            {/* Listing type */}
            <div>
              <label className="block text-xs font-sans font-bold text-ink-muted uppercase tracking-wider mb-2">类型</label>
              <div className="flex flex-wrap gap-1.5">
                {listingTypes.map((t) => (
                  <button
                    key={t.value}
                    onClick={() => setSelectedListing(t.value)}
                    className={`px-2 py-0.5 text-xs font-sans border cursor-pointer transition-colors
                      ${selectedListing === t.value ? 'bg-ink text-paper border-ink' : 'bg-white text-ink border-paper-dark hover:border-ink'}`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Price range */}
            <div className="col-span-2">
              <label className="block text-xs font-sans font-bold text-ink-muted uppercase tracking-wider mb-2">价格区间 (¥)</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  placeholder="最低价"
                  value={priceMin}
                  onChange={(e) => setPriceMin(e.target.value)}
                  className="flex-1 px-2 py-1.5 border border-paper-dark bg-white text-xs font-sans text-ink outline-none focus:border-amber-film transition-colors"
                />
                <span className="text-ink-muted text-xs">—</span>
                <input
                  type="number"
                  placeholder="最高价"
                  value={priceMax}
                  onChange={(e) => setPriceMax(e.target.value)}
                  className="flex-1 px-2 py-1.5 border border-paper-dark bg-white text-xs font-sans text-ink outline-none focus:border-amber-film transition-colors"
                />
              </div>
            </div>
          </div>
        )}

        {/* Active filter chips */}
        {hasActiveFilters && (
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <span className="text-xs font-sans text-ink-muted">已筛选：</span>
            {selectedCategory !== 'all' && (
              <span className="badge-vintage">
                {categories.find(c => c.id === selectedCategory)?.label}
                <button onClick={() => setSelectedCategory('all')} className="ml-1 cursor-pointer"><X className="w-3 h-3" /></button>
              </span>
            )}
            {selectedCondition !== 'all' && (
              <span className="badge-vintage">
                {conditionLabels[selectedCondition]}
                <button onClick={() => setSelectedCondition('all')} className="ml-1 cursor-pointer"><X className="w-3 h-3" /></button>
              </span>
            )}
            <button onClick={clearFilters} className="text-xs font-sans text-film-red hover:underline cursor-pointer">清除全部</button>
          </div>
        )}

        {/* Product Grid */}
        {filtered.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">📷</div>
            <p className="font-sans font-semibold text-ink text-lg mb-2">没有找到符合条件的商品</p>
            <p className="font-sans text-ink-muted text-sm mb-4">试试调整筛选条件？</p>
            <button onClick={clearFilters} className="btn-secondary text-sm">清除筛选</button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {filtered.map((product) => (
              <ProductCard key={product.id} product={product} onClick={onProductClick} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
