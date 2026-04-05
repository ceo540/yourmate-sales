import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AdminClient from './AdminClient'
import { parseDepartments } from '@/lib/utils'

export default async function AdminPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') redirect('/dashboard')

  const [{ data: profilesRaw }, { data: entities }] = await Promise.all([
    supabase.from('profiles').select('id, name, departments, role, created_at, join_date, entity_id, phone, emergency_name, emergency_phone, bank_name, account_number, birth_date').order('created_at', { ascending: false }),
    supabase.from('business_entities').select('id, name, business_number').order('name'),
  ])

  const { createAdminClient } = await import('@/lib/supabase/admin')
  const adminClient = createAdminClient()
  const year = new Date().getFullYear()
  const [{ data: authUsersData }, { data: allPerms }, { data: leaveRows }, { data: oneOnOnes }, { data: docRequests }, { data: leaveBalancesRaw }, { data: salaryRecords }, { data: onboardingItems }, { data: notionTemplateUrl }, { data: orgDepts }, { data: employeeCards }] = await Promise.all([
    adminClient.auth.admin.listUsers(),
    adminClient.from('role_permissions').select('role, page_key, access_level').neq('role', 'admin'),
    adminClient.from('leave_requests').select('member_id, days')
      .eq('director_approval', '승인').eq('ceo_approval', '승인')
      .gte('start_date', `${year}-01-01`).lte('start_date', `${year}-12-31`),
    adminClient.from('one_on_ones').select('*').order('date', { ascending: false }),
    adminClient.from('document_requests').select('*').order('created_at', { ascending: false }),
    adminClient.from('leave_balances').select('member_id, initial_days').eq('year', year),
    adminClient.from('salary_records').select('*').order('year').order('month'),
    adminClient.from('onboarding_items').select('*').order('sort_order'),
    adminClient.from('system_settings').select('value').eq('key', 'onboarding_notion_url').single(),
    adminClient.from('departments').select('*').order('sort_order'),
    adminClient.from('employee_cards').select('*').order('employee_name'),
  ])
  const authMap = new Map(authUsersData?.users?.map(u => [u.id, {
    email: u.email,
    last_sign_in_at: u.last_sign_in_at ?? null,
    confirmed_at: u.confirmed_at ?? null,
  }]))

  const users = (profilesRaw ?? []).map(p => {
    const departments = parseDepartments((p as any).departments)
    return {
      ...p,
      departments,
      email: authMap.get(p.id)?.email ?? null,
      last_sign_in_at: authMap.get(p.id)?.last_sign_in_at ?? null,
      confirmed_at: authMap.get(p.id)?.confirmed_at ?? null,
    }
  })

  const permissionsByRole: Record<string, Record<string, string>> = {}
  for (const p of (allPerms ?? [])) {
    if (!permissionsByRole[p.role]) permissionsByRole[p.role] = {}
    permissionsByRole[p.role][p.page_key] = p.access_level
  }

  // 초기 사용일수 맵 (시스템 도입 전 사용분)
  const initialDaysMap: Record<string, number> = {}
  for (const b of (leaveBalancesRaw ?? [])) {
    initialDaysMap[b.member_id] = b.initial_days ?? 0
  }

  // 사람별 올해 사용 연차 합산 (실제 신청분 + 초기 사용분)
  const usedDaysMap: Record<string, number> = {}
  for (const r of (leaveRows ?? [])) {
    usedDaysMap[r.member_id] = (usedDaysMap[r.member_id] ?? 0) + (r.days ?? 0)
  }
  for (const [memberId, initDays] of Object.entries(initialDaysMap)) {
    usedDaysMap[memberId] = (usedDaysMap[memberId] ?? 0) + initDays
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">팀원 관리</h1>
        <p className="text-gray-500 text-sm mt-1">팀원 초대 및 권한 설정</p>
      </div>
      <AdminClient
        users={users ?? []}
        entities={entities ?? []}
        permissionsByRole={permissionsByRole}
        usedDaysMap={usedDaysMap}
        initialDaysMap={initialDaysMap}
        oneOnOnes={oneOnOnes ?? []}
        docRequests={docRequests ?? []}
        salaryRecords={salaryRecords ?? []}
        onboardingItems={onboardingItems ?? []}
        notionTemplateUrl={notionTemplateUrl?.value ?? ''}
        orgDepts={orgDepts ?? []}
        employeeCards={employeeCards ?? []}
      />
    </div>
  )
}
