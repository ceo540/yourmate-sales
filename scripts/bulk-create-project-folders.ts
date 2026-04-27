#!/usr/bin/env tsx
/**
 * 활성 프로젝트 중 dropbox_url 없는 것들에 대해 폴더 + brief.md 일괄 생성.
 *
 * 실행: cd /Users/junyoungbang/yourmate-system && npx tsx scripts/bulk-create-project-folders.ts
 *
 * .env.local 자동 로드.
 */
import { config } from 'dotenv'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: join(__dirname, '..', '.env.local') })

async function main() {
  const { createAdminClient } = await import('../src/lib/supabase/admin')
  const { createSaleFolder } = await import('../src/lib/dropbox')
  const { createOrUpdateProjectBrief } = await import('../src/lib/brief-generator')
  const admin = createAdminClient()

  const { data: projects, error } = await admin
    .from('projects')
    .select('id, name, project_number, service_type, status, created_at')
    .is('dropbox_url', null)
    .not('service_type', 'is', null)
    .not('status', 'in', '("취소","완료","archived")')
    .order('created_at')

  if (error) { console.error('조회 실패:', error.message); return }
  if (!projects || projects.length === 0) { console.log('처리할 프로젝트 없음.'); return }

  console.log(`▶ ${projects.length}개 처리 시작\n`)

  let success = 0, failed = 0
  for (const p of projects) {
    const num = p.project_number ?? p.id.slice(0, 8)
    try {
      const inflowDate = p.created_at?.slice(0, 10) ?? null
      const folderUrl = await createSaleFolder({
        service_type: p.service_type,
        name: p.name,
        inflow_date: inflowDate,
      })

      if (!folderUrl) {
        console.log(`✗ ${num} ${p.name}: createSaleFolder가 null 반환 (service_type 미지원?)`)
        failed++
        continue
      }

      const { error: updErr } = await admin.from('projects').update({ dropbox_url: folderUrl }).eq('id', p.id)
      if (updErr) {
        console.log(`✗ ${num} ${p.name}: DB 업데이트 실패 - ${updErr.message}`)
        failed++
        continue
      }

      const briefResult = await createOrUpdateProjectBrief(p.id)
      const briefMsg = 'error' in briefResult ? `(brief 실패: ${briefResult.error})` : `(brief: ${briefResult.filename})`

      console.log(`✓ ${num} ${p.name} ${briefMsg}`)
      success++

      // Dropbox API 부하 완화
      await new Promise(r => setTimeout(r, 200))
    } catch (e) {
      console.log(`✗ ${num} ${p.name}: ${(e as Error).message}`)
      failed++
    }
  }

  console.log(`\n완료 — 성공 ${success} / 실패 ${failed} / 전체 ${projects.length}`)
}

main().catch(e => { console.error(e); process.exit(1) })
