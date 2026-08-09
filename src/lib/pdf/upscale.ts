'use client'

/**
 * Upscale + cover-crop an image blob to exact pixel dimensions using a canvas.
 * Embedding, say, a 2588 px image on an 8.625 in page yields ~300 DPI — KDP
 * computes DPI from pixels ÷ inches, so hitting the pixel target is what
 * matters. High-quality smoothing keeps flat illustration acceptably crisp.
 */
export async function upscaleToPng(
  blob: Blob,
  wPx: number,
  hPx: number
): Promise<Uint8Array> {
  const bmp = await createImageBitmap(blob)
  const canvas = document.createElement('canvas')
  canvas.width = wPx
  canvas.height = hPx
  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'

  // Cover fit (fill the whole box, cropping overflow).
  const scale = Math.max(wPx / bmp.width, hPx / bmp.height)
  const dw = bmp.width * scale
  const dh = bmp.height * scale
  ctx.drawImage(bmp, (wPx - dw) / 2, (hPx - dh) / 2, dw, dh)
  bmp.close?.()

  const out = await new Promise<Blob | null>((res) =>
    canvas.toBlob(res, 'image/png')
  )
  if (!out) throw new Error('Image processing failed')
  return new Uint8Array(await out.arrayBuffer())
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
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = color
  ctx.fillRect(0, 0, wPx, hPx)
  const out = await new Promise<Blob | null>((res) =>
    canvas.toBlob(res, 'image/png')
  )
  if (!out) throw new Error('Canvas failed')
  return new Uint8Array(await out.arrayBuffer())
}
