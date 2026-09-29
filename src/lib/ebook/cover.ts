'use client'

import { PDFDocument, type PDFFont } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import { PT_PER_INCH, SAFE_MARGIN_IN, TRIM_SIZES, type TrimId } from '@/lib/kdp/constants'
import { loadPdfFonts } from '@/lib/pdf/fonts'
import { bodyFontDef, type BodyFontId } from '@/lib/pdf/bodyFonts'
import { fitFontSize } from '@/lib/pdf/text'
import { computeBandStyle, bakeScrim, type ExtraLine, type BandStyle } from '@/lib/pdf/textband'
import { upscaleToImage } from '@/lib/pdf/upscale'

/**
 * KDP recommends eBook covers 2560 px on the long side (JPG, RGB). We keep the
 * book's own shape (square stays square) so the cover matches the pages.
 */
export const EBOOK_COVER_LONG_PX = 2560

export function ebookCoverSizePx(trimSize: TrimId): { w: number; h: number } {
  const t = TRIM_SIZES[trimSize]
  const long = Math.max(t.w, t.h)
  return {
    w: Math.round((EBOOK_COVER_LONG_PX * t.w) / long),
    h: Math.round((EBOOK_COVER_LONG_PX * t.h) / long),
  }
}

const PLAIN_BG = 'rgb(245, 227, 235)'
const INK = 'rgb(43, 33, 23)'

type RGBish = { red: number; green: number; blue: number }
const css = (c: RGBish) =>
  `rgb(${Math.round(c.red * 255)}, ${Math.round(c.green * 255)}, ${Math.round(c.blue * 255)})`

/**
 * Render the Kindle eBook cover as a JPEG: the front cover art with the same
 * title/byline band as the printed cover (same fonts, sizes, soft fade and
 * outline), but with no bleed or spine. Layout is computed in points on a
 * trim-sized page — exactly like the print cover — then drawn on a canvas
 * scaled to the target pixel size.
 */
export async function renderEbookCover({
  title,
  author,
  showTitle = true,
  showAuthor = true,
  trimSize,
  frontImageBlob,
  bodyFont,
}: {
  title: string
  author?: string
  showTitle?: boolean
  showAuthor?: boolean
  trimSize: TrimId
  frontImageBlob: Blob | null
  bodyFont?: BodyFontId
}): Promise<Uint8Array> {
  const trim = TRIM_SIZES[trimSize]
  const wPt = trim.w * PT_PER_INCH
  const hPt = trim.h * PT_PER_INCH
  const { w: W, h: H } = ebookCoverSizePx(trimSize)
  const s = W / wPt

  // Measure with the same embedded fonts the print cover uses.
  const doc = await PDFDocument.create()
  doc.registerFontkit(fontkit)
  const fonts = await loadPdfFonts(bodyFont)
  const display = await doc.embedFont(fonts.display)
  const body = await doc.embedFont(fonts.body)

  // Canvas draws with the same TTFs via the app's @font-face families.
  const displayFamily = '"VH Fraunces"'
  const bodyFamily = bodyFontDef(bodyFont).previewStack.split(',')[0].trim()
  if ('fonts' in document) {
    await Promise.all([
      document.fonts.load(`40px ${displayFamily}`),
      document.fonts.load(`40px ${bodyFamily}`),
    ]).catch(() => {})
  }
  const familyOf = (f: PDFFont) => (f === display ? displayFamily : bodyFamily)

  // --- Title plan (mirrors cover.ts) ---
  const inset = SAFE_MARGIN_IN * PT_PER_INCH
  const maxW = wPt - inset * 2
  const textBottom = inset + 6
  const byline = author?.trim() ? `by ${author.trim()}` : ''
  const wantAuthor = showAuthor && Boolean(byline)
  let plan: {
    lines: string[]
    size: number
    font: PDFFont
    lineH: number
    extras: ExtraLine[]
  } | null = null
  if (showTitle) {
    const fit = fitFontSize(title, display, maxW, hPt * 0.28, 34, 16)
    const extras: ExtraLine[] = []
    if (wantAuthor) {
      const authorSize = Math.max(11, Math.round(fit.size * 0.42))
      extras.push({ text: byline, size: authorSize, lineH: authorSize * 1.3, font: body })
    }
    plan = { lines: fit.lines, size: fit.size, font: display, lineH: fit.size * 1.3, extras }
  } else if (wantAuthor) {
    const fit = fitFontSize(byline, body, maxW, hPt * 0.12, 22, 13)
    plan = { lines: fit.lines, size: fit.size, font: body, lineH: fit.size * 1.3, extras: [] }
  }

  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d', { alpha: false })!

  let style: BandStyle | undefined
  if (frontImageBlob) {
    // Screens have no trim, so no top inset is needed.
    const up = await upscaleToImage(frontImageBlob, W, H, 0)
    let art = up.jpg
    if (plan) {
      style = computeBandStyle(up.band, textBottom, plan.lines.length, plan.size, plan.lineH, plan.extras)
      art = await bakeScrim(up.jpg, hPt, style)
    }
    const bmp = await createImageBitmap(new Blob([art as BlobPart], { type: 'image/jpeg' }))
    ctx.drawImage(bmp, 0, 0, W, H)
    bmp.close?.()
  } else {
    ctx.fillStyle = PLAIN_BG
    ctx.fillRect(0, 0, W, H)
  }

  if (plan) {
    ctx.textAlign = 'center'
    ctx.textBaseline = 'alphabetic'
    const cx = W / 2
    const textColor = style ? css(style.textColor) : INK
    const haloColor = style ? css(style.haloColor) : null
    const ring = (r: number): Array<[number, number]> =>
      Array.from({ length: 8 }, (_, i) => {
        const a = (i / 8) * Math.PI * 2
        return [Math.cos(a) * r, Math.sin(a) * r] as [number, number]
      })

    // PDF-style y (points up from the bottom) → canvas pixels.
    const drawRow = (text: string, size: number, font: PDFFont, yPt: number) => {
      ctx.font = `${size * s}px ${familyOf(font)}`
      const y = (hPt - yPt) * s
      if (haloColor) {
        ctx.fillStyle = haloColor
        const offsets = [...ring(Math.max(0.8, size * 0.05)), ...ring(Math.max(1.3, size * 0.085))]
        for (const [dx, dy] of offsets) ctx.fillText(text, cx + dx * s, y - dy * s)
      }
      ctx.fillStyle = textColor
      ctx.fillText(text, cx, y)
    }

    const gap = style ? style.gap : plan.extras.length ? Math.max(3, plan.size * 0.2) : 0
    const extrasH = plan.extras.reduce((sum, l) => sum + l.lineH, 0)
    const textTop = style ? style.textTop : textBottom + plan.lines.length * plan.lineH + gap + extrasH
    let ty = textTop - plan.size
    for (const line of plan.lines) {
      drawRow(line, plan.size, plan.font, ty)
      ty -= plan.lineH
    }
    ty -= gap
    for (const ex of plan.extras) {
      drawRow(ex.text, ex.size, ex.font, ty)
      ty -= ex.lineH
    }
  }

  const out = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', 0.92))
  if (!out) throw new Error('Could not make the eBook cover')
  return new Uint8Array(await out.arrayBuffer())
}
