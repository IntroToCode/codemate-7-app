import { createContext, useContext, useState } from 'react';

const UserContext = createContext(null);

export function UserProvider({ children }) {
  const [userName, setUserName] = useState(() => localStorage.getItem('lr_username') || '');
  const [userId, setUserId] = useState(() => localStorage.getItem('lr_userid') || '');

  function saveName(name) {
    localStorage.setItem('lr_username', name.trim());
    setUserName(name.trim());
  }

  function saveUser(profile) {
    const displayName = `${profile.first_name} ${profile.last_name}`;
    localStorage.setItem('lr_username', displayName);
    localStorage.setItem('lr_userid', profile.id);
    setUserName(displayName);
    setUserId(profile.id);
  }

  function logout() {
    localStorage.removeItem('lr_username');
    localStorage.removeItem('lr_userid');
    setUserName('');
    setUserId('');
  }

  return (
    <UserContext.Provider value={{ userName, userId, saveName, saveUser, logout }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  return useContext(UserContext);
}
