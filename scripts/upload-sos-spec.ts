#!/usr/bin/env tsx
import { config } from 'dotenv'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: join(__dirname, '..', '.env.local') })

async function main() {
  const { uploadTextFile } = await import('../src/lib/dropbox')
  const content = readFileSync('/tmp/sos-quote-spec.md', 'utf-8')
  const folderWebUrl = 'https://www.dropbox.com/home/방 준영/1. 가업/★ DB/0 유어메이트/7 Claude협업/01_SOS'
  const r = await uploadTextFile({ folderWebUrl, filename: 'SOS_견적기준.md', content })
  console.log(r)
}
main().catch(e => { console.error(e); process.exit(1) })
