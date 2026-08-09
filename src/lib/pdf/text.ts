import type { PDFFont } from 'pdf-lib'

/** Greedy word-wrap to a max width, returning lines. */
export function wrapText(
  text: string,
  font: PDFFont,
  size: number,
  maxWidth: number
): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    const trial = line ? `${line} ${word}` : word
    if (font.widthOfTextAtSize(trial, size) > maxWidth && line) {
      lines.push(line)
      line = word
    } else {
      line = trial
    }
  }
  if (line) lines.push(line)
  return lines
}

/** Largest font size (down to min) that fits the text in the given box. */
export function fitFontSize(
  text: string,
  font: PDFFont,
  maxWidth: number,
  maxHeight: number,
  start = 22,
  min = 11,
  lineGap = 1.35
): { size: number; lines: string[] } {
  for (let size = start; size >= min; size--) {
    const lines = wrapText(text, font, size, maxWidth)
    if (lines.length * size * lineGap <= maxHeight) return { size, lines }
  }
  return { size: min, lines: wrapText(text, font, min, maxWidth) }
}
