'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function createSale(formData: FormData) {
  const supabase = await createClient()
  await supabase.from('sales').insert({
    name: formData.get('name') as string,
    department: (formData.get('department') as string) || null,
    assignee_id: (formData.get('assignee_id') as string) || null,
    revenue: formData.get('revenue') ? Number(formData.get('revenue')) : 0,
    payment_status: (formData.get('payment_status') as string) || '계약전',
    memo: (formData.get('memo') as string) || null,
    inflow_date: (formData.get('inflow_date') as string) || null,
    payment_date: (formData.get('payment_date') as string) || null,
    dropbox_url: (formData.get('dropbox_url') as string) || null,
  })
  redirect('/sales')
}

export async function updateSale(formData: FormData) {
  const supabase = await createClient()
  const id = formData.get('id') as string
  await supabase.from('sales').update({
    name: formData.get('name') as string,
    department: (formData.get('department') as string) || null,
    assignee_id: (formData.get('assignee_id') as string) || null,
    revenue: formData.get('revenue') ? Number(formData.get('revenue')) : 0,
    payment_status: (formData.get('payment_status') as string) || '계약전',
    memo: (formData.get('memo') as string) || null,
    inflow_date: (formData.get('inflow_date') as string) || null,
    payment_date: (formData.get('payment_date') as string) || null,
    dropbox_url: (formData.get('dropbox_url') as string) || null,
    updated_at: new Date().toISOString(),
  }).eq('id', id)
  redirect('/sales')
}

export async function deleteSale(id: string) {
  const supabase = await createClient()
  await supabase.from('sales').delete().eq('id', id)
  revalidatePath('/sales')
}
