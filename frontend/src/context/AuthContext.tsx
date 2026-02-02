import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { authApi } from '../services/api';
import type { User } from '../types';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, fullName: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('fastsock_token');
      if (token) {
        try {
          const { data } = await authApi.getMe();
          setUser(data);
        } catch {
          console.error("Session expired");
          localStorage.removeItem('fastsock_token');
        }
      }
      setLoading(false);
    };
    initAuth();
  }, []);

  const login = async (email: string, password: string) => {
    const { data } = await authApi.login(email, password);
    localStorage.setItem('fastsock_token', data.access_token);
    const userRes = await authApi.getMe();
    setUser(userRes.data);
  };

  const signup = async (email: string, password: string, fullName: string) => {
    await authApi.signup(email, password, fullName);
  };

  const logout = () => {
    localStorage.removeItem('fastsock_token');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
