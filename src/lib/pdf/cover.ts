'use client'

import { PDFDocument, rgb, degrees } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import {
  BLEED_IN,
  SAFE_MARGIN_IN,
  PT_PER_INCH,
  PRINT_DPI,
  TOP_ART_INSET_IN,
  HARDCOVER_HINGE_IN,
  TRIM_SIZES,
  coverWrapBoxIn,
  type BindingId,
  type TrimId,
} from '@/lib/kdp/constants'
import { loadPdfFonts } from './fonts'
import type { BodyFontId } from './bodyFonts'
import { fitFontSize, wrapText } from './text'
import {
  computeBandStyle,
  bakeScrim,
  drawBandText,
  type ExtraLine,
  type BandStyle,
} from './textband'
import { upscaleToImage, type BandStats } from './upscale'

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
  /** Front cover art (the cover image or page 1's art), or null for a plain
   *  colored cover. Sized to the front panel here, so it fits either binding. */
  frontImageBlob?: Blob | null
  /** Paperback (0.125" bleed) or hardcover (0.51" board wrap + 0.4" hinge). */
  binding?: BindingId
  /** Hardcover only: exact spine width (inches) from KDP's cover calculator. */
  spineOverrideIn?: number
  /** Author's chosen body font; used for the byline so it matches the interior. */
  bodyFont?: BodyFontId
  /** Back-cover blurb/description. Printed on the back cover when present. */
  blurb?: string
  /** Optional back-cover illustration. When set, it fills the back cover full-bleed
   *  and the blurb is layered over it (like the interior pages). */
  backImageBlob?: Blob | null
}

/**
 * Build the KDP full-wrap cover: back cover + spine + front cover on a single
 * page. Paperback: 0.125" bleed all around, spine from the page count (white
 * paper = 0.002252"/page). Hardcover (case laminate): the image extends 0.51"
 * past each outer trim edge to wrap the boards, text stays 0.4" clear of the
 * spine hinge, and the spine can be set from KDP's cover calculator. Spine text
 * is only added at ≥100 pages.
 */
export async function buildCoverPdf({
  title,
  author,
  showTitle = true,
  showAuthor = true,
  trimSize,
  pageCount,
  frontImageBlob,
  bodyFont,
  blurb,
  backImageBlob,
  binding = 'paperback',
  spineOverrideIn,
}: BuildCoverInput): Promise<Uint8Array> {
  const trim = TRIM_SIZES[trimSize]
  const wrap = coverWrapBoxIn(trim, pageCount, binding, spineOverrideIn)
  const wPt = wrap.w * PT_PER_INCH
  const hPt = wrap.h * PT_PER_INCH
  // Outer margin past the trim: bleed (paperback) or board wrap (hardcover).
  const outerPt = wrap.outer * PT_PER_INCH
  const trimWPt = trim.w * PT_PER_INCH
  const spinePt = wrap.spine * PT_PER_INCH
  const inset = SAFE_MARGIN_IN * PT_PER_INCH
  // Keep text clear of the spine side: the safe margin, or the hardcover hinge.
  const spineClear =
    binding === 'hardcover'
      ? Math.max(inset, HARDCOVER_HINGE_IN * PT_PER_INCH)
      : inset

  const doc = await PDFDocument.create()
  doc.registerFontkit(fontkit)
  const fonts = await loadPdfFonts(bodyFont)
  const display = await doc.embedFont(fonts.display, { subset: true })
  const body = await doc.embedFont(fonts.body, { subset: true })

  const page = doc.addPage([wPt, hPt])

  // Region boundaries (left → right): back | spine | front.
  const backW = outerPt + trimWPt
  const spineX = backW
  const frontX = backW + spinePt
  const frontW = trimWPt + outerPt

  // --- Back cover ---------------------------------------------------------
  // With an illustration: it fills the back cover full-bleed and the blurb is
  // layered over it in a soft readable band — the same treatment as the interior
  // pages (scrim baked into the art pixels for KDP-safe opacity, halo text on
  // top). Without one: a plain coloured panel with the blurb centred.
  // Either way the blurb sits ABOVE a clear ~1.6" bottom strip reserved for the
  // barcode KDP auto-adds to the back cover.
  const BARCODE_RESERVE_IN = 1.6
  const backColLeft = outerPt + inset
  const backColW = backW - spineClear - backColLeft
  const backTopY = hPt - outerPt - inset
  const backTextBottom = outerPt + BARCODE_RESERVE_IN * PT_PER_INCH
  const hasBlurb = Boolean(blurb?.trim())

  // Wrap the blurb (honouring line breaks; a blank line is a paragraph gap) and
  // pick the largest body size that fits between the barcode strip and the top.
  const backLayout = (size: number): string[] => {
    const out: string[] = []
    for (const raw of (blurb ?? '').split('\n')) {
      const t = raw.trim()
      if (!t) {
        out.push('')
        continue
      }
      for (const wl of wrapText(t, body, size, backColW)) out.push(wl)
    }
    return out
  }
  const backAvailH = backTopY - backTextBottom
  const backLineGapK = 1.4
  let backSize = 15
  let backLines = backLayout(backSize)
  for (; backSize >= 9; backSize--) {
    backLines = backLayout(backSize)
    if (backLines.length * backSize * backLineGapK <= backAvailH) break
  }
  const backLineH = backSize * backLineGapK

  if (backImageBlob) {
    // Cover-fit the art to the back panel (full bleed), bake a soft scrim behind
    // the blurb, then draw the art + halo text — exactly like an interior page.
    const backWpx = Math.round((backW / PT_PER_INCH) * PRINT_DPI)
    const backHpx = Math.round((hPt / PT_PER_INCH) * PRINT_DPI)
    const up = await upscaleToImage(backImageBlob, backWpx, backHpx)

    if (hasBlurb) {
      const style = computeBandStyle(
        up.band,
        backTextBottom,
        backLines.length,
        backSize,
        backLineH
      )
      const composited = await bakeScrim(up.jpg, hPt, style)
      const img = await doc.embedJpg(composited)
      page.drawImage(img, { x: 0, y: 0, width: backW, height: hPt })
      drawBandText({
        page,
        x: backColLeft,
        width: backColW,
        lines: backLines,
        size: backSize,
        lineH: backLineH,
        font: body,
        style,
      })
    } else {
      const img = await doc.embedJpg(up.jpg)
      page.drawImage(img, { x: 0, y: 0, width: backW, height: hPt })
    }
  } else {
    // No art: plain coloured panel with the blurb centred in dark ink.
    page.drawRectangle({ x: 0, y: 0, width: backW, height: hPt, color: BACK_BG })
    if (hasBlurb) {
      const blockH = backLines.length * backLineH
      let ty = backTextBottom + Math.max(0, (backAvailH + blockH) / 2) - backSize
      for (const line of backLines) {
        if (line) {
          const lw = body.widthOfTextAtSize(line, backSize)
          page.drawText(line, {
            x: backColLeft + (backColW - lw) / 2,
            y: ty,
            size: backSize,
            font: body,
            color: INK,
          })
        }
        ty -= backLineH
      }
    }
  }

  // Front art: cover-fit to the front panel (so it fits either binding's panel
  // shape), with the top art inset measured from the TRIM rather than the file
  // edge — otherwise hardcover art would be pushed into the board wrap.
  let frontImageBytes: Uint8Array | null = null
  let frontBand: BandStats | undefined
  if (frontImageBlob) {
    const fwPx = Math.round((frontW / PT_PER_INCH) * PRINT_DPI)
    const fhPx = Math.round((hPt / PT_PER_INCH) * PRINT_DPI)
    const topInsetIn = wrap.outer + (TOP_ART_INSET_IN - BLEED_IN)
    const up = await upscaleToImage(
      frontImageBlob,
      fwPx,
      fhPx,
      Math.round(topInsetIn * PRINT_DPI)
    )
    frontImageBytes = up.jpg
    frontBand = up.band
  }

  // Front text column: inside the trim safe area, clear of the spine/hinge.
  const frontSafeLeft = frontX + spineClear
  const frontSafeW = wPt - outerPt - inset - frontSafeLeft

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
    const maxW = frontSafeW
    const textBottom = inset + outerPt + 6

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
        x: frontSafeLeft,
        width: frontSafeW,
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
          x: frontSafeLeft + (frontSafeW - lw) / 2,
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
          x: frontSafeLeft + (frontSafeW - lw) / 2,
          y: ty,
          size: ex.size,
          font: ex.font,
          color: INK,
        })
        ty -= ex.lineH
      }
    }
  }

  // Back cover note — only on the plain (no-art) back cover, where it's legible
  // and out of the barcode corner. Omitted over a full-bleed illustration.
  if (!backImageBlob) {
    const note = 'Made with Viola House'
    const s = 11
    const nw = body.widthOfTextAtSize(note, s)
    page.drawText(note, {
      x: (backW - nw) / 2,
      y: inset + outerPt,
      size: s,
      font: body,
      color: rgb(0.5, 0.42, 0.46),
    })
  }

  // See interior.ts for why: classic xref table, not compressed object
  // streams — broader compatibility with print-on-demand PDF processors.
  return doc.save({ useObjectStreams: false })
}
