'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useLiveQuery } from 'dexie-react-hooks'
import toast from 'react-hot-toast'
import { db, patchBook } from '@/lib/db/dexie'
import { StatusBadge } from '@/components/StatusBadge'
import { PHASES, phaseReadiness, type Phase } from '@/lib/phases'
import { cn } from '@/lib/cn'
import type { Book } from '@/lib/types'
import { WritePhase } from './WritePhase'
import { PagesPhase } from './PagesPhase'
import { IllustratePhase } from './IllustratePhase'
import { PublishPhase } from './PublishPhase'

export function BookWorkspace({ bookId }: { bookId: string }) {
  const [phase, setPhase] = useState<Phase>('write')
  const book = useLiveQuery(() => db.books.get(bookId), [bookId])

  if (book === undefined) {
    return <div className="flex-1 p-10 text-center text-muted">Loading…</div>
  }
  if (book === null || !book) {
    return (
      <div className="flex-1 p-10 text-center">
        <p className="text-muted">That book could not be found.</p>
        <Link href="/" className="mt-3 inline-block text-accent underline">
          Back to library
        </Link>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="sticky top-14 z-20 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto w-full max-w-5xl px-5 pt-4 sm:px-8">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="text-sm text-muted hover:text-foreground"
              aria-label="Back to library"
            >
              ← Library
            </Link>
            <StatusBadge status={book.status} />
          </div>
          <EditableTitle book={book} />

          <nav className="-mb-px mt-3 flex gap-1 overflow-x-auto">
            {PHASES.map((p) => {
              const { ready } = phaseReadiness(book, p.id)
              const active = phase === p.id
              return (
                <button
                  key={p.id}
                  onClick={() => setPhase(p.id)}
                  className={cn(
                    'flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3.5 py-2.5 text-sm font-semibold transition',
                    active
                      ? 'border-accent text-accent'
                      : 'border-transparent text-muted hover:text-foreground',
                    !ready && !active && 'opacity-60'
                  )}
                >
                  <span aria-hidden>{p.icon}</span>
                  {p.label}
                </button>
              )
            })}
          </nav>
        </div>
      </div>

      <div className="mx-auto w-full max-w-5xl flex-1 px-5 py-6 sm:px-8">
        {phase === 'write' && <WritePhase book={book} />}
        {phase === 'pages' && (
          <PagesPhase book={book} onGoToIllustrate={() => setPhase('illustrate')} />
        )}
        {phase === 'illustrate' && (
          <IllustratePhase
            book={book}
            onGoToPages={() => setPhase('pages')}
            onGoToPublish={() => setPhase('publish')}
          />
        )}
        {phase === 'publish' && <PublishPhase book={book} />}
      </div>
    </div>
  )
}

/**
 * The book title in the sticky header — visible on every tab, so it's the
 * natural place to rename the book (not just buried on the Write tab, which
 * still has its own synced title field). Click to edit; Enter or blur saves,
 * Escape cancels.
 */
function EditableTitle({ book }: { book: Book }) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(book.title)
  const inputRef = useRef<HTMLInputElement>(null)

  // Keep in sync with the book (e.g. renamed from the Write tab, or sync).
  useEffect(() => {
    if (!editing) setValue(book.title)
  }, [book.title, editing])

  function startEdit() {
    setValue(book.title)
    setEditing(true)
  }

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [editing])

  async function commit() {
    const next = value.trim() || 'Untitled Book'
    setEditing(false)
    if (next !== book.title) {
      await patchBook(book.id, { title: next })
      toast.success('Title updated')
    }
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            commit()
          } else if (e.key === 'Escape') {
            setValue(book.title)
            setEditing(false)
          }
        }}
        aria-label="Book title"
        className="mt-2 w-full rounded-lg border border-accent bg-surface px-2 py-1 font-display text-2xl font-bold outline-none"
      />
    )
  }

  return (
    <button
      onClick={startEdit}
      title="Click to rename"
      aria-label="Book title — click to rename"
      className="mt-2 -mx-2 flex max-w-full items-center gap-2 rounded-lg px-2 py-1 text-left hover:bg-surface-2"
    >
      <h1 className="truncate font-display text-2xl font-bold">
        {book.title}
      </h1>
      <span aria-hidden className="shrink-0 text-sm text-muted">
        ✏️
      </span>
    </button>
  )
}
