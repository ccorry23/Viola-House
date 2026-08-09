// One-off: download the two TTFs we embed into exported PDFs (KDP requires
// embedded fonts). Static instances of open-licensed Google fonts.
// Run: node scripts/get-fonts.mjs
import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const outDir = join(here, '..', 'src', 'lib', 'pdf', 'fonts')
await mkdir(outDir, { recursive: true })

const fonts = [
  {
    name: 'Fraunces.ttf',
    url: 'https://github.com/google/fonts/raw/main/ofl/fraunces/Fraunces%5BSOFT%2CWONK%2Copsz%2Cwght%5D.ttf',
  },
  {
    name: 'Nunito.ttf',
    url: 'https://github.com/google/fonts/raw/main/ofl/nunito/Nunito%5Bwght%5D.ttf',
  },
]

for (const f of fonts) {
  const res = await fetch(f.url, { redirect: 'follow' })
  if (!res.ok) throw new Error(`Failed to fetch ${f.name}: ${res.status}`)
  const buf = Buffer.from(await res.arrayBuffer())
  await writeFile(join(outDir, f.name), buf)
  console.log(`${f.name}: ${(buf.length / 1024).toFixed(0)} KB`)
}
console.log('fonts written to', outDir)
