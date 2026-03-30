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
    entity_id: (formData.get('entity_id') as string) || null,
    revenue: formData.get('revenue') ? Number(formData.get('revenue')) : 0,
    payment_status: (formData.get('payment_status') as string) || '계약전',
    contract_type: (formData.get('contract_type') as string) || null,
    memo: (formData.get('memo') as string) || null,
    inflow_date: (formData.get('inflow_date') as string) || null,
    payment_date: (formData.get('payment_date') as string) || null,
    dropbox_url: (formData.get('dropbox_url') as string) || null,
  })
  redirect('/sales/report')
}

export async function updateSale(formData: FormData) {
  const supabase = await createClient()
  const id = formData.get('id') as string
  const from = (formData.get('from') as string) || '/sales/report'
  await supabase.from('sales').update({
    name: formData.get('name') as string,
    department: (formData.get('department') as string) || null,
    assignee_id: (formData.get('assignee_id') as string) || null,
    entity_id: (formData.get('entity_id') as string) || null,
    revenue: formData.get('revenue') ? Number(formData.get('revenue')) : 0,
    payment_status: (formData.get('payment_status') as string) || '계약전',
    contract_type: (formData.get('contract_type') as string) || null,
    memo: (formData.get('memo') as string) || null,
    inflow_date: (formData.get('inflow_date') as string) || null,
    payment_date: (formData.get('payment_date') as string) || null,
    dropbox_url: (formData.get('dropbox_url') as string) || null,
    updated_at: new Date().toISOString(),
  }).eq('id', id)
  redirect(from)
}

export async function deleteSale(id: string) {
  const supabase = await createClient()
  await supabase.from('sales').delete().eq('id', id)
  revalidatePath('/sales')
}

export async function bulkDeleteSales(ids: string[]) {
  const supabase = await createClient()
  await supabase.from('sales').delete().in('id', ids)
  revalidatePath('/sales')
}

export async function bulkUpdateSalesStatus(ids: string[], payment_status: string) {
  const supabase = await createClient()
  await supabase.from('sales').update({ payment_status, updated_at: new Date().toISOString() }).in('id', ids)
  revalidatePath('/sales')
}

export async function updateSaleEntity(id: string, entity_id: string | null) {
  const supabase = await createClient()
  await supabase.from('sales').update({ entity_id, updated_at: new Date().toISOString() }).eq('id', id)
  revalidatePath('/sales/report')
  revalidatePath('/sales')
}

export async function updateSaleContractType(id: string, contract_type: string | null) {
  const supabase = await createClient()
  await supabase.from('sales').update({ contract_type, updated_at: new Date().toISOString() }).eq('id', id)
  revalidatePath('/sales/report')
  revalidatePath('/sales')
}

export async function updateSaleInline(id: string, data: {
  name: string
  department: string | null
  assignee_id: string | null
  entity_id: string | null
  revenue: number
  payment_status: string
  contract_type: string | null
  memo: string | null
  inflow_date: string | null
  payment_date: string | null
  dropbox_url: string | null
}) {
  const supabase = await createClient()
  await supabase.from('sales').update({ ...data, updated_at: new Date().toISOString() }).eq('id', id)
  revalidatePath('/sales/report')
  revalidatePath('/sales')
}
