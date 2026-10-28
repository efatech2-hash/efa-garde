import type { IncomingMessage, ServerResponse } from 'http';
import crypto from 'crypto';

// Log au démarrage / chargement du module
const configuredEmail =
  process.env.VITE_SUPER_ADMIN_EMAIL ||
  process.env.SUPER_ADMIN_EMAIL ||
  'efatech2@gmail.com';
const configuredPassword =
  process.env.VITE_SUPER_ADMIN_PASSWORD ||
  process.env.SUPER_ADMIN_PASSWORD ||
  '2hcetafe';
const configuredSecret =
  process.env.JWT_SECRET || 'fallback-efa-garde-2025';

console.log(
  '[API Admin Login] SUPER_ADMIN_EMAIL configuré :',
  Boolean(process.env.VITE_SUPER_ADMIN_EMAIL || process.env.SUPER_ADMIN_EMAIL),
  '->',
  configuredEmail.trim().toLowerCase()
);
console.log(
  '[API Admin Login] JWT_SECRET configuré :',
  Boolean(process.env.JWT_SECRET)
);

// Helper pour encoder en base64url
function base64UrlEncode(str: string): string {
  return Buffer.from(str)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

// Création d'un token JWT signé avec HMAC-SHA256
function signJwt(payload: object, secret: string): string {
  const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = base64UrlEncode(JSON.stringify(payload));
  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${header}.${body}`)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return `${header}.${body}.${signature}`;
}

export default async function handler(req: any, res: any) {
  // En-têtes CORS pour autoriser les requêtes SPA
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Méthode non autorisée. Utilisez POST.',
    });
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        body = {};
      }
    } else if (!body && typeof req.on === 'function') {
      // Si body n'est pas encore parsé
      const buffers: Buffer[] = [];
      for await (const chunk of req) {
        buffers.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
      }
      const raw = Buffer.concat(buffers).toString('utf-8');
      try {
        body = JSON.parse(raw);
      } catch {
        body = {};
      }
    }

    const { email, password } = body || {};

    // Normalisation stricte : toLowerCase() et trim()
    const reqEmail = String(email || '').trim().toLowerCase();
    const reqPassword = String(password || '').trim();

    const expectedEmail = String(
      process.env.VITE_SUPER_ADMIN_EMAIL ||
        process.env.SUPER_ADMIN_EMAIL ||
        'efatech2@gmail.com'
    )
      .trim()
      .toLowerCase();

    const expectedPassword = String(
      process.env.VITE_SUPER_ADMIN_PASSWORD ||
        process.env.SUPER_ADMIN_PASSWORD ||
        '2hcetafe'
    ).trim();

    // Vérification de la présence des identifiants
    if (!reqEmail || !reqPassword) {
      return res.status(400).json({
        success: false,
        error: 'Email et mot de passe requis.',
      });
    }

    // Comparaison stricte insensible à la casse
    const isEmailValid = reqEmail === expectedEmail;
    const isPasswordValid = reqPassword === expectedPassword;

    if (!isEmailValid || !isPasswordValid) {
      console.warn(
        `[API Admin Login] Échec de connexion : email ${reqEmail} invalide ou mot de passe incorrect.`
      );
      return res.status(401).json({
        success: false,
        error: 'Identifiants Super Admin invalides. Accès strictement réservé.',
      });
    }

    // JWT Secret avec fallback si manquant
    const jwtSecret = process.env.JWT_SECRET || 'fallback-efa-garde-2025';

    const nowSec = Math.floor(Date.now() / 1000);
    const tokenPayload = {
      sub: 'super_admin',
      email: reqEmail,
      role: 'super_admin',
      iat: nowSec,
      exp: nowSec + 24 * 3600, // Valide 24 heures
    };

    const token = signJwt(tokenPayload, jwtSecret);

    console.log(
      `[API Admin Login] Connexion réussie pour le Super Admin : ${reqEmail}`
    );

    return res.status(200).json({
      success: true,
      message: 'Authentification Super Admin réussie.',
      token,
      super_admin_token: token,
      redirect: '/#/efa-admin',
    });
  } catch (error: any) {
    console.error('[API Admin Login] Erreur interne :', error);
    return res.status(500).json({
      success: false,
      error: 'Erreur interne lors de la connexion Super Admin.',
    });
  }
}
