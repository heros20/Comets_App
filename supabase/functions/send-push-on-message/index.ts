// supabase/functions/send-push-on-message/index.ts

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

serve(async (req) => {
  // Parse le body envoyé par Supabase (doit contenir le nouveau message)
  const { record } = await req.json()
  const { name, message } = record

  // Récupère les tokens depuis Supabase REST API
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  const tokenRes = await fetch(`${SUPABASE_URL}/rest/v1/expo_push_tokens?select=token`, {
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY!,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    }
  })

  const tokens = (await tokenRes.json()).map((t: any) => t.token)

  // Prépare le payload Expo Push
  const payloads = tokens.map(token => ({
    to: token,
    sound: "default",
    title: "📥 Nouveau message reçu",
    body: `${name} : ${message.slice(0, 80)}${message.length > 80 ? '...' : ''}`,
    data: { message },
  }))

  // Envoie à Expo (en 1 ou plusieurs requêtes, 100 max par POST)
  const expoUrl = "https://exp.host/--/api/v2/push/send"
  const chunkSize = 100
  for (let i = 0; i < payloads.length; i += chunkSize) {
    await fetch(expoUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payloads.slice(i, i + chunkSize))
    })
  }

  return new Response(JSON.stringify({ success: true, sent: tokens.length }), { status: 200 })
})
