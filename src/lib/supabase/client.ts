import { createBrowserClient } from '@supabase/ssr'

/**
 * Browser Supabase client. Only call when isSupabaseConfigured() is true —
 * the app is local-first and works with no Supabase project at all.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
