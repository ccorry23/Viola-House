'use client'

import { useEffect } from 'react'
import { liveQuery } from 'dexie'
import { db } from '@/lib/db/dexie'
import { isSupabaseConfigured } from '@/lib/env'
import { pushBook, pullAndMergeBooks } from '@/lib/sync/sync'

/**
 * When (and only when) cloud sync is configured, keep this device in step with
 * the account: pull down any books it is missing on sign-in, then push local
 * changes up while online. Entirely inert in local-first mode.
 */
export function SyncProvider() {
  useEffect(() => {
    if (!isSupabaseConfigured()) return

    let cancelled = false
    let stopPush: (() => void) | undefined
    let stopAuth: (() => void) | undefined

    // Watch local books and push each change up (once online).
    function startPush() {
      if (stopPush) return
      const seen = new Map<string, number>()
      const sub = liveQuery(() => db.books.toArray()).subscribe({
        next: (books) => {
          if (!navigator.onLine) return
          for (const b of books) {
            if (seen.get(b.id) !== b.updatedAt) {
              seen.set(b.id, b.updatedAt)
              void pushBook(b)
            }
          }
        },
        error: () => {},
      })
      stopPush = () => sub.unsubscribe()
    }

    async function onSignedIn() {
      try {
        await pullAndMergeBooks()
      } catch {
        // Offline or a transient error — local data is untouched; push still runs.
      }
      if (!cancelled) startPush()
    }

    ;(async () => {
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()

      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (user && !cancelled) await onSignedIn()

      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((event) => {
        if (cancelled) return
        if (event === 'SIGNED_IN') void onSignedIn()
        if (event === 'SIGNED_OUT') {
          stopPush?.()
          stopPush = undefined
        }
      })
      stopAuth = () => subscription.unsubscribe()
    })()

    return () => {
      cancelled = true
      stopPush?.()
      stopAuth?.()
    }
  }, [])

  return null
}
