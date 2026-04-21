'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { SERVICE_TO_DEPT } from '@/types'
import { createSaleFolder } from '@/lib/dropbox'

// 사업부 내에서 직접 새 건 추가 (redirect 없이 revalidate)
export async function createSaleFromDept(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const admin = createAdminClient()
  const service_type = (formData.get('service_type') as string) || null
  const department = (service_type && SERVICE_TO_DEPT[service_type]) || (formData.get('department') as string) || null
  const name = formData.get('name') as string
  const inflow_date = (formData.get('inflow_date') as string) || null

  const { data: sale } = await admin.from('sales').insert({
    name,
    department,
    service_type,
    assignee_id: (formData.get('assignee_id') as string) || null,
    client_org: (formData.get('client_org') as string) || null,
    revenue: formData.get('revenue') ? Number(formData.get('revenue')) : 0,
    contract_stage: '계약',
    inflow_date,
  }).select('id').single()

  if (sale) {
    const dropboxUrl = await createSaleFolder({ service_type, name, inflow_date })
    if (dropboxUrl) {
      await admin.from('sales').update({ dropbox_url: dropboxUrl }).eq('id', sale.id)
    }
  }

  if (department) {
    revalidatePath(`/departments/${department}`)
  }
  revalidatePath('/sales/report')
  revalidatePath('/sales')
}

export async function createGoal(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin' && profile?.role !== 'manager') throw new Error('Admin only')

  const admin = createAdminClient()
  const dept = formData.get('department') as string
  const year = parseInt(formData.get('year') as string) || new Date().getFullYear()

  await admin.from('department_goals').insert({
    department:    dept,
    title:         formData.get('title') as string,
    description:   formData.get('description') as string || null,
    year,
    target_value:  formData.get('target_value') ? parseFloat(formData.get('target_value') as string) : null,
    current_value: formData.get('current_value') ? parseFloat(formData.get('current_value') as string) : 0,
    unit:          formData.get('unit') as string || null,
    status:        formData.get('status') as string || '진행중',
    deadline:      formData.get('deadline') as string || null,
  })

  revalidatePath(`/departments/${dept}`)
  revalidatePath('/departments')
}

export async function updateGoal(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin' && profile?.role !== 'manager') throw new Error('Admin only')

  const admin = createAdminClient()
  const id = formData.get('id') as string
  const dept = formData.get('department') as string

  await admin.from('department_goals').update({
    title:         formData.get('title') as string,
    description:   formData.get('description') as string || null,
    target_value:  formData.get('target_value') ? parseFloat(formData.get('target_value') as string) : null,
    current_value: formData.get('current_value') ? parseFloat(formData.get('current_value') as string) : 0,
    unit:          formData.get('unit') as string || null,
    status:        formData.get('status') as string,
    deadline:      formData.get('deadline') as string || null,
    updated_at:    new Date().toISOString(),
  }).eq('id', id)

  revalidatePath(`/departments/${dept}`)
  revalidatePath('/departments')
}

export async function deleteGoal(id: string, dept: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin' && profile?.role !== 'manager') throw new Error('Admin only')

  const admin = createAdminClient()
  await admin.from('department_goals').delete().eq('id', id)

  revalidatePath(`/departments/${dept}`)
  revalidatePath('/departments')
}

export async function updateSaleServiceType(saleId: string, serviceType: string, dept: string) {
  const admin = createAdminClient()
  const newDept = SERVICE_TO_DEPT[serviceType] ?? dept
  await admin.from('sales').update({ service_type: serviceType, department: newDept }).eq('id', saleId)
  revalidatePath(`/departments/${dept}`)
  if (newDept !== dept) revalidatePath(`/departments/${newDept}`)
}

export async function updateSaleRemindDate(saleId: string, remind_date: string | null, dept: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const admin = createAdminClient()
  await admin.from('sales').update({ remind_date }).eq('id', saleId)

  revalidatePath(`/departments/${dept}`)
  revalidatePath(`/sales/${saleId}`)
}
