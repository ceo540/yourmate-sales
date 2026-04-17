import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import PipelineClient from './PipelineClient'


export default async function PipelinePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()

  // 완료·취소 제외한 리드
  const { data: leadsRaw } = await admin
    .from('leads')
    .select('id, lead_id, client_org, service_type, status, assignee_id, remind_date, inflow_date')
    .not('status', 'in', '("완료","취소")')
    .order('inflow_date', { ascending: false })

  // 완납 제외한 매출건 (진행 중인 것)
  const { data: salesRaw } = await admin
    .from('sales')
    .select('id, name, client_org, service_type, contract_stage, progress_status, revenue, assignee_id, lead_id, inflow_date, remind_date')
    .not('contract_stage', 'eq', '잔금')
    .order('inflow_date', { ascending: false })

  // 담당자 목록
  const { data: profilesRaw } = await admin.from('profiles').select('id, name').order('name')

  return (
    <PipelineClient
      leads={leadsRaw ?? []}
      sales={salesRaw ?? []}
      profiles={profilesRaw ?? []}
      currentUserId={user.id}
    />
  )
}
