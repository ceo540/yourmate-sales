'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function upsertPayroll(data: {
  id?: string
  year: number
  month: number
  employee_name: string
  employee_type: string
  business_entity?: string | null
  profile_id?: string | null
  base_salary: number
  meal_allowance: number
  mileage_allowance: number
  allowances: number
  fixed_bonus: number
  bonus: number
  unpaid_leave: number
  national_pension: number
  health_insurance: number
  employment_insurance: number
  income_tax: number
  resident_id?: string | null
  bank_info?: string | null
  payment_confirmed: boolean
  payment_date?: string | null
  memo?: string | null
  description?: string | null
}) {
  const supabase = await createClient()
  if (data.id) {
    const { id, ...rest } = data
    await supabase.from('payroll').update(rest).eq('id', id)
  } else {
    await supabase.from('payroll').insert(data)
  }
  revalidatePath('/payroll')
}

export async function deletePayroll(id: string) {
  const supabase = await createClient()
  await supabase.from('payroll').delete().eq('id', id)
  revalidatePath('/payroll')
}

export async function upsertBusinessEntity(data: { id?: string; name: string }) {
  const supabase = await createClient()
  if (data.id) {
    await supabase.from('business_entities').update({ name: data.name }).eq('id', data.id)
  } else {
    await supabase.from('business_entities').insert({ name: data.name })
  }
  revalidatePath('/payroll')
}

export async function deleteBusinessEntity(id: string) {
  const supabase = await createClient()
  await supabase.from('business_entities').delete().eq('id', id)
  revalidatePath('/payroll')
}

export async function upsertBonusItem(data: {
  id?: string
  year: number
  month: number
  employee_name: string
  business_entity?: string | null
  date?: string | null
  description: string
  detail?: string | null
  amount: number
}) {
  const supabase = await createClient()
  if (data.id) {
    const { id, ...rest } = data
    await supabase.from('employee_bonus_items').update(rest).eq('id', id)
  } else {
    await supabase.from('employee_bonus_items').insert(data)
  }
  revalidatePath('/payroll')
}

export async function deleteBonusItem(id: string) {
  const supabase = await createClient()
  await supabase.from('employee_bonus_items').delete().eq('id', id)
  revalidatePath('/payroll')
}

export async function upsertEmployeeCard(data: {
  id?: string
  employee_name: string
  business_entity?: string | null
  profile_id?: string | null
  base_salary: number
  meal_allowance: number
  mileage_allowance: number
  allowances: number
  fixed_bonus: number
  national_pension: number
  health_insurance: number
  employment_insurance: number
  income_tax: number
  resident_id?: string | null
  bank_info?: string | null
  dependents?: number
  hourly_rate?: number | null
  memo?: string | null
  is_active: boolean
}) {
  const supabase = await createClient()
  if (data.id) {
    const { id, ...rest } = data
    await supabase.from('employee_cards').update(rest).eq('id', id)
  } else {
    await supabase.from('employee_cards').insert(data)
  }
  revalidatePath('/payroll')
  revalidatePath('/admin')
}

export async function deleteEmployeeCard(id: string) {
  const supabase = await createClient()
  await supabase.from('employee_cards').delete().eq('id', id)
  revalidatePath('/payroll')
  revalidatePath('/admin')
}

export async function generateMonthlyFromCards(year: number, month: number) {
  const supabase = await createClient()
  const { data: cards } = await supabase.from('employee_cards').select('*').eq('is_active', true)
  if (!cards || cards.length === 0) return { created: 0 }

  const { data: existing } = await supabase
    .from('payroll').select('employee_name')
    .eq('year', year).eq('month', month).eq('employee_type', 'employee')

  const existingNames = new Set((existing ?? []).map((r: any) => r.employee_name))
  const toInsert = cards
    .filter((c: any) => !existingNames.has(c.employee_name))
    .map((c: any) => ({
      year, month,
      employee_name: c.employee_name,
      employee_type: 'employee',
      business_entity: c.business_entity,
      profile_id: c.profile_id,
      base_salary: c.base_salary,
      meal_allowance: c.meal_allowance,
      mileage_allowance: c.mileage_allowance,
      allowances: c.allowances,
      fixed_bonus: c.fixed_bonus,
      bonus: 0,
      unpaid_leave: 0,
      national_pension: c.national_pension,
      health_insurance: c.health_insurance,
      employment_insurance: c.employment_insurance,
      income_tax: c.income_tax,
      resident_id: c.resident_id,
      bank_info: c.bank_info,
      payment_confirmed: false,
    }))

  if (toInsert.length > 0) {
    await supabase.from('payroll').insert(toInsert)
  }
  revalidatePath('/payroll')
  return { created: toInsert.length, skipped: cards.length - toInsert.length }
}
