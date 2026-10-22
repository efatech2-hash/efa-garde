import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
Deno.serve(async (req) => {
  try {
    const body = await req.json()
    const { entreprise_id, statut, expire_le } = body
    if (!entreprise_id) return new Response(JSON.stringify({error: 'entreprise_id manquant'}), {status: 400})
    const supabaseSuite = createClient(Deno.env.get('SUITE_URL')!, Deno.env.get('SUITE_SERVICE_KEY')!)
    const supabaseAconta = createClient(Deno.env.get('ACONTA_URL')!, Deno.env.get('ACONTA_SERVICE_KEY')!)
    const data = { entreprise_id, statut: statut || 'actif', expire_le: expire_le || new Date(Date.now() + 30*24*60*60*1000).toISOString() }
    await supabaseSuite.from('abonnements').upsert(data, { onConflict: 'entreprise_id' })
    await supabaseAconta.from('abonnements').upsert(data, { onConflict: 'entreprise_id' })
    return new Response(JSON.stringify({ success: true, message: 'Propagé à SUITE et ACONTA' }), { status: 200, headers: {'Content-Type': 'application/json'} })
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 })
  }
})
