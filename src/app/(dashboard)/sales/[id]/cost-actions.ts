'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { listDropboxFolder, readDropboxFile } from '@/lib/dropbox'
import { extractCostsFromPdfTexts, type ExtractedCostRow } from '@/lib/cost-pdf-extract'

export interface AnalyzedCostRow extends ExtractedCostRow {
  // vendor 매칭 결과
  matched_vendor_id: string | null
  matched_vendor_name: string | null
  // 기존 sale_costs와 (item, amount, vendor) 같은 행이 있는지
  duplicate: boolean
}

const WEB_BASE = 'https://www.dropbox.com/home'

// sale → project.dropbox_url → /0 행정/원가/ 폴더 PDF 스캔 (depth 2 재귀) → 통합 LLM 분석.
export async function analyzeCostFolder(
  saleId: string,
): Promise<{ rows: AnalyzedCostRow[]; pdfsScanned: number } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '로그인 필요' }

  const admin = createAdminClient()

  const { data: sale } = await admin
    .from('sales')
    .select('id, project_id')
    .eq('id', saleId)
    .maybeSingle()
  if (!sale) return { error: '계약을 찾을 수 없음' }
  if (!sale.project_id) return { error: '연결된 프로젝트가 없음' }

  const { data: project } = await admin
    .from('projects')
    .select('dropbox_url')
    .eq('id', sale.project_id)
    .maybeSingle()
  if (!project?.dropbox_url) return { error: '프로젝트 Dropbox 폴더가 없음' }
  if (!project.dropbox_url.startsWith(WEB_BASE)) {
    return { error: 'Dropbox URL 형식 오류 (/home/ 형식 필요)' }
  }

  const projectFolderPath = decodeURIComponent(project.dropbox_url.replace(WEB_BASE, '')).replace(/\/$/, '')
  const costFolderPath = `${projectFolderPath}/0 행정/원가`

  // depth 2 재귀로 .pdf 수집
  const pdfPaths: { name: string; path: string }[] = []
  const seen = new Set<string>()
  async function scan(folderPath: string, prefix: string, depth: number) {
    if (depth > 2) return
    const items = await listDropboxFolder(folderPath).catch(() => [])
    for (const f of items) {
      if (f.type === 'file' && f.name.toLowerCase().endsWith('.pdf')) {
        if (!seen.has(f.path)) {
          seen.add(f.path)
          pdfPaths.push({ name: prefix ? `${prefix}/${f.name}` : f.name, path: f.path })
        }
      } else if (f.type === 'folder') {
        await scan(`${folderPath}/${f.name}`, prefix ? `${prefix}/${f.name}` : f.name, depth + 1)
      }
    }
  }
  await scan(costFolderPath, '', 0)

  if (pdfPaths.length === 0) {
    return { error: `원가 폴더에 PDF가 없어. (${costFolderPath})` }
  }

  // 각 PDF 텍스트 추출 (병렬)
  const texts = await Promise.all(
    pdfPaths.map(async p => {
      const r = await readDropboxFile(p.path)
      if ('error' in r) return { filename: p.name, text: `[읽기 실패: ${r.error}]` }
      return { filename: p.name, text: r.text }
    }),
  )

  // LLM 통합 분석
  const result = await extractCostsFromPdfTexts(texts, { userId: user.id })
  if ('error' in result) return { error: 'LLM 분석 실패: ' + result.error }

  // vendor 매칭 + 기존 sale_costs 중복 확인
  const [{ data: vendors }, { data: existingCosts }] = await Promise.all([
    admin.from('vendors').select('id, name'),
    admin.from('sale_costs').select('item, amount, vendor_id').eq('sale_id', saleId),
  ])

  const vendorList = vendors ?? []
  const existing = existingCosts ?? []

  const analyzed: AnalyzedCostRow[] = result.rows.map(r => {
    let matched_vendor_id: string | null = null
    let matched_vendor_name: string | null = null
    if (r.vendor_name) {
      const needle = r.vendor_name.trim().toLowerCase()
      const v = vendorList.find(v =>
        v.name.toLowerCase().includes(needle) || needle.includes(v.name.toLowerCase()),
      )
      if (v) { matched_vendor_id = v.id; matched_vendor_name = v.name }
    }
    const duplicate = existing.some(e =>
      e.item?.trim().toLowerCase() === r.item.trim().toLowerCase() &&
      Number(e.amount) === r.amount &&
      (e.vendor_id ?? null) === matched_vendor_id,
    )
    return { ...r, matched_vendor_id, matched_vendor_name, duplicate }
  })

  return { rows: analyzed, pdfsScanned: pdfPaths.length }
}

export interface BulkInsertItem {
  item: string
  amount: number
  vendor_id: string | null            // 매칭된 기존 vendor
  new_vendor_name: string | null      // vendor_id 없을 때 새로 등록할 이름
  new_vendor_business_number: string | null
  due_date: string | null
}

export async function bulkInsertCosts(
  saleId: string,
  items: BulkInsertItem[],
): Promise<{ inserted: number; newVendors: number } | { error: string }> {
  if (items.length === 0) return { inserted: 0, newVendors: 0 }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '로그인 필요' }

  const admin = createAdminClient()

  // 같은 신규 거래처 이름 중복 등록 방지 — 한 번에 묶어서 처리
  const newVendorMap = new Map<string, { id_number: string | null }>()
  for (const it of items) {
    if (!it.vendor_id && it.new_vendor_name?.trim()) {
      const key = it.new_vendor_name.trim()
      if (!newVendorMap.has(key)) {
        newVendorMap.set(key, { id_number: it.new_vendor_business_number?.trim() || null })
      }
    }
  }

  // 1. 신규 vendors 생성 (이미 같은 이름이 있으면 그걸 재사용)
  const createdVendorIds = new Map<string, string>()
  if (newVendorMap.size > 0) {
    const names = Array.from(newVendorMap.keys())
    const { data: existing } = await admin
      .from('vendors')
      .select('id, name')
      .in('name', names)
    const existingByName = new Map((existing ?? []).map(v => [v.name, v.id]))

    for (const [name, meta] of newVendorMap.entries()) {
      const existId = existingByName.get(name)
      if (existId) {
        createdVendorIds.set(name, existId)
        continue
      }
      const { data: v, error: vErr } = await admin
        .from('vendors')
        .insert({ name, type: '업체', id_number: meta.id_number })
        .select('id')
        .single()
      if (vErr || !v) return { error: `거래처 등록 실패 (${name}): ${vErr?.message}` }
      createdVendorIds.set(name, v.id)
    }
  }

  // 2. sale_costs 일괄 INSERT
  const rows = items.map(it => {
    const vendorId = it.vendor_id ?? (it.new_vendor_name ? createdVendorIds.get(it.new_vendor_name.trim()) ?? null : null)
    return {
      sale_id: saleId,
      item: it.item.trim(),
      amount: Math.round(it.amount),
      category: '외부원가',
      vendor_id: vendorId,
      due_date: it.due_date,
      memo: null,
    }
  })

  const { error: insErr } = await admin.from('sale_costs').insert(rows)
  if (insErr) return { error: `원가 추가 실패: ${insErr.message}` }

  revalidatePath(`/sales/${saleId}`)
  // 매출/계약은 project 페이지에도 떠 있을 수 있어 같이 revalidate
  const { data: sale } = await admin.from('sales').select('project_id').eq('id', saleId).maybeSingle()
  if (sale?.project_id) revalidatePath(`/projects/${sale.project_id}`)

  return { inserted: rows.length, newVendors: createdVendorIds.size }
}
