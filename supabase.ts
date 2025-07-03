import { createClient } from '@supabase/supabase-js'

// Mets ici ton URL et ta clé ANON (publique), pas la clé "service_role" !
const supabaseUrl = 'https://ncqeaqymxdktlrdxxjlv.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5jcWVhcXlteGRrdGxyZHh4amx2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA1MjU3NzAsImV4cCI6MjA2NjEwMTc3MH0.t4YX_DEAyzE6iy0JhIV66-GDXsSoqMj7UbRYKc3QJJY'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
