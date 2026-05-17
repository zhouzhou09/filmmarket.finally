import { useState, useEffect, useCallback } from 'react';
import {
  Bell, ChevronLeft, Check, CheckCheck, Trash2, Loader2,
  RefreshCw, Package, CreditCard, CheckCircle, XCircle, Star
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
  type ApiNotification,
  type NotificationsResponse,
} from '../lib/api';
import type { NavPage } from '../types';

interface NotificationsPageProps {
  onBack: () => void;
  onNavigate: (page: NavPage) => void;
}

// 通知类型配置
const typeConfig: Record<string, {
  icon: React.ReactNode;
  color: string;
  bgColor: string;
}> = {
  order_created: {
    icon: <Package className="w-5 h-5" />,
    color: 'text-purple-600',
    bgColor: 'bg-purple-100',
  },
  order_paid: {
    icon: <CreditCard className="w-5 h-5" />,
    color: 'text-green-600',
    bgColor: 'bg-green-100',
  },
  order_confirmed: {
    icon: <CheckCircle className="w-5 h-5" />,
    color: 'text-film-green',
    bgColor: 'bg-film-green/10',
  },
  order_cancelled: {
    icon: <XCircle className="w-5 h-5" />,
    color: 'text-film-red',
    bgColor: 'bg-film-red/10',
  },
  review_received: {
    icon: <Star className="w-5 h-5" />,
    color: 'text-amber-film',
    bgColor: 'bg-amber-film/10',
  },
};

function timeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes}分钟前`;
  if (hours < 24) return `${hours}小时前`;
  if (days < 7) return `${days}天前`;
  return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function NotificationsPage({ onBack, onNavigate }: NotificationsPageProps) {
  const { isAuthenticated } = useAuth();
  const [notifications, setNotifications] = useState<ApiNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(1);

  const LIMIT = 20;

  const fetchNotifications = useCallback(async (reset = false) => {
    if (!isAuthenticated) return;

    if (reset) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const data: NotificationsResponse = await getNotifications(reset ? 1 : page, LIMIT);
      setNotifications(prev => reset ? data.notifications : [...prev, ...data.notifications]);
      setUnreadCount(data.unreadCount);
      setTotal(data.total);
      if (reset) setPage(1);
      setHasMore(data.notifications.length >= LIMIT);
    } catch (error) {
      console.error('获取通知失败:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isAuthenticated, page]);

  useEffect(() => {
    fetchNotifications(true);
  }, []);

  const handleRefresh = () => {
    fetchNotifications(true);
  };

  const handleLoadMore = () => {
    setPage(p => p + 1);
    fetchNotifications(false);
  };

  const handleMarkAsRead = async (id: string) => {
    try {
      await markNotificationRead(id);
      setNotifications(prev =>
        prev.map(n => (n.id === id ? { ...n, is_read: true } : n))
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('标记已读失败:', error);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsRead();
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('全部已读失败:', error);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteNotification(id);
      const removed = notifications.find(n => n.id === id);
      setNotifications(prev => prev.filter(n => n.id !== id));
      if (removed && !removed.is_read) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
      setTotal(prev => prev - 1);
    } catch (error) {
      console.error('删除通知失败:', error);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-paper pb-16 flex items-center justify-center">
        <div className="text-center px-6">
          <Bell className="w-16 h-16 text-ink-muted mx-auto mb-4" />
          <h2 className="font-display text-2xl text-ink mb-2">请先登录</h2>
          <p className="font-sans text-ink-muted mb-6">登录后查看您的通知</p>
          <button onClick={() => onNavigate('auth')} className="btn-primary">
            去登录
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper pb-16">
      {/* Header */}
      <div className="bg-paper-warm border-b-2 border-ink sticky top-14 z-20">
        <div className="section-container py-3 flex items-center justify-between">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-sm font-sans text-ink-muted hover:text-ink transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" /> 返回
          </button>
          <span className="font-display text-lg text-ink">消息通知</span>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-1.5 hover:bg-paper-dark rounded cursor-pointer transition-colors"
            title="刷新"
          >
            <RefreshCw className={`w-4 h-4 text-ink-muted ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* 统计和操作 */}
        <div className="section-container pb-3 flex items-center justify-between">
          <div className="flex items-center gap-4 text-sm font-sans">
            <span className="text-ink">
              共 <span className="font-semibold">{total}</span> 条
            </span>
            {unreadCount > 0 && (
              <span className="text-film-red">
                <span className="font-semibold">{unreadCount}</span> 条未读
              </span>
            )}
          </div>
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-sans text-ink-muted hover:text-ink hover:bg-paper-dark rounded transition-colors cursor-pointer"
            >
              <CheckCheck className="w-4 h-4" />
              全部已读
            </button>
          )}
        </div>
      </div>

      {/* 通知列表 */}
      <div className="section-container py-4">
        {loading && notifications.length === 0 ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-ink-muted animate-spin" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="text-center py-20">
            <Bell className="w-16 h-16 text-ink-muted mx-auto mb-4 opacity-40" />
            <p className="font-sans text-ink-muted">暂无通知</p>
            <p className="font-sans text-xs text-ink-muted mt-2">
              有新消息时会在此处显示
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {notifications.map((notification) => {
                const config = typeConfig[notification.type] || typeConfig.order_created;

                return (
                  <div
                    key={notification.id}
                    className={`bg-paper border-2 transition-colors ${
                      notification.is_read
                        ? 'border-paper-dark hover:border-ink/30'
                        : 'border-amber-film/50 hover:border-amber-film'
                    }`}
                  >
                    {/* 卡片头部 */}
                    <div className="flex items-start gap-3 p-4">
                      {/* 图标 */}
                      <div className={`p-2.5 rounded-lg ${config.bgColor}`}>
                        <span className={config.color}>{config.icon}</span>
                      </div>

                      {/* 内容 */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="font-sans font-semibold text-ink text-sm line-clamp-1">
                            {notification.title}
                          </h3>
                          <span className="text-xs text-ink-muted flex-shrink-0">
                            {timeAgo(notification.created_at)}
                          </span>
                        </div>
                        <p className="font-sans text-sm text-ink-muted mt-1.5 line-clamp-2">
                          {notification.content}
                        </p>
                        <p className="font-sans text-xs text-ink-muted/60 mt-1.5">
                          {formatDate(notification.created_at)}
                        </p>
                      </div>

                      {/* 未读标记 */}
                      {!notification.is_read && (
                        <span className="w-2.5 h-2.5 bg-film-red rounded-full flex-shrink-0 mt-1.5" />
                      )}
                    </div>

                    {/* 操作栏 */}
                    <div className="flex border-t border-paper-dark">
                      {!notification.is_read && (
                        <button
                          onClick={() => handleMarkAsRead(notification.id)}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-sans text-ink-muted hover:text-ink hover:bg-paper-warm transition-colors cursor-pointer border-r border-paper-dark"
                        >
                          <Check className="w-4 h-4" />
                          标为已读
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(notification.id)}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-sans text-ink-muted hover:text-film-red hover:bg-film-red/5 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                        删除
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 加载更多 */}
            {hasMore && (
              <div className="mt-4 text-center">
                {loading ? (
                  <div className="flex items-center justify-center gap-2 py-3">
                    <Loader2 className="w-5 h-5 text-ink-muted animate-spin" />
                    <span className="text-sm text-ink-muted">加载中...</span>
                  </div>
                ) : (
                  <button
                    onClick={handleLoadMore}
                    className="px-6 py-2.5 border-2 border-paper-dark text-sm font-sans text-ink-muted hover:border-ink hover:text-ink transition-colors cursor-pointer"
                  >
                    加载更多
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
