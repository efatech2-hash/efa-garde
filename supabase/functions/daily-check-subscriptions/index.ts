import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async (req) => {
  try {
    const supabaseUrl =
      Deno.env.get('SUPABASE_URL') ||
      Deno.env.get('VITE_SUPABASE_URL') ||
      'https://yarxkehzxmvaotplfuek.supabase.co'

    const supabaseKey =
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ||
      Deno.env.get('SUPABASE_ANON_KEY') ||
      Deno.env.get('VITE_SUPABASE_ANON_KEY') ||
      ''

    if (!supabaseUrl || !supabaseKey) {
      return new Response(
        JSON.stringify({ error: 'Supabase credentials missing' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseKey)
    const nowIso = new Date().toISOString()

    // 1. Désactiver les abonnements échus :
    // UPDATE pharmacies SET subscription_status='inactive', is_active=false
    // WHERE subscription_status='active' AND subscription_end_at < NOW()
    const { data: updatedPharmacies, error: updateErr } = await supabase
      .from('pharmacies')
      .update({
        subscription_status: 'inactive',
        is_active: false,
        subscription_days_left: 0,
      })
      .eq('subscription_status', 'active')
      .lt('subscription_end_at', nowIso)
      .select('id, nom, subscription_end_at')

    if (updateErr) {
      console.error('Error updating overdue subscriptions:', updateErr)
      return new Response(
        JSON.stringify({ success: false, error: updateErr.message }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const count = updatedPharmacies?.length || 0

    return new Response(
      JSON.stringify({
        success: true,
        message: `Cron quotidien exécuté : ${count} pharmacie(s) expirée(s) passée(s) en inactive.`,
        deactivatedCount: count,
        deactivatedPharmacies: updatedPharmacies || [],
        timestamp: nowIso,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('Unexpected error in daily-check-subscriptions:', err)
    return new Response(
      JSON.stringify({ success: false, error: String(err) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
