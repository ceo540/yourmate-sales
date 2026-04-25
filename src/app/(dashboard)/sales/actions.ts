'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { SERVICE_TO_DEPT, ProgressStatus } from '@/types'
import { createSaleFolder } from '@/lib/dropbox'

export async function createSale(formData: FormData) {
  const supabase = await createClient()
  const service_type = (formData.get('service_type') as string) || null
  const department = (service_type && SERVICE_TO_DEPT[service_type]) || (formData.get('department') as string) || null
  const name = formData.get('name') as string
  const inflow_date = (formData.get('inflow_date') as string) || null
  const manualDropboxUrl = (formData.get('dropbox_url') as string) || null

  const { data: sale } = await supabase.from('sales').insert({
    name,
    department,
    assignee_id: (formData.get('assignee_id') as string) || null,
    entity_id: (formData.get('entity_id') as string) || null,
    client_org: (formData.get('client_org') as string) || null,
    customer_id: (formData.get('customer_id') as string) || null,
    service_type,
    revenue: formData.get('revenue') ? Number(formData.get('revenue')) : 0,
    contract_stage: (formData.get('contract_stage') as string) || '계약',
    contract_type: (formData.get('contract_type') as string) || null,
    memo: (formData.get('memo') as string) || null,
    inflow_date,
    payment_date: (formData.get('payment_date') as string) || null,
    dropbox_url: manualDropboxUrl,
  }).select('id').single()

  // 수동 입력이 없을 때만 자동 생성
  if (sale && !manualDropboxUrl) {
    const dropboxUrl = await createSaleFolder({ service_type, name, inflow_date })
    if (dropboxUrl) {
      await supabase.from('sales').update({ dropbox_url: dropboxUrl }).eq('id', sale.id)
    }
  }

  redirect('/sales/report')
}

export async function updateSale(formData: FormData) {
  const supabase = await createClient()
  const id = formData.get('id') as string
  const from = (formData.get('from') as string) || '/sales/report'
  const service_type = (formData.get('service_type') as string) || null
  const department = (service_type && SERVICE_TO_DEPT[service_type]) || (formData.get('department') as string) || null
  await supabase.from('sales').update({
    name: formData.get('name') as string,
    department,
    assignee_id: (formData.get('assignee_id') as string) || null,
    entity_id: (formData.get('entity_id') as string) || null,
    client_org: (formData.get('client_org') as string) || null,
    customer_id: (formData.get('customer_id') as string) || null,
    service_type,
    revenue: formData.get('revenue') ? Number(formData.get('revenue')) : 0,
    contract_stage: (formData.get('contract_stage') as string) || '계약',
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

export async function bulkUpdateSalesStage(ids: string[], contract_stage: string) {
  const supabase = await createClient()
  await supabase.from('sales').update({ contract_stage, updated_at: new Date().toISOString() }).in('id', ids)
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

export async function toggleCostConfirmed(saleId: string, confirmed: boolean) {
  const supabase = await createClient()
  const { error } = await supabase.from('sales').update({
    cost_confirmed: confirmed,
    updated_at: new Date().toISOString(),
  }).eq('id', saleId)
  if (error) throw new Error(error.message)
  revalidatePath('/sales/report')
}

export async function updateEntityType(entityId: string, entityType: string) {
  const supabase = await createClient()
  await supabase.from('business_entities').update({ entity_type: entityType }).eq('id', entityId)
  revalidatePath('/sales/report')
}

export async function updateProgressStatus(saleId: string, status: ProgressStatus): Promise<void> {
  const supabase = await createClient()
  await supabase.from('sales').update({ progress_status: status, updated_at: new Date().toISOString() }).eq('id', saleId)
  revalidatePath('/sales/report')
  revalidatePath('/sales')
  revalidatePath(`/sales/${saleId}`)
}

export async function updateSaleInline(id: string, data: {
  name: string
  department: string | null
  assignee_id: string | null
  entity_id: string | null
  client_org: string | null
  client_dept: string | null
  customer_id: string | null
  service_type: string | null
  revenue: number
  contract_stage: string
  contract_type: string | null
  memo: string | null
  inflow_date: string | null
  payment_date: string | null
  dropbox_url: string | null
}) {
  const supabase = await createClient()
  const department = (data.service_type && SERVICE_TO_DEPT[data.service_type]) || data.department
  const { error } = await supabase.from('sales').update({ ...data, department, updated_at: new Date().toISOString() }).eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/sales/report')
  revalidatePath('/sales')
}
