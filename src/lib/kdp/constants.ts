/**
 * KDP paperback print constants and the supported trim sizes.
 *
 * All measurements follow Amazon KDP's published paperback specs:
 *  - Full bleed adds 0.125 in to the top, bottom, and outside edges.
 *  - Interior images must be >= 300 DPI at final print size.
 *  - Paperback minimum page count is 24.
 *  - Spine width = page count x paper thickness. White paper = 0.002252 in/page.
 * Sources: KDP "Paperback manuscript" and "Print cover calculator" help pages.
 */

export const PT_PER_INCH = 72
export const PRINT_DPI = 300
export const BLEED_IN = 0.125
/** Keep text/important content this far inside the trim edge. */
export const SAFE_MARGIN_IN = 0.25
export const MIN_PAGE_COUNT = 24
/** White paper thickness per page (KDP cover calculator). */
export const SPINE_IN_PER_PAGE_WHITE = 0.002252

export type TrimId = '8.5x8.5' | '8x10' | '7x10'

export interface TrimSize {
  id: TrimId
  /** Trim width in inches. */
  w: number
  /** Trim height in inches. */
  h: number
  label: string
}

export const TRIM_SIZES: Record<TrimId, TrimSize> = {
  '8.5x8.5': { id: '8.5x8.5', w: 8.5, h: 8.5, label: '8.5" × 8.5" — Square' },
  '8x10': { id: '8x10', w: 8, h: 10, label: '8" × 10" — Portrait' },
  '7x10': { id: '7x10', w: 7, h: 10, label: '7" × 10" — Portrait' },
}

export const DEFAULT_TRIM: TrimId = '8.5x8.5'

export const TRIM_LIST: TrimSize[] = Object.values(TRIM_SIZES)

export function inToPt(inches: number): number {
  return inches * PT_PER_INCH
}

/** Pixel dimension needed for a given inch length at print DPI. */
export function inToPx(inches: number, dpi: number = PRINT_DPI): number {
  return Math.round(inches * dpi)
}

/** Spine width in inches for a given page count (white paper). */
export function spineWidthIn(pageCount: number): number {
  return pageCount * SPINE_IN_PER_PAGE_WHITE
}

/**
 * Interior page box WITH full bleed. KDP adds 0.125 in to top, bottom, and the
 * OUTSIDE edge only (the inside/binding edge gets no bleed). We produce a single
 * page box that is safe for both left and right pages by adding bleed to width
 * once and to height twice — art is placed to cover the whole box.
 */
export function interiorPageBoxIn(trim: TrimSize) {
  return {
    w: trim.w + BLEED_IN, // outside-edge bleed
    h: trim.h + BLEED_IN * 2, // top + bottom bleed
  }
}

/**
 * Full-wrap cover box (back + spine + front) WITH bleed, in inches.
 * width = bleed + backTrim + spine + frontTrim + bleed
 * height = bleed + trimH + bleed
 */
export function coverWrapBoxIn(trim: TrimSize, pageCount: number) {
  const spine = spineWidthIn(pageCount)
  return {
    spine,
    w: BLEED_IN + trim.w + spine + trim.w + BLEED_IN,
    h: BLEED_IN + trim.h + BLEED_IN,
  }
}
