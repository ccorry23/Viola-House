/**
 * Prompt construction for page illustrations and the character reference sheet.
 * A single locked style descriptor + character description is applied to every
 * page so the art stays consistent across the book.
 */

export interface StylePromptInput {
  descriptor: string
  palette: string
  characters: string
}

const BASE_STYLE =
  'Professional children\'s picture-book illustration. Full-bleed art that fills the whole frame. ' +
  'No text, no words, no letters, no captions, no page numbers anywhere in the image. ' +
  'Warm, friendly, age-appropriate for young children.'

function styleClause({ descriptor, palette, characters }: StylePromptInput): string {
  const bits: string[] = []
  if (descriptor.trim()) bits.push(`Art style: ${descriptor.trim()}.`)
  if (palette.trim()) bits.push(`Color palette: ${palette.trim()}.`)
  if (characters.trim()) bits.push(`Recurring characters: ${characters.trim()}.`)
  return bits.join(' ')
}

/** Prompt for one page's illustration, given the page's story text. */
export function buildPagePrompt(style: StylePromptInput, pageText: string): string {
  return [
    BASE_STYLE,
    styleClause(style),
    `Illustrate this moment from the story: "${pageText.trim()}"`,
    'Keep the characters visually identical to the reference image provided (same faces, colors, proportions, and clothing).',
  ]
    .filter(Boolean)
    .join(' ')
}

/** Prompt for the one-time character/style reference sheet. */
export function buildReferencePrompt(style: StylePromptInput): string {
  return [
    BASE_STYLE,
    styleClause(style),
    'Create a clean character reference sheet: show the main character(s) full-body, ' +
      'front view, on a plain neutral background, clearly and consistently designed so ' +
      'they can be reused across every page of the book.',
  ]
    .filter(Boolean)
    .join(' ')
}
