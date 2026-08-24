import { GoogleGenAI } from '@google/genai'
import {
  MissingKeyError,
  type GenerateImageParams,
  type ImageProvider,
} from './provider'

const MODEL = process.env.GEMINI_IMAGE_MODEL || 'gemini-3.1-flash-image'

/**
 * Google Gemini Flash Image ("Nano Banana") provider. When a reference image is
 * supplied it is passed alongside the prompt so recurring characters stay
 * consistent — this is the provider's main advantage for a picture book.
 */
export class GeminiProvider implements ImageProvider {
  name = 'gemini'

  async generate({
    prompt,
    referenceImages = [],
  }: GenerateImageParams): Promise<Buffer> {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) throw new MissingKeyError('GEMINI_API_KEY is not set')

    const ai = new GoogleGenAI({ apiKey })

    // The prompt goes first, then each reference image (cover, then any
    // character references) so the model has them all as visual context.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parts: any[] = [{ text: prompt }]
    for (const ref of referenceImages) {
      if (!ref?.b64) continue
      parts.push({
        inlineData: { mimeType: ref.mime ?? 'image/png', data: ref.b64 },
      })
    }

    const res = await ai.models.generateContent({
      model: MODEL,
      contents: [{ role: 'user', parts }],
    })

    const candidateParts = res.candidates?.[0]?.content?.parts ?? []
    for (const part of candidateParts) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const inline = (part as any).inlineData
      if (inline?.data) {
        return Buffer.from(inline.data, 'base64')
      }
    }

    // No image came back — surface any text the model returned as the reason.
    const text = candidateParts
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((p: any) => p.text)
      .filter(Boolean)
      .join(' ')
    throw new Error(
      text
        ? `Image model returned no image: ${text.slice(0, 200)}`
        : 'Image model returned no image.'
    )
  }
}
