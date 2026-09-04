'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useLiveQuery } from 'dexie-react-hooks'
import toast from 'react-hot-toast'
import { getPages, patchBook } from '@/lib/db/dexie'
import {
  exportBook,
  downloadPdf,
  fileStem,
  type ExportResult,
  type ExportProgress,
} from '@/lib/pdf/export'
import { TRIM_SIZES, spineWidthIn } from '@/lib/kdp/constants'
import type { Book } from '@/lib/types'
import { cn } from '@/lib/cn'

const KDP_BOOKSHELF = 'https://kdp.amazon.com/en_US/bookshelf'

export function PublishPhase({ book }: { book: Book }) {
  const pages = useLiveQuery(() => getPages(book.id), [book.id]) ?? []
  const [result, setResult] = useState<ExportResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<ExportProgress | null>(null)
  const [authorInput, setAuthorInput] = useState(book.author ?? '')
  const trim = TRIM_SIZES[book.trimSize]
  const showCoverTitle = book.showCoverTitle !== false

  // Keep the author field in sync if the book changes underneath us.
  useEffect(() => {
    setAuthorInput(book.author ?? '')
  }, [book.id, book.author])

  const illustrated = pages.filter((p) => p.imageStatus === 'ready').length
  const stem = fileStem(book.title)

  const hasUnpublishedChanges = useMemo(() => {
    if (!book.published) return false
    const pub = book.published
    const nowTexts = [...pages].sort((a, b) => a.index - b.index).map((p) => p.text)
    return (
      pub.manuscriptText !== book.manuscriptText ||
      pub.pageTexts.join('') !== nowTexts.join('')
    )
  }, [book.published, book.manuscriptText, pages])

  async function runExport() {
    if (pages.length === 0) {
      toast.error('Split your story into pages first.')
      return
    }
    setBusy(true)
    setProgress({ done: 0, total: 1, label: 'Getting things ready…' })
    try {
      const res = await exportBook(book, pages, setProgress)
      setResult(res)
      if (res.missingImages > 0) {
        toast(
          `${res.missingImages} page(s) have no illustration — exported as text-only.`,
          { icon: '⚠️' }
        )
      } else {
        toast.success('Print files ready')
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Export failed')
    } finally {
      setBusy(false)
      setProgress(null)
    }
  }

  async function publish() {
    const nowTexts = [...pages].sort((a, b) => a.index - b.index).map((p) => p.text)
    await patchBook(book.id, {
      status: 'ready',
      published: {
        label: `Published ${new Date().toLocaleDateString()}`,
        manuscriptText: book.manuscriptText,
        pageBreaks: book.pageBreaks,
        pageTexts: nowTexts,
        publishedAt: Date.now(),
      },
    })
    toast.success('Marked as published')
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Export */}
      <section className="rounded-2xl border border-border bg-surface p-5">
        <h2 className="font-display text-xl font-semibold">Print-ready files</h2>
        <p className="mt-1 text-sm text-muted">
          Two PDFs sized to Amazon KDP paperback specs — an interior file and a
          full-wrap cover.
        </p>

        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <Info label="Trim size" value={trim.label} />
          <Info label="Story pages" value={String(pages.length)} />
          <Info label="Illustrated" value={`${illustrated}/${pages.length}`} />
          <Info
            label="Spine (approx.)"
            value={`${spineWidthIn(Math.max(24, pages.length + 2)).toFixed(3)}"`}
          />
        </dl>

        <div className="mt-4 rounded-xl border border-border p-3">
          <label htmlFor="author" className="block text-xs font-semibold text-muted">
            Author name
          </label>
          <input
            id="author"
            value={authorInput}
            onChange={(e) => setAuthorInput(e.target.value)}
            onBlur={() => patchBook(book.id, { author: authorInput.trim() })}
            placeholder="e.g. Jane Doe"
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
          />
          <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm font-semibold">
            <input
              type="checkbox"
              checked={showCoverTitle}
              onChange={(e) =>
                patchBook(book.id, { showCoverTitle: e.target.checked })
              }
              className="h-4 w-4 accent-[color:var(--accent)]"
            />
            <span>Show the title &amp; author on the cover</span>
          </label>
          <p className="mt-1 text-xs text-muted">
            Turn this off if your cover picture already has the title printed on
            it.
          </p>
        </div>

        <button
          onClick={runExport}
          disabled={busy}
          className="mt-4 w-full rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-accent-fg disabled:opacity-60"
        >
          {busy ? 'Building PDFs…' : 'Generate print files'}
        </button>

        {busy && progress && (
          <div className="mt-4" aria-live="polite">
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-surface-2">
              <div
                className="h-full rounded-full bg-accent transition-all duration-300 ease-out"
                style={{
                  width: `${Math.round(
                    (progress.done / Math.max(1, progress.total)) * 100
                  )}%`,
                }}
              />
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-muted">
              <span>{progress.label}</span>
              <span>
                {Math.round(
                  (progress.done / Math.max(1, progress.total)) * 100
                )}
                %
              </span>
            </div>
            <p className="mt-1 text-xs text-muted">
              This can take a minute — please keep this page open.
            </p>
          </div>
        )}

        {!busy && result && (
          <div className="mt-4 space-y-3">
            <div className="rounded-xl bg-surface-2 p-3 text-sm">
              <p className="font-semibold">
                Interior is {result.pageCount} pages · spine{' '}
                {spineWidthIn(result.pageCount).toFixed(3)}&quot;
              </p>
              {result.missingImages > 0 && (
                <p className="mt-1 text-xs text-[color:var(--warn)]">
                  {result.missingImages} page(s) had no illustration and were
                  exported as text-only.
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() =>
                  downloadPdf(result.interior, `${stem}-interior.pdf`)
                }
                className="rounded-xl border border-border px-4 py-2.5 text-sm font-semibold hover:bg-surface-2"
              >
                ↓ Interior PDF
              </button>
              <button
                onClick={() => downloadPdf(result.cover, `${stem}-cover.pdf`)}
                className="rounded-xl border border-border px-4 py-2.5 text-sm font-semibold hover:bg-surface-2"
              >
                ↓ Cover PDF
              </button>
            </div>
          </div>
        )}
      </section>

      {/* KDP handoff */}
      <section className="rounded-2xl border border-border bg-surface p-5">
        <h2 className="font-display text-xl font-semibold">Upload to KDP</h2>
        <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm text-muted">
          <li>Download both PDFs above.</li>
          <li>Open your KDP Bookshelf and start a new paperback.</li>
          <li>
            Set the trim size to <strong>{trim.label}</strong> with bleed and
            white paper.
          </li>
          <li>Upload the interior file, then the cover file.</li>
          <li>Use KDP&apos;s previewer to confirm, then publish.</li>
        </ol>
        <a
          href={KDP_BOOKSHELF}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-flex rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-accent-fg"
        >
          Open KDP Bookshelf ↗
        </a>
        <p className="mt-2 text-xs text-muted">
          KDP has no upload API, so the final drag-and-drop is manual — that&apos;s
          an Amazon limitation, not a missing feature.
        </p>
      </section>

      {/* Publish + versioning */}
      <section className="rounded-2xl border border-border bg-surface p-5">
        <h2 className="font-display text-xl font-semibold">Version</h2>
        {book.published ? (
          <div className="mt-2 text-sm">
            <p className="text-muted">
              {book.published.label} · {book.published.pageTexts.length} story
              pages preserved.
            </p>
            {hasUnpublishedChanges ? (
              <p className="mt-2 rounded-lg bg-[color:var(--warn)]/12 px-3 py-2 text-xs text-[color:var(--warn)]">
                You&apos;ve edited the story since publishing. Your published
                version is preserved — mark as published again to update it.
              </p>
            ) : (
              <p className="mt-2 rounded-lg bg-[color:var(--ok)]/12 px-3 py-2 text-xs text-[color:var(--ok)]">
                This matches your published version.
              </p>
            )}
            <button
              onClick={publish}
              className="mt-3 rounded-xl border border-border px-4 py-2 text-sm font-semibold hover:bg-surface-2"
            >
              Update published version
            </button>
          </div>
        ) : (
          <div className="mt-2 text-sm">
            <p className="text-muted">
              Mark this book as published to snapshot the current story. Later
              edits create a new working version and never overwrite the
              published one.
            </p>
            <button
              onClick={publish}
              className={cn(
                'mt-3 rounded-xl px-4 py-2 text-sm font-semibold',
                'bg-accent text-accent-fg'
              )}
            >
              Mark as published
            </button>
          </div>
        )}
      </section>

      {/* Manual-steps handoff: appears once the book has been through the
          whole app flow and only the human Amazon steps remain. */}
      <section className="rounded-2xl border border-border bg-accent-soft p-5">
        <h2 className="font-display text-xl font-semibold">
          Need a hand publishing on Amazon?
        </h2>
        <p className="mt-1 text-sm text-muted">
          A calm, large-print, step-by-step walkthrough of everything above —
          written for someone doing this for the very first time. Print it out
          or follow along on screen.
        </p>
        <Link
          href="/guide"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-flex rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-accent-fg"
        >
          📖 Open the full step-by-step guide
        </Link>
      </section>
    </div>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-surface-2 px-3 py-2">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="font-semibold">{value}</dd>
    </div>
  )
}
