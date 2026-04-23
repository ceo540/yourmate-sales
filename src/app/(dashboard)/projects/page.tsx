import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { createProfileNameMap } from '@/lib/utils'
import { isAdminOrManager } from '@/lib/permissions'
import ProjectsClient from './ProjectsClient'

export default async function ProjectsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('id, role, name').eq('id', user.id).single()
  const isAdmin = isAdminOrManager(profile?.role)

  // 프로젝트 목록 — sales join으로 단계/매출 정보 포함
  const [{ data: projectsRaw }, { data: profiles }] = await Promise.all([
    admin.from('projects')
      .select(`
        id, name, service_type, status, project_number, customer_id, pm_id, created_at,
        sales(id, revenue, contract_stage, inflow_date),
        customers(id, name)
      `)
      .order('created_at', { ascending: false }),
    admin.from('profiles').select('id, name'),
  ])

  const profileMap = createProfileNameMap(profiles)

  const projects = (projectsRaw ?? []).map((p: any) => {
    const sale = (p.sales ?? [])[0] ?? null
    return {
      id: p.id,
      name: p.name,
      project_number: p.project_number ?? null,
      service_type: p.service_type ?? null,
      status: p.status ?? '진행중',
      customer_name: p.customers?.name ?? null,
      pm_name: p.pm_id ? (profileMap[p.pm_id] ?? null) : null,
      revenue: sale?.revenue ?? null,
      contract_stage: sale?.contract_stage ?? null,
      inflow_date: sale?.inflow_date ?? p.created_at?.slice(0, 10) ?? null,
    }
  })

  return (
    <div className="max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">프로젝트</h1>
        <p className="text-gray-500 text-sm mt-1">
          총 {projects.length}건 · 진행중 {projects.filter(p => p.status === '진행중').length}건
        </p>
      </div>
      <ProjectsClient projects={projects} isAdmin={isAdmin} />
    </div>
  )
}
