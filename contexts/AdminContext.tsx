import * as SecureStore from 'expo-secure-store';
import React, { createContext, useContext, useEffect, useState } from 'react';

type AdminContextType = {
  isAdmin: boolean;
  isMember: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  register: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  checkSession: () => Promise<void>;
};

const AdminContext = createContext<AdminContextType>({
  isAdmin: false,
  isMember: false,
  isLoading: true,
  login: async () => false,
  register: async () => false,
  logout: async () => {},
  checkSession: async () => {},
});

export function AdminProvider({ children }: { children: React.ReactNode }) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [isMember, setIsMember] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkSession();
  }, []);

  const checkSession = async () => {
    setIsLoading(true);
    try {
      const sessionStr = await SecureStore.getItemAsync('session');
      if (sessionStr) {
        const session = JSON.parse(sessionStr);
        setIsAdmin(session.role === 'admin');
        setIsMember(session.role === 'member');
      } else {
        setIsAdmin(false);
        setIsMember(false);
      }
    } catch (e) {
      setIsAdmin(false);
      setIsMember(false);
    }
    setIsLoading(false);
  };

  // PATCH : login par email !
  const login = async (email: string, password: string) => {
    try {
      const res = await fetch('https://les-comets-honfleur.vercel.app/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) return false;
      const data = await res.json();

      // Attend une réponse du style : { email, id, role, success }
      if (!data.success || !data.role) return false;

      await SecureStore.setItemAsync('session', JSON.stringify({
        email: data.email,
        id: data.id,
        role: data.role,
      }));
      setIsAdmin(data.role === 'admin');
      setIsMember(data.role === 'member');
      return true;
    } catch (e) {
      console.error('Login error:', e);
      return false;
    }
  };

  // PATCH : register par email aussi (si besoin)
  const register = async (email: string, password: string) => {
    try {
      const res = await fetch('https://les-comets-honfleur.vercel.app/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      return res.ok;
    } catch (e) {
      console.error('Register error:', e);
      return false;
    }
  };

  const logout = async () => {
    await SecureStore.deleteItemAsync('session');
    setIsAdmin(false);
    setIsMember(false);
  };

  return (
    <AdminContext.Provider value={{ isAdmin, isMember, isLoading, login, register, logout, checkSession }}>
      {children}
    </AdminContext.Provider>
  );
}

export function useAdmin() {
  return useContext(AdminContext);
}
