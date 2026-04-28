import { config } from 'dotenv'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: join(__dirname, '..', '.env.local') })

async function main() {
  const { listDropboxFolder, readDropboxFile } = await import('../src/lib/dropbox')

  const base = '/방 준영/1. 가업/★ DB/3 학교상점/1 교구대여/999999.완료/2024년/240807 이화여대 예술교육치료연구소(1400)'

  console.log('=== 240807 이화여대 예술교육치료연구소 PDF 본문 ===')
  const pdfRes = await readDropboxFile(`${base}/240807 이화여대 예술교육치료연구소.pdf`)
  if ('error' in pdfRes) console.log('실패:', pdfRes.error)
  else {
    console.log(`(전체 ${pdfRes.text.length}자, truncated=${pdfRes.truncated})`)
    console.log(pdfRes.text)
  }

  console.log('\n\n=== 결제 서류 폴더 트리 ===')
  const pay = await listDropboxFolder(`${base}/0. 이화여대 예술교육치료연구소 결제 서류`)
  for (const f of pay) console.log(`  [${f.type}] ${f.name}`)

  console.log('\n=== 240819 PDF 시도 ===')
  const pdf2 = await readDropboxFile(`${base}/0. 이화여대 예술교육치료연구소 결제 서류/240819 이화여대 예술교육치료연구소.pdf`)
  if ('error' in pdf2) console.log('실패:', pdf2.error)
  else {
    console.log(`(전체 ${pdf2.text.length}자, truncated=${pdf2.truncated})`)
    console.log(pdf2.text)
  }
}

main().catch(e => { console.error(e); process.exit(1) })
