'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { isSupabaseConfigured } from '@/lib/env'

/**
 * Account control in the top bar. Renders nothing in local-first mode (no cloud
 * configured). When cloud sync is on, shows a Sign in link when signed out, or
 * a Sign out button (with the account email) when signed in.
 */
export function AuthMenu() {
  const [ready, setReady] = useState(false)
  const [email, setEmail] = useState<string | null>(null)

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setReady(true)
      return
    }
    let unsub: (() => void) | undefined
    ;(async () => {
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      setEmail(user?.email ?? null)
      setReady(true)
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((_e, session) =>
        setEmail(session?.user?.email ?? null)
      )
      unsub = () => subscription.unsubscribe()
    })()
    return () => unsub?.()
  }, [])

  if (!isSupabaseConfigured() || !ready) return null

  if (!email) {
    return (
      <Link
        href="/login"
        className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-surface-2"
      >
        Sign in
      </Link>
    )
  }

  async function signOut() {
    const { createClient } = await import('@/lib/supabase/client')
    await createClient().auth.signOut()
    window.location.href = '/login'
  }

  return (
    <button
      onClick={signOut}
      title={`Signed in as ${email}`}
      className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-surface-2"
    >
      Sign out
    </button>
  )
}
