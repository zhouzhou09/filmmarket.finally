import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ApiUser } from '../lib/api';
import {
  login as apiLogin,
  register as apiRegister,
  getProfile,
  updateProfile as apiUpdateProfile,
  getToken,
  setToken,
  removeToken,
} from '../lib/api';

interface AuthContextValue {
  user: ApiUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, nickname: string) => Promise<void>;
  signOut: () => void;
  updateProfile: (updates: Partial<ApiUser>) => Promise<ApiUser>;
  setUser: (user: ApiUser) => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<ApiUser | null>(null);
  const [loading, setLoading] = useState(true);

  // 初始化：检查 localStorage 里是否有 token
  useEffect(() => {
    const token = getToken();
    if (token) {
      getProfile()
        .then((profile) => {
          setUser(profile);
        })
        .catch(() => {
          removeToken();
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const res = await apiLogin(email, password);
    setToken(res.token);
    setUser(res.user);
  }, []);

  const signUp = useCallback(async (email: string, password: string, nickname: string) => {
    const res = await apiRegister(email, password, nickname);
    setToken(res.token);
    setUser(res.user);
  }, []);

  const signOut = useCallback(() => {
    removeToken();
    setUser(null);
  }, []);

  const updateProfile = useCallback(async (updates: Partial<ApiUser>): Promise<ApiUser> => {
    const updated = await apiUpdateProfile(updates);
    setUser(updated);
    return updated;
  }, []);

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      signIn,
      signUp,
      signOut,
      updateProfile,
      setUser,
      isAuthenticated: !!user,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

// useAuth 变成从 Context 读取，所有组件共享同一份状态
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
