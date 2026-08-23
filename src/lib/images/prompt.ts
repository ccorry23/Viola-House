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
    'Match the cover image provided: keep the same characters (identical faces, ' +
      'colors, proportions, and clothing), the same art style, and the same palette.',
  ]
    .filter(Boolean)
    .join(' ')
}

/**
 * Prompt for refining an existing page illustration: keep the picture as the
 * starting point and apply only the specific change the author asked for,
 * preserving everything else. The current image is passed to the model as the
 * input to edit.
 */
export function buildRefinePrompt(
  style: StylePromptInput,
  instruction: string
): string {
  return [
    BASE_STYLE,
    styleClause(style),
    'Here is an existing illustration. Use it as the starting point and make ' +
      `only this change: "${instruction.trim()}".`,
    'Preserve everything else exactly — the same characters (identical faces, ' +
      'colors, proportions, and clothing), the same composition, the same art ' +
      'style, and the same palette. Edit the provided image; do not redraw it ' +
      'from scratch.',
  ]
    .filter(Boolean)
    .join(' ')
}

/**
 * Prompt for the book's cover — the first image the author dials in. It sets the
 * look for the whole book and is reused as the style/character reference on
 * every page.
 */
export function buildReferencePrompt(style: StylePromptInput): string {
  return [
    BASE_STYLE,
    styleClause(style),
    'Create the front cover illustration for this book: a warm, inviting full-bleed ' +
      'scene featuring the main character(s) prominently and capturing the story\'s ' +
      'mood, clearly and consistently designed so the same characters and style can ' +
      'be carried across every page of the book.',
  ]
    .filter(Boolean)
    .join(' ')
}
