'use client'

import { PDFDocument, rgb } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import {
  BLEED_IN,
  SAFE_MARGIN_IN,
  PT_PER_INCH,
  minInteriorPages,
  type BindingId,
  TRIM_SIZES,
  interiorPageBoxIn,
  type TrimId,
} from '@/lib/kdp/constants'
import { loadPdfFonts } from './fonts'
import type { BodyFontId } from './bodyFonts'
import { fitFontSize } from './text'
import { computeBandStyle, bakeScrim, drawBandText } from './textband'
import type { BandStats } from './upscale'

const INK = rgb(0.17, 0.13, 0.09)
const WHITE = rgb(1, 1, 1)

export interface InteriorPageInput {
  text: string
  /** Full-bleed JPEG bytes at print resolution, or null for a text-only page. */
  imageBytes: Uint8Array | null
  /** Brightness/colour of the art where the text sits, for adaptive overlays. */
  band?: BandStats
}

export interface BuildInteriorInput {
  title: string
  author?: string
  trimSize: TrimId
  pages: InteriorPageInput[]
  /** Author's chosen story-text font; undefined = default (Nunito). */
  bodyFont?: BodyFontId
  /** Binding decides the minimum page count we pad to (24 paperback, 75 hardcover). */
  binding?: BindingId
}

/**
 * Build the KDP interior PDF: title + copyright front matter, one full-bleed
 * illustrated page per story page (story text overlaid in a readable band),
 * then blank pages padded to reach KDP's 24-page paperback minimum and an even
 * total. All pages share the same trim+bleed size, as KDP requires.
 */
export interface InteriorResult {
  bytes: Uint8Array
  pageCount: number
}

export async function buildInteriorPdf({
  title,
  author,
  trimSize,
  pages,
  bodyFont,
  binding = 'paperback',
}: BuildInteriorInput): Promise<InteriorResult> {
  const trim = TRIM_SIZES[trimSize]
  const box = interiorPageBoxIn(trim)
  const wPt = box.w * PT_PER_INCH
  const hPt = box.h * PT_PER_INCH
  // Keep content inside bleed + safe margin from every physical edge.
  const inset = (BLEED_IN + SAFE_MARGIN_IN) * PT_PER_INCH

  const doc = await PDFDocument.create()
  doc.registerFontkit(fontkit)
  const fonts = await loadPdfFonts(bodyFont)
  const display = await doc.embedFont(fonts.display, { subset: true })
  const body = await doc.embedFont(fonts.body, { subset: true })

  const addBlank = () => {
    const page = doc.addPage([wPt, hPt])
    page.drawRectangle({ x: 0, y: 0, width: wPt, height: hPt, color: WHITE })
    return page
  }

  // --- Title page ---
  {
    const page = addBlank()
    const maxW = wPt - inset * 2
    const { size, lines } = fitFontSize(title, display, maxW, hPt * 0.4, 40, 18)
    let y = hPt * 0.62
    for (const line of lines) {
      const w = display.widthOfTextAtSize(line, size)
      page.drawText(line, { x: (wPt - w) / 2, y, size, font: display, color: INK })
      y -= size * 1.3
    }
    const sub = author?.trim() ? `by ${author.trim()}` : 'A picture book'
    const subSize = 13
    const subW = body.widthOfTextAtSize(sub, subSize)
    page.drawText(sub, {
      x: (wPt - subW) / 2,
      y: y - 8,
      size: subSize,
      font: body,
      color: rgb(0.48, 0.44, 0.38),
    })
  }

  // --- Copyright page ---
  {
    const page = addBlank()
    const year = new Date().getFullYear()
    const lines = [
      `Copyright © ${year}. All rights reserved.`,
      `“${title}”`,
      'No part of this book may be reproduced without permission.',
      '',
      'Made with Viola House.',
    ]
    let y = inset + 18 * lines.length * 1.4
    for (const line of lines) {
      if (line)
        page.drawText(line, { x: inset, y, size: 11, font: body, color: rgb(0.4, 0.36, 0.3) })
      y -= 18
    }
  }

  // --- Story pages ---
  for (const p of pages) {
    const page = doc.addPage([wPt, hPt])
    const text = p.text.trim()
    const layout = text
      ? (() => {
          const pad = 14
          const maxTextW = wPt - inset * 2 - pad * 2
          const { size, lines } = fitFontSize(text, body, maxTextW, hPt * 0.25, 20, 12)
          return { size, lines, lineH: size * 1.35, textBottom: inset + pad }
        })()
      : null

    if (p.imageBytes && layout) {
      // Bake the soft fade into the art (seamless, opaque), then text on top.
      const style = computeBandStyle(
        p.band,
        layout.textBottom,
        layout.lines.length,
        layout.size,
        layout.lineH,
        [],
        'soft'
      )
      const composited = await bakeScrim(p.imageBytes, hPt, style)
      const img = await doc.embedJpg(composited)
      page.drawImage(img, { x: 0, y: 0, width: wPt, height: hPt })
      drawBandText({
        page,
        x: 0,
        width: wPt,
        lines: layout.lines,
        size: layout.size,
        lineH: layout.lineH,
        font: body,
        style,
      })
    } else if (p.imageBytes) {
      const img = await doc.embedJpg(p.imageBytes)
      page.drawImage(img, { x: 0, y: 0, width: wPt, height: hPt })
    } else {
      page.drawRectangle({ x: 0, y: 0, width: wPt, height: hPt, color: WHITE })
      if (layout) {
        // Text-only page (no art): plain dark ink on the white background.
        let ty = layout.textBottom + layout.lines.length * layout.lineH - layout.size
        for (const line of layout.lines) {
          const lw = body.widthOfTextAtSize(line, layout.size)
          page.drawText(line, {
            x: (wPt - lw) / 2,
            y: ty,
            size: layout.size,
            font: body,
            color: INK,
          })
          ty -= layout.lineH
        }
      }
    }
  }

  // --- Pad to KDP minimum + even count ---
  let total = doc.getPageCount()
  const minPages = minInteriorPages(binding)
  while (total < minPages || total % 2 !== 0) {
    addBlank()
    total++
  }

  // useObjectStreams: false writes a classic (uncompressed) cross-reference
  // table instead of pdf-lib's default compressed object streams. It's a
  // larger file but far more broadly compatible with third-party PDF
  // ingestion/validation tools — including print-on-demand processors like
  // KDP's, which have been reported to reject object-stream PDFs outright.
  const bytes = await doc.save({ useObjectStreams: false })
  return { bytes, pageCount: total }
}
