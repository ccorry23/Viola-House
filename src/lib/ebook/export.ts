'use client'

import { TRIM_SIZES } from '@/lib/kdp/constants'
import type { Book, Page } from '@/lib/types'
import { buildInteriorPdf, type InteriorPageInput } from '@/lib/pdf/interior'
import { upscaleToImage } from '@/lib/pdf/upscale'
import type { ProgressFn } from '@/lib/pdf/export'
import { renderEbookCover, ebookCoverSizePx } from './cover'

/**
 * Longest side of each eBook page image. Sharp on tablets while keeping the
 * file modest — on KDP's 70% royalty plan Amazon charges a delivery fee per
 * megabyte, so picture-book eBooks shouldn't carry print-size art.
 */
export const EBOOK_PAGE_LONG_PX = 1800

export interface EbookResult {
  /** Fixed-layout page PDF to open in Kindle Create. */
  pdf: Uint8Array
  /** eBook cover JPEG for KDP's cover upload. */
  coverJpg: Uint8Array
  coverPx: { w: number; h: number }
  pageCount: number
  missingImages: number
}

/**
 * Produce the Kindle eBook files in the browser: a page PDF at the book's exact
 * shape (no bleed, no blank padding — KDP builds a picture-book eBook from a
 * PDF via Kindle Create) and a cover JPEG at KDP's recommended size.
 */
export async function exportEbook(
  book: Book,
  pages: Page[],
  onProgress?: ProgressFn
): Promise<EbookResult> {
  const trim = TRIM_SIZES[book.trimSize]
  const long = Math.max(trim.w, trim.h)
  const wPx = Math.round((EBOOK_PAGE_LONG_PX * trim.w) / long)
  const hPx = Math.round((EBOOK_PAGE_LONG_PX * trim.h) / long)

  const sorted = [...pages].sort((a, b) => a.index - b.index)
  const total = sorted.length + 2
  let done = 0
  const tick = (label: string) => onProgress?.({ done, total, label })
  const yieldToUi = () => new Promise((r) => setTimeout(r, 0))

  const interiorPages: InteriorPageInput[] = []
  let missingImages = 0
  let n = 0
  for (const p of sorted) {
    n++
    tick(`Preparing page ${n} of ${sorted.length}…`)
    if (p.image) {
      // Screens have no trim, so no top inset is needed.
      const up = await upscaleToImage(p.image, wPx, hPx, 0)
      interiorPages.push({ text: p.text, imageBytes: up.jpg, band: up.band })
    } else {
      missingImages++
      interiorPages.push({ text: p.text, imageBytes: null })
    }
    done++
    await yieldToUi()
  }

  tick('Putting the eBook together…')
  const interior = await buildInteriorPdf({
    title: book.title,
    author: book.author,
    trimSize: book.trimSize,
    pages: interiorPages,
    bodyFont: book.bodyFont,
    format: 'ebook',
  })
  done++
  tick('Making the eBook cover…')
  await yieldToUi()

  const frontImageBlob: Blob | null =
    book.style.characterSheet ??
    sorted.find((p) => p.index === 0 && p.image)?.image ??
    null
  const coverJpg = await renderEbookCover({
    title: book.title,
    author: book.author,
    showTitle: book.showCoverTitle !== false,
    showAuthor: book.showCoverAuthor !== false,
    trimSize: book.trimSize,
    frontImageBlob,
    bodyFont: book.bodyFont,
  })
  done++
  tick('Almost done…')

  return {
    pdf: interior.bytes,
    coverJpg,
    coverPx: ebookCoverSizePx(book.trimSize),
    pageCount: interior.pageCount,
    missingImages,
  }
}
