import * as SecureStore from 'expo-secure-store';
import React, { createContext, useContext, useEffect, useState } from 'react';

type Role = 'admin' | 'member' | 'guest';

export type Admin = {
  id: string;
  email: string;
  role: Role;
  participations?: number;
  first_name?: string;
  last_name?: string;
};

type AdminContextType = {
  admin: Admin | null;                                   // ← exposé pour accéder à admin.id
  isAdmin: boolean;
  isMember: boolean;
  isLoading: boolean;
  setAdmin: React.Dispatch<React.SetStateAction<Admin | null>>; // ← pour MAJ locale (ex: après participe)
  login: (email: string, password: string) => Promise<boolean>;
  register: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  checkSession: () => Promise<void>;
};

const AdminContext = createContext<AdminContextType>({
  admin: null,
  isAdmin: false,
  isMember: false,
  isLoading: true,
  setAdmin: () => {},
  login: async () => false,
  register: async () => false,
  logout: async () => {},
  checkSession: async () => {},
});

// garde ton domaine (ça marchait déjà chez toi)
const API_BASE = 'https://les-comets-honfleur.vercel.app';
const SESSION_KEY = 'session';

export function AdminProvider({ children }: { children: React.ReactNode }) {
  const [admin, setAdmin] = useState<Admin | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const isAdmin = admin?.role === 'admin';
  const isMember = admin?.role === 'member';

  const checkSession = async () => {
    setIsLoading(true);
    try {
      const sessionStr = await SecureStore.getItemAsync(SESSION_KEY);
      if (sessionStr) {
        const s = JSON.parse(sessionStr) as {
          id: string;
          email: string;
          role: Role;
          participations?: number;
        };
        setAdmin({
          id: s.id,
          email: s.email,
          role: s.role,
          participations: s.participations ?? 0,
        });
      } else {
        setAdmin(null);
      }
    } catch {
      setAdmin(null);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    checkSession();
  }, []);

  // == Ton login qui marchait, inchangé, mais on remplit aussi admin ==
  const login = async (email: string, password: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) return false;
      const data = await res.json();

      // attendu: { success, email, id, role, participations? }
      if (!data?.success || !data?.role || !data?.id) return false;

      const sess = {
        email: data.email,
        id: data.id,
        role: data.role as Role,
        participations: data.participations ?? 0,
      };
      await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(sess));

      setAdmin({
        id: sess.id,
        email: sess.email,
        role: sess.role,
        participations: sess.participations,
      });
      return true;
    } catch (e) {
      console.error('Login error:', e);
      return false;
    }
  };

  // == Ton register, inchangé ==
  const register = async (email: string, password: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/register`, {
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
    await SecureStore.deleteItemAsync(SESSION_KEY);
    setAdmin(null);
  };

  return (
    <AdminContext.Provider
      value={{
        admin,
        isAdmin,
        isMember,
        isLoading,
        setAdmin,
        login,
        register,
        logout,
        checkSession,
      }}
    >
      {children}
    </AdminContext.Provider>
  );
}

export function useAdmin() {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error('useAdmin must be used within AdminProvider');
  return ctx;
}
