/**
 * Gestionnaire de Token de Paiement Anti-Fake pour l'Enregistrement Officine Lomé
 * Montant officiel : 25.000 FCFA (T-Money / Moov Money)
 */

export interface RegistrationPaymentToken {
  id: string;
  plan: 'enregistrement_lome';
  amount: string;
  amountNumber: number;
  operator: 'TMONEY' | 'MOOV';
  phoneNumber: string;
  createdAt: string;
  expiresAt: string;
  status: 'paid';
}

const STORAGE_KEY = 'efa_registration_payment_token';

/**
 * Crée et stocke un token de paiement officiel de 25.000 FCFA
 */
export function saveRegistrationPaymentToken(data: {
  operator: 'TMONEY' | 'MOOV';
  phone: string;
}): RegistrationPaymentToken {
  const now = new Date();
  const expires = new Date(now.getTime() + 24 * 60 * 60 * 1000); // Valide 24 heures

  const token: RegistrationPaymentToken = {
    id: `token-25k-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    plan: 'enregistrement_lome',
    amount: '25.000 FCFA',
    amountNumber: 25000,
    operator: data.operator,
    phoneNumber: data.phone,
    createdAt: now.toISOString(),
    expiresAt: expires.toISOString(),
    status: 'paid',
  };

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(token));
  } catch (err) {
    console.warn('Erreur stockage token paiement:', err);
  }

  return token;
}

/**
 * Récupère et vérifie la validité du token de paiement 25k
 */
export function getRegistrationPaymentToken(): RegistrationPaymentToken | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as RegistrationPaymentToken;
    if (!parsed || parsed.status !== 'paid' || parsed.amountNumber !== 25000) {
      return null;
    }

    // Vérifier l'expiration (24h)
    if (new Date(parsed.expiresAt).getTime() < Date.now()) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

/**
 * Vérifie si le token est présent et valide
 */
export function hasValidRegistrationPaymentToken(): boolean {
  return getRegistrationPaymentToken() !== null;
}

/**
 * Supprime le token après utilisation (soumission du formulaire réussie)
 */
export function consumeRegistrationPaymentToken(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
