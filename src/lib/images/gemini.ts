import { GoogleGenAI } from '@google/genai'
import {
  MissingKeyError,
  type GenerateImageParams,
  type ImageProvider,
} from './provider'

const MODEL = process.env.GEMINI_IMAGE_MODEL || 'gemini-2.5-flash-image'

/**
 * Google Gemini 2.5 Flash Image provider. When a reference image is supplied it
 * is passed alongside the prompt so recurring characters stay consistent — this
 * is the provider's main advantage for a picture book.
 */
export class GeminiProvider implements ImageProvider {
  name = 'gemini'

  async generate({
    prompt,
    referenceImageB64,
    referenceMime = 'image/png',
  }: GenerateImageParams): Promise<Buffer> {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) throw new MissingKeyError('GEMINI_API_KEY is not set')

    const ai = new GoogleGenAI({ apiKey })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parts: any[] = [{ text: prompt }]
    if (referenceImageB64) {
      parts.push({
        inlineData: { mimeType: referenceMime, data: referenceImageB64 },
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
