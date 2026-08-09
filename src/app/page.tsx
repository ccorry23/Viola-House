'use client'

import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db/dexie'
import { BookCard } from '@/components/BookCard'
import { NewBookDialog } from '@/components/NewBookDialog'

export default function LibraryPage() {
  const [showNew, setShowNew] = useState(false)
  const books = useLiveQuery(
    () => db.books.orderBy('updatedAt').reverse().toArray(),
    []
  )

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-8 sm:px-8 sm:py-12">
      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold sm:text-4xl">
            Your library
          </h1>
          <p className="mt-1 text-muted">
            Write it, illustrate it, and get it ready for Amazon KDP.
          </p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="shrink-0 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-accent-fg shadow-sm hover:brightness-105"
        >
          + New book
        </button>
      </header>

      {books === undefined ? (
        <p className="mt-16 text-center text-muted">Loading…</p>
      ) : books.length === 0 ? (
        <EmptyState onNew={() => setShowNew(true)} />
      ) : (
        <div className="mt-8 grid grid-cols-2 gap-x-5 gap-y-7 sm:grid-cols-3 md:grid-cols-4">
          {books.map((b) => (
            <BookCard key={b.id} book={b} />
          ))}
        </div>
      )}

      {showNew && <NewBookDialog onClose={() => setShowNew(false)} />}
    </main>
  )
}

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="mt-16 flex flex-col items-center rounded-3xl border border-dashed border-border bg-surface/50 px-6 py-16 text-center">
      <div className="text-5xl" aria-hidden>
        📖
      </div>
      <h2 className="mt-4 font-display text-2xl font-semibold">No books yet</h2>
      <p className="mt-2 max-w-sm text-muted">
        Start your first picture book. You&apos;ll write the story, split it into
        pages, and add an illustration to each one.
      </p>
      <button
        onClick={onNew}
        className="mt-6 rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-accent-fg"
      >
        + Create your first book
      </button>
    </div>
  )
}
