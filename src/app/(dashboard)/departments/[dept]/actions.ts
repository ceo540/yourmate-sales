'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function createGoal(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') throw new Error('Admin only')

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
  if (profile?.role !== 'admin') throw new Error('Admin only')

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
  if (profile?.role !== 'admin') throw new Error('Admin only')

  const admin = createAdminClient()
  await admin.from('department_goals').delete().eq('id', id)

  revalidatePath(`/departments/${dept}`)
  revalidatePath('/departments')
}
