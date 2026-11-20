import { createContext, useContext } from 'react';
import type { MeOutputType } from 'zitejs/api';

export const MeContext = createContext<MeOutputType | null>(null);
export const useMe = () => useContext(MeContext)!;
export const can = (me: MeOutputType | null, module: string) =>
  !!me && (me.role === 'admin' || (module !== 'admin' && me.permissions.includes(module)));
