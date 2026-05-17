import { Camera, Search, Plus, ArrowLeftRight, Home, Compass, Menu, X, LogIn, PlusCircle, MessageCircle } from 'lucide-react';
import { useState, useEffect } from 'react';
import type { NavPage } from '../types';
import { useAppData } from '../context/DataContext';
import NotificationBell from './NotificationBell';

interface NavbarProps {
  currentPage: NavPage;
  onNavigate: (page: NavPage) => void;
}

const navItems = [
  { id: 'home' as NavPage, label: '首页', icon: Home },
  { id: 'discover' as NavPage, label: '发现', icon: Compass },
  { id: 'swap' as NavPage, label: '换物', icon: ArrowLeftRight },
];

export default function Navbar({ currentPage, onNavigate }: NavbarProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const { currentUser } = useAppData();
  const isLoggedIn = !!currentUser;

  // 滚动时添加阴影
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // 移动端底部导航
  const MobileNavItem = ({ item }: { item: typeof navItems[0] }) => {
    const Icon = item.icon;
    const isActive = currentPage === item.id;
    return (
      <button
        onClick={() => onNavigate(item.id)}
        className={`flex flex-col items-center gap-1 py-2 px-4 touch-no-select transition-colors
          ${isActive ? 'text-amber-film' : 'text-ink-muted hover:text-ink'}`}
      >
        <Icon className={`w-5 h-5 ${isActive ? 'scale-110' : ''} transition-transform`} />
        <span className="text-xs font-sans font-medium">{item.label}</span>
      </button>
    );
  };

  return (
    <>
      {/* Top Navbar */}
      <nav className={`sticky top-0 z-50 bg-paper border-b-2 border-ink transition-shadow duration-200 ${isScrolled ? 'shadow-vintage' : ''}`}>
        <div className="section-container">
          <div className="flex items-center justify-between h-14">
            {/* Logo */}
            <button
              onClick={() => onNavigate('home')}
              className="flex items-center gap-2 cursor-pointer active:scale-95 transition-transform"
            >
              <div className="w-8 h-8 bg-ink flex items-center justify-center">
                <Camera className="w-4 h-4 text-amber-film" />
              </div>
              <span className="font-display text-xl text-ink leading-none hidden sm:block">FilmMarket</span>
            </button>

            {/* Desktop Nav */}
            <div className="hidden md:flex items-center gap-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => onNavigate(item.id)}
                    className={`flex items-center gap-1.5 px-4 py-2 text-sm font-sans font-medium cursor-pointer transition-all duration-150 rounded-sm
                      ${currentPage === item.id
                        ? 'text-amber-film bg-amber-film/10'
                        : 'text-ink-muted hover:text-ink hover:bg-paper-warm'
                      }`}
                  >
                    <Icon className="w-4 h-4" />
                    {item.label}
                  </button>
                );
              })}
            </div>

            {/* Desktop Actions */}
            <div className="hidden md:flex items-center gap-2">
              <button
                onClick={() => onNavigate('search')}
                className={`p-2 rounded-full transition-colors cursor-pointer ${
                  currentPage === 'search'
                    ? 'text-amber-film bg-amber-film/10'
                    : 'text-ink-muted hover:text-ink hover:bg-paper-warm'
                }`}
                title="搜索"
              >
                <Search className="w-5 h-5" />
              </button>
              <NotificationBell onNavigate={onNavigate} />
              <button
                onClick={() => onNavigate('chat-list')}
                className={`p-2 rounded-full transition-colors cursor-pointer ${
                  currentPage === 'chat-list' || currentPage === 'chat-room'
                    ? 'text-amber-film bg-amber-film/10'
                    : 'text-ink-muted hover:text-ink hover:bg-paper-warm'
                }`}
                title="我的消息"
              >
                <MessageCircle className="w-5 h-5" />
              </button>
              <button
                onClick={() => onNavigate('post')}
                className="btn-primary text-xs px-4 py-2"
              >
                <Plus className="w-4 h-4" />
                <span className="hidden lg:inline">发布商品</span>
              </button>
              {isLoggedIn ? (
                <button
                  onClick={() => onNavigate('profile')}
                  className="flex items-center gap-2 px-3 py-2 text-ink-muted hover:text-ink hover:bg-paper-warm transition-colors cursor-pointer rounded-full"
                >
                  <img
                    src={currentUser.avatar}
                    alt={currentUser.name}
                    className="w-6 h-6 rounded-full border-2 border-paper-dark object-cover"
                  />
                  <span className="font-sans text-sm font-medium hidden lg:block">{currentUser.name}</span>
                </button>
              ) : (
                <button
                  onClick={() => onNavigate('auth')}
                  className="flex items-center gap-2 px-4 py-2 bg-ink text-paper font-sans text-sm font-semibold hover:bg-ink/80 transition-colors cursor-pointer rounded-full"
                >
                  <LogIn className="w-4 h-4" />
                  <span className="hidden lg:inline">登录</span>
                </button>
              )}
            </div>

            {/* Mobile menu button */}
            <button
              className="md:hidden p-2 text-ink cursor-pointer active:scale-90 transition-transform"
              onClick={() => setMenuOpen(!menuOpen)}
            >
              {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {menuOpen && (
          <div className="md:hidden border-t-2 border-ink bg-paper animate-slide-in">
            <div className="section-container py-4 flex flex-col gap-2">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => { onNavigate(item.id); setMenuOpen(false); }}
                    className={`flex items-center gap-3 text-sm font-sans font-medium py-3 px-4 cursor-pointer rounded-lg transition-colors
                      ${currentPage === item.id ? 'text-amber-film bg-amber-film/10' : 'text-ink hover:bg-paper-warm'}`}
                  >
                    <Icon className="w-5 h-5" />
                    {item.label}
                  </button>
                );
              })}
              {/* 消息入口 */}
              <button
                onClick={() => { onNavigate('chat-list'); setMenuOpen(false); }}
                className={`flex items-center gap-3 text-sm font-sans font-medium py-3 px-4 cursor-pointer rounded-lg transition-colors
                  ${currentPage === 'chat-list' || currentPage === 'chat-room' ? 'text-amber-film bg-amber-film/10' : 'text-ink hover:bg-paper-warm'}`}
              >
                <MessageCircle className="w-5 h-5" />
                我的消息
              </button>
              <div className="flex gap-3 pt-3 border-t border-paper-dark mt-2">
                <button
                  onClick={() => { onNavigate('post'); setMenuOpen(false); }}
                  className="btn-primary flex-1 justify-center text-sm"
                >
                  <PlusCircle className="w-5 h-5" />
                  发布商品
                </button>
                {isLoggedIn ? (
                  <button
                    onClick={() => { onNavigate('profile'); setMenuOpen(false); }}
                    className="btn-secondary px-6"
                  >
                    <img
                      src={currentUser.avatar}
                      alt={currentUser.name}
                      className="w-5 h-5 rounded-full object-cover"
                    />
                    <span className="ml-2 font-medium">我的</span>
                  </button>
                ) : (
                  <button
                    onClick={() => { onNavigate('auth'); setMenuOpen(false); }}
                    className="btn-secondary px-6"
                  >
                    <LogIn className="w-5 h-5" />
                    <span className="ml-2">登录</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-paper border-t-2 border-ink safe-area-inset-bottom">
        <div className="flex items-center justify-around h-16 bg-paper/95 backdrop-blur-sm">
          {navItems.map((item) => (
            <MobileNavItem key={item.id} item={item} />
          ))}
          {/* Post button in center */}
          <button
            onClick={() => onNavigate('post')}
            className="relative -mt-6 w-14 h-14 bg-amber-film border-4 border-paper rounded-full flex items-center justify-center shadow-lg active:scale-95 transition-transform cursor-pointer"
          >
            <Plus className="w-6 h-6 text-white" />
          </button>
          {/* Search (mobile) */}
          <button
            onClick={() => onNavigate('search')}
            className={`flex flex-col items-center gap-1 py-2 px-4 touch-no-select transition-colors
              ${currentPage === 'search' ? 'text-amber-film' : 'text-ink-muted hover:text-ink'}`}
          >
            <Search className="w-5 h-5" />
            <span className="text-xs font-sans font-medium">搜索</span>
          </button>
          {/* Messages (mobile) */}
          {isLoggedIn ? (
            <button
              onClick={() => onNavigate('chat-list')}
              className={`flex flex-col items-center gap-1 py-2 px-4 touch-no-select transition-colors
                ${currentPage === 'chat-list' || currentPage === 'chat-room' ? 'text-amber-film' : 'text-ink-muted hover:text-ink'}`}
            >
              <MessageCircle className="w-5 h-5" />
              <span className="text-xs font-sans font-medium">消息</span>
            </button>
          ) : (
            <div className="w-16" /> // 占位
          )}
          {/* Notifications (mobile) */}
          {isLoggedIn ? (
            <NotificationBell onNavigate={onNavigate} />
          ) : (
            <div className="w-16" /> // 占位
          )}
          {/* Profile */}
          <button
            onClick={() => isLoggedIn ? onNavigate('profile') : onNavigate('auth')}
            className={`flex flex-col items-center gap-1 py-2 px-4 touch-no-select transition-colors
              ${isLoggedIn ? 'text-ink-muted hover:text-ink' : 'text-amber-film'}`}
          >
            {isLoggedIn ? (
              <>
                <img
                  src={currentUser.avatar}
                  alt={currentUser.name}
                  className="w-6 h-6 rounded-full border-2 border-paper-dark object-cover"
                />
                <span className="text-xs font-sans font-medium">我的</span>
              </>
            ) : (
              <>
                <LogIn className="w-5 h-5" />
                <span className="text-xs font-sans font-medium">登录</span>
              </>
            )}
          </button>
        </div>
      </nav>
    </>
  );
}
