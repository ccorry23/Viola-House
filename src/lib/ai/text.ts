import { GoogleGenAI } from '@google/genai'

const MODEL = process.env.GEMINI_TEXT_MODEL || 'gemini-2.5-flash'

export class MissingKeyError extends Error {}

export interface GenerateTextParams {
  prompt: string
  system?: string
  /** Ask the model to return JSON (used for structured brainstorm ideas). */
  json?: boolean
}

/** Server-only text generation via Gemini. Reuses GEMINI_API_KEY. */
export async function generateText({
  prompt,
  system,
  json,
}: GenerateTextParams): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new MissingKeyError('GEMINI_API_KEY is not set')

  const ai = new GoogleGenAI({ apiKey })
  const res = await ai.models.generateContent({
    model: MODEL,
    contents: prompt,
    config: {
      ...(system ? { systemInstruction: system } : {}),
      ...(json ? { responseMimeType: 'application/json' } : {}),
      temperature: 0.9,
    },
  })
  return res.text ?? ''
}

export function writingAvailable(): { available: boolean } {
  return { available: Boolean(process.env.GEMINI_API_KEY) }
}
