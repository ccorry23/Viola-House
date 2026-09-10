'use client'

import { rgb, type PDFPage, type PDFFont } from 'pdf-lib'
import type { BandStats } from './upscale'

type Color = ReturnType<typeof rgb>

const INK = rgb(0.17, 0.13, 0.09)
const WHITE = rgb(1, 1, 1)
const lerp = (a: number, b: number, t: number) => a + (b - a) * t

/** An extra line (e.g. an author byline) drawn below the main text, smaller. */
export interface ExtraLine {
  text: string
  size: number
  lineH: number
  font: PDFFont
}

export interface BandStyle {
  textColor: Color
  haloColor: Color
  /** Scrim colour (0..1), tinted from the art. */
  scrim: { r: number; g: number; b: number }
  /** Blend fractions toward the scrim colour at the bottom / behind the text. */
  maxBlend: number
  plateauBlend: number
  /** PDF y (from page bottom) of the top of the text block and of the scrim. */
  textTop: number
  scrimTop: number
  /** Extra spacing between the main lines and any extra (byline) lines. */
  gap: number
}

/**
 * Adaptive colours + geometry for the text band, chosen from the art beneath:
 * light scrim + dark text over bright art, dark scrim + light text over dark
 * art, tinted from the art's own colour. Pure — no drawing.
 */
export function computeBandStyle(
  band: BandStats | undefined,
  textBottom: number,
  lineCount: number,
  size: number,
  lineH: number,
  extraLines: ExtraLine[] = []
): BandStyle {
  const lum = band?.luminance ?? 0.5
  const br = band?.r ?? 0.5
  const bg = band?.g ?? 0.5
  const bb = band?.b ?? 0.5
  const lightArt = lum >= 0.6

  const scrim = lightArt
    ? { r: lerp(br, 1, 0.9), g: lerp(bg, 1, 0.9), b: lerp(bb, 1, 0.9) }
    : { r: br * 0.14, g: bg * 0.14, b: bb * 0.14 }
  const textColor = lightArt ? INK : WHITE
  const haloColor = lightArt ? WHITE : rgb(0.05, 0.04, 0.03)
  const maxBlend = lightArt ? 0.85 : 0.8
  const plateauBlend = maxBlend * 0.72

  const extrasH = extraLines.reduce((s, l) => s + l.lineH, 0)
  const gap = extraLines.length ? Math.max(3, size * 0.2) : 0
  const totalH = lineCount * lineH + gap + extrasH
  const textTop = textBottom + totalH
  const feather = size * 2.4
  const scrimTop = textTop + feather

  return { textColor, haloColor, scrim, maxBlend, plateauBlend, textTop, scrimTop, gap }
}

/**
 * Composite the soft gradient scrim directly INTO the art's pixels and return a
 * fully OPAQUE JPEG. Because the gradient is alpha-composited onto the real
 * picture on a canvas, it fades seamlessly into the art above the text with no
 * visible top edge — then the JPEG output flattens it to opaque pixels, so the
 * PDF carries no transparency at all (safe for print processors like KDP).
 * `regionHeightPt` is the PDF height the art image spans (a full page, or the
 * full cover height for the front-cover art).
 */
export async function bakeScrim(
  artJpg: Uint8Array,
  regionHeightPt: number,
  style: BandStyle
): Promise<Uint8Array> {
  const bmp = await createImageBitmap(new Blob([artJpg as BlobPart], { type: 'image/jpeg' }))
  const c = document.createElement('canvas')
  c.width = bmp.width
  c.height = bmp.height
  const ctx = c.getContext('2d', { alpha: false })!
  ctx.drawImage(bmp, 0, 0)
  bmp.close?.()

  // PDF y grows up from the page bottom; canvas y grows down from the top.
  const scale = c.height / regionHeightPt
  const scrimTopY = Math.max(0, c.height - style.scrimTop * scale)
  const textTopY = c.height - style.textTop * scale
  const { r, g, b } = style.scrim
  const col = `${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)}`

  const grad = ctx.createLinearGradient(0, scrimTopY, 0, c.height)
  grad.addColorStop(0, `rgba(${col},0)`)
  const midStop = Math.max(0, Math.min(1, (textTopY - scrimTopY) / (c.height - scrimTopY)))
  grad.addColorStop(midStop, `rgba(${col},${style.plateauBlend})`)
  grad.addColorStop(1, `rgba(${col},${style.maxBlend})`)
  ctx.fillStyle = grad
  ctx.fillRect(0, scrimTopY, c.width, c.height - scrimTopY)

  const out = await new Promise<Blob | null>((res) => c.toBlob(res, 'image/jpeg', 0.9))
  if (!out) throw new Error('Scrim composite failed')
  return new Uint8Array(await out.arrayBuffer())
}

/** Draw the band's text (+ a solid halo) as crisp vector text on the PDF. */
export function drawBandText(opts: {
  page: PDFPage
  x: number
  width: number
  lines: string[]
  size: number
  lineH: number
  font: PDFFont
  extraLines?: ExtraLine[]
  style: BandStyle
}) {
  const { page, x, width, lines, size, lineH, font, style } = opts
  const extraLines = opts.extraLines ?? []
  const { textColor, haloColor, textTop, gap } = style

  const drawRow = (text: string, rSize: number, rFont: PDFFont, ty: number) => {
    const o = Math.max(0.5, rSize * 0.04)
    const offsets: Array<[number, number]> = [
      [-o, 0],
      [o, 0],
      [0, -o],
      [0, o],
      [-o, -o],
      [o, o],
    ]
    const lw = rFont.widthOfTextAtSize(text, rSize)
    const lx = x + (width - lw) / 2
    for (const [dx, dy] of offsets) {
      page.drawText(text, { x: lx + dx, y: ty + dy, size: rSize, font: rFont, color: haloColor })
    }
    page.drawText(text, { x: lx, y: ty, size: rSize, font: rFont, color: textColor })
  }

  let ty = textTop - size
  for (const line of lines) {
    drawRow(line, size, font, ty)
    ty -= lineH
  }
  ty -= gap
  for (const ex of extraLines) {
    drawRow(ex.text, ex.size, ex.font, ty)
    ty -= ex.lineH
  }
}
