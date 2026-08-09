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

const ACCENT = rgb(0.71, 0.28, 0.42)
const BACK_BG = rgb(0.96, 0.89, 0.92)
const INK = rgb(0.17, 0.13, 0.09)
const WHITE = rgb(1, 1, 1)

export interface BuildCoverInput {
  title: string
  trimSize: TrimId
  /** Interior page count — drives spine width. */
  pageCount: number
  /** Front cover art (upscaled PNG), or null for a plain colored cover. */
  frontPngBytes: Uint8Array | null
}

/**
 * Build the KDP full-wrap paperback cover: back cover + spine + front cover on
 * a single page, with 0.125" bleed all around and a spine sized from the page
 * count (white paper = 0.002252"/page). Spine text is only added at ≥100 pages,
 * per KDP's rule.
 */
export async function buildCoverPdf({
  title,
  trimSize,
  pageCount,
  frontPngBytes,
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

  // Front title band (bottom third, inside the front trim safe area).
  {
    const safeLeft = frontX + inset
    const safeRight = wPt - bleedPt - inset
    const maxW = safeRight - safeLeft
    const { size, lines } = fitFontSize(title, display, maxW, hPt * 0.3, 34, 16)
    const lineH = size * 1.25
    const bandH = lines.length * lineH + 28
    const bandY = inset + bleedPt
    page.drawRectangle({
      x: safeLeft - 8,
      y: bandY,
      width: maxW + 16,
      height: bandH,
      color: WHITE,
      opacity: frontPngBytes ? 0.85 : 1,
    })
    let ty = bandY + bandH - 16 - size
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
  }

  // Back cover note.
  {
    const note = 'Made with Storybook'
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
