import type { Book } from './types'

export type Phase = 'write' | 'pages' | 'illustrate' | 'publish'

export const PHASES: { id: Phase; label: string; icon: string }[] = [
  { id: 'write', label: 'Write', icon: '✍️' },
  { id: 'pages', label: 'Pages', icon: '📄' },
  { id: 'illustrate', label: 'Illustrate', icon: '🎨' },
  { id: 'publish', label: 'Publish', icon: '📦' },
]

/** Whether a phase is ready to use yet, with a hint when it isn't. */
export function phaseReadiness(book: Book, phase: Phase): {
  ready: boolean
  hint?: string
} {
  switch (phase) {
    case 'write':
      return { ready: true }
    case 'pages':
      return book.manuscriptText.trim().length > 0
        ? { ready: true }
        : { ready: false, hint: 'Write your story first.' }
    case 'illustrate':
      return book.breaksLocked
        ? { ready: true }
        : { ready: false, hint: 'Lock your page breaks first.' }
    case 'publish':
      return book.breaksLocked
        ? { ready: true }
        : { ready: false, hint: 'Split and lock pages first.' }
  }
}
