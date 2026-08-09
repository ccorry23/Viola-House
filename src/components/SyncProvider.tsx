'use client'

import { useEffect } from 'react'
import { liveQuery } from 'dexie'
import { db } from '@/lib/db/dexie'
import { isSupabaseConfigured } from '@/lib/env'
import { pushBook } from '@/lib/sync/sync'

/**
 * When (and only when) cloud sync is configured, watch local book changes and
 * push them up while online. Entirely inert in local-first mode.
 */
export function SyncProvider() {
  useEffect(() => {
    if (!isSupabaseConfigured()) return

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
    return () => sub.unsubscribe()
  }, [])

  return null
}
