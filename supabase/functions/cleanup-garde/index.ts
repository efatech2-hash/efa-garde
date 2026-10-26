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
    const threshold24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const report: {
      messagesDeleted: number
      storageObjectsDeleted: number
      bucketsCleaned: string[]
      errors: string[]
    } = {
      messagesDeleted: 0,
      storageObjectsDeleted: 0,
      bucketsCleaned: [],
      errors: [],
    }

    // 1. Suppression auto 24h des messages
    // SQL: DELETE FROM garde.messages WHERE created_at < NOW() - INTERVAL '24 hours'
    try {
      // Nettoyage table garde.messages
      const { error: gardeMsgErr } = await supabase
        .schema('garde')
        .from('messages')
        .delete()
        .lt('created_at', threshold24h)

      if (gardeMsgErr) {
        report.errors.push(`garde.messages: ${gardeMsgErr.message}`)
      } else {
        report.messagesDeleted++
      }
    } catch {
      // schema garde non présent
    }

    // Nettoyage table public.messages (fallback)
    try {
      const { error: publicMsgErr } = await supabase
        .from('messages')
        .delete()
        .lt('created_at', threshold24h)

      if (publicMsgErr) {
        report.errors.push(`public.messages: ${publicMsgErr.message}`)
      } else {
        report.messagesDeleted++
      }
    } catch (err: unknown) {
      report.errors.push(err instanceof Error ? err.message : String(err))
    }

    // 2. Suppression auto 24h photos & ordonnances dans storage.objects
    // SQL: DELETE FROM storage.objects WHERE bucket_id='garde-ordonnances' AND created_at < NOW() - INTERVAL '24 hours'
    const targetBuckets = ['garde-ordonnances', 'garde-photo', 'chat-media']
    for (const bucketId of targetBuckets) {
      try {
        const { data: files, error: listErr } = await supabase.storage
          .from(bucketId)
          .list('images', { limit: 100, sortBy: { column: 'created_at', order: 'asc' } })

        if (!listErr && files && files.length > 0) {
          const nowMs = Date.now()
          const toDelete = files
            .filter((f) => {
              if (!f.created_at) return false
              const fileAge = nowMs - new Date(f.created_at).getTime()
              return fileAge > 24 * 60 * 60 * 1000
            })
            .map((f) => `images/${f.name}`)

          if (toDelete.length > 0) {
            const { error: delErr } = await supabase.storage.from(bucketId).remove(toDelete)
            if (!delErr) {
              report.storageObjectsDeleted += toDelete.length
              report.bucketsCleaned.push(bucketId)
            }
          }
        }
      } catch (bucketErr: unknown) {
        report.errors.push(bucketErr instanceof Error ? bucketErr.message : String(bucketErr))
      }
    }

    // 3. Exécution RPC si la fonction SQL dédiée est créée dans la base
    try {
      await supabase.rpc('cleanup_garde_24h')
    } catch {
      // ignorer si rpc non encore déployé
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Suppression auto 24h messages et photos effectuée',
        timestamp: new Date().toISOString(),
        threshold24h,
        report,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err)
    return new Response(JSON.stringify({ error: errorMsg }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
