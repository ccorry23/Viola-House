import type { TrimId } from './kdp/constants'

export type BookStatus = 'drafting' | 'illustrating' | 'ready'

export const BOOK_STATUS_LABEL: Record<BookStatus, string> = {
  drafting: 'Drafting',
  illustrating: 'Illustrating',
  ready: 'Ready to Publish',
}

export type ImageStatus = 'none' | 'generating' | 'ready' | 'error'

/**
 * The locked art style for a book. Set once and applied to every page so
 * illustrations don't drift. `characterSheet` is a generated reference image
 * passed back into the model on each page (Gemini's consistency lever).
 */
export interface StyleLock {
  /** e.g. "soft watercolor, warm palette, gentle rounded shapes". */
  descriptor: string
  /** Optional free-text palette hint. */
  palette: string
  /** Once true, the style + character sheet are frozen for the book. */
  locked: boolean
  /** PNG reference sheet (characters/style anchor), stored locally. */
  characterSheet?: Blob
  /** Prior cover versions, most-recent first, kept so a change can be undone. */
  coverHistory?: Blob[]
  /** Short description of recurring characters, fed into every page prompt. */
  characters: string
}

export function emptyStyleLock(): StyleLock {
  return { descriptor: '', palette: '', locked: false, characters: '' }
}

export interface Book {
  id: string
  title: string
  status: BookStatus
  trimSize: TrimId
  /** Full manuscript text (the writing surface's source of truth). */
  manuscriptText: string
  /**
   * Page breaks as sorted character offsets into `manuscriptText`. Each break
   * ends a page; the text between consecutive breaks is one page's text.
   */
  pageBreaks: number[]
  breaksLocked: boolean
  style: StyleLock
  /** Snapshot of the last published version (null until first publish). */
  published: PublishedSnapshot | null
  createdAt: number
  updatedAt: number
}

/** A concrete page produced after page breaks are locked. */
export interface Page {
  id: string
  bookId: string
  index: number
  text: string
  image?: Blob
  /** Prior image versions, most-recent first, kept so a change can be undone. */
  imageHistory?: Blob[]
  imageStatus: ImageStatus
  /** Whether the current image was AI-generated or uploaded by a human. */
  imageSource?: 'ai' | 'upload'
  promptUsed?: string
  updatedAt: number
}

/** Immutable record of what was published, preserved across later edits. */
export interface PublishedSnapshot {
  label: string
  manuscriptText: string
  pageBreaks: number[]
  pageTexts: string[]
  publishedAt: number
}

export function newBook(title: string, trimSize: TrimId): Book {
  const now = Date.now()
  return {
    id: crypto.randomUUID(),
    title: title.trim() || 'Untitled Book',
    status: 'drafting',
    trimSize,
    manuscriptText: '',
    pageBreaks: [],
    breaksLocked: false,
    style: { descriptor: '', palette: '', locked: false, characters: '' },
    published: null,
    createdAt: now,
    updatedAt: now,
  }
}
