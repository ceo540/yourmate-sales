'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { SERVICE_TO_DEPT } from '@/types'

export async function updateSaleDetail(formData: FormData) {
  const admin = createAdminClient()
  const id = formData.get('id') as string
  const service_type = (formData.get('service_type') as string) || null
  const department = (service_type && SERVICE_TO_DEPT[service_type]) || (formData.get('department') as string) || null

  await admin.from('sales').update({
    name: formData.get('name') as string,
    department,
    assignee_id: (formData.get('assignee_id') as string) || null,
    contract_assignee_id: (formData.get('contract_assignee_id') as string) || null,
    entity_id: (formData.get('entity_id') as string) || null,
    client_org: (formData.get('client_org') as string) || null,
    service_type,
    revenue: formData.get('revenue') ? Number(formData.get('revenue')) : 0,
    contract_stage: (formData.get('contract_stage') as string) || '계약',
    contract_type: (formData.get('contract_type') as string) || null,
    inflow_date: (formData.get('inflow_date') as string) || null,
    payment_date: (formData.get('payment_date') as string) || null,
    dropbox_url: (formData.get('dropbox_url') as string) || null,
    updated_at: new Date().toISOString(),
  }).eq('id', id)

  revalidatePath(`/sales/${id}`)
}
