'use client'

import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { callWrite, checkWritingAvailability, WriteError } from '@/lib/ai/writeClient'
import { useOnline } from '@/lib/hooks/useOnline'
import type { Book } from '@/lib/types'

/**
 * Generates a ready-to-paste Amazon product description from the book's story,
 * for the KDP listing. Lives on the Publish tab. Read-only output with Copy —
 * it never touches the manuscript.
 */
export function DescriptionWriter({ book }: { book: Book }) {
  const online = useOnline()
  const [available, setAvailable] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(false)
  const [text, setText] = useState<string | null>(null)

  useEffect(() => {
    checkWritingAvailability().then(setAvailable)
  }, [])

  const manuscript = book.manuscriptText.trim()
  const canRun = available === true && online && !loading && manuscript.length > 0

  async function run() {
    setLoading(true)
    try {
      const res = await callWrite({
        mode: 'description',
        title: book.title,
        author: book.author,
        manuscript,
      })
      if (res.text) setText(res.text.trim())
      else toast('No description came back — try again.')
    } catch (e) {
      if (e instanceof WriteError && e.code === 'no_key') setAvailable(false)
      toast.error(e instanceof Error ? e.message : 'Could not generate')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="rounded-2xl border border-border bg-surface p-5">
      <h2 className="font-display text-xl font-semibold">
        Amazon book description
      </h2>
      <p className="mt-1 text-sm text-muted">
        A warm, ready-to-paste description for your book&apos;s Amazon page — it
        helps shoppers decide to buy. Paste it into KDP&apos;s{' '}
        <strong>Description</strong> box.
      </p>

      {available === false && (
        <p className="mt-3 rounded-lg bg-[color:var(--warn)]/12 px-3 py-2 text-sm text-[color:var(--warn)]">
          The writing helper isn&apos;t turned on yet — ask whoever set up this
          app to enable it.
        </p>
      )}
      {available !== false && manuscript.length === 0 && (
        <p className="mt-3 rounded-lg bg-surface-2 px-3 py-2 text-sm text-muted">
          Write your story on the Write tab first, then I can describe it.
        </p>
      )}

      <button
        onClick={run}
        disabled={!canRun}
        className="mt-4 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-accent-fg disabled:opacity-50"
      >
        {loading
          ? 'Writing…'
          : text
            ? 'Write it again'
            : 'Write my book description'}
      </button>

      {text && (
        <div className="mt-4">
          <div className="max-h-72 overflow-y-auto whitespace-pre-wrap rounded-xl border border-border bg-background p-3 text-[15px] leading-relaxed">
            {text}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              onClick={() => {
                navigator.clipboard?.writeText(text)
                toast.success('Description copied')
              }}
              className="rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-accent-fg"
            >
              Copy
            </button>
            <span className="text-xs text-muted">
              {text.split(/\s+/).filter(Boolean).length} words ·{' '}
              {text.length}/4000 characters
            </span>
          </div>
        </div>
      )}
    </section>
  )
}
