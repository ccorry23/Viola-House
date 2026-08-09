'use client'

import { useEffect, useRef, useState } from 'react'
import { patchBook } from '@/lib/db/dexie'
import { useDebouncedCallback } from '@/lib/hooks/useDebouncedCallback'
import { TRIM_LIST, type TrimId } from '@/lib/kdp/constants'
import type { Book } from '@/lib/types'
import { cn } from '@/lib/cn'
import { WriteAssistant } from './WriteAssistant'

type SaveState = 'idle' | 'saving' | 'saved'

export function WritePhase({ book }: { book: Book }) {
  // Local editing state, seeded from the store. We autosave to Dexie (offline
  // safe) and never block typing on it.
  const [title, setTitle] = useState(book.title)
  const [text, setText] = useState(book.manuscriptText)
  const [save, setSave] = useState<SaveState>('idle')
  const [showAssistant, setShowAssistant] = useState(false)
  const taRef = useRef<HTMLTextAreaElement>(null)

  // Keep local state in sync if the book changes underneath us (e.g. sync).
  const bookIdRef = useRef(book.id)
  useEffect(() => {
    if (bookIdRef.current !== book.id) {
      bookIdRef.current = book.id
      setTitle(book.title)
      setText(book.manuscriptText)
    }
  }, [book.id, book.title, book.manuscriptText])

  const persist = useDebouncedCallback(
    async (patch: Partial<Book>) => {
      await patchBook(book.id, patch)
      setSave('saved')
    },
    600
  )

  function onTitle(v: string) {
    setTitle(v)
    setSave('saving')
    persist({ title: v || 'Untitled Book' })
  }
  function onText(v: string) {
    setText(v)
    setSave('saving')
    persist({ manuscriptText: v })
  }
  function onTrim(v: TrimId) {
    setSave('saving')
    patchBook(book.id, { trimSize: v }).then(() => setSave('saved'))
  }

  /** Apply text from the AI helper — appended or replacing, never silently. */
  function applyAssistantText(incoming: string, how: 'replace' | 'append') {
    const next =
      how === 'append'
        ? text.trim()
          ? `${text.trim()}\n\n${incoming.trim()}`
          : incoming.trim()
        : incoming.trim()
    setText(next)
    setSave('saving')
    persist({ manuscriptText: next })
    taRef.current?.focus()
  }

  const words = text.trim() ? text.trim().split(/\s+/).length : 0
  const locked = book.breaksLocked

  return (
    <div className="mx-auto max-w-2xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <input
          value={title}
          onChange={(e) => onTitle(e.target.value)}
          className="min-w-0 flex-1 rounded-lg bg-transparent font-display text-xl font-semibold outline-none focus:bg-surface-2 focus:px-2"
          aria-label="Book title"
        />
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAssistant((v) => !v)}
            className={cn(
              'rounded-lg border px-3 py-1.5 text-sm font-semibold transition',
              showAssistant
                ? 'border-accent bg-accent-soft text-accent'
                : 'border-border hover:bg-surface-2'
            )}
            aria-pressed={showAssistant}
          >
            ✨ AI helper
          </button>
          <select
            value={book.trimSize}
            onChange={(e) => onTrim(e.target.value as TrimId)}
            className="rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm outline-none"
            aria-label="Trim size"
          >
            {TRIM_LIST.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {showAssistant && (
        <div className="mt-4">
          <WriteAssistant manuscript={text} onApply={applyAssistantText} />
        </div>
      )}

      {locked && (
        <p className="mt-3 rounded-lg bg-accent-soft px-3 py-2 text-xs text-accent">
          Page breaks are locked. Editing the story here may shift where pages
          break — you can re-split on the Pages tab.
        </p>
      )}

      <textarea
        ref={taRef}
        value={text}
        onChange={(e) => onText(e.target.value)}
        placeholder="Once upon a time…"
        spellCheck
        className="writing-surface mt-4 min-h-[55vh] w-full resize-none bg-transparent text-lg"
      />

      <div className="sticky bottom-0 flex items-center justify-between border-t border-border bg-background/85 py-3 text-sm text-muted backdrop-blur">
        <span>
          {words} {words === 1 ? 'word' : 'words'}
        </span>
        <span>
          {save === 'saving' ? 'Saving…' : save === 'saved' ? 'Saved ✓' : 'All changes save automatically'}
        </span>
      </div>
    </div>
  )
}
