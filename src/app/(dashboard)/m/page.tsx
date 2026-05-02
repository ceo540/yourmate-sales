// 모바일 빠른 입력 페이지 (yourmate-spec.md §4.7)
// 현장 직원이 사진·메모·음성·영수증을 빠르게 올리기. 활성 프로젝트 자동 추천.

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { isAdminOrManager } from '@/lib/permissions'
import MobileQuickClient from './MobileQuickClient'

export default async function MobilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('id, role').eq('id', user.id).single()
  if (!isAdminOrManager(profile?.role)) {
    return <div className="p-8 text-gray-500">관리자만 접근 가능 (모바일은 검증 단계라 admin 한정)</div>
  }

  // 활성 프로젝트 (최근 진행 中 — 자동 추천)
  const { data: activeProjects } = await admin
    .from('projects')
    .select('id, name, project_number, customer_id, service_type, dropbox_url')
    .eq('status', '진행중')
    .order('updated_at', { ascending: false })
    .limit(20)

  return (
    <MobileQuickClient
      projects={(activeProjects ?? []).map(p => ({
        id: p.id,
        name: p.name,
        project_number: p.project_number ?? null,
        customer_id: p.customer_id ?? null,
        service_type: p.service_type ?? null,
      }))}
      currentUserId={user.id}
    />
  )
}
