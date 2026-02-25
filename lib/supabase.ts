// lib/supabase.ts
import { createClient, SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

export function getSupabase() {
  if (client) return client;

  // Expo → on préfère EXPO_PUBLIC_*
  // Fallback → accepte aussi NEXT_PUBLIC_* si jamais c'est ce qui est défini dans eas.json
  const url =
    process.env.EXPO_PUBLIC_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon =
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anon) {
    console.warn(
      "[Supabase] Variables manquantes. Ajoute EXPO_PUBLIC_SUPABASE_URL et EXPO_PUBLIC_SUPABASE_ANON_KEY (ou NEXT_PUBLIC_*) dans ton profil EAS."
    );
    throw new Error("Supabase env manquantes");
  }

  client = createClient(url, anon, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  });

  return client;
}
