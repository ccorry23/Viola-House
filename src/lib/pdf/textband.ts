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
 * A single smooth vertical alpha gradient as a PNG: transparent at the top,
 * ramping to `maxOpacity` at the bottom with a plateau behind the text. Drawing
 * it as one image (vs. many stacked strips) avoids seam lines between strips.
 */
function scrimPng(
  scrim: { r: number; g: number; b: number },
  maxOpacity: number,
  plateauMin: number,
  textTop: number,
  scrimTop: number
): Uint8Array {
  const w = 2
  const h = 512
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d')!
  const col = `${Math.round(scrim.r * 255)},${Math.round(scrim.g * 255)},${Math.round(
    scrim.b * 255
  )}`
  // Canvas top (offset 0) maps to the PDF box top (scrimTop); canvas bottom
  // (offset 1) maps to the page bottom, where the scrim is strongest.
  const midStop = Math.max(0, Math.min(1, 1 - textTop / scrimTop))
  const g = ctx.createLinearGradient(0, 0, 0, h)
  g.addColorStop(0, `rgba(${col},0)`)
  g.addColorStop(midStop, `rgba(${col},${plateauMin})`)
  g.addColorStop(1, `rgba(${col},${maxOpacity})`)
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
}): Promise<void> {
  const { doc, page, x, width, textBottom, band, lines, size, lineH, font } = opts

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
  const maxOpacity = lightArt ? 0.85 : 0.8
  const plateauMin = maxOpacity * 0.72

  const textBlockH = lines.length * lineH
  const textTop = textBottom + textBlockH
  const feather = size * 2.4
  const scrimTop = textTop + feather

  const img = await doc.embedPng(
    scrimPng(scrim, maxOpacity, plateauMin, textTop, scrimTop)
  )
  page.drawImage(img, { x, y: 0, width, height: scrimTop })

  // Faint halo (offset copies) then the crisp text on top.
  const o = Math.max(0.5, size * 0.04)
  const offsets: Array<[number, number]> = [
    [-o, 0],
    [o, 0],
    [0, -o],
    [0, o],
    [-o, -o],
    [o, o],
  ]
  let ty = textTop - size
  for (const line of lines) {
    const lw = font.widthOfTextAtSize(line, size)
    const lx = x + (width - lw) / 2
    for (const [dx, dy] of offsets) {
      page.drawText(line, {
        x: lx + dx,
        y: ty + dy,
        size,
        font,
        color: haloColor,
        opacity: 0.45,
      })
    }
    page.drawText(line, { x: lx, y: ty, size, font, color: textColor })
    ty -= lineH
  }
}
