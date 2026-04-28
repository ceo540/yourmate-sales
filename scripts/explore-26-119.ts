import { config } from 'dotenv'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: join(__dirname, '..', '.env.local') })

async function main() {
  const { listDropboxFolder } = await import('../src/lib/dropbox')

  const base = '/방 준영/1. 가업/★ DB/4 002Creative(영상,디자인,행사)/2 행사운영/26-119 경기도교육청 남부연수원(롯데인재개발원)'

  async function walk(path: string, depth: number = 0, maxDepth: number = 3) {
    if (depth > maxDepth) return
    const items = await listDropboxFolder(path).catch(() => [])
    for (const f of items) {
      const indent = '  '.repeat(depth)
      console.log(`${indent}[${f.type}] ${f.name}`)
      if (f.type === 'folder') {
        await walk(`${path}/${f.name}`, depth + 1, maxDepth)
      }
    }
  }

  console.log(`=== 26-119 폴더 트리 ===`)
  await walk(base, 0, 3)
}

main().catch(e => { console.error(e); process.exit(1) })
