import { createContext, useContext, useState, useCallback } from 'react';

const UserContext = createContext(null);

export function UserProvider({ children }) {
  const [userId, setUserId] = useState(() => localStorage.getItem('lr_user_id') || '');
  const [userName, setUserName] = useState(() => localStorage.getItem('lr_username') || '');
  const [isAdmin, setIsAdmin] = useState(false);

  const loginUser = useCallback(async (user) => {
    const displayName = `${user.first_name} ${user.last_name}`;
    localStorage.setItem('lr_user_id', user.id);
    localStorage.setItem('lr_username', displayName);
    setUserId(user.id);
    setUserName(displayName);
    try {
      const res = await fetch('/api/settings/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: displayName }),
      });
      if (res.ok) {
        const data = await res.json();
        setIsAdmin(data.is_admin);
      }
    } catch {
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('lr_user_id');
    localStorage.removeItem('lr_username');
    setUserId('');
    setUserName('');
    setIsAdmin(false);
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
    <UserContext.Provider value={{ userId, userName, loginUser, logout, isAdmin, setIsAdmin, checkAdmin }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  return useContext(UserContext);
}
