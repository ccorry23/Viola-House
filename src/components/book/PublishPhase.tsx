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
import {
  TRIM_SIZES,
  HARDCOVER_MIN_PAGES,
  coverWrapBoxIn,
  hardcoverBlockers,
  paddedPageCount,
  spineWidthIn,
} from '@/lib/kdp/constants'
import { BODY_FONTS, DEFAULT_BODY_FONT } from '@/lib/pdf/bodyFonts'
import type { Book } from '@/lib/types'
import { cn } from '@/lib/cn'
import { callWrite } from '@/lib/ai/writeClient'
import { ListingHelper } from './ListingHelper'
import { BackCoverImagePicker } from './BackCoverImagePicker'
import { MarketingSlide } from './MarketingSlide'
import { BindingPicker } from './BindingPicker'

const KDP_BOOKSHELF = 'https://kdp.amazon.com/en_US/bookshelf'

export function PublishPhase({ book }: { book: Book }) {
  const pages = useLiveQuery(() => getPages(book.id), [book.id]) ?? []
  const [result, setResult] = useState<ExportResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<ExportProgress | null>(null)
  const [authorInput, setAuthorInput] = useState(book.author ?? '')
  const [blurbInput, setBlurbInput] = useState(book.blurb ?? '')
  const [writingBlurb, setWritingBlurb] = useState(false)
  const trim = TRIM_SIZES[book.trimSize]

  // Binding + hardcover safeguards.
  const binding = book.binding ?? 'paperback'
  const isHardcover = binding === 'hardcover'
  const bindingLabel = isHardcover ? 'hardcover' : 'paperback'
  const storyPages = pages.length
  const finalPages = paddedPageCount(storyPages, binding)
  const blanksAdded = finalPages - (storyPages + 2)
  const blockers = isHardcover ? hardcoverBlockers(book.trimSize, storyPages) : []
  const needsAck = isHardcover && storyPages + 2 < HARDCOVER_MIN_PAGES
  // The acknowledgement is tied to the page count it was given for, so it has
  // to be given again if the story changes length.
  const [ackForPages, setAckForPages] = useState<number | null>(null)
  const ackBlanks = ackForPages === storyPages
  const exportBlocked =
    storyPages === 0 || blockers.length > 0 || (needsAck && !ackBlanks)
  const coverBox = coverWrapBoxIn(trim, finalPages, binding, book.hardcoverSpineIn)
  const spineShown = (pageCount: number) =>
    coverWrapBoxIn(trim, pageCount, binding, book.hardcoverSpineIn).spine

  const showCoverTitle = book.showCoverTitle !== false
  const showCoverAuthor = book.showCoverAuthor !== false

  // Keep the author field in sync if the book changes underneath us.
  useEffect(() => {
    setAuthorInput(book.author ?? '')
  }, [book.id, book.author])

  // Keep the blurb field in sync (e.g. when the Listing Helper fills it in).
  useEffect(() => {
    setBlurbInput(book.blurb ?? '')
  }, [book.id, book.blurb])

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

  async function writeBackCover() {
    if (!book.manuscriptText.trim()) {
      toast.error('Write your story first, then I can write the back cover.')
      return
    }
    setWritingBlurb(true)
    try {
      const res = await callWrite({
        mode: 'backcover',
        manuscript: book.manuscriptText,
        title: book.title,
        author: book.author,
      })
      const text = (res.text ?? '').trim()
      if (!text) throw new Error('No text came back — try again.')
      setBlurbInput(text)
      await patchBook(book.id, { blurb: text })
      toast.success('Back cover written')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not write the back cover')
    } finally {
      setWritingBlurb(false)
    }
  }

  async function runExport() {
    if (pages.length === 0) {
      toast.error('Split your story into pages first.')
      return
    }
    if (blockers.length) {
      toast.error(blockers[0])
      return
    }
    if (needsAck && !ackBlanks) {
      toast.error(
        `Please confirm the ${blanksAdded} blank pages first — KDP hardcovers need ${HARDCOVER_MIN_PAGES} pages.`
      )
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
          Two PDFs sized to Amazon KDP {bindingLabel} specs — an interior file
          and a full-wrap cover.
        </p>

        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <Info label="Trim size" value={trim.label} />
          <Info label="Story pages" value={String(pages.length)} />
          <Info label="Illustrated" value={`${illustrated}/${pages.length}`} />
          <Info
            label={isHardcover && book.hardcoverSpineIn ? 'Spine (from KDP)' : 'Spine (approx.)'}
            value={`${spineShown(finalPages).toFixed(3)}"`}
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

          <div className="mt-3 flex items-center justify-between gap-2">
            <label htmlFor="blurb" className="block text-xs font-semibold text-muted">
              Back cover description
            </label>
            <button
              type="button"
              onClick={writeBackCover}
              disabled={writingBlurb}
              className="rounded-lg border border-border px-2.5 py-1 text-xs font-semibold text-accent hover:bg-accent-soft disabled:opacity-60"
            >
              {writingBlurb ? 'Writing…' : '✨ Write it for me'}
            </button>
          </div>
          <textarea
            id="blurb"
            value={blurbInput}
            onChange={(e) => setBlurbInput(e.target.value)}
            onBlur={() => patchBook(book.id, { blurb: blurbInput.trim() })}
            rows={4}
            placeholder="A few sentences about the story — printed on the book's back cover. (Leave blank for a plain back cover.)"
            className="mt-1 w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
          />
          <p className="mt-1 text-xs text-muted">
            Prints on the back cover. The bottom corner is left clear for
            Amazon&apos;s barcode.
          </p>

          <BackCoverImagePicker book={book} />

          <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm font-semibold">
            <input
              type="checkbox"
              checked={showCoverTitle}
              onChange={(e) =>
                patchBook(book.id, { showCoverTitle: e.target.checked })
              }
              className="h-4 w-4 accent-[color:var(--accent)]"
            />
            <span>Show the title on the cover</span>
          </label>
          <label className="mt-2 flex cursor-pointer items-center gap-2 text-sm font-semibold">
            <input
              type="checkbox"
              checked={showCoverAuthor}
              onChange={(e) =>
                patchBook(book.id, { showCoverAuthor: e.target.checked })
              }
              className="h-4 w-4 accent-[color:var(--accent)]"
            />
            <span>Show the author on the cover</span>
          </label>
          <p className="mt-1 text-xs text-muted">
            Turn one off if your cover picture already has that text printed on
            it.
          </p>

          <fieldset className="mt-4">
            <legend className="text-xs font-semibold text-muted">
              Story text font
            </legend>
            <p className="mt-1 text-xs text-muted">
              The font used for the story on each page. Titles always use the
              same display font.
            </p>
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {BODY_FONTS.map((f) => {
                const selected = (book.bodyFont ?? DEFAULT_BODY_FONT) === f.id
                return (
                  <button
                    key={f.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => patchBook(book.id, { bodyFont: f.id })}
                    className={cn(
                      'rounded-xl border p-3 text-left transition-colors',
                      selected
                        ? 'border-accent bg-accent-soft'
                        : 'border-border hover:bg-surface-2'
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold">{f.label}</span>
                      {selected && (
                        <span className="text-xs font-semibold text-accent">
                          ✓ Selected
                        </span>
                      )}
                    </div>
                    <div
                      className="mt-1 text-lg leading-snug"
                      style={{ fontFamily: f.previewStack }}
                    >
                      The quick brown fox.
                    </div>
                    <div className="mt-1 text-xs text-muted">{f.note}</div>
                  </button>
                )
              })}
            </div>
          </fieldset>
        </div>

        <BindingPicker
          key={book.id}
          book={book}
          storyPages={storyPages}
          finalPages={finalPages}
          blanksAdded={blanksAdded}
          blockers={blockers}
          needsAck={needsAck}
          ack={ackBlanks}
          onAck={(v) => setAckForPages(v ? storyPages : null)}
          spineEstimateIn={spineWidthIn(finalPages)}
          coverSizeIn={{ w: coverBox.w, h: coverBox.h }}
          onBindingChange={() => {
            setResult(null)
            setAckForPages(null)
          }}
        />

        <button
          onClick={runExport}
          disabled={busy || exportBlocked}
          className="mt-4 w-full rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-accent-fg disabled:opacity-60"
        >
          {busy
            ? 'Building PDFs…'
            : isHardcover
              ? 'Generate hardcover print files'
              : 'Generate print files'}
        </button>
        {!busy && exportBlocked && storyPages > 0 && (
          <p className="mt-2 text-xs text-[color:var(--warn)]">
            {blockers.length
              ? 'Fix the hardcover problem above to generate files.'
              : 'Tick the blank-pages box above to generate your hardcover files.'}
          </p>
        )}

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
                {isHardcover ? 'Hardcover' : 'Paperback'} · interior is{' '}
                {result.pageCount} pages · spine{' '}
                {spineShown(result.pageCount).toFixed(3)}&quot;
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
                  downloadPdf(result.interior, `${stem}-${bindingLabel}-interior.pdf`)
                }
                className="rounded-xl border border-border px-4 py-2.5 text-sm font-semibold hover:bg-surface-2"
              >
                ↓ Interior PDF
              </button>
              <button
                onClick={() => downloadPdf(result.cover, `${stem}-${bindingLabel}-cover.pdf`)}
                className="rounded-xl border border-border px-4 py-2.5 text-sm font-semibold hover:bg-surface-2"
              >
                ↓ Cover PDF
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Amazon listing helper */}
      <ListingHelper key={book.id} book={book} />

      {/* Amazon A+ marketing image */}
      <MarketingSlide book={book} />

      {/* KDP handoff */}
      <section className="rounded-2xl border border-border bg-surface p-5">
        <h2 className="font-display text-xl font-semibold">Upload to KDP</h2>
        <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm text-muted">
          <li>Download both PDFs above.</li>
          <li>Open your KDP Bookshelf and start a new {bindingLabel}.</li>
          <li>
            Set the trim size to <strong>{trim.label}</strong> with bleed and
            white paper.
          </li>
          {isHardcover && (
            <li>
              If this book is already on KDP as a paperback, add the hardcover
              from that book&apos;s row (&ldquo;+ Create hardcover&rdquo;) so the
              two formats stay linked. The hardcover needs its own ISBN, which KDP
              can give you for free.
            </li>
          )}
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
