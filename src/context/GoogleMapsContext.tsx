import React, { createContext, useContext, useState } from 'react';

interface GoogleMapsContextType {
  isLoaded: boolean;
  loadError: Error | undefined;
}

const GoogleMapsContext = createContext<GoogleMapsContextType | undefined>(undefined);

// In React Native, react-native-maps loads natively — no JS API loader needed.
export const GoogleMapsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [loadError] = useState<Error | undefined>(undefined);

  return (
    <GoogleMapsContext.Provider value={{ isLoaded: true, loadError }}>
      {children}
    </GoogleMapsContext.Provider>
  );
};

export const useGoogleMaps = () => {
  const context = useContext(GoogleMapsContext);
  if (context === undefined) {
    throw new Error('useGoogleMaps must be used within a GoogleMapsProvider');
  }
  return context;
};
