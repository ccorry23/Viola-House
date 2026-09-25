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
/**
 * How far to push illustration content down from the top of every page and the
 * cover, so nothing sits right against the top trim. The art is nudged down by
 * this much and the freed top strip is filled with colour bled up from the art,
 * so the page still bleeds to the edge (no white border) while no picture detail
 * sits in the top ~3/8" that a trim can crop.
 */
export const TOP_ART_INSET_IN = 0.375
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
export function coverWrapBoxIn(
  trim: TrimSize,
  pageCount: number,
  binding: BindingId = 'paperback',
  spineOverrideIn?: number
) {
  const spine =
    binding === 'hardcover' && spineOverrideIn && spineOverrideIn > 0
      ? spineOverrideIn
      : spineWidthIn(pageCount)
  const outer = coverOuterIn(binding)
  return {
    spine,
    outer,
    w: outer + trim.w + spine + trim.w + outer,
    h: outer + trim.h + outer,
  }
}

// ---- Hardcover (case laminate) ---------------------------------------------
//
// From KDP's "Create a Hardcover Cover" help page: the cover image extends
// 0.51" past each outer trim edge (it wraps around the board and is glued
// inside), and there's a 0.4" hinge beside the spine where no text or barcode
// may go. Hardcovers need 75–550 interior pages, white paper, and only certain
// trim sizes. KDP does not publish a simple hardcover spine formula here, so we
// estimate it from page count and let the author paste the exact value from
// KDP's cover calculator (https://kdp.amazon.com/cover-calculator).

export type BindingId = 'paperback' | 'hardcover'

export const HARDCOVER_MIN_PAGES = 75
export const HARDCOVER_MAX_PAGES = 550
export const HARDCOVER_WRAP_IN = 0.51
export const HARDCOVER_HINGE_IN = 0.4
/** Our trim sizes that KDP also offers in hardcover. */
export const HARDCOVER_TRIMS: TrimId[] = ['7x10']
export const KDP_COVER_CALCULATOR_URL = 'https://kdp.amazon.com/cover-calculator'

/** How far the cover image extends past each outer trim edge. */
export function coverOuterIn(binding: BindingId = 'paperback'): number {
  return binding === 'hardcover' ? HARDCOVER_WRAP_IN : BLEED_IN
}

/** Minimum interior page count KDP accepts for this binding. */
export function minInteriorPages(binding: BindingId = 'paperback'): number {
  return binding === 'hardcover' ? HARDCOVER_MIN_PAGES : MIN_PAGE_COUNT
}

/**
 * Final interior page count after export padding: story pages + title and
 * copyright pages, padded with blanks to the binding minimum and an even total.
 */
export function paddedPageCount(
  storyPages: number,
  binding: BindingId = 'paperback'
): number {
  let total = storyPages + 2
  const min = minInteriorPages(binding)
  if (total < min) total = min
  if (total % 2 !== 0) total++
  return total
}

/**
 * Problems that BLOCK a hardcover export (empty = OK). The under-75 case isn't
 * here: it's allowed with blank-page padding, but the UI warns and requires the
 * author to acknowledge it.
 */
export function hardcoverBlockers(trimSize: TrimId, storyPages: number): string[] {
  const out: string[] = []
  if (!HARDCOVER_TRIMS.includes(trimSize)) {
    out.push(
      `KDP hardcovers don't come in ${TRIM_SIZES[trimSize].label}. Of our sizes, only ` +
        `${HARDCOVER_TRIMS.map((t) => TRIM_SIZES[t].label).join(', ')} is available in hardcover.`
    )
  }
  if (storyPages + 2 > HARDCOVER_MAX_PAGES) {
    out.push(`KDP hardcovers can have at most ${HARDCOVER_MAX_PAGES} pages.`)
  }
  return out
}
