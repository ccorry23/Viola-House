'use client'

import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import toast from 'react-hot-toast'
import { getPages, patchBook } from '@/lib/db/dexie'
import { exportBook, downloadPdf, fileStem, type ExportResult } from '@/lib/pdf/export'
import { TRIM_SIZES, spineWidthIn } from '@/lib/kdp/constants'
import type { Book } from '@/lib/types'
import { cn } from '@/lib/cn'

const KDP_BOOKSHELF = 'https://kdp.amazon.com/en_US/bookshelf'

export function PublishPhase({ book }: { book: Book }) {
  const pages = useLiveQuery(() => getPages(book.id), [book.id]) ?? []
  const [result, setResult] = useState<ExportResult | null>(null)
  const [busy, setBusy] = useState(false)
  const trim = TRIM_SIZES[book.trimSize]

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
    try {
      const res = await exportBook(book, pages)
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

        <button
          onClick={runExport}
          disabled={busy}
          className="mt-5 w-full rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-accent-fg disabled:opacity-60"
        >
          {busy ? 'Building PDFs…' : 'Generate print files'}
        </button>

        {result && (
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
