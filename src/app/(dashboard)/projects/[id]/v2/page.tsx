import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { notFound, redirect } from 'next/navigation'
import { isAdminOrManager } from '@/lib/permissions'
import ProjectV2Client from './ProjectV2Client'

// V2 — 새 디자인 데모. 만족스러우면 기존 페이지 대체.
// 기존 /projects/[id] 와 같은 데이터 사용. 점진적으로 데이터 fetch 확장.
export default async function ProjectV2Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const [{ data: profile }, { data: project }] = await Promise.all([
    admin.from('profiles').select('id, role, name').eq('id', user.id).single(),
    admin.from('projects').select('*').eq('id', id).single(),
  ])
  if (!project) notFound()

  const isAdmin = isAdminOrManager(profile?.role)

  return (
    <ProjectV2Client
      project={{
        id: project.id,
        name: project.name,
        project_number: project.project_number ?? null,
        service_type: project.service_type ?? null,
        department: project.department ?? null,
        status: project.status ?? '진행중',
        dropbox_url: project.dropbox_url ?? null,
        memo: project.memo ?? null,
        notes: project.notes ?? null,
        customer_id: project.customer_id ?? null,
        pm_id: project.pm_id ?? null,
      }}
      isAdmin={isAdmin}
      currentUserId={user.id}
    />
  )
}
