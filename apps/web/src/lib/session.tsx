'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { AuthResponse, OrganizerSummary, PublicUser, Role } from '@enhakkore/shared';
import { ApiError, api, getToken, setToken } from './api';

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
  signIn(email: string, password: string, code?: string): Promise<PublicUser>;
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
  city?: string;
  /** Public handle shown instead of a phone number or email. */
  username?: string;
  phone?: string;
  /** The member accepted the current terms (required). */
  acceptedTerms?: boolean;
  /** YYYY-MM-DD — required; used only for age protections and never shown to others. */
  dateOfBirth?: string;
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
    // The API may be waking up (a sleeping server can take up to a minute) or
    // briefly unreachable. Only a definite "not signed in" (401) discards the
    // token; anything else is retried, so a slow start never signs people out.
    for (let attempt = 0; attempt < 8; attempt++) {
      try {
        const result = await api.get<{ user: PublicUser; organizer: OrganizerSummary | null }>('/auth/session');
        setUser(result.user);
        setOrganizer(result.organizer);
        setStatus('authenticated');
        return;
      } catch (error) {
        if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
          setToken(null);
          setUser(null);
          setOrganizer(null);
          setStatus('anonymous');
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, Math.min(8000, 1500 * (attempt + 1))));
      }
    }
    // Still unreachable after about a minute: keep the token, show signed-out views for now.
    setUser(null);
    setOrganizer(null);
    setStatus('anonymous');
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const signIn = useCallback(async (email: string, password: string, code?: string) => {
    const result = await api.post<AuthResponse>('/auth/login', { email, password, ...(code ? { code } : {}) }, { token: null });
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
    // End the session on the server too, so the token stops working everywhere.
    if (getToken()) void api.post('/auth/logout').catch(() => undefined);
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
  if (role === 'ADMIN' || role === 'STAFF') return '/admin';
  return '/account';
}
