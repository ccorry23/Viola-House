'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { putBook } from '@/lib/db/dexie'
import { newBook } from '@/lib/types'
import { DEFAULT_TRIM, TRIM_LIST, type TrimId } from '@/lib/kdp/constants'
import { cn } from '@/lib/cn'

export function NewBookDialog({ onClose }: { onClose: () => void }) {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [trim, setTrim] = useState<TrimId>(DEFAULT_TRIM)
  const [busy, setBusy] = useState(false)

  async function create() {
    setBusy(true)
    try {
      const book = newBook(title, trim)
      await putBook(book)
      toast.success('Book created')
      router.push(`/book/${book.id}`)
    } catch {
      setBusy(false)
      toast.error('Could not create the book')
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-display text-2xl font-semibold">New book</h2>
        <p className="mt-1 text-sm text-muted">
          You can change the title and size any time.
        </p>

        <label className="mt-5 block text-sm font-semibold">Title</label>
        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !busy && create()}
          placeholder="e.g. The Sleepy Little Fox"
          className="mt-1.5 w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-base outline-none focus:border-accent"
        />

        <label className="mt-4 block text-sm font-semibold">Trim size</label>
        <div className="mt-1.5 grid gap-2">
          {TRIM_LIST.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTrim(t.id)}
              className={cn(
                'flex items-center justify-between rounded-xl border px-3.5 py-2.5 text-left text-sm transition',
                trim === t.id
                  ? 'border-accent bg-accent-soft'
                  : 'border-border bg-background hover:border-accent/50'
              )}
            >
              <span className="font-medium">{t.label}</span>
              {trim === t.id && (
                <span className="text-accent" aria-hidden>
                  ✓
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-4 py-2 text-sm font-semibold text-muted hover:bg-surface-2"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={create}
            className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-accent-fg disabled:opacity-60"
          >
            {busy ? 'Creating…' : 'Create book'}
          </button>
        </div>
      </div>
    </div>
  )
}
