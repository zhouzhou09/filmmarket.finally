import { useState, useEffect } from 'react';
import { DataProvider, useAppData } from './context/DataContext';
import { AuthProvider } from './context/AuthContext';
import { useAuth } from './hooks/useAuth';
import Navbar from './components/Navbar';
import HomePage from './pages/HomePage';
import DiscoverPage from './pages/DiscoverPage';
import ProductDetailPage from './pages/ProductDetailPage';
import PostPage from './pages/PostPage';
import SwapPage from './pages/SwapPage';
import ProfilePage from './pages/ProfilePage';
import AuthPage from './pages/AuthPage';
import OrdersPage from './pages/OrdersPage';
import EditProductPage from './pages/EditProductPage';
import NotificationsPage from './pages/NotificationsPage';
import ChatListPage from './pages/ChatListPage';
import ChatRoomPage from './pages/ChatRoomPage';
import SearchPage from './pages/SearchPage';
import type { NavPage, Product } from './types';
import type { ApiProduct } from './lib/api';
import type { Conversation } from './lib/api';

// 主应用组件（在 DataProvider 内部）
function AppContent() {
  const [currentPage, setCurrentPage] = useState<NavPage>('home');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [swapTargetProduct, setSwapTargetProduct] = useState<Product | null>(null);
  const [editingProduct, setEditingProduct] = useState<ApiProduct | null>(null);
  const [currentConversation, setCurrentConversation] = useState<Conversation | null>(null);
  const [pendingChatConversation, setPendingChatConversation] = useState<Conversation | null>(null);
  const [discoverCategory, setDiscoverCategory] = useState<string>('all');
  const { isAuthenticated, user: authUser } = useAuth();
  const { products, syncWithAuthUser } = useAppData();

  // 处理待跳转的聊天会话（从联系卖家弹窗发起）
  useEffect(() => {
    if (pendingChatConversation) {
      setCurrentConversation(pendingChatConversation);
      setCurrentPage('chat-room');
      setPendingChatConversation(null);
    }
  }, [pendingChatConversation]);

  // 同步 AuthContext 用户数据到 DataContext（首次加载和登录状态变化时）
  useEffect(() => {
    syncWithAuthUser(authUser);
  }, [authUser, syncWithAuthUser]);

  const handleNavigate = (page: NavPage) => {
    if (page === 'swap' && selectedProduct) {
      // 从商品详情跳换物页时，带入目标商品
      setSwapTargetProduct(selectedProduct);
    }
    setCurrentPage(page);
    setSelectedProduct(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // 跳转到 discover 并预设分类筛选
  const handleNavigateToCategory = (category: string) => {
    setDiscoverCategory(category);
    setCurrentPage('discover');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleProductClick = (product: Product) => {
    setSelectedProduct(product);
    setCurrentPage('detail');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleEditProduct = (product: ApiProduct) => {
    setEditingProduct(product);
    setCurrentPage('edit');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBack = () => {
    setSelectedProduct(null);
    setSwapTargetProduct(null);
    setEditingProduct(null);
    setCurrentConversation(null);
    setCurrentPage('home');
  };

  // 打开聊天对话
  const handleOpenChat = (conversation: Conversation) => {
    setCurrentConversation(conversation);
    setCurrentPage('chat-room');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // 点击商品卡片（从聊天页）
  const handleChatProductClick = (productId: string) => {
    const found = products.find(p => String(p.id) === String(productId));
    if (found) {
      setSelectedProduct(found);
    }
    setCurrentPage('detail');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // 从联系卖家弹窗发起聊天
  const handleStartChat = (conversation: Conversation) => {
    setPendingChatConversation(conversation);
  };

  // 登录成功：跳转到个人中心
  const handleLoginSuccess = () => {
    setCurrentPage('profile');
  };

  const renderPage = () => {
    switch (currentPage) {
      case 'home':
        return <HomePage onNavigate={handleNavigate} onProductClick={handleProductClick} onNavigateToCategory={handleNavigateToCategory} />;
      case 'discover':
        return <DiscoverPage onProductClick={handleProductClick} initialCategory={discoverCategory} />;
      case 'detail':
        if (!selectedProduct) return <HomePage onNavigate={handleNavigate} onProductClick={handleProductClick} />;
        return <ProductDetailPage product={selectedProduct} onBack={handleBack} onProductClick={handleProductClick} onNavigate={handleNavigate} onStartChat={handleStartChat} />;
      case 'post':
        return <PostPage onBack={handleBack} onNavigate={handleNavigate} />;
      case 'swap':
        return <SwapPage onBack={handleBack} targetProduct={swapTargetProduct} />;
      case 'profile':
        return <ProfilePage onBack={handleBack} onProductClick={handleProductClick} onNavigate={handleNavigate} onEditProduct={handleEditProduct} />;
      case 'orders':
        return <OrdersPage onBack={handleBack} onNavigate={handleNavigate} />;
      case 'edit':
        if (!editingProduct) return <ProfilePage onBack={handleBack} onProductClick={handleProductClick} onNavigate={handleNavigate} onEditProduct={handleEditProduct} />;
        return <EditProductPage product={editingProduct} onBack={handleBack} onNavigate={handleNavigate} />;
      case 'auth':
        // 已登录则直接跳转个人中心
        if (isAuthenticated) {
          setCurrentPage('profile');
          return <ProfilePage onBack={handleBack} onProductClick={handleProductClick} onNavigate={handleNavigate} onEditProduct={handleEditProduct} />;
        }
        return <AuthPage onBack={handleBack} onSuccess={handleLoginSuccess} />;
      case 'notifications':
        return <NotificationsPage onBack={handleBack} onNavigate={handleNavigate} />;
      case 'chat-list':
        return <ChatListPage onBack={handleBack} onNavigate={handleNavigate} onOpenChat={handleOpenChat} />;
      case 'chat-room':
        if (!currentConversation) return <ChatListPage onBack={handleBack} onNavigate={handleNavigate} onOpenChat={handleOpenChat} />;
        return <ChatRoomPage conversation={currentConversation} onBack={() => { setCurrentPage('chat-list'); }} onProductClick={handleChatProductClick} />;
      case 'search':
        return <SearchPage onBack={handleBack} onProductClick={handleProductClick} onNavigate={handleNavigate} />;
      default:
        return <HomePage onNavigate={handleNavigate} onProductClick={handleProductClick} />;
    }
  };

  const showNavbar = currentPage !== 'detail' && currentPage !== 'chat-room';

  return (
    <div className="min-h-screen bg-paper">
      {showNavbar && <Navbar currentPage={currentPage} onNavigate={handleNavigate} />}
      {renderPage()}
      <div className="text-center text-xs text-gray-400 py-2">build-v2-0522</div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <DataProvider>
        <AppContent />
      </DataProvider>
    </AuthProvider>
  );
}
