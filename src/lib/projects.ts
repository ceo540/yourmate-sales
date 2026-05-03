// 매출(sales)에 대응하는 프로젝트(projects) 자동 생성 헬퍼.
// 모든 매출 생성 경로 (/sales/new, 빵빵이, 채널톡, 렌탈)에서 사용.
// 리드 전환과 동일 패턴을 재사용해 orphan sales 방지.

import { createAdminClient } from '@/lib/supabase/admin'

interface EnsureProjectInput {
  saleId: string
  name: string
  service_type: string | null
  department: string | null
  customer_id: string | null
  pm_id: string | null
  project_number: string | null
  dropbox_url: string | null
  // 운영 분류 승계 (Phase 4) — sale.main_type/expansion_tags → project.main_type/expansion_tags
  // 새 project 생성 시에만 적용. 기존 project 가 있으면 손대지 않음.
  main_type?: string | null
  expansion_tags?: string[] | null
}

/**
 * 매출 행에 대응하는 프로젝트를 생성하고 sales.project_id에 연결한다.
 * - PM이 지정되면 project_members에 PM 역할로 등록
 * - 이미 project_id가 있는 매출이면 스킵
 *
 * @returns 생성된(또는 기존) project id, 실패 시 null
 */
export async function ensureProjectForSale(input: EnsureProjectInput): Promise<string | null> {
  const admin = createAdminClient()

  // 이미 연결된 매출이면 그대로 반환
  const { data: existing } = await admin
    .from('sales')
    .select('project_id')
    .eq('id', input.saleId)
    .single()
  if (existing?.project_id) return existing.project_id as string

  const { data: project, error } = await admin.from('projects').insert({
    name: input.name,
    service_type: input.service_type,
    department: input.department,
    pm_id: input.pm_id,
    customer_id: input.customer_id,
    status: '진행중',
    _source_sale_id: input.saleId,
    project_number: input.project_number,
    dropbox_url: input.dropbox_url,
    main_type: input.main_type ?? null,
    expansion_tags: input.expansion_tags ?? [],
  }).select('id').single()

  if (error || !project) return null

  await admin.from('sales').update({ project_id: project.id }).eq('id', input.saleId)

  if (input.pm_id) {
    await admin
      .from('project_members')
      .insert({ project_id: project.id, profile_id: input.pm_id, role: 'PM' })
      .single()
  }

  return project.id as string
}

/**
 * YY-NNN 형식 프로젝트 고유번호 생성 (예: 26-009).
 * 해당 연도의 sales 행 개수 +1 기반.
 */
export async function generateProjectNumber(): Promise<string> {
  const admin = createAdminClient()
  const year = new Date().getFullYear()
  const yy = String(year).slice(2)
  const { count } = await admin
    .from('sales')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', `${year}-01-01`)
  const num = (count ?? 0) + 1
  return `${yy}-${String(num).padStart(3, '0')}`
}
