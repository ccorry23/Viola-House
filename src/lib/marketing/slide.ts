'use client'

/**
 * Renders an Amazon A+ Content "Image & Text Overlay" marketing image at the
 * recommended 1940×600, entirely on a canvas. Two layouts:
 *  - 'overlay': the illustration full-bleed with a soft dark scrim on the left
 *    and white headline + benefit lines over it.
 *  - 'split':   a soft colour panel on the left with dark headline + benefits,
 *    the illustration on the right.
 *
 * Output is JPEG (q≈0.92) so it stays comfortably under A+'s 3 MB limit while
 * looking crisp at banner size. Uses the bundled "VH Fraunces"/"VH Nunito"
 * @font-face families so the type matches the rest of the app.
 */

export type SlideTemplate = 'overlay' | 'split'

export interface SlideInput {
  imageBlob: Blob | null
  headline: string
  bullets: string[]
  template: SlideTemplate
  /** Brand accent (hex). Defaults to the app's viola purple. */
  accent?: string
}

export const SLIDE_W = 1940
export const SLIDE_H = 600

const INK = '#2b2118'
const CREAM = '#faf5ec'
const PANEL_LIGHT = '#f1eaf7'

async function ensureFonts() {
  if (!('fonts' in document)) return
  try {
    await Promise.all([
      document.fonts.load('700 80px "VH Fraunces"'),
      document.fonts.load('600 40px "VH Nunito"'),
      document.fonts.load('400 40px "VH Nunito"'),
    ])
    await document.fonts.ready
  } catch {
    // Fall back to system fonts if loading fails.
  }
}

function wrap(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxW: number
): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let line = ''
  for (const w of words) {
    const trial = line ? `${line} ${w}` : w
    if (ctx.measureText(trial).width > maxW && line) {
      lines.push(line)
      line = w
    } else {
      line = trial
    }
  }
  if (line) lines.push(line)
  return lines
}

function drawCover(
  ctx: CanvasRenderingContext2D,
  bmp: ImageBitmap,
  x: number,
  y: number,
  w: number,
  h: number
) {
  const s = Math.max(w / bmp.width, h / bmp.height)
  const dw = bmp.width * s
  const dh = bmp.height * s
  ctx.drawImage(bmp, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh)
}

export async function renderAplusSlide(input: SlideInput): Promise<Uint8Array> {
  const { headline, bullets, template } = input
  const accent = input.accent || '#7c5c9c'
  await ensureFonts()

  const canvas = document.createElement('canvas')
  canvas.width = SLIDE_W
  canvas.height = SLIDE_H
  const ctx = canvas.getContext('2d', { alpha: false })!
  ctx.textBaseline = 'alphabetic'

  const bmp = input.imageBlob
    ? await createImageBitmap(input.imageBlob)
    : null

  // Text region geometry per template.
  let textX: number
  let textW: number
  let headColor: string
  let bodyColor: string

  if (template === 'split') {
    const panelW = Math.round(SLIDE_W * 0.44)
    // Left panel.
    ctx.fillStyle = PANEL_LIGHT
    ctx.fillRect(0, 0, panelW, SLIDE_H)
    // Right image (or a soft tint if none).
    if (bmp) drawCover(ctx, bmp, panelW, 0, SLIDE_W - panelW, SLIDE_H)
    else {
      ctx.fillStyle = CREAM
      ctx.fillRect(panelW, 0, SLIDE_W - panelW, SLIDE_H)
    }
    textX = 90
    textW = panelW - 150
    headColor = INK
    bodyColor = '#4a4038'
  } else {
    // overlay: full-bleed image + left scrim.
    if (bmp) drawCover(ctx, bmp, 0, 0, SLIDE_W, SLIDE_H)
    else {
      const g = ctx.createLinearGradient(0, 0, SLIDE_W, SLIDE_H)
      g.addColorStop(0, accent)
      g.addColorStop(1, '#3a2a4a')
      ctx.fillStyle = g
      ctx.fillRect(0, 0, SLIDE_W, SLIDE_H)
    }
    const scrim = ctx.createLinearGradient(0, 0, SLIDE_W * 0.62, 0)
    scrim.addColorStop(0, 'rgba(24,17,32,0.82)')
    scrim.addColorStop(0.6, 'rgba(24,17,32,0.55)')
    scrim.addColorStop(1, 'rgba(24,17,32,0)')
    ctx.fillStyle = scrim
    ctx.fillRect(0, 0, SLIDE_W, SLIDE_H)
    textX = 96
    textW = Math.round(SLIDE_W * 0.5)
    headColor = '#ffffff'
    bodyColor = '#f3eef8'
  }

  // Lay out headline (Fraunces) — largest size that fits ~40% of the height.
  const headMax = SLIDE_H * 0.44
  let headSize = 92
  let headLines: string[] = []
  const headLineGap = 1.12
  for (; headSize >= 44; headSize -= 2) {
    ctx.font = `700 ${headSize}px "VH Fraunces", Georgia, serif`
    headLines = wrap(ctx, headline.trim() || ' ', textW)
    if (headLines.length * headSize * headLineGap <= headMax) break
  }

  // Bullets (Nunito).
  const bulletList = bullets.map((b) => b.trim()).filter(Boolean).slice(0, 3)
  const bulletSize = 40
  const bulletLineGap = 1.3
  const bulletGapAbove = 34
  ctx.font = `600 ${bulletSize}px "VH Nunito", system-ui, sans-serif`
  const bulletWrapped = bulletList.map((b) => wrap(ctx, b, textW - 44))

  // Total block height for vertical centering.
  const headBlockH = headLines.length * headSize * headLineGap
  const bulletBlockH = bulletWrapped.reduce(
    (s, lines) => s + lines.length * bulletSize * bulletLineGap + 10,
    0
  )
  const totalH = headBlockH + (bulletList.length ? bulletGapAbove + bulletBlockH : 0)
  let y = Math.max(64, (SLIDE_H - totalH) / 2) + headSize

  // Draw headline.
  ctx.fillStyle = headColor
  ctx.font = `700 ${headSize}px "VH Fraunces", Georgia, serif`
  for (const line of headLines) {
    ctx.fillText(line, textX, y)
    y += headSize * headLineGap
  }

  // Draw bullets with a small accent marker.
  if (bulletList.length) {
    y += bulletGapAbove - headSize * (headLineGap - 1)
    ctx.font = `600 ${bulletSize}px "VH Nunito", system-ui, sans-serif`
    for (const lines of bulletWrapped) {
      let first = true
      for (const line of lines) {
        if (first) {
          ctx.fillStyle = accent
          ctx.beginPath()
          ctx.arc(textX + 9, y - bulletSize * 0.32, 9, 0, Math.PI * 2)
          ctx.fill()
        }
        ctx.fillStyle = bodyColor
        ctx.fillText(line, textX + 44, y)
        y += bulletSize * bulletLineGap
        first = false
      }
      y += 10
    }
  }

  bmp?.close?.()

  const out = await new Promise<Blob | null>((res) =>
    canvas.toBlob(res, 'image/jpeg', 0.92)
  )
  if (!out) throw new Error('Could not render the marketing image')
  return new Uint8Array(await out.arrayBuffer())
}
