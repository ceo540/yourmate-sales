import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import LeadsClient from './LeadsClient'

export const dynamic = 'force-dynamic'

export default async function LeadsPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('id, role').eq('id', user.id).single()
  const role = profile?.role || 'member'

  const leadsQuery = admin.from('leads').select('*').order('inflow_date', { ascending: false })
  const [{ data: leadsRaw }, { data: profilesRaw }] = await Promise.all([
    role === 'member' ? leadsQuery.eq('assignee_id', user.id) : leadsQuery,
    admin.from('profiles').select('id, name').order('name'),
  ])

  const profileMap = Object.fromEntries((profilesRaw ?? []).map(p => [p.id, p]))

  const leads = (leadsRaw ?? []).map((l: any) => ({
    ...l,
    assignee: l.assignee_id ? (profileMap[l.assignee_id] ?? null) : null,
  }))

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">리드 관리</h1>
          <p className="text-gray-500 text-sm mt-1">잠재 고객 문의 및 영업 파이프라인</p>
        </div>
      </div>
      <LeadsClient
        leads={leads}
        profiles={profilesRaw ?? []}
        currentUserId={user.id}
        isAdmin={role === 'admin' || role === 'manager'}
      />
    </div>
  )
}
