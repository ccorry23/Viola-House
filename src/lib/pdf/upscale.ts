'use client'

/**
 * Brightness + average color of the strip of art where the story text sits, so
 * the text treatment can adapt per page (light scrim + dark text over bright
 * art; dark scrim + light text over dark art). Values are 0..1.
 */
export interface BandStats {
  luminance: number
  r: number
  g: number
  b: number
}

/** Average luminance + colour of the bottom `frac` of a canvas (0..1 values). */
function sampleBottomBand(source: HTMLCanvasElement, frac = 0.3): BandStats {
  try {
    // Downscale first so reading pixels is cheap regardless of print size.
    const sw = 80
    const sh = Math.max(
      8,
      Math.round((sw * source.height) / source.width)
    )
    const tmp = document.createElement('canvas')
    tmp.width = sw
    tmp.height = sh
    const tctx = tmp.getContext('2d')!
    tctx.drawImage(source, 0, 0, sw, sh)
    const top = Math.floor(sh * (1 - frac))
    const { data } = tctx.getImageData(0, top, sw, sh - top)
    let r = 0
    let g = 0
    let b = 0
    let n = 0
    for (let i = 0; i < data.length; i += 4) {
      r += data[i]
      g += data[i + 1]
      b += data[i + 2]
      n++
    }
    if (!n) return { luminance: 0.5, r: 0.5, g: 0.5, b: 0.5 }
    r /= n
    g /= n
    b /= n
    return {
      luminance: (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255,
      r: r / 255,
      g: g / 255,
      b: b / 255,
    }
  } catch {
    // Cross-origin taint or an empty canvas — fall back to a neutral guess.
    return { luminance: 0.5, r: 0.5, g: 0.5, b: 0.5 }
  }
}

export interface UpscaleResult {
  /** JPEG bytes of the print-resolution page/cover art. */
  jpg: Uint8Array
  /** Brightness/colour of the text band region, for adaptive overlays. */
  band: BandStats
}

// JPEG quality for the illustrations. At 300 DPI a picture-book illustration is
// visually indistinguishable at 0.9, but lossless PNG of the same detailed art
// is 10–20× larger — a 28-page book came out at ~370 MB as PNG, which KDP
// cannot process. JPEG brings that to tens of MB.
const JPEG_QUALITY = 0.9

/**
 * Upscale + cover-crop an image blob to exact pixel dimensions using a canvas,
 * encoded as JPEG. Embedding, say, a 2588 px image on an 8.625 in page yields
 * ~300 DPI — KDP computes DPI from pixels ÷ inches, so hitting the pixel target
 * is what matters. High-quality smoothing keeps flat illustration acceptably
 * crisp. Also returns the brightness of the region where page text will sit.
 */
export async function upscaleToImage(
  blob: Blob,
  wPx: number,
  hPx: number,
  topInsetPx = 0
): Promise<UpscaleResult> {
  const bmp = await createImageBitmap(blob)
  const canvas = document.createElement('canvas')
  canvas.width = wPx
  canvas.height = hPx
  // alpha: false guarantees an opaque canvas (and JPEG has no alpha anyway), so
  // no soft mask/transparency is ever introduced into the PDF.
  const ctx = canvas.getContext('2d', { alpha: false })!
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'

  // The art occupies everything below the top inset strip; the strip itself is
  // filled afterwards with colour bled up from the art, so the page still bleeds
  // to the top edge but no picture detail sits in the trim-risk strip.
  const inset = Math.max(0, Math.min(Math.round(topInsetPx), Math.floor(hPx / 2)))
  const artTop = inset
  // Vertical compression that frees the top strip (~4% for a 3/8" inset). Keeps
  // the whole picture — the title and any bottom byline included — rather than
  // cropping either end; the horizontal is untouched, so it's a gentle squash.
  const vComp = (hPx - inset) / hPx

  // Cover fit to the full page (same framing/crop as before), then compress that
  // vertically into the region below the top strip and nudge it down.
  const scale = Math.max(wPx / bmp.width, hPx / bmp.height)
  const dw = bmp.width * scale
  const dh = bmp.height * scale
  ctx.drawImage(bmp, (wPx - dw) / 2, artTop + ((hPx - dh) / 2) * vComp, dw, dh * vComp)
  bmp.close?.()

  // Fill the top strip by stretching the art's top row upward — a seamless
  // colour bleed that matches the art's own top edge (no hard seam, no border).
  if (inset > 0) {
    ctx.drawImage(canvas, 0, artTop, wPx, 1, 0, 0, wPx, inset)
  }

  const band = sampleBottomBand(canvas)

  const out = await new Promise<Blob | null>((res) =>
    canvas.toBlob(res, 'image/jpeg', JPEG_QUALITY)
  )
  if (!out) throw new Error('Image processing failed')
  return { jpg: new Uint8Array(await out.arrayBuffer()), band }
}

/**
 * Flatten an image blob to an OPAQUE JPEG (white behind any transparency),
 * scaled so its longest side is at most `maxDim`. Used for the back-cover
 * illustration: keeps aspect ratio (no crop), stays KDP-safe (no transparency),
 * and keeps the file small. Returns bytes plus the encoded pixel dimensions.
 */
export async function flattenToJpeg(
  blob: Blob,
  maxDim = 1400
): Promise<{ jpg: Uint8Array; width: number; height: number }> {
  const bmp = await createImageBitmap(blob)
  const scale = Math.min(1, maxDim / Math.max(bmp.width, bmp.height))
  const w = Math.max(1, Math.round(bmp.width * scale))
  const h = Math.max(1, Math.round(bmp.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d', { alpha: false })!
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, w, h)
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(bmp, 0, 0, w, h)
  bmp.close?.()
  const out = await new Promise<Blob | null>((res) =>
    canvas.toBlob(res, 'image/jpeg', JPEG_QUALITY)
  )
  if (!out) throw new Error('Image processing failed')
  return { jpg: new Uint8Array(await out.arrayBuffer()), width: w, height: h }
}

/** Render a solid-color PNG of given pixel size (placeholder / blank pages). */
export async function solidPng(
  wPx: number,
  hPx: number,
  color: string
): Promise<Uint8Array> {
  const canvas = document.createElement('canvas')
  canvas.width = wPx
  canvas.height = hPx
  const ctx = canvas.getContext('2d', { alpha: false })!
  ctx.fillStyle = color
  ctx.fillRect(0, 0, wPx, hPx)
  const out = await new Promise<Blob | null>((res) =>
    canvas.toBlob(res, 'image/png')
  )
  if (!out) throw new Error('Canvas failed')
  return new Uint8Array(await out.arrayBuffer())
}
