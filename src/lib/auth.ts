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

/**
 * Removes session
 */
export function clearSession(): void {
  localStorage.removeItem(SESSION_KEY);
}

/**
 * Checks if session is active
 */
export function hasSession(): boolean {
  return getSession() !== null;
}
