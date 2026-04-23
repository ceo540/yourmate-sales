import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { isAdminOrManager } from '@/lib/permissions'
import HrClient from './HrClient'

function calcAnnualLeave(joinDate: string): number {
  const join = new Date(joinDate)
  const today = new Date()
  const totalMonths =
    (today.getFullYear() - join.getFullYear()) * 12 +
    (today.getMonth() - join.getMonth())
  if (totalMonths < 12) return Math.min(totalMonths, 11)
  return Math.min(15 + Math.floor((Math.floor(totalMonths / 12) - 1) / 2), 25)
}

export default async function HrPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const isAdmin = isAdminOrManager(profile?.role)

  const admin = createAdminClient()
  const year = new Date().getFullYear()

  const [{ data: profilesRaw }, { data: leavesRaw }, { data: docRequestsRaw }, { data: leaveBalancesRaw }] = await Promise.all([
    admin.from('profiles').select('id, name, role, join_date').order('created_at', { ascending: true }),
    admin.from('leave_requests').select('*')
      .gte('start_date', `${year}-01-01`)
      .order('created_at', { ascending: false }),
    admin.from('document_requests').select('*').order('created_at', { ascending: false }),
    admin.from('leave_balances').select('member_id, initial_days').eq('year', year),
  ])

  const initialBalances: Record<string, number> = {}
  for (const b of (leaveBalancesRaw ?? [])) {
    initialBalances[b.member_id] = b.initial_days ?? 0
  }

  const members = (profilesRaw ?? []).map(p => ({
    id: p.id,
    name: p.name ?? '',
    role: p.role ?? 'member',
    joinDate: p.join_date ?? null,
    annualLeave: p.join_date ? calcAnnualLeave(p.join_date) : null,
  }))

  const leaves = leavesRaw ?? []

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">인사 관리</h1>
          <p className="text-gray-500 text-sm mt-1">연차 신청 · 서류 발급 · 현황 ({year}년)</p>
        </div>
      </div>
      <HrClient
        members={members}
        initialLeaves={leaves}
        initialDocRequests={docRequestsRaw ?? []}
        initialBalances={initialBalances}
        currentUserId={user.id}
        isAdmin={isAdmin}
      />
    </div>
  )
}
