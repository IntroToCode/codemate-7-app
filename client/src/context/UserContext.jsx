import { createContext, useContext, useState, useCallback } from 'react';

const UserContext = createContext(null);

export function UserProvider({ children }) {
  const [userName, setUserName] = useState(() => localStorage.getItem('lr_username') || '');
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminName, setAdminName] = useState('');
  const [adminLoading, setAdminLoading] = useState(() => !!localStorage.getItem('lr_username'));

  const logout = useCallback(() => {
    localStorage.removeItem('lr_username');
    setUserName('');
    setIsAdmin(false);
  }, []);

  const saveName = useCallback(async (name) => {
    const trimmed = name.trim();
    localStorage.setItem('lr_username', trimmed);
    setUserName(trimmed);
    setAdminLoading(true);
    try {
      const res = await fetch('/api/settings/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: trimmed }),
      });
      if (res.ok) {
        const data = await res.json();
        setIsAdmin(data.is_admin);
        if (data.admin_name) setAdminName(data.admin_name);
      }
    } catch {
    } finally {
      setAdminLoading(false);
    }
  }, []);

  const checkAdmin = useCallback(async () => {
    if (!userName) return;
    setAdminLoading(true);
    try {
      const res = await fetch(`/api/settings?user=${encodeURIComponent(userName)}`);
      if (res.ok) {
        const data = await res.json();
        setIsAdmin(data.is_admin);
        if (data.admin_name) setAdminName(data.admin_name);
      }
    } catch {
    } finally {
      setAdminLoading(false);
    }
  }, [userName]);

  return (
    <UserContext.Provider value={{ userName, saveName, logout, isAdmin, adminName, adminLoading, setIsAdmin, checkAdmin }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  return useContext(UserContext);
}
