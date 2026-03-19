import { createContext, useContext, useState } from 'react';

const TempDisableContext = createContext(null);

export function TempDisableProvider({ children }) {
  const [tempDisabled, setTempDisabled] = useState(new Set());

  function toggle(id) {
    setTempDisabled((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function clear(id) {
    setTempDisabled((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  function clearAll() {
    setTempDisabled(new Set());
  }

  return (
    <TempDisableContext.Provider value={{ tempDisabled, toggle, clear, clearAll }}>
      {children}
    </TempDisableContext.Provider>
  );
}

export function useTempDisable() {
  return useContext(TempDisableContext);
}
