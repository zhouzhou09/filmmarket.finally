import { useState, useEffect } from 'react';
import { MessageCircle, ChevronLeft, Trash2, ShoppingBag, Loader2 } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { getConversations, deleteConversation, type Conversation } from '../lib/api';
import type { NavPage } from '../types';

interface ChatListPageProps {
  onBack: () => void;
  onNavigate: (page: NavPage) => void;
  onOpenChat: (conversation: Conversation) => void;
}

function formatTime(dateStr: string | null): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) {
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  } else if (days === 1) {
    return '昨天';
  } else if (days < 7) {
    const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    return weekdays[date.getDay()];
  } else {
    return `${date.getMonth() + 1}/${date.getDate()}`;
  }
}

function ConversationCard({
  conversation,
  onClick,
  onDelete,
}: {
  conversation: Conversation;
  onClick: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className="flex items-start gap-3 p-4 bg-paper hover:bg-paper-warm border-b border-paper-dark cursor-pointer transition-colors"
      onClick={onClick}
    >
      {/* 头像 */}
      <div className="relative flex-shrink-0">
        <img
          src={conversation.otherUser.avatar || 'https://api.dicebear.com/7.x/thumbs/svg?seed=user'}
          alt={conversation.otherUser.nickname}
          className="w-12 h-12 rounded-full border-2 border-ink object-cover bg-paper-warm"
        />
        {conversation.unreadCount > 0 && (
          <div className="absolute -top-1 -right-1 w-5 h-5 bg-film-red text-white text-xs font-bold rounded-full flex items-center justify-center">
            {conversation.unreadCount > 99 ? '99+' : conversation.unreadCount}
          </div>
        )}
      </div>

      {/* 内容 */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className="font-sans font-bold text-ink truncate">
            {conversation.otherUser.nickname}
          </span>
          <span className="text-xs font-mono text-ink-muted flex-shrink-0 ml-2">
            {formatTime(conversation.lastMessageAt)}
          </span>
        </div>

        {/* 商品信息 */}
        {conversation.product && (
          <div className="flex items-center gap-1.5 mb-1 text-xs text-film-blue">
            <ShoppingBag className="w-3 h-3" />
            <span className="truncate">{conversation.product.title}</span>
          </div>
        )}

        {/* 最后消息 */}
        <p className={`text-sm truncate ${conversation.unreadCount > 0 ? 'text-ink font-semibold' : 'text-ink-muted'}`}>
          {conversation.lastMessage || '暂无消息'}
        </p>
      </div>

      {/* 删除按钮 */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        className="p-2 text-ink-muted hover:text-film-red hover:bg-film-red/10 transition-colors rounded"
        title="删除对话"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
}

export default function ChatListPage({ onBack, onNavigate, onOpenChat }: ChatListPageProps) {
  const { isAuthenticated } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }

    const fetchConversations = async () => {
      try {
        const data = await getConversations();
        setConversations(data);
      } catch (err: any) {
        setError(err.message || '获取对话列表失败');
      } finally {
        setLoading(false);
      }
    };

    fetchConversations();
  }, [isAuthenticated]);

  const handleDelete = async (conversationId: string) => {
    if (!confirm('确定要删除这个对话吗？')) return;

    try {
      await deleteConversation(conversationId);
      setConversations(prev => prev.filter(c => c.id !== conversationId));
    } catch (err: any) {
      alert(err.message || '删除失败');
    }
  };

  return (
    <div className="min-h-screen bg-paper">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-paper border-b-2 border-ink">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-2 -ml-2 hover:bg-paper-warm transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-5 h-5 text-ink" />
            </button>
            <div className="flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-amber-film" />
              <h1 className="font-display text-lg font-bold text-ink">我的消息</h1>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="pb-20">
        {loading && (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="w-8 h-8 text-amber-film animate-spin" />
            <p className="font-sans text-sm text-ink-muted">加载中...</p>
          </div>
        )}

        {!loading && error && (
          <div className="text-center py-20">
            <p className="font-sans text-sm text-film-red mb-4">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="btn-secondary text-sm"
            >
              重试
            </button>
          </div>
        )}

        {!loading && !error && conversations.length === 0 && (
          <div className="text-center py-20">
            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-paper-warm border-2 border-paper-dark flex items-center justify-center">
              <MessageCircle className="w-10 h-10 text-ink-muted" />
            </div>
            <p className="font-sans text-ink font-semibold mb-2">暂无消息</p>
            <p className="font-sans text-sm text-ink-muted">
              去商品详情页联系卖家开始聊天吧
            </p>
            <button
              onClick={() => onNavigate('discover')}
              className="btn-primary mt-4"
            >
              去发现
            </button>
          </div>
        )}

        {!loading && !error && conversations.length > 0 && (
          <div className="divide-y divide-paper-dark">
            {conversations.map(conv => (
              <ConversationCard
                key={conv.id}
                conversation={conv}
                onClick={() => onOpenChat(conv)}
                onDelete={() => handleDelete(conv.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
