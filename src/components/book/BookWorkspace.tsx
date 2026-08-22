'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db/dexie'
import { StatusBadge } from '@/components/StatusBadge'
import { PHASES, phaseReadiness, type Phase } from '@/lib/phases'
import { cn } from '@/lib/cn'
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
      <div className="border-b border-border bg-surface/40">
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
          <h1 className="mt-2 truncate font-display text-2xl font-bold">
            {book.title}
          </h1>

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
