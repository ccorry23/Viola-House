/**
 * Small helpers for feature-gating on optional configuration. The app is
 * fully usable with none of these set (local-first). They light up cloud sync
 * and illustration when present.
 */

/** True when Supabase cloud sync + login should be active. */
export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )
}

/** Server-only: which image provider is selected. */
export function imageProvider(): string {
  return (process.env.IMAGE_PROVIDER || 'gemini').toLowerCase()
}
