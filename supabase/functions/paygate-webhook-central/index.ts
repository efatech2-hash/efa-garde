import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ALLOWED_STATUSES = new Set(['actif', 'inactif', 'expire', 'en_attente', 'suspendu'])

Deno.serve(async (req) => {
  // 1. Autoriser uniquement la méthode POST
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Méthode non autorisée. Utilisez POST.' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // 2. Vérification du Secret de Webhook (Bearer token ou header x-paygate-secret)
  const webhookSecret = Deno.env.get('PAYGATE_WEBHOOK_SECRET')
  if (webhookSecret) {
    const authHeader = req.headers.get('Authorization') || req.headers.get('x-paygate-secret') || ''
    const token = authHeader.replace(/^Bearer\s+/i, '').trim()
    if (token !== webhookSecret) {
      return new Response(JSON.stringify({ error: 'Non autorisé: secret de webhook invalide.' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }
  }

  try {
    const body = await req.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return new Response(JSON.stringify({ error: 'Payload JSON invalide.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const { entreprise_id, statut, expire_le } = body

    // 3. Validation stricte côté serveur de entreprise_id
    if (!entreprise_id || typeof entreprise_id !== 'string') {
      return new Response(JSON.stringify({ error: 'entreprise_id manquant ou invalide.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const cleanEntrepriseId = entreprise_id.trim()
    if (cleanEntrepriseId.length < 2 || cleanEntrepriseId.length > 100) {
      return new Response(JSON.stringify({ error: 'entreprise_id longueur invalide.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // 4. Validation statut
    const cleanStatut = (typeof statut === 'string' ? statut.trim().toLowerCase() : 'actif')
    if (!ALLOWED_STATUSES.has(cleanStatut)) {
      return new Response(
        JSON.stringify({ error: `Statut non autorisé (${cleanStatut}). Valeurs permises: ${Array.from(ALLOWED_STATUSES).join(', ')}` }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // 5. Validation date expiration
    let cleanExpireLe: string
    if (expire_le) {
      const parsed = Date.parse(expire_le)
      if (isNaN(parsed)) {
        return new Response(JSON.stringify({ error: 'expire_le doit être une date ISO valide.' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      cleanExpireLe = new Date(parsed).toISOString()
    } else {
      cleanExpireLe = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    }

    const suiteUrl = Deno.env.get('SUITE_URL')
    const suiteKey = Deno.env.get('SUITE_SERVICE_KEY')
    const acontaUrl = Deno.env.get('ACONTA_URL')
    const acontaKey = Deno.env.get('ACONTA_SERVICE_KEY')

    const data = {
      entreprise_id: cleanEntrepriseId,
      statut: cleanStatut,
      expire_le: cleanExpireLe,
      updated_at: new Date().toISOString(),
    }

    const results = {
      suite: false,
      aconta: false,
    }

    if (suiteUrl && suiteKey) {
      const supabaseSuite = createClient(suiteUrl, suiteKey)
      await supabaseSuite.from('abonnements').upsert(data, { onConflict: 'entreprise_id' })
      results.suite = true
    }

    if (acontaUrl && acontaKey) {
      const supabaseAconta = createClient(acontaUrl, acontaKey)
      await supabaseAconta.from('abonnements').upsert(data, { onConflict: 'entreprise_id' })
      results.aconta = true
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Synchronisation webhook exécutée avec succès',
        synced: results,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (e: unknown) {
    const errorMsg = e instanceof Error ? e.message : 'Erreur interne de traitement'
    return new Response(JSON.stringify({ error: errorMsg }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
