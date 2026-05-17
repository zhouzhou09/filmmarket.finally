import { useState, useEffect, useCallback } from 'react';
import { Bell, Check, CheckCheck, Trash2, Loader2 } from 'lucide-react';
import { getUnreadCount, type ApiNotification } from '../lib/api';
import { useAuth } from '../hooks/useAuth';
import type { NavPage } from '../types';

interface NotificationBellProps {
  onNavigate: (page: NavPage) => void;
}

const typeIcons: Record<string, string> = {
  order_created: '📦',
  order_paid: '💰',
  order_confirmed: '✅',
  order_cancelled: '❌',
  review_received: '⭐',
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

export default function NotificationBell({ onNavigate }: NotificationBellProps) {
  const { isAuthenticated } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<ApiNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(1);

  // 获取未读数
  const fetchUnreadCount = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const data = await getUnreadCount();
      setUnreadCount(data.unreadCount);
    } catch (error) {
      console.error('获取未读数失败:', error);
    }
  }, [isAuthenticated]);

  // 获取通知列表
  const fetchNotifications = useCallback(async (reset = false) => {
    if (!isAuthenticated) return;
    setLoading(true);
    try {
      const currentPage = reset ? 1 : page;
      const res = await fetch(`/api/notifications?page=${currentPage}&limit=5`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('fm_token')}`,
        },
      });
      const data = await res.json();
      setNotifications(prev => reset ? data.notifications : [...prev, ...data.notifications]);
      setHasMore(data.notifications?.length >= 5);
      if (reset) setPage(1);
    } catch (error) {
      console.error('获取通知失败:', error);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, page]);

  // 标记单条已读
  const markAsRead = async (id: string) => {
    try {
      await fetch(`/api/notifications/${id}/read`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('fm_token')}`,
        },
      });
      setNotifications(prev =>
        prev.map(n => (n.id === id ? { ...n, is_read: true } : n))
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('标记已读失败:', error);
    }
  };

  // 全部已读
  const markAllRead = async () => {
    try {
      await fetch('/api/notifications/read-all', {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('fm_token')}`,
        },
      });
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('全部已读失败:', error);
    }
  };

  // 删除通知
  const deleteNotification = async (id: string) => {
    try {
      await fetch(`/api/notifications/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('fm_token')}`,
        },
      });
      const removed = notifications.find(n => n.id === id);
      setNotifications(prev => prev.filter(n => n.id !== id));
      if (removed && !removed.is_read) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('删除通知失败:', error);
    }
  };

  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000); // 每30秒刷新
    return () => clearInterval(interval);
  }, [fetchUnreadCount]);

  useEffect(() => {
    if (isOpen) {
      fetchNotifications(true);
    }
  }, [isOpen]);

  if (!isAuthenticated) return null;

  return (
    <div className="relative">
      {/* 铃铛按钮 */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 hover:bg-paper-warm rounded transition-colors cursor-pointer"
        title="通知"
      >
        <Bell className="w-5 h-5 text-ink" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-film-red text-white text-xs font-bold rounded-full flex items-center justify-center px-1">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* 通知面板 */}
      {isOpen && (
        <>
          {/* 点击外部关闭 */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />

          <div className="absolute right-0 top-full mt-2 w-80 bg-paper border-2 border-ink shadow-retro-lg z-50 animate-scale-in">
            {/* 头部 */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-paper-dark bg-paper-warm">
              <h3 className="font-display text-base text-ink">消息通知</h3>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    onClick={markAllRead}
                    className="p-1.5 hover:bg-paper-dark rounded transition-colors cursor-pointer"
                    title="全部已读"
                  >
                    <CheckCheck className="w-4 h-4 text-ink-muted" />
                  </button>
                )}
                <button
                  onClick={() => {
                    setIsOpen(false);
                    onNavigate('notifications');
                  }}
                  className="text-xs text-amber-film hover:underline cursor-pointer"
                >
                  查看全部
                </button>
              </div>
            </div>

            {/* 通知列表 */}
            <div className="max-h-96 overflow-y-auto">
              {loading && notifications.length === 0 ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="w-6 h-6 text-ink-muted animate-spin" />
                </div>
              ) : notifications.length === 0 ? (
                <div className="text-center py-10">
                  <Bell className="w-10 h-10 text-ink-muted mx-auto mb-2 opacity-40" />
                  <p className="text-sm text-ink-muted">暂无通知</p>
                </div>
              ) : (
                <>
                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`px-4 py-3 border-b border-paper-dark hover:bg-paper-warm transition-colors ${
                        !notification.is_read ? 'bg-amber-film/5' : ''
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {/* 图标 */}
                        <span className="text-xl flex-shrink-0 mt-0.5">
                          {typeIcons[notification.type] || '📬'}
                        </span>

                        {/* 内容 */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-sans font-semibold text-ink line-clamp-1">
                              {notification.title}
                            </p>
                            <span className="text-xs text-ink-muted flex-shrink-0">
                              {timeAgo(notification.created_at)}
                            </span>
                          </div>
                          <p className="text-xs text-ink-muted mt-0.5 line-clamp-2">
                            {notification.content}
                          </p>

                          {/* 操作按钮 */}
                          <div className="flex items-center gap-2 mt-2">
                            {!notification.is_read && (
                              <button
                                onClick={() => markAsRead(notification.id)}
                                className="flex items-center gap-1 px-2 py-1 text-xs text-ink-muted hover:text-ink hover:bg-paper-dark rounded transition-colors cursor-pointer"
                              >
                                <Check className="w-3 h-3" /> 标为已读
                              </button>
                            )}
                            <button
                              onClick={() => deleteNotification(notification.id)}
                              className="flex items-center gap-1 px-2 py-1 text-xs text-ink-muted hover:text-film-red hover:bg-paper-dark rounded transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3 h-3" /> 删除
                            </button>
                          </div>
                        </div>

                        {/* 未读标记 */}
                        {!notification.is_read && (
                          <span className="w-2 h-2 bg-film-red rounded-full flex-shrink-0 mt-2" />
                        )}
                      </div>
                    </div>
                  ))}

                  {/* 加载更多 */}
                  {hasMore && !loading && (
                    <button
                      onClick={() => {
                        setPage(p => p + 1);
                        fetchNotifications(false);
                      }}
                      className="w-full py-3 text-sm text-ink-muted hover:text-ink hover:bg-paper-warm transition-colors cursor-pointer"
                    >
                      加载更多
                    </button>
                  )}

                  {loading && hasMore && (
                    <div className="flex items-center justify-center py-3">
                      <Loader2 className="w-4 h-4 text-ink-muted animate-spin" />
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
