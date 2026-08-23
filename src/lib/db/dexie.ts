'use client'

import Dexie, { type EntityTable } from 'dexie'
import type { Book, Page } from '../types'

/**
 * Local-first store. This IndexedDB database is the app's source of truth and
 * works entirely offline. Optional Supabase sync (when configured) mirrors
 * `books` and `pages` to the cloud for backup / multi-device — see lib/sync.
 */
class StorybookDB extends Dexie {
  books!: EntityTable<Book, 'id'>
  pages!: EntityTable<Page, 'id'>

  constructor() {
    super('storybook')
    this.version(1).stores({
      // Indexed fields only; the full record is stored regardless.
      books: 'id, updatedAt, status',
      pages: 'id, bookId, [bookId+index]',
    })
  }
}

export const db = new StorybookDB()

// ---- Book helpers -----------------------------------------------------------

export async function putBook(book: Book): Promise<void> {
  await db.books.put({ ...book, updatedAt: Date.now() })
}

export async function getBook(id: string): Promise<Book | undefined> {
  return db.books.get(id)
}

export async function deleteBook(id: string): Promise<void> {
  await db.transaction('rw', db.books, db.pages, async () => {
    await db.pages.where('bookId').equals(id).delete()
    await db.books.delete(id)
  })
}

/**
 * Patch a book by id and bump updatedAt. Returns the updated book (or
 * undefined if it no longer exists).
 */
export async function patchBook(
  id: string,
  patch: Partial<Book>
): Promise<Book | undefined> {
  return db.transaction('rw', db.books, async () => {
    const existing = await db.books.get(id)
    if (!existing) return undefined
    const updated: Book = { ...existing, ...patch, id, updatedAt: Date.now() }
    await db.books.put(updated)
    return updated
  })
}

// ---- Page helpers -----------------------------------------------------------

export async function getPages(bookId: string): Promise<Page[]> {
  const pages = await db.pages.where('bookId').equals(bookId).toArray()
  return pages.sort((a, b) => a.index - b.index)
}

export async function replacePages(
  bookId: string,
  pages: Page[]
): Promise<void> {
  await db.transaction('rw', db.pages, async () => {
    await db.pages.where('bookId').equals(bookId).delete()
    if (pages.length) await db.pages.bulkPut(pages)
  })
}

export async function patchPage(
  id: string,
  patch: Partial<Page>
): Promise<void> {
  await db.transaction('rw', db.pages, async () => {
    const existing = await db.pages.get(id)
    if (!existing) return
    await db.pages.put({ ...existing, ...patch, id, updatedAt: Date.now() })
  })
}

/** How many previous images to keep per page for undo. */
const MAX_IMAGE_HISTORY = 5

/**
 * Replace a page's image while pushing the previous one onto its undo history.
 * Used when the author accepts a tweaked / regenerated / uploaded image, so a
 * change can always be walked back.
 */
export async function setPageImageWithHistory(
  id: string,
  image: Blob,
  source: 'ai' | 'upload'
): Promise<void> {
  await db.transaction('rw', db.pages, async () => {
    const existing = await db.pages.get(id)
    if (!existing) return
    const history = existing.image
      ? [existing.image, ...(existing.imageHistory ?? [])].slice(0, MAX_IMAGE_HISTORY)
      : existing.imageHistory ?? []
    await db.pages.put({
      ...existing,
      image,
      imageHistory: history,
      imageStatus: 'ready',
      imageSource: source,
      updatedAt: Date.now(),
    })
  })
}

/** Undo: restore the most recent previous image from a page's history. */
export async function undoPageImage(id: string): Promise<void> {
  await db.transaction('rw', db.pages, async () => {
    const existing = await db.pages.get(id)
    if (!existing) return
    const [prev, ...rest] = existing.imageHistory ?? []
    if (!prev) return
    await db.pages.put({
      ...existing,
      image: prev,
      imageHistory: rest,
      imageStatus: 'ready',
      updatedAt: Date.now(),
    })
  })
}

/**
 * Replace a book's cover (the style anchor) while pushing the previous cover
 * onto its undo history. Reads fresh inside the transaction so it never clobbers
 * a concurrent style-field save. Used when the author accepts a tweaked /
 * regenerated / uploaded cover.
 */
export async function setBookCoverWithHistory(
  bookId: string,
  cover: Blob
): Promise<void> {
  await db.transaction('rw', db.books, async () => {
    const b = await db.books.get(bookId)
    if (!b) return
    const prev = b.style.characterSheet
    const history = prev
      ? [prev, ...(b.style.coverHistory ?? [])].slice(0, MAX_IMAGE_HISTORY)
      : b.style.coverHistory ?? []
    await db.books.put({
      ...b,
      style: { ...b.style, characterSheet: cover, coverHistory: history },
      updatedAt: Date.now(),
    })
  })
}

/** Undo: restore the most recent previous cover from a book's history. */
export async function undoBookCover(bookId: string): Promise<void> {
  await db.transaction('rw', db.books, async () => {
    const b = await db.books.get(bookId)
    if (!b) return
    const [prev, ...rest] = b.style.coverHistory ?? []
    if (!prev) return
    await db.books.put({
      ...b,
      style: { ...b.style, characterSheet: prev, coverHistory: rest },
      updatedAt: Date.now(),
    })
  })
}
