#!/usr/bin/env tsx
import { config } from 'dotenv'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: join(__dirname, '..', '.env.local') })

async function main() {
  const { listDropboxFolder } = await import('../src/lib/dropbox')
  const path = '/방 준영/1. 가업/★ DB/0 유어메이트/7 Claude협업'
  const items = await listDropboxFolder(path)
  console.log(`\n📁 ${path}\n`)
  for (const it of items) {
    console.log(`${it.type === 'folder' ? '📁' : '📄'} ${it.name}`)
  }

  // 한 단계 더 — 폴더 안의 폴더도
  for (const it of items.filter(i => i.type === 'folder')) {
    const sub = await listDropboxFolder(`${path}/${it.name}`)
    console.log(`\n  📁 ${it.name}`)
    for (const s of sub) {
      console.log(`     ${s.type === 'folder' ? '📁' : '📄'} ${s.name}`)
    }
  }
}

main().catch(e => { console.error(e); process.exit(1) })
