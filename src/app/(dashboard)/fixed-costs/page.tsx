import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import FixedCostsClient from './FixedCostsClient'

export default async function FixedCostsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/dashboard')

  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1

  const [{ data: fixedCosts }, { data: entities }, { data: payroll }] = await Promise.all([
    supabase.from('fixed_costs').select('*').order('is_active', { ascending: false }).order('category').order('name'),
    supabase.from('business_entities').select('id, name').order('name'),
    supabase.from('payroll').select('employee_name, base_salary, meal_allowance, mileage_allowance, allowances, fixed_bonus, bonus, unpaid_leave, business_entity, payment_confirmed').eq('year', year).eq('month', month),
  ])

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">고정비 관리</h1>
        <p className="text-gray-500 text-sm mt-1">매월 발생하는 고정 지출 항목</p>
      </div>
      <FixedCostsClient fixedCosts={fixedCosts ?? []} entities={entities ?? []} payroll={payroll ?? []} currentMonth={{ year, month }} />
    </div>
  )
}
