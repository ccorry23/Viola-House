'use client'

import { rgb, type PDFDocument, type PDFPage, type PDFFont } from 'pdf-lib'
import type { BandStats } from './upscale'

const INK = rgb(0.17, 0.13, 0.09)
const WHITE = rgb(1, 1, 1)
const lerp = (a: number, b: number, t: number) => a + (b - a) * t

function dataUrlToBytes(url: string): Uint8Array {
  const b64 = url.split(',')[1] ?? ''
  const bin = atob(b64)
  const arr = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i)
  return arr
}

/**
 * A single smooth vertical gradient as a fully OPAQUE PNG — no alpha channel,
 * no PDF-level transparency. Print pipelines (KDP's cover/interior processor
 * included) are considerably more reliable with flattened, opaque PDFs, so
 * instead of true alpha-compositing the scrim color over the art, we
 * pre-blend it: the gradient runs from the art's own average colour (`bg`,
 * i.e. visually "no scrim yet") up top, to the full scrim colour by the
 * plateau behind the text. Since every pixel is fully opaque, embedding this
 * image never introduces a soft mask.
 */
function scrimPng(
  scrim: { r: number; g: number; b: number },
  bg: { r: number; g: number; b: number },
  maxBlend: number,
  plateauBlend: number,
  textTop: number,
  scrimTop: number
): Uint8Array {
  const w = 2
  const h = 512
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d', { alpha: false })!
  const bgCol = `${Math.round(bg.r * 255)},${Math.round(bg.g * 255)},${Math.round(bg.b * 255)}`
  const mid = {
    r: lerp(bg.r, scrim.r, plateauBlend),
    g: lerp(bg.g, scrim.g, plateauBlend),
    b: lerp(bg.b, scrim.b, plateauBlend),
  }
  const midCol = `${Math.round(mid.r * 255)},${Math.round(mid.g * 255)},${Math.round(mid.b * 255)}`
  const full = {
    r: lerp(bg.r, scrim.r, maxBlend),
    g: lerp(bg.g, scrim.g, maxBlend),
    b: lerp(bg.b, scrim.b, maxBlend),
  }
  const fullCol = `${Math.round(full.r * 255)},${Math.round(full.g * 255)},${Math.round(full.b * 255)}`
  // Canvas top (offset 0) maps to the PDF box top (scrimTop); canvas bottom
  // (offset 1) maps to the page bottom, where the scrim is strongest.
  const midStop = Math.max(0, Math.min(1, 1 - textTop / scrimTop))
  const g = ctx.createLinearGradient(0, 0, 0, h)
  g.addColorStop(0, `rgb(${bgCol})`)
  g.addColorStop(midStop, `rgb(${midCol})`)
  g.addColorStop(1, `rgb(${fullCol})`)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)
  return dataUrlToBytes(c.toDataURL('image/png'))
}

/**
 * Draw text over full-bleed art so it reads on any book's colours without a
 * pasted-on box: a soft, seamless gradient scrim rising from the bottom edge of
 * the region and feathering to nothing above the text, adapted to the art
 * beneath (light scrim + dark text over bright art; dark scrim + light text
 * over dark art, tinted from the art's own colour), plus a faint per-letter
 * halo. Works for a full page (interior) or a sub-region (the cover front).
 */
/** An extra line (e.g. an author byline) drawn below the main text, smaller. */
export interface ExtraLine {
  text: string
  size: number
  lineH: number
  font: PDFFont
}

export async function drawAdaptiveTextBand(opts: {
  doc: PDFDocument
  page: PDFPage
  /** Left edge and width of the region the scrim + text span. */
  x: number
  width: number
  /** PDF y where the bottom line of text sits (inside the safe margin). */
  textBottom: number
  band: BandStats | undefined
  lines: string[]
  size: number
  lineH: number
  font: PDFFont
  /** Optional smaller lines (e.g. "by Jane Doe") drawn beneath the main text. */
  extraLines?: ExtraLine[]
}): Promise<void> {
  const { doc, page, x, width, textBottom, band, lines, size, lineH, font } = opts
  const extraLines = opts.extraLines ?? []

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
  // Blend fractions toward the scrim colour (0 = art's own colour, 1 = full
  // scrim) — not alpha; the gradient PNG is fully opaque (see scrimPng).
  const maxOpacity = lightArt ? 0.85 : 0.8
  const plateauMin = maxOpacity * 0.72

  const extrasH = extraLines.reduce((s, l) => s + l.lineH, 0)
  const gap = extraLines.length ? Math.max(3, size * 0.2) : 0
  const totalH = lines.length * lineH + gap + extrasH
  const textTop = textBottom + totalH
  const feather = size * 2.4
  const scrimTop = textTop + feather

  const img = await doc.embedPng(
    scrimPng(scrim, { r: br, g: bg, b: bb }, maxOpacity, plateauMin, textTop, scrimTop)
  )
  page.drawImage(img, { x, y: 0, width, height: scrimTop })

  // Draw one centered line with a solid halo (opaque — no PDF transparency),
  // then the crisp text on top. The halo sits fully inside the plateau, which
  // is already near-solid scrim colour, so a solid halo reads the same as a
  // faint one while keeping the whole file flat/opaque for print processors.
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
