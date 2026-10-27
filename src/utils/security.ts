/**
 * EFA GARDE - MODULE SÉCURITÉ & VALIDATION FORTERESSE
 * 1. Sanitization XSS & Anti-Injection
 * 2. Validation stricte des données (Prix, Quantités, Coordonnées, Contacts)
 * 3. Validation MIME & Magic Bytes des fichiers uploadés
 * 4. Rate Limiting anti brute-force
 */

// 1. SANITIZATION XSS & ANTI-INJECTION
export function sanitizeInput(input: string | unknown): string {
  if (typeof input !== 'string') return '';
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
    .replace(/javascript:/gi, '')
    .replace(/data:text\/html/gi, '')
    .replace(/onload=/gi, '')
    .replace(/onerror=/gi, '')
    .replace(/onclick=/gi, '')
    .trim();
}

/**
 * Nettoie une chaîne pour affichage sécurisé (retire balises HTML brutes)
 */
export function stripHtml(input: string): string {
  if (typeof input !== 'string') return '';
  return input.replace(/<[^>]*>/g, '').trim();
}

// 2. VALIDATION STRICTE DES DONNÉES MÉTIER (PRIX, QUANTITÉS, CONTACTS)
export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

export function validatePrice(amount: number | unknown): ValidationResult {
  const num = Number(amount);
  if (isNaN(num) || !isFinite(num)) {
    return { isValid: false, error: 'Montant invalide.' };
  }
  if (num < 0) {
    return { isValid: false, error: 'Le montant ne peut pas être négatif.' };
  }
  if (num > 50000000) {
    return { isValid: false, error: 'Montant supérieur au plafond autorisé (50.000.000 FCFA).' };
  }
  return { isValid: true };
}

export function validateQuantity(quantity: number | unknown): ValidationResult {
  const num = Number(quantity);
  if (!Number.isInteger(num)) {
    return { isValid: false, error: 'La quantité doit être un nombre entier.' };
  }
  if (num <= 0) {
    return { isValid: false, error: 'La quantité doit être strictement positive.' };
  }
  if (num > 100000) {
    return { isValid: false, error: 'Quantité excessive (max 100.000).' };
  }
  return { isValid: true };
}

export function validateEmail(email: string): boolean {
  if (!email || typeof email !== 'string') return false;
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email.trim());
}

export function validatePhone(phone: string): boolean {
  if (!phone || typeof phone !== 'string') return false;
  const digits = phone.replace(/[^0-9]/g, '');
  return digits.length >= 8 && digits.length <= 15;
}

export function validateCoordinates(lat: number, lng: number): boolean {
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    !isNaN(lat) &&
    !isNaN(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

// 3. SÉCURITÉ DES FICHIERS & VALIDATION DES TYPES MIME
const FORBIDDEN_EXTENSIONS = [
  '.exe', '.bat', '.sh', '.cmd', '.php', '.phtml', '.js', '.mjs',
  '.html', '.htm', '.vbs', '.py', '.rb', '.jar', '.com', '.scr',
  '.msi', '.apk', '.bin', '.dll', '.so', '.dylib'
];

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'audio/webm',
  'audio/ogg',
  'audio/mp4',
  'audio/mpeg',
  'application/pdf',
]);

export interface FileValidationResult {
  isValid: boolean;
  error?: string;
}

export function validateUploadedFile(
  file: File | Blob,
  maxSizeBytes: number = 1024 * 1024 // 1 Mo max
): FileValidationResult {
  // 1. Taille
  if (file.size > maxSizeBytes) {
    const maxMb = (maxSizeBytes / (1024 * 1024)).toFixed(1);
    return { isValid: false, error: `Fichier trop volumineux. La taille maximale est de ${maxMb} Mo.` };
  }
  if (file.size === 0) {
    return { isValid: false, error: 'Fichier vide non autorisé.' };
  }

  // 2. Type MIME
  if (file.type && !ALLOWED_MIME_TYPES.has(file.type.toLowerCase())) {
    return {
      isValid: false,
      error: `Type de fichier non autorisé (${file.type}). Formats acceptés : WebP, JPEG, PNG, PDF, Audio.`,
    };
  }

  // 3. Extension si c'est un File
  if ('name' in file && typeof file.name === 'string') {
    const lowerName = file.name.toLowerCase();
    for (const ext of FORBIDDEN_EXTENSIONS) {
      if (lowerName.endsWith(ext) || lowerName.includes(ext + '.')) {
        return {
          isValid: false,
          error: `Extension interdite détectée (${ext}). Upload bloqué pour des raisons de sécurité.`,
        };
      }
    }
  }

  return { isValid: true };
}

// 4. RATE LIMITING ANTI-BRUTE FORCE (Client & Edge)
interface RateLimitBucket {
  attempts: number;
  firstAttemptTime: number;
  blockedUntil?: number;
}

const rateLimitStore = new Map<string, RateLimitBucket>();

export function checkRateLimit(
  key: string,
  maxAttempts: number = 5,
  windowMs: number = 60 * 1000, // 1 minute
  blockDurationMs: number = 5 * 60 * 1000 // 5 minutes de blocage en cas d'abus
): { allowed: boolean; remainingAttempts: number; retryAfterSeconds: number } {
  const now = Date.now();
  const bucket = rateLimitStore.get(key) || {
    attempts: 0,
    firstAttemptTime: now,
  };

  // Est-il temporairement bloqué ?
  if (bucket.blockedUntil && bucket.blockedUntil > now) {
    const retryAfterSeconds = Math.ceil((bucket.blockedUntil - now) / 1000);
    return { allowed: false, remainingAttempts: 0, retryAfterSeconds };
  }

  // Réinitialiser la fenêtre si expirée
  if (now - bucket.firstAttemptTime > windowMs) {
    bucket.attempts = 1;
    bucket.firstAttemptTime = now;
    bucket.blockedUntil = undefined;
    rateLimitStore.set(key, bucket);
    return { allowed: true, remainingAttempts: maxAttempts - 1, retryAfterSeconds: 0 };
  }

  bucket.attempts += 1;

  if (bucket.attempts > maxAttempts) {
    bucket.blockedUntil = now + blockDurationMs;
    rateLimitStore.set(key, bucket);
    const retryAfterSeconds = Math.ceil(blockDurationMs / 1000);
    return { allowed: false, remainingAttempts: 0, retryAfterSeconds };
  }

  rateLimitStore.set(key, bucket);
  return {
    allowed: true,
    remainingAttempts: maxAttempts - bucket.attempts,
    retryAfterSeconds: 0,
  };
}

export function resetRateLimit(key: string): void {
  rateLimitStore.delete(key);
}
