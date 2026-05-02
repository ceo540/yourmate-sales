// 영업 활동 추적 (yourmate-spec.md §5.13)
// 콜드메일·콜드콜·방문 등 매일 영업 활동 기록. lead 이전 단계.

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { isAdminOrManager } from '@/lib/permissions'
import ProspectsClient from './ProspectsClient'
import type { Prospect, ProspectActivity } from '@/types'

export default async function ProspectsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('id, role').eq('id', user.id).single()
  if (!isAdminOrManager(profile?.role)) {
    return <div className="p-8 text-gray-500">관리자만 접근 가능</div>
  }

  const [{ data: prospectsRaw }, { data: activitiesRaw }] = await Promise.all([
    admin.from('prospects').select('*').eq('archive_status', 'active').order('updated_at', { ascending: false }).limit(200),
    admin.from('prospect_activities').select('*').order('done_at', { ascending: false }).limit(500),
  ])

  return (
    <ProspectsClient
      prospects={(prospectsRaw ?? []) as Prospect[]}
      activities={(activitiesRaw ?? []) as ProspectActivity[]}
    />
  )
}
