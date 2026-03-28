import { createContext, useContext, useState } from 'react';

const UserContext = createContext(null);

export function UserProvider({ children }) {
  const [userName, setUserName] = useState(() => localStorage.getItem('lr_username') || '');
  const [userId, setUserId] = useState(() => localStorage.getItem('lr_userid') || '');
  const [userRole, setUserRole] = useState(() => localStorage.getItem('lr_userrole') || 'guest');

  function saveName(name) {
    localStorage.setItem('lr_username', name.trim());
    setUserName(name.trim());
  }

  function saveUser(profile) {
    const displayName = `${profile.first_name} ${profile.last_name}`;
    localStorage.setItem('lr_username', displayName);
    localStorage.setItem('lr_userid', profile.id);
    localStorage.setItem('lr_userrole', profile.role || 'guest');
    setUserName(displayName);
    setUserId(profile.id);
    setUserRole(profile.role || 'guest');
  }

  function updateRole(role) {
    localStorage.setItem('lr_userrole', role);
    setUserRole(role);
  }

  function logout() {
    localStorage.removeItem('lr_username');
    localStorage.removeItem('lr_userid');
    localStorage.removeItem('lr_userrole');
    setUserName('');
    setUserId('');
    setUserRole('guest');
  }

  return (
    <UserContext.Provider value={{ userName, userId, userRole, saveName, saveUser, updateRole, logout }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  return useContext(UserContext);
}
