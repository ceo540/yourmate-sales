import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import PayrollClient from './PayrollClient'

export default async function PayrollPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/sales')

  const [{ data: payroll }, { data: profiles }, { data: businessEntities }, { data: bonusItems }, { data: employeeCards }] = await Promise.all([
    supabase.from('payroll').select('*').order('year', { ascending: false }).order('month', { ascending: false }).order('employee_name'),
    supabase.from('profiles').select('id, name').order('name'),
    supabase.from('business_entities').select('*').order('name'),
    supabase.from('employee_bonus_items').select('*').order('year', { ascending: false }).order('month', { ascending: false }).order('date', { ascending: false }),
    supabase.from('employee_cards').select('*').order('employee_name'),
  ])

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">인건비 관리</h1>
        <p className="text-gray-500 text-sm mt-1">월별 직원 급여 현황</p>
      </div>
      <PayrollClient payroll={payroll ?? []} profiles={profiles ?? []} businessEntities={businessEntities ?? []} bonusItems={bonusItems ?? []} employeeCards={employeeCards ?? []} />
    </div>
  )
}
