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

  const { data: users } = await supabase
    .from('profiles')
    .select('id, name, departments, role, created_at')
    .order('created_at', { ascending: false })

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">팀원 관리</h1>
        <p className="text-gray-500 text-sm mt-1">팀원 초대 및 권한 설정</p>
      </div>
      <AdminClient users={users ?? []} />
    </div>
  )
}
