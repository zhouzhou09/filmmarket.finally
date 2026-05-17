import { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronLeft, Send, ShoppingBag, Image as ImageIcon, Loader2 } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import {
  getMessages,
  sendMessage,
  markConversationRead,
  uploadFile,
  type Conversation,
  type ChatMessage,
} from '../lib/api';
import { uploadWechatQR } from '../lib/api';

interface ChatRoomPageProps {
  conversation: Conversation;
  onBack: () => void;
  onProductClick?: (productId: string) => void;
}

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();

  if (isToday) {
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  } else {
    return date.toLocaleTimeString('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
}

function MessageBubble({
  message,
  isOwn,
  showAvatar,
}: {
  message: ChatMessage;
  isOwn: boolean;
  showAvatar: boolean;
}) {
  return (
    <div className={`flex items-end gap-2 ${isOwn ? 'flex-row-reverse' : 'flex-row'} mb-3`}>
      {/* 头像 */}
      <img
        src={message.sender.avatar || 'https://api.dicebear.com/7.x/thumbs/svg?seed=user'}
        alt={message.sender.nickname}
        className={`w-9 h-9 rounded-full border border-paper-dark object-cover bg-paper-warm flex-shrink-0 ${
          showAvatar ? 'visible' : 'invisible'
        }`}
      />

      {/* 消息气泡 */}
      <div className={`max-w-[75%] ${isOwn ? 'items-end' : 'items-start'} flex flex-col`}>
        {showAvatar && (
          <span className={`text-xs text-ink-muted mb-1 ${isOwn ? 'text-right mr-1' : 'ml-1'}`}>
            {message.sender.nickname}
          </span>
        )}
        <div
          className={`px-3 py-2 text-sm ${
            isOwn
              ? 'bg-amber-film text-white rounded-2xl rounded-br-md'
              : 'bg-paper-warm border border-paper-dark text-ink rounded-2xl rounded-bl-md'
          }`}
          style={{ wordBreak: 'break-word' }}
        >
          {message.type === 'image' ? (
            <img
              src={message.content}
              alt="图片消息"
              className="max-w-full rounded-lg cursor-pointer hover:opacity-90"
              onClick={() => window.open(message.content, '_blank')}
            />
          ) : (
            <span className="whitespace-pre-wrap">{message.content}</span>
          )}
        </div>
        <span className={`text-xs text-ink-muted mt-1 ${isOwn ? 'text-right mr-1' : 'ml-1'}`}>
          {formatTime(message.createdAt)}
        </span>
      </div>
    </div>
  );
}

export default function ChatRoomPage({ conversation, onBack, onProductClick }: ChatRoomPageProps) {
  const { user, isAuthenticated } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 加载消息
  const loadMessages = useCallback(async (pageNum: number, append = false) => {
    if (pageNum === 1) setLoading(true);
    else setLoadingMore(true);

    try {
      const res = await getMessages(conversation.id, pageNum, 50);
      const newMessages = res.messages;

      if (append) {
        setMessages(prev => [...newMessages.reverse(), ...prev]);
      } else {
        setMessages(newMessages.reverse());
      }

      setHasMore(res.total > pageNum * 50);
      setPage(pageNum);
    } catch (err: any) {
      console.error('加载消息失败:', err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [conversation.id]);

  // 初始加载 + 标记已读
  useEffect(() => {
    loadMessages(1);
    markConversationRead(conversation.id).catch(() => {});
  }, [conversation.id, loadMessages]);

  // 滚动到底部
  useEffect(() => {
    if (!loading && messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [loading, messages.length]);

  // 监听容器滚动，加载更多历史消息
  const handleScroll = useCallback(() => {
    if (!messagesContainerRef.current || loadingMore || !hasMore) return;

    if (messagesContainerRef.current.scrollTop < 100) {
      loadMessages(page + 1, true);
    }
  }, [loadingMore, hasMore, page, loadMessages]);

  // 发送消息
  const handleSend = async () => {
    if (!inputText.trim() || sending) return;

    setSending(true);
    try {
      const newMessage = await sendMessage(conversation.id, inputText.trim());
      setMessages(prev => [...prev, newMessage]);
      setInputText('');
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });

      // 更新本地对话列表的最后消息（通过回调通知父组件）
    } catch (err: any) {
      alert(err.message || '发送失败');
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  // 发送图片
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const file = files[0];
    if (!file.type.startsWith('image/')) {
      alert('请选择图片文件');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('图片大小不能超过 5MB');
      return;
    }

    setSending(true);
    try {
      const { url } = await uploadFile(file);
      const newMessage = await sendMessage(conversation.id, url, 'image');
      setMessages(prev => [...prev, newMessage]);
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    } catch (err: any) {
      alert(err.message || '上传失败');
    } finally {
      setSending(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // 处理回车发送
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // 自动调整输入框高度
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputText(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-paper flex flex-col">
        <div className="flex items-center gap-3 px-4 py-3 border-b-2 border-ink">
          <button onClick={onBack} className="p-2 -ml-2 cursor-pointer">
            <ChevronLeft className="w-5 h-5 text-ink" />
          </button>
          <p className="font-sans text-sm text-ink-muted">请先登录</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-paper border-b-2 border-ink">
        <div className="flex items-center gap-3 px-4 py-3">
          <button
            onClick={onBack}
            className="p-2 -ml-2 hover:bg-paper-warm transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-5 h-5 text-ink" />
          </button>

          <div className="flex items-center gap-2 flex-1 min-w-0">
            <img
              src={conversation.otherUser.avatar || 'https://api.dicebear.com/7.x/thumbs/svg?seed=user'}
              alt={conversation.otherUser.nickname}
              className="w-8 h-8 rounded-full border border-paper-dark object-cover"
            />
            <div className="min-w-0">
              <p className="font-sans font-bold text-ink truncate">
                {conversation.otherUser.nickname}
              </p>
            </div>
          </div>
        </div>

        {/* 商品卡片 */}
        {conversation.product && (
          <div
            className="flex items-center gap-3 px-4 py-2 bg-paper-warm border-t border-paper-dark cursor-pointer hover:bg-paper-dark transition-colors"
            onClick={() => onProductClick?.(conversation.product!.id)}
          >
            <ShoppingBag className="w-4 h-4 text-amber-film flex-shrink-0" />
            <img
              src={conversation.product.images[0] || '/images/placeholder.png'}
              alt={conversation.product.title}
              className="w-8 h-8 rounded border border-paper-dark object-cover"
            />
            <div className="flex-1 min-w-0">
              <p className="font-sans text-sm text-ink truncate">{conversation.product.title}</p>
            </div>
            <span className="font-display text-amber-film font-bold">
              ¥{conversation.product.price.toLocaleString()}
            </span>
          </div>
        )}
      </div>

      {/* 消息列表 */}
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto px-4 py-4"
        onScroll={handleScroll}
      >
        {loading && (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 text-amber-film animate-spin" />
          </div>
        )}

        {loadingMore && (
          <div className="flex justify-center py-4">
            <Loader2 className="w-5 h-5 text-amber-film animate-spin" />
          </div>
        )}

        {!loading && messages.length === 0 && (
          <div className="text-center py-12">
            <p className="font-sans text-sm text-ink-muted">
              还没有消息，快来打个招呼吧 👋
            </p>
          </div>
        )}

        {messages.map((msg, idx) => {
          const isOwn = msg.sender.id === String(user?.id);
          // 判断是否显示头像（每3条消息显示一次，或者和上一条消息发送者不同）
          const prevMsg = messages[idx - 1];
          const showAvatar = !prevMsg || prevMsg.sender.id !== msg.sender.id || idx % 3 === 0;

          return (
            <MessageBubble
              key={msg.id}
              message={msg}
              isOwn={isOwn}
              showAvatar={showAvatar}
            />
          );
        })}

        <div ref={messagesEndRef} />
      </div>

      {/* 输入区域 */}
      <div className="border-t-2 border-ink bg-paper">
        {/* 图片预览上传区域 */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleImageUpload}
        />

        <div className="flex items-end gap-2 px-4 py-3">
          {/* 图片按钮 */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={sending}
            className="p-2 text-ink-muted hover:text-amber-film hover:bg-paper-warm transition-colors rounded flex-shrink-0 disabled:opacity-50 cursor-pointer"
            title="发送图片"
          >
            <ImageIcon className="w-5 h-5" />
          </button>

          {/* 文字输入 */}
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={inputText}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="输入消息..."
              rows={1}
              className="w-full px-3 py-2 bg-paper-warm border-2 border-paper-dark focus:border-ink rounded-lg resize-none font-sans text-sm text-ink placeholder:text-ink-muted focus:outline-none"
              style={{ maxHeight: '120px' }}
            />
          </div>

          {/* 发送按钮 */}
          <button
            onClick={handleSend}
            disabled={!inputText.trim() || sending}
            className="p-2.5 bg-amber-film text-white rounded-lg hover:bg-amber-film/90 transition-colors flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {sending ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </div>

        {/* 安全提示 */}
        <div className="px-4 pb-2">
          <p className="text-xs text-ink-muted text-center">
            交易过程中如有问题，请通过平台订单功能保障权益
          </p>
        </div>
      </div>
    </div>
  );
}
