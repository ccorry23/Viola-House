'use client'

import { isSupabaseConfigured } from '@/lib/env'
import type { Book } from '@/lib/types'

/**
 * Optional cloud sync. The app is local-first: none of this runs unless
 * Supabase is configured (NEXT_PUBLIC_SUPABASE_URL/ANON_KEY set) AND the user
 * is signed in. Cloud sync backs up book text + metadata for multi-device use;
 * page illustrations stay in local IndexedDB (they are large and regenerable).
 *
 * When Supabase is not configured every function here is a no-op, so the rest
 * of the app can call these freely.
 */

async function browserClientIfReady() {
  if (!isSupabaseConfigured()) return null
  const { createClient } = await import('@/lib/supabase/client')
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  return { supabase, userId: user.id }
}

/** Upsert a book's text + metadata to the cloud. Safe no-op when not configured. */
export async function pushBook(book: Book): Promise<void> {
  const ready = await browserClientIfReady()
  if (!ready) return
  const { supabase, userId } = ready
  await supabase.from('books').upsert({
    id: book.id,
    owner_id: userId,
    title: book.title,
    status: book.status,
    trim_size: book.trimSize,
    manuscript_text: book.manuscriptText,
    page_breaks: book.pageBreaks,
    breaks_locked: book.breaksLocked,
    style: {
      descriptor: book.style.descriptor,
      palette: book.style.palette,
      characters: book.style.characters,
      locked: book.style.locked,
    },
    updated_at: new Date(book.updatedAt).toISOString(),
  })
}

/** Pull cloud books newer than local. Returns [] when not configured. */
export async function pullBooks(): Promise<
  { id: string; updated_at: string }[]
> {
  const ready = await browserClientIfReady()
  if (!ready) return []
  const { supabase, userId } = ready
  const { data } = await supabase
    .from('books')
    .select('id, updated_at')
    .eq('owner_id', userId)
  return data ?? []
}
