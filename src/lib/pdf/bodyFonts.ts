/**
 * The curated set of body (story-text) fonts the author can choose from.
 *
 * Deliberately a short, hand-picked list rather than an open font picker: every
 * option is legible at picture-book sizes, ships as a static TTF we embed +
 * subset into the print PDF, and is safe for KDP. The display font (titles,
 * cover, spine) is always Fraunces — only the body text changes here.
 *
 * Pure data (no browser APIs) so the `Book` type and the UI can both import it.
 */
export type BodyFontId = 'nunito' | 'fraunces' | 'andika' | 'comic'

export interface BodyFontDef {
  id: BodyFontId
  /** Shown in the picker. */
  label: string
  /** One-line plain-language description for the picker. */
  note: string
  /** File under /public/fonts. */
  file: string
  /** CSS font-family stack for the in-app preview swatch. */
  previewStack: string
}

export const DEFAULT_BODY_FONT: BodyFontId = 'nunito'

export const BODY_FONTS: readonly BodyFontDef[] = [
  {
    id: 'nunito',
    label: 'Nunito',
    note: 'Rounded and friendly — the classic default.',
    file: '/fonts/Nunito.ttf',
    previewStack: '"VH Nunito", "Segoe UI", sans-serif',
  },
  {
    id: 'fraunces',
    label: 'Fraunces',
    note: 'A warm storybook serif, for a more timeless feel.',
    file: '/fonts/Fraunces.ttf',
    previewStack: '"VH Fraunces", Georgia, serif',
  },
  {
    id: 'andika',
    label: 'Andika',
    note: 'Made for new readers — simple, single-story a and g.',
    file: '/fonts/Andika.ttf',
    previewStack: '"VH Andika", "Segoe UI", sans-serif',
  },
  {
    id: 'comic',
    label: 'Comic Neue',
    note: 'Playful and casual, easy for young eyes.',
    file: '/fonts/ComicNeue.ttf',
    previewStack: '"VH Comic Neue", "Comic Sans MS", cursive',
  },
] as const

export function bodyFontDef(id: BodyFontId | undefined): BodyFontDef {
  return BODY_FONTS.find((f) => f.id === id) ?? BODY_FONTS[0]
}
