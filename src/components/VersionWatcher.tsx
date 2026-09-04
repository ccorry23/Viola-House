'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Because the app is offline-capable, an already-open tab keeps running the
 * code it loaded until it is reloaded. This quietly checks whether a newer
 * version has been deployed and, if so, shows a gentle "refresh" banner — and
 * auto-refreshes when the user returns to the app (a safe moment, since the
 * story autosaves continuously). Inert in local dev (version is a constant).
 */
const POLL_MS = 5 * 60 * 1000

export function VersionWatcher() {
  const [updateReady, setUpdateReady] = useState(false)
  const loadedRef = useRef<string | null>(null)
  const readyRef = useRef(false)

  useEffect(() => {
    let active = true

    async function fetchVersion(): Promise<string | null> {
      try {
        const res = await fetch('/api/version', { cache: 'no-store' })
        if (!res.ok) return null
        const data = await res.json()
        return typeof data.version === 'string' ? data.version : null
      } catch {
        return null
      }
    }

    async function check() {
      const v = await fetchVersion()
      if (!active || !v) return
      // First successful read establishes the version this tab is running.
      if (loadedRef.current == null) {
        loadedRef.current = v
        return
      }
      if (v !== 'dev' && loadedRef.current !== 'dev' && v !== loadedRef.current) {
        readyRef.current = true
        setUpdateReady(true)
      }
    }

    check()
    const interval = setInterval(check, POLL_MS)

    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      // Returning to the app is a natural, safe moment to pick up an update.
      if (readyRef.current) {
        window.location.reload()
        return
      }
      check()
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', check)

    return () => {
      active = false
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', check)
    }
  }, [])

  if (!updateReady) return null

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 flex justify-center p-3">
      <div className="flex flex-wrap items-center justify-center gap-3 rounded-2xl border border-border bg-surface px-4 py-3 shadow-lg">
        <span className="text-sm font-semibold">
          ✨ A new version of Viola House is ready.
        </span>
        <button
          onClick={() => window.location.reload()}
          className="rounded-xl bg-accent px-4 py-1.5 text-sm font-semibold text-accent-fg"
        >
          Refresh
        </button>
      </div>
    </div>
  )
}
