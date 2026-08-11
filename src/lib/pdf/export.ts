'use client'

import { inToPx, interiorPageBoxIn, TRIM_SIZES } from '@/lib/kdp/constants'
import type { Book, Page } from '@/lib/types'
import { buildInteriorPdf } from './interior'
import { buildCoverPdf } from './cover'
import { upscaleToPng } from './upscale'

export interface ExportResult {
  interior: Uint8Array
  cover: Uint8Array
  pageCount: number
  missingImages: number
}

/**
 * Produce the two KDP print files entirely in the browser. Each illustration is
 * upscaled (via canvas) to the interior page's pixel target so it prints at
 * ~300 DPI; the spine width is taken from the interior PDF's final page count.
 * Pages without an illustration still export as text-only pages so a proof can
 * always be made.
 */
export async function exportBook(
  book: Book,
  pages: Page[]
): Promise<ExportResult> {
  const trim = TRIM_SIZES[book.trimSize]
  const box = interiorPageBoxIn(trim)
  const wPx = inToPx(box.w)
  const hPx = inToPx(box.h)

  const sorted = [...pages].sort((a, b) => a.index - b.index)
  const interiorPages: { text: string; pngBytes: Uint8Array | null }[] = []
  let missingImages = 0

  // The cover front prefers the dedicated cover image (the style anchor the
  // author dialed in first); it falls back to page 1's art if none is set.
  let frontBytes: Uint8Array | null = book.style.characterSheet
    ? await upscaleToPng(book.style.characterSheet, wPx, hPx)
    : null

  for (const p of sorted) {
    let png: Uint8Array | null = null
    if (p.image) {
      png = await upscaleToPng(p.image, wPx, hPx)
    } else {
      missingImages++
    }
    interiorPages.push({ text: p.text, pngBytes: png })
    if (p.index === 0 && png && !frontBytes) frontBytes = png
  }

  const interior = await buildInteriorPdf({
    title: book.title,
    trimSize: book.trimSize,
    pages: interiorPages,
  })

  const cover = await buildCoverPdf({
    title: book.title,
    trimSize: book.trimSize,
    pageCount: interior.pageCount,
    frontPngBytes: frontBytes,
  })

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
