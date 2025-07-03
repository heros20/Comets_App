// contexts/AdminContext.tsx

import * as SecureStore from 'expo-secure-store';
import React, { createContext, useContext, useEffect, useState } from 'react';

type AdminContextType = {
  isAdmin: boolean;
  setIsAdmin: (value: boolean) => void;
  logout: () => Promise<void>;
  checkAdmin: () => Promise<void>;
};

const AdminContext = createContext<AdminContextType>({
  isAdmin: false,
  setIsAdmin: () => {},
  logout: async () => {},
  checkAdmin: async () => {},
});

export function AdminProvider({ children }: { children: React.ReactNode }) {
  const [isAdmin, setIsAdmin] = useState(false);

  // On vérifie au premier render si l'utilisateur est admin (async/await dans useEffect)
  useEffect(() => {
    (async () => {
      await checkAdmin();
    })();
     
  }, []);

  // Vérifie le flag stocké localement (admin connecté ?)
  const checkAdmin = async () => {
    const flag = await SecureStore.getItemAsync('admin_logged_in');
    setIsAdmin(flag === 'yes');
  };

  // Déconnecte l’admin
  const logout = async () => {
    await SecureStore.deleteItemAsync('admin_logged_in');
    setIsAdmin(false);
  };

  return (
    <AdminContext.Provider value={{ isAdmin, setIsAdmin, logout, checkAdmin }}>
      {children}
    </AdminContext.Provider>
  );
}

// Hook pour utiliser le contexte
export function useAdmin() {
  return useContext(AdminContext);
}

/*
* Pour utiliser ce context :
* - Dans ton layout racine (par ex RootLayout), entoure tout par <AdminProvider>...</AdminProvider>
* - Dans tes pages : const { isAdmin, logout } = useAdmin();
* - Affiche l’onglet Messages et le bouton Déconnexion seulement si isAdmin === true
*/
