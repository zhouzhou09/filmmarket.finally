import { useState } from 'react';
import { Camera, Mail, Lock, User, Eye, EyeOff, ArrowLeft, Check, X } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

interface AuthPageProps {
  onBack: () => void;
  onSuccess: () => void;
}

// 密码验证规则
const passwordRules = [
  { id: 'length', label: '至少 8 个字符', check: (p: string) => p.length >= 8 },
  { id: 'upper', label: '包含大写字母', check: (p: string) => /[A-Z]/.test(p) },
  { id: 'lower', label: '包含小写字母', check: (p: string) => /[a-z]/.test(p) },
  { id: 'number', label: '包含数字', check: (p: string) => /[0-9]/.test(p) },
];

export default function AuthPage({ onBack, onSuccess }: AuthPageProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { signIn, signUp } = useAuth();

  // 表单数据
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    nickname: '',
  });

  // 切换模式时清除错误
  const switchMode = (newMode: 'login' | 'register') => {
    setMode(newMode);
    setError(null);
    setFormData({ email: '', password: '', nickname: '' });
  };

  // 验证表单
  const validateForm = (): boolean => {
    if (!formData.email) {
      setError('请输入邮箱地址');
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      setError('请输入有效的邮箱地址');
      return false;
    }
    if (!formData.password) {
      setError('请输入密码');
      return false;
    }
    if (mode === 'register') {
      if (!formData.nickname) {
        setError('请输入昵称');
        return false;
      }
      const allRulesPass = passwordRules.every(rule => rule.check(formData.password));
      if (!allRulesPass) {
        setError('密码必须满足所有要求');
        return false;
      }
    }
    return true;
  };

  // 提交表单 — 真实 API 调用
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!validateForm()) return;

    setLoading(true);

    try {
      if (mode === 'login') {
        await signIn(formData.email, formData.password);
      } else {
        await signUp(formData.email, formData.password, formData.nickname);
      }
      setLoading(false);
      onSuccess();
    } catch (err: any) {
      setLoading(false);
      // 显示后端返回的具体错误（邮箱已存在、密码错误等）
      setError(err.message || (mode === 'login' ? '邮箱或密码错误' : '注册失败，请重试'));
    }
  };

  // 检查密码规则
  const checkPasswordRule = (rule: typeof passwordRules[0]) => {
    if (!formData.password) return false;
    return rule.check(formData.password);
  };

  return (
    <div className="min-h-screen bg-paper flex flex-col">
      {/* Header */}
      <div className="bg-paper-warm border-b-2 border-ink">
        <div className="section-container py-3 flex items-center gap-3">
          <button
            onClick={onBack}
            className="flex items-center gap-1 text-sm font-sans text-ink-muted hover:text-ink transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            返回
          </button>
          <span className="font-display text-lg text-ink flex-1 text-center">
            {mode === 'login' ? '登录账号' : '注册新账号'}
          </span>
          <div className="w-16" />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md">
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-ink flex items-center justify-center mx-auto mb-4">
              <Camera className="w-8 h-8 text-amber-film" />
            </div>
            <h1 className="font-display text-3xl text-ink mb-2">FilmMarket</h1>
            <p className="font-sans text-ink-muted text-sm">胶片玩家的专属交易市集</p>
          </div>

          {/* Error message */}
          {error && (
            <div className="mb-4 p-3 bg-film-red/10 border border-film-red/30 flex items-center gap-2 text-film-red text-sm">
              <X className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Nickname (register only) */}
            {mode === 'register' && (
              <div>
                <label className="block text-xs font-sans font-bold text-ink-muted uppercase tracking-wider mb-2">
                  昵称
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-muted" />
                  <input
                    type="text"
                    placeholder="你希望别人怎么称呼你"
                    value={formData.nickname}
                    onChange={(e) => setFormData(prev => ({ ...prev, nickname: e.target.value }))}
                    className="w-full pl-10 pr-4 py-3 border-2 border-paper-dark bg-white font-sans text-sm text-ink placeholder-ink-muted/60 outline-none focus:border-amber-film transition-colors"
                  />
                </div>
              </div>
            )}

            {/* Email */}
            <div>
              <label className="block text-xs font-sans font-bold text-ink-muted uppercase tracking-wider mb-2">
                邮箱
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-muted" />
                <input
                  type="email"
                  placeholder="your@email.com"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  className="w-full pl-10 pr-4 py-3 border-2 border-paper-dark bg-white font-sans text-sm text-ink placeholder-ink-muted/60 outline-none focus:border-amber-film transition-colors"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-sans font-bold text-ink-muted uppercase tracking-wider mb-2">
                密码
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-muted" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder={mode === 'login' ? '输入密码' : '创建密码'}
                  value={formData.password}
                  onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                  className="w-full pl-10 pr-12 py-3 border-2 border-paper-dark bg-white font-sans text-sm text-ink placeholder-ink-muted/60 outline-none focus:border-amber-film transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink transition-colors cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {/* Password rules (register only) */}
              {mode === 'register' && formData.password && (
                <div className="mt-3 p-3 bg-paper-warm border border-paper-dark">
                  <div className="text-xs font-sans font-bold text-ink-muted uppercase tracking-wider mb-2">
                    密码要求
                  </div>
                  <div className="space-y-1">
                    {passwordRules.map(rule => (
                      <div
                        key={rule.id}
                        className={`flex items-center gap-2 text-xs font-sans ${
                          checkPasswordRule(rule) ? 'text-film-green' : 'text-ink-muted'
                        }`}
                      >
                        <div className={`w-4 h-4 rounded flex items-center justify-center ${
                          checkPasswordRule(rule) ? 'bg-film-green text-white' : 'bg-paper-dark'
                        }`}>
                          {checkPasswordRule(rule) && <Check className="w-3 h-3" />}
                        </div>
                        {rule.label}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Submit button */}
            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full justify-center py-3 mt-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  处理中...
                </span>
              ) : (
                mode === 'login' ? '登录' : '注册'
              )}
            </button>
          </form>

          {/* Switch mode */}
          <div className="mt-6 text-center">
            {mode === 'login' ? (
              <p className="font-sans text-sm text-ink-muted">
                还没有账号？
                <button
                  onClick={() => switchMode('register')}
                  className="text-amber-film hover:underline font-semibold ml-1 cursor-pointer"
                >
                  立即注册
                </button>
              </p>
            ) : (
              <p className="font-sans text-sm text-ink-muted">
                已有账号？
                <button
                  onClick={() => switchMode('login')}
                  className="text-amber-film hover:underline font-semibold ml-1 cursor-pointer"
                >
                  立即登录
                </button>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
