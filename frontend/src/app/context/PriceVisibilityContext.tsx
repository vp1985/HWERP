import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

/**
 * DEV: Role-based permissions matrix
 */
type Role = 'Admin' | 'Projektleiter' | 'GF-Assistenz' | 'Servicetechniker' | 'Lagerist' | 'Helfer';

export const rolePermissions: Record<Role, { can_view_prices: boolean; hide_prices_default: boolean }> = {
  'Admin': { can_view_prices: true, hide_prices_default: false },
  'Projektleiter': { can_view_prices: true, hide_prices_default: false },
  'GF-Assistenz': { can_view_prices: true, hide_prices_default: true },
  'Servicetechniker': { can_view_prices: false, hide_prices_default: false },
  'Lagerist': { can_view_prices: false, hide_prices_default: false },
  'Helfer': { can_view_prices: false, hide_prices_default: false },
};

interface PriceVisibilityContextType {
  currentRole: Role;
  setCurrentRole: (role: Role) => void;
  hidePrices: boolean;
  setHidePrices: (hide: boolean) => void;
  revealPrices: boolean;
  setRevealPrices: (reveal: boolean) => void;
  permissions: { can_view_prices: boolean; hide_prices_default: boolean };
}

const PriceVisibilityContext = createContext<PriceVisibilityContextType | undefined>(undefined);

export function PriceVisibilityProvider({ children }: { children: ReactNode }) {
  const [currentRole, setCurrentRole] = useState<Role>('Admin');
  const [hidePrices, setHidePrices] = useState(false);
  const [revealPrices, setRevealPrices] = useState(false);

  const permissions = rolePermissions[currentRole];

  // Update hidePrices when role changes
  useEffect(() => {
    setHidePrices(permissions.hide_prices_default);
  }, [currentRole, permissions.hide_prices_default]);

  return (
    <PriceVisibilityContext.Provider
      value={{
        currentRole,
        setCurrentRole,
        hidePrices,
        setHidePrices,
        revealPrices,
        setRevealPrices,
        permissions,
      }}
    >
      {children}
    </PriceVisibilityContext.Provider>
  );
}

export function usePriceVisibility() {
  const context = useContext(PriceVisibilityContext);
  if (context === undefined) {
    throw new Error('usePriceVisibility must be used within a PriceVisibilityProvider');
  }
  return context;
}
