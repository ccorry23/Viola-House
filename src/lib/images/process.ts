import sharp from 'sharp'
import { inToPx, interiorPageBoxIn, type TrimSize } from '@/lib/kdp/constants'

/**
 * Normalize a model image to PNG for local storage. We keep the model's native
 * resolution here (small, good for preview + regeneration). The upscale to
 * 300 DPI print size happens later, at export time, from this stored image.
 */
export async function normalizeToPng(bytes: Buffer): Promise<Buffer> {
  return sharp(bytes).png().toBuffer()
}

/**
 * Upscale + cover-crop an illustration to the exact interior page box (trim +
 * full bleed) at 300 DPI. Used by the PDF export. Lanczos keeps flat
 * illustration acceptably crisp when enlarging from the model's native size.
 */
export async function toPrintPage(bytes: Buffer, trim: TrimSize): Promise<Buffer> {
  const box = interiorPageBoxIn(trim)
  const wPx = inToPx(box.w)
  const hPx = inToPx(box.h)
  return sharp(bytes)
    .resize(wPx, hPx, { fit: 'cover', kernel: 'lanczos3' })
    .png()
    .withMetadata({ density: 300 })
    .toBuffer()
}
