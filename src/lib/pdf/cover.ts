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
import {
  computeBandStyle,
  bakeScrim,
  drawBandText,
  type ExtraLine,
  type BandStyle,
} from './textband'
import type { BandStats } from './upscale'

const ACCENT = rgb(0.71, 0.28, 0.42)
const BACK_BG = rgb(0.96, 0.89, 0.92)
const INK = rgb(0.17, 0.13, 0.09)
const WHITE = rgb(1, 1, 1)

export interface BuildCoverInput {
  title: string
  /** Author name for the byline (blank to omit). */
  author?: string
  /** Whether to print the title on the front cover. */
  showTitle?: boolean
  /** Whether to print the author byline on the front cover. */
  showAuthor?: boolean
  trimSize: TrimId
  /** Interior page count — drives spine width. */
  pageCount: number
  /** Front cover art (upscaled JPEG), or null for a plain colored cover. */
  frontImageBytes: Uint8Array | null
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
  showAuthor = true,
  trimSize,
  pageCount,
  frontImageBytes,
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

  // Front title and/or author (bottom of the front cover, inside the trim safe
  // area). Each is independently optional — turning one off is useful when the
  // cover art already has that text printed on it. Computed BEFORE the front
  // art is drawn so its soft fade can be baked into the art (seamless), just
  // like the interior pages. On a plain colored cover it's plain dark ink.
  const byline = author?.trim() ? `by ${author.trim()}` : ''
  const wantTitle = showTitle
  const wantAuthor = showAuthor && Boolean(byline)
  let titlePlan: {
    mainLines: string[]
    mainSize: number
    mainFont: typeof display
    lineH: number
    extraLines: ExtraLine[]
    textBottom: number
    style?: BandStyle
  } | null = null

  if (wantTitle || wantAuthor) {
    const safeLeft = frontX + inset
    const safeRight = wPt - bleedPt - inset
    const maxW = safeRight - safeLeft
    const textBottom = inset + bleedPt + 6

    // The title is the main (largest) text; the byline is a smaller line under
    // it. With the title hidden, the byline becomes the main line instead.
    let mainLines: string[]
    let mainSize: number
    let mainFont = display
    let extraLines: ExtraLine[] = []

    if (wantTitle) {
      const fit = fitFontSize(title, display, maxW, hPt * 0.28, 34, 16)
      mainLines = fit.lines
      mainSize = fit.size
      if (wantAuthor) {
        const authorSize = Math.max(11, Math.round(mainSize * 0.42))
        extraLines = [
          { text: byline, size: authorSize, lineH: authorSize * 1.3, font: body },
        ]
      }
    } else {
      const fit = fitFontSize(byline, body, maxW, hPt * 0.12, 22, 13)
      mainLines = fit.lines
      mainSize = fit.size
      mainFont = body
    }
    const lineH = mainSize * 1.3
    titlePlan = { mainLines, mainSize, mainFont, lineH, extraLines, textBottom }
    if (frontImageBytes) {
      titlePlan.style = computeBandStyle(
        frontBand,
        textBottom,
        mainLines.length,
        mainSize,
        lineH,
        extraLines
      )
    }
  }

  // Front cover art — with the title band's soft fade baked in (seamless,
  // opaque) when there's art + a title band.
  let frontToDraw = frontImageBytes
  if (frontImageBytes && titlePlan?.style) {
    frontToDraw = await bakeScrim(frontImageBytes, hPt, titlePlan.style)
  }
  if (frontToDraw) {
    const img = await doc.embedJpg(frontToDraw)
    page.drawImage(img, { x: frontX, y: 0, width: frontW, height: hPt })
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

  // Front title/author text, drawn on top of the (composited) front art.
  if (titlePlan) {
    if (titlePlan.style) {
      drawBandText({
        page,
        x: frontX,
        width: frontW,
        lines: titlePlan.mainLines,
        size: titlePlan.mainSize,
        lineH: titlePlan.lineH,
        font: titlePlan.mainFont,
        extraLines: titlePlan.extraLines,
        style: titlePlan.style,
      })
    } else {
      // Plain colored cover (no art): dark ink title + byline.
      const { mainLines, mainSize, mainFont, lineH, extraLines, textBottom } =
        titlePlan
      const gap = extraLines.length ? Math.max(3, mainSize * 0.2) : 0
      const total =
        mainLines.length * lineH +
        gap +
        extraLines.reduce((s, l) => s + l.lineH, 0)
      let ty = textBottom + total - mainSize
      for (const line of mainLines) {
        const lw = mainFont.widthOfTextAtSize(line, mainSize)
        page.drawText(line, {
          x: frontX + (frontW - lw) / 2,
          y: ty,
          size: mainSize,
          font: mainFont,
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

  // See interior.ts for why: classic xref table, not compressed object
  // streams — broader compatibility with print-on-demand PDF processors.
  return doc.save({ useObjectStreams: false })
}
