'use client'

import { inToPx, interiorPageBoxIn, TRIM_SIZES } from '@/lib/kdp/constants'
import type { Book, Page } from '@/lib/types'
import { buildInteriorPdf, type InteriorPageInput } from './interior'
import { buildCoverPdf } from './cover'
import { upscaleToPng } from './upscale'

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
  const trim = TRIM_SIZES[book.trimSize]
  const box = interiorPageBoxIn(trim)
  const wPx = inToPx(box.w)
  const hPx = inToPx(box.h)

  const sorted = [...pages].sort((a, b) => a.index - b.index)
  const interiorPages: InteriorPageInput[] = []
  let missingImages = 0

  // Progress: one step per page image, plus a cover-art step and two
  // assembly steps. Yielding between steps lets the status bar paint.
  const hasCoverArt = Boolean(book.style.characterSheet)
  const total = (hasCoverArt ? 1 : 0) + sorted.length + 2
  let done = 0
  const tick = (label: string) => onProgress?.({ done, total, label })
  const yieldToUi = () => new Promise((r) => setTimeout(r, 0))

  tick('Getting things ready…')

  // The cover front prefers the dedicated cover image (the style anchor the
  // author dialed in first); it falls back to page 1's art if none is set.
  let frontBytes: Uint8Array | null = null
  if (hasCoverArt) {
    tick('Preparing the cover…')
    frontBytes = (await upscaleToPng(book.style.characterSheet!, wPx, hPx)).png
    done++
    tick('Preparing the cover…')
  }

  let n = 0
  for (const p of sorted) {
    n++
    tick(`Preparing page ${n} of ${sorted.length}…`)
    let png: Uint8Array | null = null
    let band: InteriorPageInput['band']
    if (p.image) {
      const up = await upscaleToPng(p.image, wPx, hPx)
      png = up.png
      band = up.band
    } else {
      missingImages++
    }
    interiorPages.push({ text: p.text, pngBytes: png, band })
    if (p.index === 0 && png && !frontBytes) frontBytes = png
    done++
    tick(`Preparing page ${n} of ${sorted.length}…`)
    await yieldToUi()
  }

  tick('Putting the book together…')
  const interior = await buildInteriorPdf({
    title: book.title,
    trimSize: book.trimSize,
    pages: interiorPages,
  })
  done++
  tick('Building the cover…')
  await yieldToUi()

  const cover = await buildCoverPdf({
    title: book.title,
    trimSize: book.trimSize,
    pageCount: interior.pageCount,
    frontPngBytes: frontBytes,
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
