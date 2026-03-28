import { createContext, useContext, useState } from 'react';

const UserContext = createContext(null);

export function UserProvider({ children }) {
  const [userName, setUserName] = useState(() => localStorage.getItem('lr_username') || '');

  function saveName(name) {
    localStorage.setItem('lr_username', name.trim());
    setUserName(name.trim());
  }

  return (
    <UserContext.Provider value={{ userName, saveName }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  return useContext(UserContext);
}
