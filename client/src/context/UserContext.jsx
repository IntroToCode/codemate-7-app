import { createContext, useContext, useState, useCallback } from 'react';

const UserContext = createContext(null);

export function UserProvider({ children }) {
  const [userName, setUserName] = useState(() => localStorage.getItem('lr_username') || '');
  const [isAdmin, setIsAdmin] = useState(false);

  const saveName = useCallback(async (name) => {
    const trimmed = name.trim();
    localStorage.setItem('lr_username', trimmed);
    setUserName(trimmed);
    try {
      const res = await fetch('/api/settings/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: trimmed }),
      });
      if (res.ok) {
        const data = await res.json();
        setIsAdmin(data.is_admin);
      }
    } catch {
    }
  }, []);

  const checkAdmin = useCallback(async () => {
    if (!userName) return;
    try {
      const res = await fetch(`/api/settings?user=${encodeURIComponent(userName)}`);
      if (res.ok) {
        const data = await res.json();
        setIsAdmin(data.is_admin);
      }
    } catch {
    }
  }, [userName]);

  return (
    <UserContext.Provider value={{ userName, saveName, isAdmin, setIsAdmin, checkAdmin }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  return useContext(UserContext);
}
