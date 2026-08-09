/**
 * Pluggable illustration provider. The default is Google Gemini 2.5 Flash Image
 * ("Nano Banana"), chosen for strong character/style consistency via reference
 * images. A cheaper or higher-res provider can be added by implementing this
 * interface and wiring it into getImageProvider() — nothing else changes.
 *
 * Server-only: providers read API keys from the environment.
 */
import { imageProvider } from '@/lib/env'

export interface GenerateImageParams {
  prompt: string
  /** Optional reference image (base64, no data: prefix) for consistency. */
  referenceImageB64?: string
  referenceMime?: string
}

export interface ImageProvider {
  name: string
  /** Returns raw image bytes (typically PNG). Throws on failure. */
  generate(params: GenerateImageParams): Promise<Buffer>
}

export class MissingKeyError extends Error {}

/** Resolve the configured provider, or throw MissingKeyError if unusable. */
export async function getImageProvider(): Promise<ImageProvider> {
  const name = imageProvider()
  switch (name) {
    case 'gemini': {
      const { GeminiProvider } = await import('./gemini')
      return new GeminiProvider()
    }
    // Future: case 'openai': ...
    default: {
      const { GeminiProvider } = await import('./gemini')
      return new GeminiProvider()
    }
  }
}

/** Whether the configured provider has what it needs to run. */
export function imageGenerationAvailable(): { available: boolean; provider: string } {
  const provider = imageProvider()
  if (provider === 'gemini') {
    return { available: Boolean(process.env.GEMINI_API_KEY), provider }
  }
  if (provider === 'openai') {
    return { available: Boolean(process.env.OPENAI_API_KEY), provider }
  }
  return { available: Boolean(process.env.GEMINI_API_KEY), provider }
}
