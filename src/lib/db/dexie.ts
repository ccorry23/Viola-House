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
