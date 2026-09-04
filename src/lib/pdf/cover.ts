'use client'

import { PDFDocument, rgb, degrees } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import {
  BLEED_IN,
  SAFE_MARGIN_IN,
  PT_PER_INCH,
  TRIM_SIZES,
  coverWrapBoxIn,
  spineWidthIn,
  type TrimId,
} from '@/lib/kdp/constants'
import { loadPdfFonts } from './fonts'
import { fitFontSize } from './text'
import { drawAdaptiveTextBand } from './textband'
import type { BandStats } from './upscale'

const ACCENT = rgb(0.71, 0.28, 0.42)
const BACK_BG = rgb(0.96, 0.89, 0.92)
const INK = rgb(0.17, 0.13, 0.09)
const WHITE = rgb(1, 1, 1)

export interface BuildCoverInput {
  title: string
  /** Author name for the byline (blank to omit). */
  author?: string
  /** Whether to print the title + author band on the front cover. */
  showTitle?: boolean
  trimSize: TrimId
  /** Interior page count — drives spine width. */
  pageCount: number
  /** Front cover art (upscaled PNG), or null for a plain colored cover. */
  frontPngBytes: Uint8Array | null
  /** Brightness/colour of the cover art where the title sits, for the scrim. */
  frontBand?: BandStats
}

/**
 * Build the KDP full-wrap paperback cover: back cover + spine + front cover on
 * a single page, with 0.125" bleed all around and a spine sized from the page
 * count (white paper = 0.002252"/page). Spine text is only added at ≥100 pages,
 * per KDP's rule.
 */
export async function buildCoverPdf({
  title,
  author,
  showTitle = true,
  trimSize,
  pageCount,
  frontPngBytes,
  frontBand,
}: BuildCoverInput): Promise<Uint8Array> {
  const trim = TRIM_SIZES[trimSize]
  const wrap = coverWrapBoxIn(trim, pageCount)
  const wPt = wrap.w * PT_PER_INCH
  const hPt = wrap.h * PT_PER_INCH
  const bleedPt = BLEED_IN * PT_PER_INCH
  const trimWPt = trim.w * PT_PER_INCH
  const spinePt = spineWidthIn(pageCount) * PT_PER_INCH
  const inset = SAFE_MARGIN_IN * PT_PER_INCH

  const doc = await PDFDocument.create()
  doc.registerFontkit(fontkit)
  const fonts = await loadPdfFonts()
  const display = await doc.embedFont(fonts.display, { subset: true })
  const body = await doc.embedFont(fonts.body, { subset: true })

  const page = doc.addPage([wPt, hPt])

  // Region boundaries (left → right): back | spine | front.
  const backW = bleedPt + trimWPt
  const spineX = backW
  const frontX = backW + spinePt
  const frontW = trimWPt + bleedPt

  // Back cover background.
  page.drawRectangle({ x: 0, y: 0, width: backW, height: hPt, color: BACK_BG })

  // Front cover art (or colored fallback).
  if (frontPngBytes) {
    const png = await doc.embedPng(frontPngBytes)
    page.drawImage(png, { x: frontX, y: 0, width: frontW, height: hPt })
  } else {
    page.drawRectangle({ x: frontX, y: 0, width: frontW, height: hPt, color: BACK_BG })
  }

  // Spine.
  page.drawRectangle({ x: spineX, y: 0, width: spinePt, height: hPt, color: ACCENT })
  if (pageCount >= 100 && spinePt > 12) {
    const spineFont = 12
    const tw = display.widthOfTextAtSize(title, spineFont)
    page.drawText(title, {
      x: spineX + spinePt / 2 + spineFont / 2 - 2,
      y: (hPt - tw) / 2,
      size: spineFont,
      font: display,
      color: WHITE,
      rotate: degrees(90),
    })
  }

  // Front title + author (bottom of the front cover, inside the trim safe
  // area). Optional — skipped when the author turns it off (e.g. the art
  // already has the title). Over art it uses the same soft adaptive scrim as
  // the interior pages; on a plain colored cover it's just dark ink.
  if (showTitle) {
    const safeLeft = frontX + inset
    const safeRight = wPt - bleedPt - inset
    const maxW = safeRight - safeLeft
    const { size, lines } = fitFontSize(title, display, maxW, hPt * 0.28, 34, 16)
    const lineH = size * 1.3
    const textBottom = inset + bleedPt + 6

    const byline = author?.trim() ? `by ${author.trim()}` : ''
    const authorSize = Math.max(11, Math.round(size * 0.42))
    const extraLines = byline
      ? [{ text: byline, size: authorSize, lineH: authorSize * 1.3, font: body }]
      : []

    if (frontPngBytes) {
      await drawAdaptiveTextBand({
        doc,
        page,
        x: frontX,
        width: frontW,
        textBottom,
        band: frontBand,
        lines,
        size,
        lineH,
        font: display,
        extraLines,
      })
    } else {
      const gap = byline ? Math.max(3, size * 0.2) : 0
      const total =
        lines.length * lineH + gap + extraLines.reduce((s, l) => s + l.lineH, 0)
      let ty = textBottom + total - size
      for (const line of lines) {
        const lw = display.widthOfTextAtSize(line, size)
        page.drawText(line, {
          x: frontX + (frontW - lw) / 2,
          y: ty,
          size,
          font: display,
          color: INK,
        })
        ty -= lineH
      }
      ty -= gap
      for (const ex of extraLines) {
        const lw = ex.font.widthOfTextAtSize(ex.text, ex.size)
        page.drawText(ex.text, {
          x: frontX + (frontW - lw) / 2,
          y: ty,
          size: ex.size,
          font: ex.font,
          color: INK,
        })
        ty -= ex.lineH
      }
    }
  }

  // Back cover note.
  {
    const note = 'Made with Viola House'
    const s = 11
    const nw = body.widthOfTextAtSize(note, s)
    page.drawText(note, {
      x: (backW - nw) / 2,
      y: inset + bleedPt,
      size: s,
      font: body,
      color: rgb(0.5, 0.42, 0.46),
    })
  }

  return doc.save()
}
