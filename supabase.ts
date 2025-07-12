import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';

// 1. Récupère les variables d'env (ordre : EAS > process.env, comme en dev web)
const supabaseUrl = Constants.expoConfig?.extra?.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = Constants.expoConfig?.extra?.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// 2. Log de debug/proof of life, coupe la clé pour ne pas tout exposer en clair
console.log("[SUPABASE] URL =", supabaseUrl);
console.log("[SUPABASE] KEY =", supabaseAnonKey ? supabaseAnonKey.slice(0, 8) + "..." : "undefined");

// 3. Throw explicite si mauvaise config
if (!supabaseUrl || !supabaseAnonKey) {
  // Ce throw s'affiche en dev (terminal), et crash en prod, donc bien visible !
  throw new Error(`
    [SUPABASE] Les variables SUPABASE ne sont pas définies !
    URL: ${supabaseUrl}
    KEY: ${supabaseAnonKey ? supabaseAnonKey.slice(0, 8) + "..." : "undefined"}
    Vérifie ta config EAS (app.json > extra, eas.json > env) et le profil build utilisé !
  `);
}

// 4. Création du client
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
