export type UserRole = 'client' | 'pharma' | 'pharma_active' | 'pharma_pending' | 'admin';

export interface UserSession {
  role: UserRole;
  phone?: string;
  email?: string;
  pharmaId?: string;
  pharmacieNom?: string;
  numeroOrdre?: string;
  createdAt: string;
}

const SESSION_KEY = 'efa_session';

/**
 * Checks if a session exists in localStorage
 */
export function getSession(): UserSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Saves permanent session in localStorage
 */
export function setSession(session: UserSession): void {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch (err) {
    console.error('Failed to save session:', err);
  }
}

import { supabase } from './supabase';

/**
 * Removes session, clears all authentication tokens and localStorage keys
 */
export function clearSession(): void {
  try {
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem('role');
    localStorage.removeItem('efa_garde_role');
    localStorage.removeItem('pharma_id');
    localStorage.removeItem('is_super_admin');
    localStorage.removeItem('efa_active_pharma_id');
    sessionStorage.clear();
    // Invalider également la session Supabase côté serveur
    supabase.auth.signOut().catch(() => {});
  } catch (err) {
    console.warn('Error during session cleanup:', err);
  }
}

/**
 * Checks if session is active
 */
export function hasSession(): boolean {
  return getSession() !== null;
}
