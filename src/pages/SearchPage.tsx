import { useState, useEffect, useRef } from 'react';
import { Search, X, Clock, TrendingUp, ChevronLeft } from 'lucide-react';
import ProductCard from '../components/ProductCard';
import type { Product, NavPage } from '../types';
import { useAppData } from '../context/DataContext';
import { getHotSearchTerms } from '../lib/api';

interface SearchPageProps {
  onBack: () => void;
  onProductClick: (product: Product) => void;
  onNavigate: (page: NavPage) => void;
}

const SEARCH_HISTORY_KEY = 'filmmarket_search_history';
const MAX_HISTORY = 10;

function getSearchHistory(): string[] {
  try {
    return JSON.parse(localStorage.getItem(SEARCH_HISTORY_KEY) || '[]');
  } catch {
    return [];
  }
}

function addSearchHistory(keyword: string) {
  const history = getSearchHistory().filter(k => k !== keyword);
  history.unshift(keyword);
  localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(history.slice(0, MAX_HISTORY)));
}

function clearSearchHistory() {
  localStorage.removeItem(SEARCH_HISTORY_KEY);
}

export default function SearchPage({ onBack, onProductClick, onNavigate }: SearchPageProps) {
  const { products } = useAppData();
  const [keyword, setKeyword] = useState('');
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [hotKeywords, setHotKeywords] = useState<string[]>([]);
  const [results, setResults] = useState<Product[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // 加载历史记录
  useEffect(() => {
    setSearchHistory(getSearchHistory());
    // 加载热门搜索词
    fetchHotKeywords();
    inputRef.current?.focus();
  }, []);

  const fetchHotKeywords = async () => {
    try {
      const hot = await getHotSearchTerms();
      setHotKeywords(hot);
    } catch {
      setHotKeywords(['Leica', '徕卡', '尼康', 'Canon', '胶片', '旁轴', '单反', '富士']);
    }
  };

  const handleSearch = (kw: string) => {
    const trimmed = kw.trim();
    if (!trimmed) return;

    addSearchHistory(trimmed);
    setSearchHistory(getSearchHistory());
    setKeyword(trimmed);
    setHasSearched(true);

    // 搜索商品
    const lower = trimmed.toLowerCase();
    const matched = products.filter(p =>
      p.title.toLowerCase().includes(lower) ||
      p.brand.toLowerCase().includes(lower) ||
      p.model?.toLowerCase().includes(lower) ||
      p.description?.toLowerCase().includes(lower) ||
      p.tags?.some((t: string) => t.toLowerCase().includes(lower))
    );
    setResults(matched);
  };

  const handleHistoryClick = (kw: string) => {
    setKeyword(kw);
    handleSearch(kw);
  };

  const handleClearHistory = () => {
    clearSearchHistory();
    setSearchHistory([]);
  };

  const handleHotClick = (kw: string) => {
    setKeyword(kw);
    handleSearch(kw);
  };

  return (
    <div className="min-h-screen bg-paper">
      {/* 搜索头部 */}
      <div className="sticky top-0 z-10 bg-paper border-b-2 border-ink">
        <div className="flex items-center gap-2 px-4 py-3">
          <button onClick={onBack} className="p-1">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-muted" />
            <input
              ref={inputRef}
              type="text"
              placeholder="搜索品牌、型号、胶片..."
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch(keyword)}
              className="w-full pl-9 pr-8 py-2 bg-white border-2 border-ink font-sans text-sm outline-none focus:border-amber-film"
            />
            {keyword && (
              <button
                onClick={() => { setKeyword(''); setHasSearched(false); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <button
            onClick={() => handleSearch(keyword)}
            className="px-4 py-2 bg-ink text-paper font-sans text-sm font-bold"
          >
            搜索
          </button>
        </div>
      </div>

      <div className="p-4">
        {!hasSearched ? (
          <>
            {/* 搜索历史 */}
            {searchHistory.length > 0 && (
              <div className="mb-6">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-ink-muted" />
                    <h3 className="font-sans text-sm font-bold text-ink">搜索历史</h3>
                  </div>
                  <button
                    onClick={handleClearHistory}
                    className="text-xs text-ink-muted hover:text-film-red"
                  >
                    清空
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {searchHistory.map((kw, i) => (
                    <button
                      key={i}
                      onClick={() => handleHistoryClick(kw)}
                      className="px-3 py-1.5 bg-white border border-ink/30 text-ink-muted text-sm font-sans hover:border-ink hover:text-ink transition-colors"
                    >
                      {kw}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 热门搜索 */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="w-4 h-4 text-film-red" />
                <h3 className="font-sans text-sm font-bold text-ink">热门搜索</h3>
              </div>
              <div className="flex flex-wrap gap-2">
                {hotKeywords.map((kw, i) => (
                  <button
                    key={i}
                    onClick={() => handleHotClick(kw)}
                    className={`px-3 py-1.5 font-sans text-sm border transition-colors ${
                      i < 3
                        ? 'bg-film-red/10 border-film-red/50 text-film-red font-bold'
                        : 'bg-white border-ink/30 text-ink-muted hover:border-ink hover:text-ink'
                    }`}
                  >
                    {kw}
                  </button>
                ))}
              </div>
            </div>
          </>
        ) : (
          <>
            {/* 搜索结果 */}
            <div className="mb-4">
              <p className="font-sans text-sm text-ink-muted">
                找到 {results.length} 件与「{keyword}」相关的商品
              </p>
            </div>

            {results.length > 0 ? (
              <div className="grid grid-cols-2 gap-3">
                {results.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    onClick={() => onProductClick(product)}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-16">
                <p className="font-sans text-ink-muted mb-2">没有找到相关商品</p>
                <p className="font-sans text-sm text-ink-muted/60">
                  试试其他关键词，或者{" "}
                  <button
                    onClick={() => onNavigate('post')}
                    className="text-film-red underline"
                  >
                    发布求购
                  </button>
                </p>
              </div>
            )}

            {/* 重新搜索 */}
            <button
              onClick={() => { setHasSearched(false); setKeyword(''); inputRef.current?.focus(); }}
              className="mt-6 w-full py-3 border-2 border-ink text-ink font-sans text-sm font-bold hover:bg-ink hover:text-paper transition-colors"
            >
              重新搜索
            </button>
          </>
        )}
      </div>
    </div>
  );
}
