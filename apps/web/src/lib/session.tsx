'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { AuthResponse, OrganizerSummary, PublicUser, Role } from '@enhakkore/shared';
import { api, getToken, setToken } from './api';

/**
 * Client-side session.
 *
 * The token lives in localStorage and is verified against `/auth/session` on
 * every mount, so a revoked or suspended account loses access on the next page
 * load rather than when its token happens to expire. Roles here drive what the
 * interface *offers*; the API independently decides what it *permits*.
 */

interface SessionState {
  user: PublicUser | null;
  organizer: OrganizerSummary | null;
  status: 'loading' | 'authenticated' | 'anonymous';
  signIn(email: string, password: string): Promise<PublicUser>;
  register(input: RegisterInput): Promise<PublicUser>;
  signOut(): void;
  refresh(): Promise<void>;
  updateUser(user: PublicUser): void;
  /** Adopt a session the API has already issued, e.g. after a password reset. */
  applyAuth(result: AuthResponse): void;
}

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
  accountType: 'TRAVELER' | 'ORGANIZER';
  companyName?: string;
  country?: string;
  phone?: string;
}

const SessionContext = createContext<SessionState | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [organizer, setOrganizer] = useState<OrganizerSummary | null>(null);
  const [status, setStatus] = useState<SessionState['status']>('loading');

  const refresh = useCallback(async () => {
    if (!getToken()) {
      setUser(null);
      setOrganizer(null);
      setStatus('anonymous');
      return;
    }
    try {
      const result = await api.get<{ user: PublicUser; organizer: OrganizerSummary | null }>('/auth/session');
      setUser(result.user);
      setOrganizer(result.organizer);
      setStatus('authenticated');
    } catch {
      // A token that no longer resolves is discarded rather than retried.
      setToken(null);
      setUser(null);
      setOrganizer(null);
      setStatus('anonymous');
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const signIn = useCallback(async (email: string, password: string) => {
    const result = await api.post<AuthResponse>('/auth/login', { email, password }, { token: null });
    setToken(result.token);
    setUser(result.user);
    setOrganizer(result.organizer);
    setStatus('authenticated');
    return result.user;
  }, []);

  const register = useCallback(async (input: RegisterInput) => {
    const result = await api.post<AuthResponse>('/auth/register', input, { token: null });
    setToken(result.token);
    setUser(result.user);
    setOrganizer(result.organizer);
    setStatus('authenticated');
    return result.user;
  }, []);

  const applyAuth = useCallback((result: AuthResponse) => {
    setToken(result.token);
    setUser(result.user);
    setOrganizer(result.organizer);
    setStatus('authenticated');
  }, []);

  const signOut = useCallback(() => {
    setToken(null);
    setUser(null);
    setOrganizer(null);
    setStatus('anonymous');
  }, []);

  const value = useMemo<SessionState>(
    () => ({ user, organizer, status, signIn, register, signOut, refresh, updateUser: setUser, applyAuth }),
    [user, organizer, status, signIn, register, signOut, refresh, applyAuth],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionState {
  const context = useContext(SessionContext);
  if (!context) throw new Error('useSession must be used inside <SessionProvider>');
  return context;
}

/** Where an account type lands after signing in. */
export function homeFor(role: Role): string {
  if (role === 'ADMIN') return '/admin';
  if (role === 'ORGANIZER') return '/organizer';
  return '/account/trips';
}
