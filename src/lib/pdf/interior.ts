'use client'

import { PDFDocument, rgb, type PDFPage, type PDFFont } from 'pdf-lib'
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

const lerp = (a: number, b: number, t: number) => a + (b - a) * t

/**
 * Draw the story text over full-bleed art so it always reads, on any book's
 * colours, without looking like a pasted box. Instead of a hard white rectangle
 * we lay down a soft, full-width gradient "scrim" that rises from the page's
 * bottom edge and feathers to nothing above the text — and we adapt it to the
 * art beneath: a light scrim with dark text over bright pictures, a dark scrim
 * with light text over dark ones, tinted from the art's own colour so it feels
 * part of the illustration. A faint halo around each letter adds legibility
 * insurance for busy backgrounds.
 */
function drawAdaptiveTextBand({
  page,
  width,
  textTop,
  band,
  lines,
  size,
  lineH,
  font,
  startY,
}: {
  page: PDFPage
  width: number
  textTop: number
  band?: BandStats
  lines: string[]
  size: number
  lineH: number
  font: PDFFont
  startY: number
}) {
  const lum = band?.luminance ?? 0.5
  const br = band?.r ?? 0.5
  const bg = band?.g ?? 0.5
  const bb = band?.b ?? 0.5

  // Favour the more universally legible dark-scrim/light-text unless the art
  // under the text is clearly bright.
  const lightArt = lum >= 0.6

  const scrim = lightArt
    ? rgb(lerp(br, 1, 0.9), lerp(bg, 1, 0.9), lerp(bb, 1, 0.9)) // near-white tint
    : rgb(br * 0.14, bg * 0.14, bb * 0.14) // deep-dark tint
  const textColor = lightArt ? INK : WHITE
  const haloColor = lightArt ? rgb(1, 1, 1) : rgb(0.05, 0.04, 0.03)

  const maxOpacity = lightArt ? 0.85 : 0.8
  const plateauMin = maxOpacity * 0.72
  const feather = size * 2.4
  const scrimTop = textTop + feather

  // Full-width strips from the bottom edge up to scrimTop. Strong and even
  // behind the text, then a soft fade above it so there is no hard top edge.
  const strips = 56
  const stripH = scrimTop / strips
  for (let i = 0; i < strips; i++) {
    const y = i * stripH
    const yc = y + stripH / 2
    let op: number
    if (yc <= textTop) {
      op = lerp(maxOpacity, plateauMin, textTop > 0 ? yc / textTop : 0)
    } else {
      const t = (yc - textTop) / (scrimTop - textTop)
      op = lerp(plateauMin, 0, Math.pow(t, 1.3))
    }
    if (op <= 0.004) continue
    page.drawRectangle({
      x: 0,
      y,
      width,
      height: stripH + 0.5, // slight overlap avoids seam lines
      color: scrim,
      opacity: op,
    })
  }

  // Halo (a few faint offset copies) then the crisp text on top.
  const o = Math.max(0.5, size * 0.04)
  const offsets: Array<[number, number]> = [
    [-o, 0],
    [o, 0],
    [0, -o],
    [0, o],
    [-o, -o],
    [o, o],
  ]
  let ty = startY
  for (const line of lines) {
    const lw = font.widthOfTextAtSize(line, size)
    const x = (width - lw) / 2
    for (const [dx, dy] of offsets) {
      page.drawText(line, {
        x: x + dx,
        y: ty + dy,
        size,
        font,
        color: haloColor,
        opacity: 0.45,
      })
    }
    page.drawText(line, { x, y: ty, size, font, color: textColor })
    ty -= lineH
  }
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
        drawAdaptiveTextBand({
          page,
          width: wPt,
          textTop,
          band: p.band,
          lines,
          size,
          lineH,
          font: body,
          startY: textTop - size,
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
