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

/**
 * Prompt for one page's illustration, given the page's story text and the
 * names of any character reference images supplied alongside the cover.
 */
export function buildPagePrompt(
  style: StylePromptInput,
  pageText: string,
  castNames: string[] = []
): string {
  const names = castNames.map((n) => n.trim()).filter(Boolean)
  const referenceClause = names.length
    ? `You are given reference images. The FIRST image is the book cover — match its overall art style and color palette. The remaining images are reference pictures of these recurring characters: ${names.join(
        ', '
      )}. Whenever one of these characters appears in the scene, draw them to look exactly like their reference picture — same face, colors, proportions, and clothing. Keep any character also shown on the cover consistent with the cover.`
    : 'Match the cover image provided: keep the same characters (identical faces, colors, proportions, and clothing), the same art style, and the same palette.'
  return [
    BASE_STYLE,
    styleClause(style),
    `Illustrate this moment from the story: "${pageText.trim()}"`,
    referenceClause,
  ]
    .filter(Boolean)
    .join(' ')
}

/**
 * Prompt for a single recurring character's reference portrait. Generated in
 * the book's style (matched to the cover, if supplied) so the character sits
 * naturally alongside the rest of the art, then reused as its own anchor.
 */
export function buildCharacterPrompt(
  style: StylePromptInput,
  name: string,
  description: string
): string {
  const who = [name.trim(), description.trim()].filter(Boolean).join(' — ')
  return [
    BASE_STYLE,
    styleClause(style),
    `Create a clear full-body character reference of: ${who}.`,
    'Center the character on a simple, plain background, facing the viewer, ' +
      'the whole body visible — this is a reference sheet for keeping the ' +
      'character consistent across the book.',
    'If a cover image is provided, match its art style and palette exactly.',
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
