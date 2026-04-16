import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import FinanceClient from './FinanceClient'

export default async function FinancePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/dashboard')

  const thisYear = new Date().getFullYear()

  const [
    { data: sales },
    { data: fixedCosts },
    { data: payroll },
  ] = await Promise.all([
    supabase
      .from('sales')
      .select('id, name, revenue, contract_stage, inflow_date, entity:business_entities(id, name), sale_costs(amount, category, is_paid)')
      .gte('inflow_date', `${thisYear}-01-01`)
      .order('inflow_date', { ascending: false }),
    supabase
      .from('fixed_costs')
      .select('name, category, amount, business_entity, is_active')
      .eq('is_active', true),
    supabase
      .from('payroll')
      .select('year, month, employee_name, base_salary, meal_allowance, mileage_allowance, allowances, fixed_bonus, bonus, unpaid_leave, business_entity, payment_confirmed')
      .eq('year', thisYear),
  ])

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">재무 현황</h1>
        <p className="text-gray-500 text-sm mt-1">{thisYear}년 손익 분석</p>
      </div>
      <FinanceClient
        sales={sales ?? []}
        fixedCosts={fixedCosts ?? []}
        payroll={payroll ?? []}
        year={thisYear}
      />
    </div>
  )
}
