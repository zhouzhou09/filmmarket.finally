import { useState, useEffect, useCallback } from 'react';
import {
  getNotifications,
  getUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
  type ApiNotification,
  type NotificationsResponse,
} from '../lib/api';

interface UseNotificationsReturn {
  notifications: ApiNotification[];
  unreadCount: number;
  total: number;
  loading: boolean;
  refreshing: boolean;
  hasMore: boolean;
  fetchNotifications: () => Promise<void>;
  fetchUnreadCount: () => Promise<void>;
  loadMore: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  removeNotification: (id: string) => Promise<void>;
}

export function useNotifications(): UseNotificationsReturn {
  const [notifications, setNotifications] = useState<ApiNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const LIMIT = 20;

  const fetchNotifications = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const data: NotificationsResponse = await getNotifications(1, LIMIT);
      setNotifications(data.notifications);
      setUnreadCount(data.unreadCount);
      setTotal(data.total);
      setPage(1);
      setHasMore(data.notifications.length >= LIMIT);
    } catch (error) {
      console.error('获取通知失败:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const fetchUnreadCount = useCallback(async () => {
    try {
      const data = await getUnreadCount();
      setUnreadCount(data.unreadCount);
    } catch (error) {
      console.error('获取未读数失败:', error);
    }
  }, []);

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;

    setLoading(true);
    try {
      const nextPage = page + 1;
      const data: NotificationsResponse = await getNotifications(nextPage, LIMIT);
      setNotifications(prev => [...prev, ...data.notifications]);
      setPage(nextPage);
      setHasMore(data.notifications.length >= LIMIT);
    } catch (error) {
      console.error('加载更多通知失败:', error);
    } finally {
      setLoading(false);
    }
  }, [page, loading, hasMore]);

  const markAsRead = useCallback(async (id: string) => {
    try {
      await markNotificationRead(id);
      setNotifications(prev =>
        prev.map(n => (n.id === id ? { ...n, is_read: true } : n))
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('标记已读失败:', error);
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    try {
      await markAllNotificationsRead();
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('全部标记已读失败:', error);
    }
  }, []);

  const removeNotification = useCallback(async (id: string) => {
    try {
      await deleteNotification(id);
      setNotifications(prev => {
        const removed = prev.find(n => n.id === id);
        if (removed && !removed.is_read) {
          setUnreadCount(count => Math.max(0, count - 1));
        }
        return prev.filter(n => n.id !== id);
      });
      setTotal(prev => prev - 1);
    } catch (error) {
      console.error('删除通知失败:', error);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  return {
    notifications,
    unreadCount,
    total,
    loading,
    refreshing,
    hasMore,
    fetchNotifications,
    fetchUnreadCount,
    loadMore,
    markAsRead,
    markAllAsRead,
    removeNotification,
  };
}
