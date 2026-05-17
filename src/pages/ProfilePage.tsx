import { useState, useEffect, useRef } from 'react';
import {
  Package, Star, Settings, Shield,
  ChevronRight, LogOut, Award, Zap, Check, Trash2,
  Image as ImageIcon, Loader2, ShoppingBag, Edit2,
  X, Plus, MapPin, CreditCard, Bell, Camera
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useAppData } from '../context/DataContext';
import {
  getMyProducts, getMyFavorites, deleteProduct,
  updateProfile, getProfile,
  uploadWechatQR, uploadFile,
  getAddresses, addAddress, updateAddress, deleteAddress, setDefaultAddress,
  getPaymentMethods, addPaymentMethod, updatePaymentMethod, deletePaymentMethod, setDefaultPaymentMethod,
  getNotificationSettings, updateNotificationSettings,
  getUserCredit,
  type ApiProduct,
  type UserAddress,
  type UserPaymentMethod,
  type NotificationSettings
} from '../lib/api';
import type { NavPage, Product } from '../types';

interface ProfilePageProps {
  onBack: () => void;
  onProductClick: (product: Product) => void;
  onNavigate: (page: NavPage) => void;
  onEditProduct: (product: ApiProduct) => void;
}

const menuItems = [
  { id: 'listings', label: '我的商品', icon: Package },
  { id: 'orders', label: '我的订单', icon: ShoppingBag },
  { id: 'favorites', label: '我的收藏', icon: Star },
  { id: 'settings', label: '账号设置', icon: Settings },
];

const certificationPlans = [
  {
    id: 'verified',
    name: '✅ 认证卖家',
    price: 99,
    period: '/年',
    color: 'film-blue',
    features: [
      '认证徽章标识',
      '商品优先展示',
      '每月免费置顶3次',
      '专属客服通道',
      '交易数据看板',
    ],
    unavailable: ['专属店铺页'],
  },
  {
    id: 'premium',
    name: '🏆 品质商家',
    price: 299,
    period: '/年',
    color: 'amber-film',
    features: [
      '专属店铺页',
      '官方推荐标识',
      '交易佣金减免至1%',
      '无限置顶次数',
      '优先客服响应',
      '数据分析报告',
      '平台活动优先权',
    ],
    unavailable: [],
    recommended: true,
  },
];

export default function ProfilePage({ onBack, onProductClick, onNavigate, onEditProduct }: ProfilePageProps) {
  const { user, signOut, isAuthenticated, loading, setUser, updateProfile } = useAuth();
  const { updateAvatar } = useAppData();
  const [activeTab, setActiveTab] = useState('listings');
  const [showCertModal, setShowCertModal] = useState(false);

  // 数据状态
  const [myProducts, setMyProducts] = useState<ApiProduct[]>([]);
  const [myFavorites, setMyFavorites] = useState<ApiProduct[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [creditLoading, setCreditLoading] = useState(false);
  const [userCredit, setUserCredit] = useState<{ avgRating: number; reviewCount: number } | null>(null);

  // 设置表单
  const [editNickname, setEditNickname] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [editMsg, setEditMsg] = useState('');

  // 收款码上传

  // 头像上传
  const [avatarUploading, setAvatarUploading] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // 更换头像
  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 限制图片类型和大小（2MB）
    if (!file.type.startsWith('image/')) {
      alert('请选择图片文件');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      alert('图片大小不能超过 2MB');
      return;
    }

    setAvatarUploading(true);
    try {
      console.log('[头像] 开始上传:', file.name, file.size, 'bytes');
      const { url } = await uploadFile(file);
      console.log('[头像] 上传成功，URL:', url);
      await updateProfile({ avatar_url: url } as any);
      // 同步 Navbar 头像（DataContext.currentUser）
      updateAvatar(url);
      console.log('[头像] 头像更新成功');
    } catch (err: any) {
      console.error('[头像] 失败:', err);
      alert(err.message || '头像上传失败');
    } finally {
      setAvatarUploading(false);
      // 清空 input，允许重复选择同一文件
      if (avatarInputRef.current) avatarInputRef.current.value = '';
    }
  };

  const [wechatQR, setWechatQR] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 用户设置模态框状态
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showNotificationModal, setShowNotificationModal] = useState(false);

  // 收货地址管理
  const [addresses, setAddresses] = useState<UserAddress[]>([]);
  const [addressesLoading, setAddressesLoading] = useState(false);
  const [editingAddress, setEditingAddress] = useState<UserAddress | null>(null);
  const [addressForm, setAddressForm] = useState({
    name: '', phone: '', province: '', city: '', district: '', detail: '', is_default: false
  });
  const [addressSaving, setAddressSaving] = useState(false);

  // 支付方式管理
  const [paymentMethods, setPaymentMethods] = useState<UserPaymentMethod[]>([]);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [editingPayment, setEditingPayment] = useState<UserPaymentMethod | null>(null);
  const [paymentForm, setPaymentForm] = useState({
    type: 'wechat' as 'wechat' | 'alipay' | 'bank_card',
    qr_code_url: '', bank_name: '', bank_account_encrypted: '', account_name: '', is_default: false
  });
  const [paymentSaving, setPaymentSaving] = useState(false);
  const [paymentQrFile, setPaymentQrFile] = useState<File | null>(null);
  const paymentQrInputRef = useRef<HTMLInputElement>(null);

  // 通知设置管理
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings | null>(null);
  const [notificationLoading, setNotificationLoading] = useState(false);
  const [notificationSaving, setNotificationSaving] = useState(false);

  // 加载收货地址
  const loadAddresses = async () => {
    setAddressesLoading(true);
    try {
      const data = await getAddresses();
      setAddresses(data);
    } catch (err) {
      console.error('加载地址失败:', err);
    } finally {
      setAddressesLoading(false);
    }
  };

  // 加载支付方式
  const loadPaymentMethods = async () => {
    setPaymentsLoading(true);
    try {
      const data = await getPaymentMethods();
      setPaymentMethods(data);
    } catch (err) {
      console.error('加载支付方式失败:', err);
    } finally {
      setPaymentsLoading(false);
    }
  };

  // 加载通知设置
  const loadNotificationSettings = async () => {
    setNotificationLoading(true);
    try {
      const data = await getNotificationSettings();
      setNotificationSettings(data);
    } catch (err) {
      console.error('加载通知设置失败:', err);
    } finally {
      setNotificationLoading(false);
    }
  };

  // 保存收货地址
  const saveAddress = async () => {
    if (!addressForm.name || !addressForm.phone || !addressForm.province || !addressForm.city || !addressForm.district || !addressForm.detail) {
      alert('请填写完整地址信息');
      return;
    }
    setAddressSaving(true);
    try {
      if (editingAddress?.id) {
        await updateAddress(editingAddress.id, addressForm);
      } else {
        await addAddress(addressForm);
      }
      await loadAddresses();
      setShowAddressModal(false);
      setEditingAddress(null);
      setAddressForm({ name: '', phone: '', province: '', city: '', district: '', detail: '', is_default: false });
    } catch (err: any) {
      alert(err.message || '保存失败');
    } finally {
      setAddressSaving(false);
    }
  };

  // 删除收货地址
  const handleDeleteAddress = async (id: number) => {
    if (!confirm('确定要删除这个地址吗？')) return;
    try {
      await deleteAddress(id);
      await loadAddresses();
    } catch (err: any) {
      alert(err.message || '删除失败');
    }
  };

  // 设置默认收货地址
  const handleSetDefaultAddress = async (id: number) => {
    try {
      await setDefaultAddress(id);
      await loadAddresses();
    } catch (err: any) {
      alert(err.message || '设置失败');
    }
  };

  // 保存支付方式
  const savePaymentMethod = async () => {
    if (!paymentForm.type) {
      alert('请选择支付类型');
      return;
    }
    setPaymentSaving(true);
    try {
      let qrUrl = paymentForm.qr_code_url;
      
      // 如果有新上传的二维码，先上传
      if (paymentQrFile) {
        const uploadResult = await uploadFile(paymentQrFile);
        qrUrl = uploadResult.url;
      }

      const data = { ...paymentForm, qr_code_url: qrUrl };
      
      // 用 id 判断是新增还是编辑（避免空对象 {} 被误判为 truthy）
      if (editingPayment?.id) {
        await updatePaymentMethod(editingPayment.id, data);
      } else {
        await addPaymentMethod(data);
      }
      await loadPaymentMethods();
      setShowPaymentModal(false);
      setEditingPayment(null);
      setPaymentForm({ type: 'wechat', qr_code_url: '', bank_name: '', bank_account_encrypted: '', account_name: '', is_default: false });
      setPaymentQrFile(null);
    } catch (err: any) {
      alert(err.message || '保存失败');
    } finally {
      setPaymentSaving(false);
    }
  };

  // 删除支付方式
  const handleDeletePayment = async (id: number) => {
    if (!confirm('确定要删除这个支付方式吗？')) return;
    try {
      await deletePaymentMethod(id);
      await loadPaymentMethods();
    } catch (err: any) {
      alert(err.message || '删除失败');
    }
  };

  // 设置默认支付方式
  const handleSetDefaultPayment = async (id: number) => {
    try {
      await setDefaultPaymentMethod(id);
      await loadPaymentMethods();
    } catch (err: any) {
      alert(err.message || '设置失败');
    }
  };

  // 保存通知设置
  const saveNotificationSettings = async () => {
    if (!notificationSettings) return;
    setNotificationSaving(true);
    try {
      await updateNotificationSettings({
        order_update: notificationSettings.order_update,
        price_alert: notificationSettings.price_alert,
        message: notificationSettings.message,
        system: notificationSettings.system
      });
      alert('设置已保存');
    } catch (err: any) {
      alert(err.message || '保存失败');
    } finally {
      setNotificationSaving(false);
    }
  };

  // 打开地址管理模态框
  const openAddressModal = () => {
    setEditingAddress(null);
    setAddressForm({ name: '', phone: '', province: '', city: '', district: '', detail: '', is_default: false });
    loadAddresses();
    setShowAddressModal(true);
  };

  // 打开支付方式管理模态框
  const openPaymentModal = () => {
    setEditingPayment(null);
    setPaymentForm({ type: 'wechat', qr_code_url: '', bank_name: '', bank_account_encrypted: '', account_name: '', is_default: false });
    setPaymentQrFile(null);
    loadPaymentMethods();
    setShowPaymentModal(true);
  };

  // 打开通知设置模态框
  const openNotificationModal = () => {
    loadNotificationSettings();
    setShowNotificationModal(true);
  };

  // 编辑地址
  const editAddress = (addr: UserAddress) => {
    setEditingAddress(addr);
    setAddressForm({
      name: addr.name,
      phone: addr.phone,
      province: addr.province,
      city: addr.city,
      district: addr.district,
      detail: addr.detail,
      is_default: addr.is_default
    });
    setShowAddressModal(true);
  };

  // 编辑支付方式
  const editPayment = (pm: UserPaymentMethod) => {
    setEditingPayment(pm);
    setPaymentForm({
      type: pm.type,
      qr_code_url: pm.qr_code_url,
      bank_name: pm.bank_name,
      bank_account_encrypted: pm.bank_account_encrypted,
      account_name: pm.account_name,
      is_default: pm.is_default
    });
    setShowPaymentModal(true);
  };

  // 加载我的商品 & 收藏
  useEffect(() => {
    if (!user) return;
    if (activeTab === 'listings') {
      setDataLoading(true);
      getMyProducts(user.id).then(setMyProducts).catch(console.error).finally(() => setDataLoading(false));
    }
    if (activeTab === 'favorites') {
      setDataLoading(true);
      getMyFavorites(user.id).then(setMyFavorites).catch(console.error).finally(() => setDataLoading(false));
    }
  }, [activeTab, user]);

  // 初始化编辑昵称
  useEffect(() => {
    if (user) setEditNickname(user.nickname);
  }, [user]);

  // 加载用户信用评分
  useEffect(() => {
    if (!user) return;
    setCreditLoading(true);
    getUserCredit(user.id)
      .then(data => {
        setUserCredit({
          avgRating: data.overallCredit.avgRating,
          reviewCount: data.overallCredit.reviewCount,
        });
      })
      .catch(() => {
        // 加载失败时不显示信用分
        setUserCredit(null);
      })
      .finally(() => setCreditLoading(false));
  }, [user]);

  const handleSaveProfile = async () => {
    if (!editNickname.trim()) return;
    setEditSaving(true);
    setEditMsg('');
    try {
      const updated = await updateProfile({ nickname: editNickname.trim() });
      setUser(updated);
      setEditMsg('保存成功！');
    } catch (err: any) {
      setEditMsg(err.message || '保存失败');
    } finally {
      setEditSaving(false);
    }
  };

  // 初始化收款码（切换到设置 tab 时从服务器刷新一次）
  useEffect(() => {
    if (user && activeTab === 'settings') {
      getProfile().then(u => {
        // 优先用 API 返回值；若为空则 fallback 到本地缓存（避免后端未返回 wechat_qr 时清空已上传的收款码）
        const qr = u.wechat_qr || (user as any).wechat_qr || '';
        setWechatQR(qr);
      }).catch(() => {
        setWechatQR((user as any).wechat_qr || '');
      });
    }
  }, [activeTab]);

  // 处理文件上传
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadMsg('');

    try {
      // 1. 上传文件，获取 URL
      const { url } = await uploadFile(file);
      // 2. 将 URL 存储到用户记录
      const updated = await uploadWechatQR(url);
      setUser(updated);
      setWechatQR(url);
      setUploadMsg('收款码上传成功！');
    } catch (err: any) {
      setUploadMsg(err.message || '上传失败，请重试');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    if (!confirm('确定要下架/删除这件商品吗？')) return;
    try {
      await deleteProduct(productId);
      setMyProducts(prev => prev.filter(p => p.id !== productId));
    } catch (err: any) {
      alert(err.message || '删除失败');
    }
  };

  // 初始化中：显示加载动画，避免闪现"请先登录"
  if (loading) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center">
        <div className="text-center p-8">
          <svg className="animate-spin w-8 h-8 text-amber-film mx-auto mb-3" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p className="font-sans text-sm text-ink-muted">加载中...</p>
        </div>
      </div>
    );
  }

  // 未登录时显示提示
  if (!isAuthenticated || !user) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center">
        <div className="text-center p-8">
          <p className="font-sans text-ink-muted mb-4">请先登录</p>
          <button onClick={onBack} className="btn-primary">
            返回登录
          </button>
        </div>
      </div>
    );
  }

  // 头像：使用 DiceBear（基于邮箱生成）
  const avatarUrl = user.avatar_url || user.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user.email)}&backgroundColor=8B2323,DAA520&textColor=ffffff`;

  // 卖家等级标签
  const badgeMap: Record<string, { label: string; className: string }> = {
    verified: { label: '认证卖家', className: 'bg-film-blue' },
    premium: { label: '金牌卖家', className: 'bg-amber-film' },
  };
  const badge = badgeMap[user.seller_level];

  return (
    <div className="min-h-screen bg-paper pb-16">
      {/* Profile Header */}
      <div className="bg-ink grain-overlay">
        <div className="section-container py-6">
          <div className="flex items-center justify-between mb-4">
            <button onClick={onBack} className="flex items-center gap-1 text-sm font-sans text-white/60 hover:text-white transition-colors cursor-pointer">
              ← 返回
            </button>
            <button
              onClick={() => { signOut(); onNavigate('home'); }}
              className="flex items-center gap-1 px-3 py-1.5 text-sm font-sans text-white/60 hover:text-white hover:bg-white/10 rounded transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              退出
            </button>
          </div>

          <div className="flex items-start gap-4">
            {/* 头像 + 上传按钮 */}
            <div className="relative flex-shrink-0">
              {avatarUploading ? (
                <div className="w-16 h-16 rounded-full border-2 border-amber-film bg-ink/50 flex items-center justify-center">
                  <Loader2 className="w-6 h-6 text-amber-film animate-spin" />
                </div>
              ) : (
                <>
                  <img
                    src={avatarUrl}
                    alt={user.nickname}
                    className="w-16 h-16 rounded-full border-2 border-amber-film object-cover cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={() => avatarInputRef.current?.click()}
                  />
                  <button
                    onClick={() => avatarInputRef.current?.click()}
                    className="absolute -bottom-1 -right-1 w-7 h-7 bg-film-red border-2 border-paper rounded-full flex items-center justify-center shadow-md hover:bg-film-red/90 transition-colors cursor-pointer"
                    title="更换头像"
                  >
                    <Camera className="w-3.5 h-3.5 text-white" />
                  </button>
                </>
              )}
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarChange}
              />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-sans font-bold text-xl text-white">{user.nickname}</span>
                {badge && (
                  <span className={`px-2 py-0.5 ${badge.className} text-white text-xs font-sans font-bold`}>{badge.label}</span>
                )}
              </div>
              <div className="flex items-center gap-3 text-sm font-sans text-white/60">
                {creditLoading ? (
                  <span className="flex items-center gap-0.5">
                    <Star className="w-3.5 h-3.5 fill-amber-film text-amber-film animate-pulse" />
                    <span className="text-white/60">加载中...</span>
                  </span>
                ) : userCredit ? (
                  <span className="flex items-center gap-0.5">
                    <Star className="w-3.5 h-3.5 fill-amber-film text-amber-film" />
                    <span className="text-white">{userCredit.avgRating.toFixed(1)}</span>
                    <span>({userCredit.reviewCount}条评价)</span>
                  </span>
                ) : (
                  <span className="flex items-center gap-0.5">
                    <Star className="w-3.5 h-3.5 fill-white/40 text-white/40" />
                    <span className="text-white/60">暂无评价</span>
                  </span>
                )}
                <span>·</span>
                <span>{user.email}</span>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-4 mt-3">
                {[
                  { label: '在售', value: myProducts.filter(p => p.listingType !== 'swap').length },
                  { label: '收藏', value: myFavorites.length },
                  { label: '换物', value: myProducts.filter(p => p.listingType !== 'sell').length },
                ].map(stat => (
                  <div key={stat.label} className="text-center">
                    <div className="font-sans font-bold text-lg text-white">{stat.value}</div>
                    <div className="text-xs font-sans text-white/40">{stat.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="bg-paper-warm border-b border-paper-dark sticky top-14 z-20">
        <div className="section-container">
          <div className="flex overflow-x-auto">
            {menuItems.map(item => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex items-center gap-1.5 px-4 py-3 text-sm font-sans font-medium whitespace-nowrap border-b-2 cursor-pointer transition-colors
                    ${activeTab === item.id
                      ? 'text-amber-film border-amber-film'
                      : 'text-ink-muted border-transparent hover:text-ink'}`}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="section-container py-6">
        {/* My Listings */}
        {activeTab === 'listings' && (
          <div className="animate-fade-up">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-sans font-bold text-ink">我的商品</h2>
              <button
                onClick={() => onNavigate('post')}
                className="btn-primary text-xs px-3 py-1.5"
              >
                发布新商品
              </button>
            </div>
            {dataLoading ? (
              <div className="text-center py-12">
                <svg className="animate-spin w-6 h-6 text-amber-film mx-auto mb-2" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <p className="font-sans text-sm text-ink-muted">加载中...</p>
              </div>
            ) : myProducts.length === 0 ? (
              <div className="text-center py-12 bg-paper-warm border border-paper-dark">
                <div className="text-5xl mb-3">📷</div>
                <p className="font-sans font-semibold text-ink mb-1">还没有发布商品</p>
                <p className="font-sans text-sm text-ink-muted mb-4">发布你的第一件胶片好物，开启交易之旅</p>
                <button onClick={() => onNavigate('post')} className="btn-primary text-sm">
                  立即发布
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {myProducts.map(product => (
                  <div key={product.id} className="flex gap-3 bg-white border border-paper-dark p-3 hover:border-amber-film transition-colors">
                    <img
                      src={product.images[0] || '/images/placeholder.png'}
                      alt={product.title}
                      className="w-20 h-20 object-cover flex-shrink-0 cursor-pointer"
                      onClick={() => onProductClick({ ...product, listingType: product.listingType } as any)}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-sans font-semibold text-sm text-ink truncate">{product.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="font-display text-amber-film text-base">¥{product.price}</span>
                        <span className="text-xs font-sans text-ink-muted bg-paper-dark px-1.5 py-0.5">{product.condition}成新</span>
                      </div>
                      <p className="font-sans text-xs text-ink-muted mt-1 line-clamp-1">{product.description}</p>
                    </div>
                    <div className="flex flex-col gap-1.5 flex-shrink-0">
                      <button
                        onClick={() => onEditProduct(product)}
                        className="p-1.5 text-ink-muted hover:text-amber-film hover:bg-amber-film/5 transition-colors rounded cursor-pointer"
                        title="编辑商品"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteProduct(product.id)}
                        className="p-1.5 text-ink-muted hover:text-film-red hover:bg-film-red/5 transition-colors rounded cursor-pointer"
                        title="删除商品"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* My Orders */}
        {activeTab === 'orders' && (
          <div className="animate-fade-up">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-sans font-bold text-ink">我的订单</h2>
            </div>

            {/* 快捷跳转 */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <button
                onClick={() => onNavigate('orders')}
                className="flex flex-col items-center gap-2 p-4 bg-paper-warm border-2 border-paper-dark hover:border-amber-film transition-colors cursor-pointer"
              >
                <ShoppingBag className="w-8 h-8 text-amber-film" />
                <span className="font-sans text-sm font-semibold text-ink">我买的</span>
                <span className="font-sans text-xs text-ink-muted">查看购买订单</span>
              </button>
              <button
                onClick={() => onNavigate('orders')}
                className="flex flex-col items-center gap-2 p-4 bg-paper-warm border-2 border-paper-dark hover:border-amber-film transition-colors cursor-pointer"
              >
                <Package className="w-8 h-8 text-film-blue" />
                <span className="font-sans text-sm font-semibold text-ink">我卖的</span>
                <span className="font-sans text-xs text-ink-muted">管理出售订单</span>
              </button>
            </div>

            <button
              onClick={() => onNavigate('orders')}
              className="w-full flex items-center justify-between px-4 py-3.5 bg-white border border-paper-dark hover:border-amber-film transition-colors cursor-pointer"
            >
              <span className="font-sans text-sm font-semibold text-ink">查看全部订单</span>
              <ChevronRight className="w-4 h-4 text-ink-muted" />
            </button>
          </div>
        )}

        {/* Favorites */}
        {activeTab === 'favorites' && (
          <div className="animate-fade-up">
            <h2 className="font-sans font-bold text-ink mb-4">我的收藏</h2>
            {dataLoading ? (
              <div className="text-center py-12">
                <svg className="animate-spin w-6 h-6 text-amber-film mx-auto mb-2" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <p className="font-sans text-sm text-ink-muted">加载中...</p>
              </div>
            ) : myFavorites.length === 0 ? (
              <div className="text-center py-12 bg-paper-warm border border-paper-dark">
                <div className="text-5xl mb-3">❤️</div>
                <p className="font-sans font-semibold text-ink mb-1">暂无收藏</p>
                <p className="font-sans text-sm text-ink-muted mb-4">浏览商品时，点击爱心即可收藏</p>
                <button onClick={() => onNavigate('discover')} className="btn-secondary text-sm">
                  去发现好物
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {myFavorites.map(product => (
                  <div
                    key={product.id}
                    className="bg-white border border-paper-dark cursor-pointer hover:border-amber-film transition-colors"
                    onClick={() => onProductClick(product as any)}
                  >
                    <div className="aspect-square overflow-hidden">
                      <img
                        src={product.images[0] || '/images/placeholder.png'}
                        alt={product.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="p-2">
                      <p className="font-sans text-xs font-semibold text-ink truncate">{product.title}</p>
                      <p className="font-display text-sm text-amber-film mt-0.5">¥{product.price}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Settings */}
        {activeTab === 'settings' && (
          <div className="animate-fade-up">
            <h2 className="font-sans font-bold text-ink mb-4">账号设置</h2>

            {/* 昵称编辑 */}
            <div className="border border-paper-dark bg-white p-4 mb-4">
              <label className="block text-xs font-sans font-bold text-ink-muted uppercase tracking-wider mb-2">昵称</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={editNickname}
                  onChange={e => setEditNickname(e.target.value)}
                  className="flex-1 px-3 py-2 border-2 border-paper-dark bg-paper-warm font-sans text-sm text-ink outline-none focus:border-amber-film transition-colors"
                  placeholder="请输入昵称"
                />
                <button
                  onClick={handleSaveProfile}
                  disabled={editSaving}
                  className="btn-primary text-xs px-4 disabled:opacity-60"
                >
                  {editSaving ? '保存...' : '保存'}
                </button>
              </div>
              {editMsg && (
                <p className={`text-xs font-sans mt-1.5 ${editMsg.includes('成功') ? 'text-film-green' : 'text-film-red'}`}>
                  {editMsg}
                </p>
              )}
            </div>

            {/* 微信收款码上传 */}
            <div className="border border-paper-dark bg-white p-4 mb-4">
              <label className="block text-xs font-sans font-bold text-ink-muted uppercase tracking-wider mb-2">微信收款码</label>
              <p className="text-xs font-sans text-ink-muted mb-3">上传你的微信收款二维码，买家购买你的商品时会看到此码</p>

              {wechatQR && (
                <div className="mb-3 p-3 bg-paper-warm border border-paper-dark inline-block">
                  <p className="text-xs font-sans text-ink-muted mb-2">当前收款码：</p>
                  <img src={wechatQR} alt="微信收款码" className="w-32 h-32 object-contain" />
                </div>
              )}

              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />

              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="btn-secondary text-xs px-4 py-2 disabled:opacity-60 inline-flex items-center gap-1"
              >
                {uploading ? (
                  <span className="flex items-center gap-1">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    上传中...
                  </span>
                ) : (
                  <>
                    <ImageIcon className="w-3.5 h-3.5" />
                    {wechatQR ? '重新上传' : '上传收款码'}
                  </>
                )}
              </button>

              {uploadMsg && (
                <p className={`text-xs font-sans mt-1.5 ${uploadMsg.includes('成功') ? 'text-film-green' : 'text-film-red'}`}>
                  {uploadMsg}
                </p>
              )}
            </div>

            <div className="border border-paper-dark bg-white">
              <button
                onClick={openAddressModal}
                className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-paper-warm cursor-pointer transition-colors text-left border-b border-paper-dark"
              >
                <div className="flex items-center gap-3">
                  <MapPin className="w-5 h-5 text-ink-muted" />
                  <div>
                    <div className="font-sans font-semibold text-sm text-ink">收货地址</div>
                    <div className="font-sans text-xs text-ink-muted">管理收货地址</div>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-ink-muted" />
              </button>
              <button
                onClick={openPaymentModal}
                className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-paper-warm cursor-pointer transition-colors text-left border-b border-paper-dark"
              >
                <div className="flex items-center gap-3">
                  <CreditCard className="w-5 h-5 text-ink-muted" />
                  <div>
                    <div className="font-sans font-semibold text-sm text-ink">支付方式</div>
                    <div className="font-sans text-xs text-ink-muted">绑定微信/支付宝</div>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-ink-muted" />
              </button>
              <button
                onClick={openNotificationModal}
                className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-paper-warm cursor-pointer transition-colors text-left"
              >
                <div className="flex items-center gap-3">
                  <Bell className="w-5 h-5 text-ink-muted" />
                  <div>
                    <div className="font-sans font-semibold text-sm text-ink">通知设置</div>
                    <div className="font-sans text-xs text-ink-muted">推送消息管理</div>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-ink-muted" />
              </button>
            </div>

            {/* Certification CTA */}
            <div className="mt-6 border-2 border-amber-film/50 bg-amber-film/5 p-5">
              <div className="flex items-start gap-3 mb-3">
                <Award className="w-5 h-5 text-amber-film flex-shrink-0 mt-0.5" />
                <div>
                  <div className="font-sans font-bold text-sm text-ink mb-0.5">成为认证卖家</div>
                  <div className="font-sans text-xs text-ink-muted">认证徽章 + 优先展示 + 月免3次置顶</div>
                </div>
              </div>
              <button
                onClick={() => setShowCertModal(true)}
                className="btn-primary w-full justify-center text-sm"
              >
                <Zap className="w-4 h-4" />
                立即申请认证
              </button>
            </div>

            <button
              onClick={() => { signOut(); onNavigate('home'); }}
              className="w-full mt-4 py-3 text-center font-sans text-sm text-film-red hover:bg-film-red/5 transition-colors cursor-pointer flex items-center justify-center gap-1"
            >
              <LogOut className="w-4 h-4" />
              退出登录
            </button>
          </div>
        )}
      </div>

      {/* Certification Modal */}
      {showCertModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/60 backdrop-blur-sm" onClick={() => setShowCertModal(false)}>
          <div className="bg-paper w-full max-w-2xl max-h-[85vh] overflow-y-auto border-2 border-ink" onClick={e => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="sticky top-0 bg-paper border-b-2 border-ink p-4 flex items-center justify-between">
              <div>
                <h2 className="font-display text-2xl text-ink">卖家认证</h2>
                <p className="font-sans text-xs text-ink-muted mt-0.5">选择适合你的认证方案，开启专业卖家之旅</p>
              </div>
              <button
                onClick={() => setShowCertModal(false)}
                className="w-8 h-8 bg-paper-warm border border-paper-dark flex items-center justify-center cursor-pointer hover:bg-paper-dark transition-colors"
              >
                ×
              </button>
            </div>

            <div className="p-5">
              {/* Benefits */}
              <div className="bg-paper-warm border border-paper-dark p-4 mb-5">
                <h3 className="font-sans font-bold text-sm text-ink mb-2 flex items-center gap-1">
                  <Shield className="w-4 h-4 text-film-green" />
                  认证卖家权益说明
                </h3>
                <div className="grid grid-cols-2 gap-2 text-xs font-sans text-ink-muted">
                  {[
                    '认证徽章，买家更信任',
                    '商品优先展示，曝光更多',
                    '免费置顶次数，降低营销成本',
                    '专属客服，快速响应问题',
                    '交易数据看板，掌握经营状况',
                    '平台活动优先参与权',
                  ].map(b => (
                    <div key={b} className="flex items-center gap-1">
                      <Check className="w-3 h-3 text-film-green flex-shrink-0" />
                      {b}
                    </div>
                  ))}
                </div>
              </div>

              {/* Plans */}
              <div className="grid grid-cols-2 gap-4 mb-5">
                {certificationPlans.map(plan => (
                  <div
                    key={plan.id}
                    className={`border-2 p-4 ${plan.recommended ? 'border-amber-film bg-amber-film/5' : 'border-paper-dark bg-white'}`}
                  >
                    {plan.recommended && (
                      <div className="bg-amber-film text-white text-xs font-sans font-bold text-center py-0.5 mb-2 -mx-4 mt-[-16px]">
                        ⭐ 推荐方案
                      </div>
                    )}
                    <div className="font-sans font-bold text-lg text-ink mb-0.5">{plan.name}</div>
                    <div className="flex items-baseline gap-0.5 mb-1">
                      <span className="font-display text-3xl text-ink">¥{plan.price}</span>
                      <span className="font-sans text-xs text-ink-muted">{plan.period}</span>
                    </div>
                    <div className="border-t border-paper-dark my-3" />
                    <ul className="space-y-1.5 mb-3">
                      {plan.features.map(f => (
                        <li key={f} className="flex items-start gap-1.5 text-xs font-sans text-ink">
                          <Check className="w-3 h-3 text-film-green flex-shrink-0 mt-0.5" />
                          {f}
                        </li>
                      ))}
                      {plan.unavailable.map(f => (
                        <li key={f} className="flex items-start gap-1.5 text-xs font-sans text-ink-muted/50">
                          <span className="flex-shrink-0 mt-0.5">—</span>
                          {f}
                        </li>
                      ))}
                    </ul>
                    <button
                      onClick={() => {
                        setShowCertModal(false);
                        alert(`${plan.name} 认证申请已提交！我们将在 1-3 个工作日内审核，请留意站内消息通知。`);
                      }}
                      className={`w-full py-2 font-sans font-bold text-sm border-2 cursor-pointer transition-colors
                      ${plan.recommended
                        ? 'bg-amber-film text-white border-amber-film hover:bg-amber-film/80'
                        : 'bg-paper text-ink border-ink hover:bg-ink hover:text-paper'}`}
                    >
                      选择此方案
                    </button>
                  </div>
                ))}
              </div>

              {/* FAQ */}
              <details className="border border-paper-dark p-3">
                <summary className="font-sans font-bold text-sm text-ink cursor-pointer">
                  常见问题
                </summary>
                <div className="mt-3 space-y-2 text-xs font-sans text-ink-muted">
                  <p><strong>Q: 认证后可以退款吗？</strong><br />A: 认证服务一经开通不支持退款，请谨慎选择。</p>
                  <p><strong>Q: 如何成为品质商家？</strong><br />A: 累计交易额超过一定金额且无违规记录，可申请升级。</p>
                  <p><strong>Q: 认证到期后怎么办？</strong><br />A: 到期前15天会收到提醒，可续费延续认证资格。</p>
                </div>
              </details>
            </div>
          </div>
        </div>
      )}

      {/* 收货地址管理 Modal */}
      {showAddressModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/60 backdrop-blur-sm" onClick={() => { setShowAddressModal(false); setEditingAddress(null); setAddressForm({ name: '', phone: '', province: '', city: '', district: '', detail: '', is_default: false }); }}>
          <div className="bg-paper w-full max-w-lg max-h-[85vh] overflow-y-auto border-2 border-ink" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-paper border-b-2 border-ink p-4 flex items-center justify-between">
              <h2 className="font-display text-xl text-ink">{editingAddress ? '编辑地址' : '收货地址管理'}</h2>
              <button onClick={() => { setShowAddressModal(false); setEditingAddress(null); setAddressForm({ name: '', phone: '', province: '', city: '', district: '', detail: '', is_default: false }); }} className="w-8 h-8 bg-paper-warm border border-paper-dark flex items-center justify-center cursor-pointer hover:bg-paper-dark transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4">
              {/* 地址列表 */}
              {!editingAddress && (
                <>
                  <button
                    onClick={() => setEditingAddress({} as UserAddress)}
                    className="w-full mb-4 py-2.5 border-2 border-dashed border-ink/30 text-ink font-sans text-sm flex items-center justify-center gap-2 hover:border-ink/60 transition-colors cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    添加新地址
                  </button>
                  
                  {addressesLoading ? (
                    <div className="text-center py-8 text-ink-muted font-sans text-sm">加载中...</div>
                  ) : addresses.length === 0 ? (
                    <div className="text-center py-8 text-ink-muted font-sans text-sm">暂无收货地址</div>
                  ) : (
                    <div className="space-y-3">
                      {addresses.map(addr => (
                        <div key={addr.id} className={`border ${addr.is_default ? 'border-film-green bg-film-green/5' : 'border-paper-dark'} p-3`}>
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <span className="font-sans font-semibold text-sm text-ink">{addr.name}</span>
                              <span className="font-sans text-sm text-ink ml-2">{addr.phone}</span>
                              {addr.is_default && <span className="ml-2 text-xs bg-film-green text-white px-1.5 py-0.5">默认</span>}
                            </div>
                            <div className="flex gap-2">
                              <button onClick={() => editAddress(addr)} className="text-film-blue font-sans text-xs cursor-pointer hover:underline">编辑</button>
                              <button onClick={() => handleDeleteAddress(addr.id)} className="text-film-red font-sans text-xs cursor-pointer hover:underline">删除</button>
                            </div>
                          </div>
                          <div className="font-sans text-xs text-ink-muted">{addr.province} {addr.city} {addr.district} {addr.detail}</div>
                          {!addr.is_default && (
                            <button onClick={() => handleSetDefaultAddress(addr.id)} className="mt-2 text-xs text-film-blue font-sans cursor-pointer hover:underline">设为默认</button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}

              {/* 地址表单 */}
              {editingAddress !== null && (
                <div className="space-y-3">
                  <div>
                    <label className="block font-sans text-xs text-ink-muted mb-1">收货人姓名</label>
                    <input
                      type="text"
                      value={addressForm.name}
                      onChange={e => setAddressForm({ ...addressForm, name: e.target.value })}
                      className="w-full px-3 py-2 border border-paper-dark font-sans text-sm text-ink bg-white focus:outline-none focus:border-ink"
                      placeholder="请输入收货人姓名"
                    />
                  </div>
                  <div>
                    <label className="block font-sans text-xs text-ink-muted mb-1">手机号码</label>
                    <input
                      type="tel"
                      value={addressForm.phone}
                      onChange={e => setAddressForm({ ...addressForm, phone: e.target.value })}
                      className="w-full px-3 py-2 border border-paper-dark font-sans text-sm text-ink bg-white focus:outline-none focus:border-ink"
                      placeholder="请输入手机号码"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block font-sans text-xs text-ink-muted mb-1">省份</label>
                      <input
                        type="text"
                        value={addressForm.province}
                        onChange={e => setAddressForm({ ...addressForm, province: e.target.value })}
                        className="w-full px-3 py-2 border border-paper-dark font-sans text-sm text-ink bg-white focus:outline-none focus:border-ink"
                        placeholder="省"
                      />
                    </div>
                    <div>
                      <label className="block font-sans text-xs text-ink-muted mb-1">城市</label>
                      <input
                        type="text"
                        value={addressForm.city}
                        onChange={e => setAddressForm({ ...addressForm, city: e.target.value })}
                        className="w-full px-3 py-2 border border-paper-dark font-sans text-sm text-ink bg-white focus:outline-none focus:border-ink"
                        placeholder="市"
                      />
                    </div>
                    <div>
                      <label className="block font-sans text-xs text-ink-muted mb-1">区县</label>
                      <input
                        type="text"
                        value={addressForm.district}
                        onChange={e => setAddressForm({ ...addressForm, district: e.target.value })}
                        className="w-full px-3 py-2 border border-paper-dark font-sans text-sm text-ink bg-white focus:outline-none focus:border-ink"
                        placeholder="区"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block font-sans text-xs text-ink-muted mb-1">详细地址</label>
                    <input
                      type="text"
                      value={addressForm.detail}
                      onChange={e => setAddressForm({ ...addressForm, detail: e.target.value })}
                      className="w-full px-3 py-2 border border-paper-dark font-sans text-sm text-ink bg-white focus:outline-none focus:border-ink"
                      placeholder="街道、门牌号等"
                    />
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={addressForm.is_default}
                      onChange={e => setAddressForm({ ...addressForm, is_default: e.target.checked })}
                      className="w-4 h-4"
                    />
                    <span className="font-sans text-sm text-ink">设为默认地址</span>
                  </label>
                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={() => { setEditingAddress(null); setAddressForm({ name: '', phone: '', province: '', city: '', district: '', detail: '', is_default: false }); }}
                      className="flex-1 py-2 border border-paper-dark font-sans text-sm text-ink cursor-pointer hover:bg-paper-warm transition-colors"
                    >
                      取消
                    </button>
                    <button
                      onClick={saveAddress}
                      disabled={addressSaving}
                      className="flex-1 py-2 bg-ink text-paper font-sans text-sm cursor-pointer hover:bg-ink/80 transition-colors disabled:opacity-50"
                    >
                      {addressSaving ? '保存中...' : '保存'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 支付方式管理 Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/60 backdrop-blur-sm" onClick={() => { setShowPaymentModal(false); setEditingPayment(null); setPaymentForm({ type: 'wechat', qr_code_url: '', bank_name: '', bank_account_encrypted: '', account_name: '', is_default: false }); setPaymentQrFile(null); }}>
          <div className="bg-paper w-full max-w-lg max-h-[85vh] overflow-y-auto border-2 border-ink" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-paper border-b-2 border-ink p-4 flex items-center justify-between">
              <h2 className="font-display text-xl text-ink">{editingPayment ? '编辑支付方式' : '支付方式管理'}</h2>
              <button onClick={() => { setShowPaymentModal(false); setEditingPayment(null); setPaymentForm({ type: 'wechat', qr_code_url: '', bank_name: '', bank_account_encrypted: '', account_name: '', is_default: false }); setPaymentQrFile(null); }} className="w-8 h-8 bg-paper-warm border border-paper-dark flex items-center justify-center cursor-pointer hover:bg-paper-dark transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4">
              {/* 支付方式列表 */}
              {!editingPayment && (
                <>
                  <button
                    onClick={() => setEditingPayment({} as UserPaymentMethod)}
                    className="w-full mb-4 py-2.5 border-2 border-dashed border-ink/30 text-ink font-sans text-sm flex items-center justify-center gap-2 hover:border-ink/60 transition-colors cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    添加支付方式
                  </button>
                  
                  {paymentsLoading ? (
                    <div className="text-center py-8 text-ink-muted font-sans text-sm">加载中...</div>
                  ) : paymentMethods.length === 0 ? (
                    <div className="text-center py-8 text-ink-muted font-sans text-sm">暂无支付方式</div>
                  ) : (
                    <div className="space-y-3">
                      {paymentMethods.map(pm => (
                        <div key={pm.id} className={`border ${pm.is_default ? 'border-film-green bg-film-green/5' : 'border-paper-dark'} p-3`}>
                          <div className="flex justify-between items-start mb-2">
                            <div className="flex items-center gap-2">
                              <span className="font-sans font-semibold text-sm text-ink">
                                {pm.type === 'wechat' ? '微信' : pm.type === 'alipay' ? '支付宝' : '银行卡'}
                              </span>
                              {pm.is_default && <span className="text-xs bg-film-green text-white px-1.5 py-0.5">默认</span>}
                            </div>
                            <div className="flex gap-2">
                              <button onClick={() => editPayment(pm)} className="text-film-blue font-sans text-xs cursor-pointer hover:underline">编辑</button>
                              <button onClick={() => handleDeletePayment(pm.id)} className="text-film-red font-sans text-xs cursor-pointer hover:underline">删除</button>
                            </div>
                          </div>
                          {pm.type !== 'bank_card' && pm.qr_code_url && (
                            <img src={pm.qr_code_url} alt="收款码" className="w-20 h-20 object-contain border border-paper-dark mb-2" />
                          )}
                          {pm.type === 'bank_card' && (
                            <div className="font-sans text-xs text-ink-muted">{pm.bank_name} {pm.bank_account_encrypted}</div>
                          )}
                          {!pm.is_default && (
                            <button onClick={() => handleSetDefaultPayment(pm.id)} className="mt-2 text-xs text-film-blue font-sans cursor-pointer hover:underline">设为默认</button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}

              {/* 支付方式表单 */}
              {editingPayment !== null && (
                <div className="space-y-3">
                  <div>
                    <label className="block font-sans text-xs text-ink-muted mb-1">支付类型</label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { value: 'wechat', label: '微信' },
                        { value: 'alipay', label: '支付宝' },
                        { value: 'bank_card', label: '银行卡' },
                      ].map(type => (
                        <button
                          key={type.value}
                          onClick={() => setPaymentForm({ ...paymentForm, type: type.value as any })}
                          className={`py-2 border font-sans text-sm cursor-pointer transition-colors ${paymentForm.type === type.value ? 'border-ink bg-ink text-paper' : 'border-paper-dark text-ink hover:border-ink/60'}`}
                        >
                          {type.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {(paymentForm.type === 'wechat' || paymentForm.type === 'alipay') && (
                    <>
                      <div>
                        <label className="block font-sans text-xs text-ink-muted mb-1">收款二维码</label>
                        <input
                          type="file"
                          ref={paymentQrInputRef}
                          accept="image/*"
                          onChange={e => setPaymentQrFile(e.target.files?.[0] || null)}
                          className="hidden"
                        />
                        <div
                          onClick={() => paymentQrInputRef.current?.click()}
                          className="border-2 border-dashed border-ink/30 p-4 text-center cursor-pointer hover:border-ink/60 transition-colors"
                        >
                          {paymentQrFile ? (
                            <img src={URL.createObjectURL(paymentQrFile)} alt="预览" className="w-24 h-24 object-contain mx-auto" />
                          ) : paymentForm.qr_code_url ? (
                            <img src={paymentForm.qr_code_url} alt="当前收款码" className="w-24 h-24 object-contain mx-auto" />
                          ) : (
                            <div className="text-ink-muted font-sans text-xs">
                              <ImageIcon className="w-8 h-8 mx-auto mb-1" />
                              点击上传收款二维码
                            </div>
                          )}
                        </div>
                      </div>
                      <div>
                        <label className="block font-sans text-xs text-ink-muted mb-1">开户人姓名（选填）</label>
                        <input
                          type="text"
                          value={paymentForm.account_name}
                          onChange={e => setPaymentForm({ ...paymentForm, account_name: e.target.value })}
                          className="w-full px-3 py-2 border border-paper-dark font-sans text-sm text-ink bg-white focus:outline-none focus:border-ink"
                          placeholder="请输入开户人姓名"
                        />
                      </div>
                    </>
                  )}

                  {paymentForm.type === 'bank_card' && (
                    <>
                      <div>
                        <label className="block font-sans text-xs text-ink-muted mb-1">银行名称</label>
                        <input
                          type="text"
                          value={paymentForm.bank_name}
                          onChange={e => setPaymentForm({ ...paymentForm, bank_name: e.target.value })}
                          className="w-full px-3 py-2 border border-paper-dark font-sans text-sm text-ink bg-white focus:outline-none focus:border-ink"
                          placeholder="如：中国工商银行"
                        />
                      </div>
                      <div>
                        <label className="block font-sans text-xs text-ink-muted mb-1">银行卡号</label>
                        <input
                          type="text"
                          value={paymentForm.bank_account_encrypted}
                          onChange={e => setPaymentForm({ ...paymentForm, bank_account_encrypted: e.target.value })}
                          className="w-full px-3 py-2 border border-paper-dark font-sans text-sm text-ink bg-white focus:outline-none focus:border-ink"
                          placeholder="请输入银行卡号"
                        />
                      </div>
                      <div>
                        <label className="block font-sans text-xs text-ink-muted mb-1">开户人姓名</label>
                        <input
                          type="text"
                          value={paymentForm.account_name}
                          onChange={e => setPaymentForm({ ...paymentForm, account_name: e.target.value })}
                          className="w-full px-3 py-2 border border-paper-dark font-sans text-sm text-ink bg-white focus:outline-none focus:border-ink"
                          placeholder="请输入开户人姓名"
                        />
                      </div>
                    </>
                  )}

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={paymentForm.is_default}
                      onChange={e => setPaymentForm({ ...paymentForm, is_default: e.target.checked })}
                      className="w-4 h-4"
                    />
                    <span className="font-sans text-sm text-ink">设为默认支付方式</span>
                  </label>
                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={() => { setEditingPayment(null); setPaymentForm({ type: 'wechat', qr_code_url: '', bank_name: '', bank_account_encrypted: '', account_name: '', is_default: false }); setPaymentQrFile(null); }}
                      className="flex-1 py-2 border border-paper-dark font-sans text-sm text-ink cursor-pointer hover:bg-paper-warm transition-colors"
                    >
                      取消
                    </button>
                    <button
                      onClick={savePaymentMethod}
                      disabled={paymentSaving}
                      className="flex-1 py-2 bg-ink text-paper font-sans text-sm cursor-pointer hover:bg-ink/80 transition-colors disabled:opacity-50"
                    >
                      {paymentSaving ? '保存中...' : '保存'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 通知设置 Modal */}
      {showNotificationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/60 backdrop-blur-sm" onClick={() => setShowNotificationModal(false)}>
          <div className="bg-paper w-full max-w-md max-h-[85vh] overflow-y-auto border-2 border-ink" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-paper border-b-2 border-ink p-4 flex items-center justify-between">
              <h2 className="font-display text-xl text-ink">通知设置</h2>
              <button onClick={() => setShowNotificationModal(false)} className="w-8 h-8 bg-paper-warm border border-paper-dark flex items-center justify-center cursor-pointer hover:bg-paper-dark transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4">
              {notificationLoading ? (
                <div className="text-center py-8 text-ink-muted font-sans text-sm">加载中...</div>
              ) : notificationSettings ? (
                <div className="space-y-4">
                  <p className="font-sans text-xs text-ink-muted mb-4">开启或关闭不同类型的通知推送</p>
                  
                  <div className="border border-paper-dark p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <div className="font-sans font-semibold text-sm text-ink">订单更新通知</div>
                        <div className="font-sans text-xs text-ink-muted">订单状态变化时接收通知</div>
                      </div>
                      <button
                        onClick={() => setNotificationSettings({ ...notificationSettings, order_update: !notificationSettings.order_update })}
                        className={`w-12 h-6 rounded-full transition-colors relative ${notificationSettings.order_update ? 'bg-film-green' : 'bg-paper-dark'}`}
                      >
                        <div className={`w-5 h-5 bg-white border absolute top-0.5 transition-transform ${notificationSettings.order_update ? 'translate-x-6' : 'translate-x-0.5'}`} />
                      </button>
                    </div>
                  </div>

                  <div className="border border-paper-dark p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <div className="font-sans font-semibold text-sm text-ink">价格提醒</div>
                        <div className="font-sans text-xs text-ink-muted">收藏商品降价时接收通知</div>
                      </div>
                      <button
                        onClick={() => setNotificationSettings({ ...notificationSettings, price_alert: !notificationSettings.price_alert })}
                        className={`w-12 h-6 rounded-full transition-colors relative ${notificationSettings.price_alert ? 'bg-film-green' : 'bg-paper-dark'}`}
                      >
                        <div className={`w-5 h-5 bg-white border absolute top-0.5 transition-transform ${notificationSettings.price_alert ? 'translate-x-6' : 'translate-x-0.5'}`} />
                      </button>
                    </div>
                  </div>

                  <div className="border border-paper-dark p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <div className="font-sans font-semibold text-sm text-ink">消息通知</div>
                        <div className="font-sans text-xs text-ink-muted">收到新消息时接收通知</div>
                      </div>
                      <button
                        onClick={() => setNotificationSettings({ ...notificationSettings, message: !notificationSettings.message })}
                        className={`w-12 h-6 rounded-full transition-colors relative ${notificationSettings.message ? 'bg-film-green' : 'bg-paper-dark'}`}
                      >
                        <div className={`w-5 h-5 bg-white border absolute top-0.5 transition-transform ${notificationSettings.message ? 'translate-x-6' : 'translate-x-0.5'}`} />
                      </button>
                    </div>
                  </div>

                  <div className="border border-paper-dark p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <div className="font-sans font-semibold text-sm text-ink">系统通知</div>
                        <div className="font-sans text-xs text-ink-muted">平台公告、系统消息等</div>
                      </div>
                      <button
                        onClick={() => setNotificationSettings({ ...notificationSettings, system: !notificationSettings.system })}
                        className={`w-12 h-6 rounded-full transition-colors relative ${notificationSettings.system ? 'bg-film-green' : 'bg-paper-dark'}`}
                      >
                        <div className={`w-5 h-5 bg-white border absolute top-0.5 transition-transform ${notificationSettings.system ? 'translate-x-6' : 'translate-x-0.5'}`} />
                      </button>
                    </div>
                  </div>

                  <button
                    onClick={saveNotificationSettings}
                    disabled={notificationSaving}
                    className="w-full py-2.5 bg-ink text-paper font-sans font-semibold text-sm cursor-pointer hover:bg-ink/80 transition-colors disabled:opacity-50 mt-4"
                  >
                    {notificationSaving ? '保存中...' : '保存设置'}
                  </button>
                </div>
              ) : (
                <div className="text-center py-8 text-ink-muted font-sans text-sm">加载失败</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
