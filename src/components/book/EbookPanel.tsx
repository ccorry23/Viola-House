'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { exportEbook, type EbookResult } from '@/lib/ebook/export'
import { downloadBytes, downloadPdf, fileStem, type ExportProgress } from '@/lib/pdf/export'
import type { Book, Page } from '@/lib/types'

const KDP_BOOKSHELF = 'https://kdp.amazon.com/en_US/bookshelf'
const KINDLE_CREATE_URL = 'https://www.amazon.com/Kindle-Create/b?node=18292298011'

const mb = (bytes: number) => `${(bytes / (1024 * 1024)).toFixed(1)} MB`

/**
 * Kindle eBook files + how to publish them. KDP builds picture-book (fixed
 * layout) eBooks from a PDF opened in Amazon's free Kindle Create app, which
 * saves a .kpf file to upload; the cover is a separate JPEG. So we make an
 * eBook page PDF (exact book shape, no bleed or blank padding) and a cover JPEG
 * at KDP's recommended 2560 px, then walk the author through the rest.
 */
export function EbookPanel({ book, pages }: { book: Book; pages: Page[] }) {
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<ExportProgress | null>(null)
  const [result, setResult] = useState<EbookResult | null>(null)
  const [coverUrl, setCoverUrl] = useState<string | null>(null)
  const coverUrlRef = useRef<string | null>(null)

  // Release the cover preview's object URL when leaving the page.
  useEffect(
    () => () => {
      if (coverUrlRef.current) URL.revokeObjectURL(coverUrlRef.current)
    },
    []
  )

  const stem = fileStem(book.title)

  async function run() {
    if (pages.length === 0) {
      toast.error('Split your story into pages first.')
      return
    }
    setBusy(true)
    setProgress({ done: 0, total: 1, label: 'Getting things ready…' })
    try {
      const res = await exportEbook(book, pages, setProgress)
      if (coverUrlRef.current) URL.revokeObjectURL(coverUrlRef.current)
      const url = URL.createObjectURL(
        new Blob([res.coverJpg as BlobPart], { type: 'image/jpeg' })
      )
      coverUrlRef.current = url
      setCoverUrl(url)
      setResult(res)
      if (res.missingImages > 0) {
        toast(`${res.missingImages} page(s) have no illustration — made as text-only.`, {
          icon: '⚠️',
        })
      } else {
        toast.success('eBook files ready')
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not make the eBook files')
    } finally {
      setBusy(false)
      setProgress(null)
    }
  }

  const pct = progress ? Math.round((progress.done / Math.max(1, progress.total)) * 100) : 0

  return (
    <section className="rounded-2xl border border-border bg-surface p-5">
      <h2 className="font-display text-xl font-semibold">Kindle eBook (optional)</h2>
      <p className="mt-1 text-sm text-muted">
        Sell a digital copy alongside the printed book. The eBook uses the same
        pages and cover art, sized for screens: no bleed, no blank pages, and no
        ISBN needed.
      </p>

      <button
        onClick={run}
        disabled={busy}
        className="mt-4 w-full rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-accent-fg disabled:opacity-60"
      >
        {busy ? 'Making eBook files…' : result ? 'Make eBook files again' : 'Make eBook files'}
      </button>

      {busy && progress && (
        <div className="mt-4" aria-live="polite">
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-surface-2">
            <div
              className="h-full rounded-full bg-accent transition-all duration-300 ease-out"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-muted">
            <span>{progress.label}</span>
            <span>{pct}%</span>
          </div>
        </div>
      )}

      {!busy && result && (
        <div className="mt-4 flex flex-col gap-4 sm:flex-row">
          {coverUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- local object URL preview
            <img
              src={coverUrl}
              alt="eBook cover preview"
              className="w-32 self-start rounded-lg border border-border shadow-sm"
            />
          )}
          <div className="min-w-0 flex-1 space-y-3">
            <div className="rounded-xl bg-surface-2 p-3 text-sm">
              <p className="font-semibold">
                eBook · {result.pageCount} pages · {mb(result.pdf.length)}
              </p>
              <p className="mt-0.5 text-xs text-muted">
                Cover {result.coverPx.w} × {result.coverPx.h} px ·{' '}
                {mb(result.coverJpg.length)}
              </p>
              {result.missingImages > 0 && (
                <p className="mt-1 text-xs text-[color:var(--warn)]">
                  {result.missingImages} page(s) had no illustration and were made
                  as text-only.
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => downloadPdf(result.pdf, `${stem}-ebook.pdf`)}
                className="rounded-xl border border-border px-4 py-2.5 text-sm font-semibold hover:bg-surface-2"
              >
                ↓ eBook PDF
              </button>
              <button
                onClick={() =>
                  downloadBytes(result.coverJpg, `${stem}-ebook-cover.jpg`, 'image/jpeg')
                }
                className="rounded-xl border border-border px-4 py-2.5 text-sm font-semibold hover:bg-surface-2"
              >
                ↓ eBook cover
              </button>
            </div>
          </div>
        </div>
      )}

      <h3 className="mt-6 font-display text-base font-semibold">
        How to publish the eBook
      </h3>
      <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm text-muted">
        <li>Download both eBook files above.</li>
        <li>
          On a <strong>Windows or Mac computer</strong>, install Amazon&apos;s free{' '}
          <a
            href={KINDLE_CREATE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-accent underline"
          >
            Kindle Create ↗
          </a>{' '}
          (it doesn&apos;t run on phones or iPads).
        </li>
        <li>
          In Kindle Create, start a new book from your <strong>eBook PDF</strong>{' '}
          (Amazon calls this a &ldquo;Print Replica&rdquo; book). Flip through
          the preview, then publish/export it. That saves a <strong>.kpf</strong>{' '}
          file.
        </li>
        <li>
          In your KDP Bookshelf, find this book&apos;s paperback and click{' '}
          <strong>&ldquo;+ Create eBook&rdquo;</strong> on its row, so the two
          editions stay linked on Amazon. (No paperback yet? Use &ldquo;+
          Create&rdquo; → Kindle eBook.)
        </li>
        <li>
          Details: use the same title and author as the paperback. Paste the
          description and keywords from the listing helper below.
        </li>
        <li>
          Content: upload the <strong>.kpf</strong> file as the manuscript and{' '}
          <strong>{stem}-ebook-cover.jpg</strong> as the cover. You don&apos;t need an
          ISBN. Check it in the previewer.
        </li>
        <li>
          Pricing: pick the 35% or 70% royalty. The 70% plan needs a price from
          $2.99 to $9.99, and Amazon subtracts a small delivery fee based on the
          file&apos;s size. KDP shows what you&apos;d earn under each, so compare
          them before you choose.
        </li>
        <li>Publish. eBooks usually go live within 72 hours.</li>
      </ol>
      <div className="mt-4 flex flex-wrap gap-2">
        <a
          href={KDP_BOOKSHELF}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex rounded-xl border border-border px-4 py-2 text-sm font-semibold hover:bg-surface-2"
        >
          Open KDP Bookshelf ↗
        </a>
        <Link
          href="/guide#part9"
          className="inline-flex rounded-xl border border-border px-4 py-2 text-sm font-semibold hover:bg-surface-2"
        >
          Step-by-step pictures →
        </Link>
      </div>
    </section>
  )
}
