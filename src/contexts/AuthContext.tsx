import React, { createContext, useContext, useEffect, useState } from 'react';
import { api, setAuthToken, UserRole } from '@/lib/api';

export interface User {
  id: string;
  name: string;
  email: string;
  phone_number?: string;
  role: UserRole;
  employee_id?: string;
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string, role: UserRole) => Promise<boolean>;
  logout: () => void;
  signup: (userData: { email: string; password: string; name: string; phone_number?: string }) => Promise<boolean>;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const normalizeUser = (payload: any, fallbackRole: UserRole): User => ({
  id: String(payload.id),
  name: payload.name || payload.full_name || payload.email,
  email: payload.email,
  phone_number: payload.phoneNumber || payload.phone_number,
  role: payload.role || fallbackRole,
  employee_id: payload.employee_id || payload.employeeId,
});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const storedUser = localStorage.getItem('auth_user');
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (error) {
        console.error('Error parsing stored user data:', error);
        localStorage.removeItem('auth_user');
      }
    }
    setIsLoading(false);
  }, []);

  const persistUser = (nextUser: User, token?: string) => {
    setUser(nextUser);
    localStorage.setItem('auth_user', JSON.stringify(nextUser));
    if (token) setAuthToken(token);
  };

  const login = async (email: string, password: string, role: UserRole): Promise<boolean> => {
    setIsLoading(true);
    try {
      const result = await api.auth.login({ email, password, role });
      if (!result.success || !result.user) return false;
      persistUser(normalizeUser(result.user, role), result.accessToken);
      return true;
    } catch (error) {
      console.error('Login error:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const signup = async (userData: { email: string; password: string; name: string; phone_number?: string }): Promise<boolean> => {
    setIsLoading(true);
    try {
      const result = await api.auth.register({
        email: userData.email,
        password: userData.password,
        fullName: userData.name,
        phone_number: userData.phone_number,
        role: 'customer',
      });
      if (!result.success || !result.user) return false;
      return true;
    } catch (error) {
      console.error('Signup error:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    setAuthToken(null);
    localStorage.removeItem('auth_user');
  };

  const value = {
    user,
    login,
    logout,
    signup,
    isLoading,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
