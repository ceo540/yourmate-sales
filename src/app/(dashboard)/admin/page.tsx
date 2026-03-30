import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AdminClient from './AdminClient'

export default async function AdminPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') redirect('/sales')

  const [{ data: profilesRaw }, { data: entities }] = await Promise.all([
    supabase.from('profiles').select('id, name, departments, role, created_at').order('created_at', { ascending: false }),
    supabase.from('business_entities').select('id, name, business_number').order('name'),
  ])

  const { createAdminClient } = await import('@/lib/supabase/admin')
  const adminClient = createAdminClient()
  const { data: authUsers } = await adminClient.auth.admin.listUsers()
  const authMap = new Map(authUsers?.users?.map(u => [u.id, {
    email: u.email,
    last_sign_in_at: u.last_sign_in_at ?? null,
    confirmed_at: u.confirmed_at ?? null,
  }]))

  const users = (profilesRaw ?? []).map(p => ({
    ...p,
    email: authMap.get(p.id)?.email ?? null,
    last_sign_in_at: authMap.get(p.id)?.last_sign_in_at ?? null,
    confirmed_at: authMap.get(p.id)?.confirmed_at ?? null,
  }))

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">팀원 관리</h1>
        <p className="text-gray-500 text-sm mt-1">팀원 초대 및 권한 설정</p>
      </div>
      <AdminClient users={users ?? []} entities={entities ?? []} />
    </div>
  )
}
