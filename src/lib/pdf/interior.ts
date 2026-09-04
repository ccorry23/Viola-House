'use client'

import { PDFDocument, rgb } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import {
  BLEED_IN,
  SAFE_MARGIN_IN,
  PT_PER_INCH,
  MIN_PAGE_COUNT,
  TRIM_SIZES,
  interiorPageBoxIn,
  type TrimId,
} from '@/lib/kdp/constants'
import { loadPdfFonts } from './fonts'
import { fitFontSize } from './text'
import { drawAdaptiveTextBand } from './textband'
import type { BandStats } from './upscale'

const INK = rgb(0.17, 0.13, 0.09)
const WHITE = rgb(1, 1, 1)

export interface InteriorPageInput {
  text: string
  /** Full-bleed PNG bytes at print resolution, or null for a text-only page. */
  pngBytes: Uint8Array | null
  /** Brightness/colour of the art where the text sits, for adaptive overlays. */
  band?: BandStats
}

export interface BuildInteriorInput {
  title: string
  trimSize: TrimId
  pages: InteriorPageInput[]
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
  trimSize,
  pages,
}: BuildInteriorInput): Promise<InteriorResult> {
  const trim = TRIM_SIZES[trimSize]
  const box = interiorPageBoxIn(trim)
  const wPt = box.w * PT_PER_INCH
  const hPt = box.h * PT_PER_INCH
  // Keep content inside bleed + safe margin from every physical edge.
  const inset = (BLEED_IN + SAFE_MARGIN_IN) * PT_PER_INCH

  const doc = await PDFDocument.create()
  doc.registerFontkit(fontkit)
  const fonts = await loadPdfFonts()
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
    const sub = 'A picture book'
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
    if (p.pngBytes) {
      const png = await doc.embedPng(p.pngBytes)
      page.drawImage(png, { x: 0, y: 0, width: wPt, height: hPt })
    } else {
      page.drawRectangle({ x: 0, y: 0, width: wPt, height: hPt, color: WHITE })
    }

    const text = p.text.trim()
    if (text) {
      const pad = 14
      const maxTextW = wPt - inset * 2 - pad * 2
      const { size, lines } = fitFontSize(text, body, maxTextW, hPt * 0.25, 20, 12)
      const lineH = size * 1.35
      const textBlockH = lines.length * lineH

      // Where the block of text sits, kept inside the safe margin.
      const textBottom = inset + pad
      const textTop = textBottom + textBlockH

      if (p.pngBytes) {
        await drawAdaptiveTextBand({
          doc,
          page,
          x: 0,
          width: wPt,
          textBottom,
          band: p.band,
          lines,
          size,
          lineH,
          font: body,
        })
      } else {
        // Text-only page (no art): plain dark ink on the white background.
        let ty = textTop - size
        for (const line of lines) {
          const lw = body.widthOfTextAtSize(line, size)
          page.drawText(line, {
            x: (wPt - lw) / 2,
            y: ty,
            size,
            font: body,
            color: INK,
          })
          ty -= lineH
        }
      }
    }
  }

  // --- Pad to KDP minimum + even count ---
  let total = doc.getPageCount()
  while (total < MIN_PAGE_COUNT || total % 2 !== 0) {
    addBlank()
    total++
  }

  const bytes = await doc.save()
  return { bytes, pageCount: total }
}
