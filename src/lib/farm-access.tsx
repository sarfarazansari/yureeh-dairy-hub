'use client';

import { createContext, useContext } from 'react';

export type FarmRole = 'super_admin' | 'viewer';

const FarmRoleContext = createContext<FarmRole | null>(null);

export function FarmRoleProvider({
  role,
  children,
}: {
  role: FarmRole;
  children: React.ReactNode;
}) {
  return <FarmRoleContext.Provider value={role}>{children}</FarmRoleContext.Provider>;
}

export function useFarmRole() {
  return useContext(FarmRoleContext);
}

export function useIsViewer() {
  return useFarmRole() === 'viewer';
}
