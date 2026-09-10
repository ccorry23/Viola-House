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
  hPx: number
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

  // Cover fit (fill the whole box, cropping overflow).
  const scale = Math.max(wPx / bmp.width, hPx / bmp.height)
  const dw = bmp.width * scale
  const dh = bmp.height * scale
  ctx.drawImage(bmp, (wPx - dw) / 2, (hPx - dh) / 2, dw, dh)
  bmp.close?.()

  const band = sampleBottomBand(canvas)

  const out = await new Promise<Blob | null>((res) =>
    canvas.toBlob(res, 'image/jpeg', JPEG_QUALITY)
  )
  if (!out) throw new Error('Image processing failed')
  return { jpg: new Uint8Array(await out.arrayBuffer()), band }
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
