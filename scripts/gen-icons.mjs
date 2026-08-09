// One-off: render the brand SVG to the PNG icons the PWA manifest needs.
// Run: node scripts/gen-icons.mjs
import sharp from 'sharp'
import { mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const svg = join(here, 'icon.svg')
const outDir = join(here, '..', 'public', 'icons')

await mkdir(outDir, { recursive: true })

const sizes = [192, 512]
for (const size of sizes) {
  await sharp(svg).resize(size, size).png().toFile(join(outDir, `icon-${size}.png`))
  await sharp(svg)
    .resize(size, size)
    .png()
    .toFile(join(outDir, `maskable-${size}.png`))
}
// Apple touch icon + favicon
await sharp(svg).resize(180, 180).png().toFile(join(outDir, 'apple-touch-icon.png'))
await sharp(svg).resize(32, 32).png().toFile(join(here, '..', 'public', 'favicon.png'))

console.log('icons written to', outDir)
