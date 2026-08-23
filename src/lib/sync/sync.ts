'use client'

import { isSupabaseConfigured } from '@/lib/env'
import { db, getPages, replacePages } from '@/lib/db/dexie'
import { pagesFromBreaks } from '@/lib/pages/split'
import type { Book, Page } from '@/lib/types'

/**
 * Optional cloud sync. The app is local-first: none of this runs unless
 * Supabase is configured (NEXT_PUBLIC_SUPABASE_URL/ANON_KEY set) AND the user
 * is signed in. Cloud sync backs up book text + metadata for multi-device use;
 * page illustrations stay in local IndexedDB (they are large binary blobs and
 * can always be regenerated), so a pulled book keeps whatever art already
 * exists on that device and shows none where the device has never made any.
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
    // Only the text style travels; images never leave the device.
    style: {
      descriptor: book.style.descriptor,
      palette: book.style.palette,
      characters: book.style.characters,
      locked: book.style.locked,
    },
    published: book.published,
    updated_at: new Date(book.updatedAt).toISOString(),
  })
}

/** Shape of a cloud `books` row (only the columns we read back). */
interface CloudBook {
  id: string
  title: string
  status: Book['status']
  trim_size: Book['trimSize']
  manuscript_text: string | null
  page_breaks: number[] | null
  breaks_locked: boolean | null
  style: {
    descriptor?: string
    palette?: string
    characters?: string
    locked?: boolean
  } | null
  published: Book['published']
  updated_at: string
}

/**
 * Pull cloud books this device is missing or that are newer than local, and
 * materialise them into IndexedDB — rebuilding page records from the manuscript
 * + saved page breaks. Local-only image data (cover + page art) is preserved.
 * Returns how many books were brought down/updated. No-op when not configured.
 */
export async function pullAndMergeBooks(): Promise<number> {
  const ready = await browserClientIfReady()
  if (!ready) return 0
  const { supabase, userId } = ready

  const { data, error } = await supabase
    .from('books')
    .select('*')
    .eq('owner_id', userId)
  if (error || !data) return 0

  let merged = 0
  for (const row of data as CloudBook[]) {
    const cloudUpdated = Date.parse(row.updated_at)
    const local = await db.books.get(row.id)
    // Skip when this device already has the same or a newer version — the push
    // path will carry any local-newer edits back up.
    if (local && local.updatedAt >= cloudUpdated) continue

    const book: Book = {
      id: row.id,
      title: row.title,
      status: row.status,
      trimSize: row.trim_size,
      manuscriptText: row.manuscript_text ?? '',
      pageBreaks: Array.isArray(row.page_breaks) ? row.page_breaks : [],
      breaksLocked: Boolean(row.breaks_locked),
      style: {
        descriptor: row.style?.descriptor ?? '',
        palette: row.style?.palette ?? '',
        characters: row.style?.characters ?? '',
        // Keep whatever art this device already has; images are never synced.
        characterSheet: local?.style.characterSheet,
        coverHistory: local?.style.coverHistory,
        // A cover only counts as "locked" where this device actually has one,
        // so a fresh device can still create/upload art for the book.
        locked:
          Boolean(row.style?.locked) && Boolean(local?.style.characterSheet),
      },
      published: row.published ?? null,
      createdAt: local?.createdAt ?? cloudUpdated,
      updatedAt: cloudUpdated,
    }
    // Preserve the cloud timestamp so this doesn't look like a fresh local edit.
    await db.books.put(book)

    if (book.breaksLocked) {
      const derived = pagesFromBreaks(book.manuscriptText, book.pageBreaks)
      const existing = await getPages(book.id)
      const now = Date.now()
      const records: Page[] = derived.map((p, index) => {
        const prev = existing[index]
        const keep = prev && prev.text === p.text ? prev : null
        return {
          id: keep?.id ?? crypto.randomUUID(),
          bookId: book.id,
          index,
          text: p.text,
          image: keep?.image,
          imageHistory: keep?.imageHistory,
          imageStatus: keep?.imageStatus ?? 'none',
          imageSource: keep?.imageSource,
          promptUsed: keep?.promptUsed,
          updatedAt: now,
        }
      })
      await replacePages(book.id, records)
    }
    merged++
  }
  return merged
}
