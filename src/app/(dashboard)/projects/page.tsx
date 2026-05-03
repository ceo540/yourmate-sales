import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { createProfileNameMap } from '@/lib/utils'
import { isAdminOrManager } from '@/lib/permissions'
import ProjectsClient from './ProjectsClient'
import StageHint from '@/components/StageHint'

export default async function ProjectsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('id, role, name').eq('id', user.id).single()
  const isAdmin = isAdminOrManager(profile?.role)

  // 프로젝트 목록 — sales join으로 단계/매출 정보 포함
  const [{ data: projectsRaw }, { data: profiles }, { data: customers }, { data: pmMembers }] = await Promise.all([
    admin.from('projects')
      .select(`
        id, name, service_type, status, project_number, customer_id, pm_id, created_at,
        main_type, expansion_tags,
        sales(id, revenue, contract_stage, inflow_date),
        customers(id, name)
      `)
      .order('created_at', { ascending: false }),
    admin.from('profiles').select('id, name').order('name'),
    admin.from('customers').select('id, name').order('name'),
    // PM 동기화 안 된 옛 데이터 대비 — project_members.role='PM' 우선 조회
    admin.from('project_members').select('project_id, profile_id').eq('role', 'PM'),
  ])

  const profileMap = createProfileNameMap(profiles)
  const pmMemberMap = new Map<string, string>(((pmMembers ?? []) as Array<{ project_id: string; profile_id: string }>).map(m => [m.project_id, m.profile_id]))

  const projects = (projectsRaw ?? []).map((p: any) => {
    const sale = (p.sales ?? [])[0] ?? null
    // PM = project_members.role='PM' 우선, fallback projects.pm_id
    const effectivePmId = pmMemberMap.get(p.id) ?? p.pm_id ?? null
    return {
      id: p.id,
      name: p.name,
      project_number: p.project_number ?? null,
      service_type: p.service_type ?? null,
      status: p.status ?? '진행중',
      customer_name: p.customers?.name ?? null,
      pm_name: effectivePmId ? (profileMap[effectivePmId] ?? null) : null,
      revenue: sale?.revenue ?? null,
      contract_stage: sale?.contract_stage ?? null,
      inflow_date: sale?.inflow_date ?? p.created_at?.slice(0, 10) ?? null,
      main_type: p.main_type ?? null,
      expansion_tags: (p.expansion_tags as string[] | null) ?? [],
    }
  })

  return (
    <div className="max-w-[1400px]">
      <div className="mb-4">
        <div className="flex items-end justify-between gap-4 mb-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">프로젝트</h1>
            <p className="text-gray-500 text-sm mt-1">
              총 {projects.length}건 · 진행중 {projects.filter(p => p.status === '진행중').length}건
            </p>
          </div>
        </div>
        <StageHint stage="project" />
      </div>
      <ProjectsClient
        projects={projects}
        isAdmin={isAdmin}
        profiles={(profiles ?? []).map(p => ({ id: p.id, name: p.name ?? '' }))}
        customers={(customers ?? []).map(c => ({ id: c.id, name: c.name }))}
      />
    </div>
  )
}
