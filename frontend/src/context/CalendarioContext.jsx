import { createContext, useContext, useState } from 'react';

const CalendarioContext = createContext();

export const useCalendario = () => {
  const context = useContext(CalendarioContext);
  if (!context) {
    throw new Error('useCalendario debe usarse dentro de CalendarioProvider');
  }
  return context;
};

export const CalendarioProvider = ({ children }) => {
  const [modoPantallaCompleta, setModoPantallaCompleta] = useState(false);

  const togglePantallaCompleta = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setModoPantallaCompleta(true);
    } else {
      document.exitFullscreen();
      setModoPantallaCompleta(false);
    }
  };

  return (
    <CalendarioContext.Provider
      value={{
        modoPantallaCompleta,
        setModoPantallaCompleta,
        togglePantallaCompleta,
      }}
    >
      {children}
    </CalendarioContext.Provider>
  );
};
