import { createContext, useContext, type ReactNode } from 'react';
import type { Model } from './api';

const SessionContext = createContext<Model<'Session'> | null>(null);
export function SessionProvider({ session, children }: { session: Model<'Session'>; children: ReactNode }) {
  return <SessionContext value={session}>{children}</SessionContext>;
}
export function useSession() {
  const session = useContext(SessionContext);
  if (!session) throw new Error('Откройте страницу после входа.');
  return session;
}
