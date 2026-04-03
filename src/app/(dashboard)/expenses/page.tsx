import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ExpensesClient from './ExpensesClient'

export default async function ExpensesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const isManager = ['admin', 'manager'].includes(profile?.role ?? '')

  const [{ data: expensesRaw }, { data: profilesRaw }] = await Promise.all([
    supabase.from('expenses').select('*').order('created_at', { ascending: false }),
    supabase.from('profiles').select('id, name'),
  ])

  const profileMap = Object.fromEntries((profilesRaw ?? []).map(p => [p.id, p.name]))

  const expenses = (expensesRaw ?? []).map((e: any) => ({
    ...e,
    employee_name: profileMap[e.employee_id] ?? '알 수 없음',
  }))

  return (
    <ExpensesClient
      expenses={expenses}
      isManager={isManager}
      currentUserId={user.id}
    />
  )
}