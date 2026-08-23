'use client'

import { useState } from 'react'

/**
 * Magic-link sign-in: enter an email, get a one-click link. No password to
 * remember. Only reachable when Supabase is configured (otherwise the app is
 * local-first with no login at all).
 */
export function LoginForm({ next }: { next?: string }) {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setBusy(true)
    setError(null)
    try {
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      const redirect = `${window.location.origin}/auth/callback${
        next ? `?next=${encodeURIComponent(next)}` : ''
      }`
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: redirect },
      })
      if (error) throw error
      setSent(true)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not send the link — try again.'
      )
    } finally {
      setBusy(false)
    }
  }

  if (sent) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-6 text-center">
        <div className="text-4xl" aria-hidden>
          📬
        </div>
        <h1 className="mt-3 font-display text-xl font-semibold">
          Check your email
        </h1>
        <p className="mx-auto mt-2 max-w-sm text-sm text-muted">
          We sent a sign-in link to <strong>{email}</strong>. Open it on this
          device to see your books. You can close this page.
        </p>
        <button
          onClick={() => {
            setSent(false)
            setEmail('')
          }}
          className="mt-5 text-sm font-semibold text-accent underline"
        >
          Use a different email
        </button>
      </div>
    )
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-2xl border border-border bg-surface p-6"
    >
      <h1 className="font-display text-xl font-semibold">Sign in</h1>
      <p className="mt-2 text-sm text-muted">
        Enter your email and we’ll send you a link to sign in — no password
        needed. Signing in lets your books follow you to any device.
      </p>

      <label className="mt-4 block text-xs font-semibold text-muted">
        Email
      </label>
      <input
        type="email"
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
        className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-base outline-none focus:border-accent"
        required
      />

      {error && (
        <p className="mt-3 rounded-lg bg-[color:var(--warn)]/12 px-3 py-2 text-sm text-[color:var(--warn)]">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={busy || !email.trim()}
        className="mt-4 w-full rounded-xl bg-accent px-4 py-2.5 text-base font-semibold text-accent-fg disabled:opacity-50"
      >
        {busy ? 'Sending…' : 'Email me a sign-in link'}
      </button>
    </form>
  )
}
