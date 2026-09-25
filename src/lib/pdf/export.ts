'use client'

import {
  inToPx,
  interiorPageBoxIn,
  TRIM_SIZES,
  TOP_ART_INSET_IN,
  hardcoverBlockers,
} from '@/lib/kdp/constants'
import type { Book, Page } from '@/lib/types'
import { buildInteriorPdf, type InteriorPageInput } from './interior'
import { buildCoverPdf } from './cover'
import { upscaleToImage } from './upscale'

export interface ExportResult {
  interior: Uint8Array
  cover: Uint8Array
  pageCount: number
  missingImages: number
}

/** Progress update during a (minute-long) export, for a status bar. */
export interface ExportProgress {
  done: number
  total: number
  label: string
}
export type ProgressFn = (p: ExportProgress) => void

/**
 * Produce the two KDP print files entirely in the browser. Each illustration is
 * upscaled (via canvas) to the interior page's pixel target so it prints at
 * ~300 DPI; the spine width is taken from the interior PDF's final page count.
 * Pages without an illustration still export as text-only pages so a proof can
 * always be made.
 */
export async function exportBook(
  book: Book,
  pages: Page[],
  onProgress?: ProgressFn
): Promise<ExportResult> {
  const binding = book.binding ?? 'paperback'
  // Safeguard: never produce a hardcover file KDP will reject outright.
  if (binding === 'hardcover') {
    const blockers = hardcoverBlockers(book.trimSize, pages.length)
    if (blockers.length) throw new Error(blockers.join(' '))
  }

  const trim = TRIM_SIZES[book.trimSize]
  const box = interiorPageBoxIn(trim)
  const wPx = inToPx(box.w)
  const hPx = inToPx(box.h)
  // Push illustration content down from the top trim on every page + the cover.
  const topInsetPx = inToPx(TOP_ART_INSET_IN)

  const sorted = [...pages].sort((a, b) => a.index - b.index)
  const interiorPages: InteriorPageInput[] = []
  let missingImages = 0

  // Progress: one step per page image, plus two assembly steps (the cover art
  // is prepared inside the cover step, sized to the cover's own panel).
  // Yielding between steps lets the status bar paint.
  const total = sorted.length + 2
  let done = 0
  const tick = (label: string) => onProgress?.({ done, total, label })
  const yieldToUi = () => new Promise((r) => setTimeout(r, 0))

  tick('Getting things ready…')

  // The cover front prefers the dedicated cover image (the style anchor the
  // author dialed in first); it falls back to page 1's art if none is set.
  const frontImageBlob: Blob | null =
    book.style.characterSheet ??
    sorted.find((p) => p.index === 0 && p.image)?.image ??
    null

  let n = 0
  for (const p of sorted) {
    n++
    tick(`Preparing page ${n} of ${sorted.length}…`)
    let img: Uint8Array | null = null
    let band: InteriorPageInput['band']
    if (p.image) {
      const up = await upscaleToImage(p.image, wPx, hPx, topInsetPx)
      img = up.jpg
      band = up.band
    } else {
      missingImages++
    }
    interiorPages.push({ text: p.text, imageBytes: img, band })
    done++
    tick(`Preparing page ${n} of ${sorted.length}…`)
    await yieldToUi()
  }

  tick('Putting the book together…')
  const interior = await buildInteriorPdf({
    title: book.title,
    author: book.author,
    trimSize: book.trimSize,
    pages: interiorPages,
    bodyFont: book.bodyFont,
    binding,
  })
  done++
  tick('Building the cover…')
  await yieldToUi()

  const cover = await buildCoverPdf({
    title: book.title,
    author: book.author,
    showTitle: book.showCoverTitle !== false,
    showAuthor: book.showCoverAuthor !== false,
    trimSize: book.trimSize,
    pageCount: interior.pageCount,
    frontImageBlob,
    bodyFont: book.bodyFont,
    binding,
    spineOverrideIn: book.hardcoverSpineIn,
    blurb: book.blurb,
    backImageBlob: book.backCoverImage ?? null,
  })
  done++
  tick('Almost done…')

  return {
    interior: interior.bytes,
    cover,
    pageCount: interior.pageCount,
    missingImages,
  }
}

/** Trigger a browser download of PDF bytes. */
export function downloadPdf(bytes: Uint8Array, filename: string) {
  const blob = new Blob([bytes as unknown as BlobPart], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}

/** Safe filename stem from the book title. */
export function fileStem(title: string): string {
  return (
    title
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'storybook'
  )
}
