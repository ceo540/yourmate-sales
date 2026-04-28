#!/usr/bin/env tsx
import { config } from 'dotenv'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: join(__dirname, '..', '.env.local') })

async function main() {
  const { uploadTextFile } = await import('../src/lib/dropbox')
  const folderWebUrl = 'https://www.dropbox.com/home/방 준영/1. 가업/★ DB/0 유어메이트/7 Claude협업/00_공통'

  const guide = readFileSync('/tmp/quote-guide.md', 'utf-8')
  const r1 = await uploadTextFile({ folderWebUrl, filename: '견적_운영가이드.md', content: guide })
  console.log(r1)

  const tpl = readFileSync('/tmp/quote-template.md', 'utf-8')
  const r2 = await uploadTextFile({ folderWebUrl, filename: '견적서_HTML템플릿.md', content: tpl })
  console.log(r2)
}
main().catch(e => { console.error(e); process.exit(1) })
