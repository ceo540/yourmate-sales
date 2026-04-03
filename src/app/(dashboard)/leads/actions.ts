'use server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { SERVICE_TO_DEPT } from '@/types'
import { createSaleFolder } from '@/lib/dropbox'
import { syncLeadToCustomerDB } from '@/lib/customer-sync'

// LEAD{YYYYMMDD}-{NNNN} 형식 ID 생성
async function generateLeadId(): Promise<string> {
  const supabase = await createClient()
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const prefix = `LEAD${today}-`
  const { data } = await supabase
    .from('leads')
    .select('lead_id')
    .ilike('lead_id', `${prefix}%`)
    .order('lead_id', { ascending: false })
    .limit(1)
  if (!data || data.length === 0) return `${prefix}0001`
  const last = data[0].lead_id as string
  const num = parseInt(last.slice(-4)) + 1
  return `${prefix}${String(num).padStart(4, '0')}`
}

export async function createLead(formData: FormData) {
  const supabase = await createClient()
  const lead_id = await generateLeadId()

  await supabase.from('leads').insert({
    lead_id,
    inflow_date: (formData.get('inflow_date') as string) || new Date().toISOString().slice(0, 10),
    remind_date: (formData.get('remind_date') as string) || null,
    service_type: (formData.get('service_type') as string) || null,
    contact_name: (formData.get('contact_name') as string) || null,
    client_org: (formData.get('client_org') as string) || null,
    phone: (formData.get('phone') as string) || null,
    office_phone: (formData.get('office_phone') as string) || null,
    email: (formData.get('email') as string) || null,
    initial_content: (formData.get('initial_content') as string) || null,
    assignee_id: (formData.get('assignee_id') as string) || null,
    status: (formData.get('status') as string) || '신규',
    channel: (formData.get('channel') as string) || null,
    inflow_source: (formData.get('inflow_source') as string) || null,
    notes: (formData.get('notes') as string) || null,
    contact_1: (formData.get('contact_1') as string) || null,
    contact_2: (formData.get('contact_2') as string) || null,
    contact_3: (formData.get('contact_3') as string) || null,
  })

  // 고객 DB 자동 upsert (콜드메일 리스트용)
  const client_org = formData.get('client_org') as string | null
  const contact_name = formData.get('contact_name') as string | null
  const phone = formData.get('phone') as string | null
  const email = formData.get('email') as string | null
  await syncLeadToCustomerDB({ client_org, contact_name, phone, email })

  revalidatePath('/leads')
}

export async function updateLead(id: string, data: Partial<{
  inflow_date: string | null
  remind_date: string | null
  service_type: string | null
  contact_name: string | null
  client_org: string | null
  phone: string | null
  office_phone: string | null
  email: string | null
  initial_content: string | null
  assignee_id: string | null
  status: string
  channel: string | null
  inflow_source: string | null
  notes: string | null
  contact_1: string | null
  contact_2: string | null
  contact_3: string | null
}>) {
  const supabase = await createClient()
  await supabase.from('leads').update({ ...data, updated_at: new Date().toISOString() }).eq('id', id)
  // 고객 DB 동기화 (연락처 관련 필드 변경 시)
  if ('client_org' in data || 'contact_name' in data || 'phone' in data || 'email' in data) {
    await syncLeadToCustomerDB({
      client_org: data.client_org ?? null,
      contact_name: data.contact_name ?? null,
      phone: data.phone ?? null,
      email: data.email ?? null,
    })
  }
  revalidatePath('/leads')
}

export async function deleteLead(id: string) {
  const supabase = await createClient()
  await supabase.from('leads').delete().eq('id', id)
  revalidatePath('/leads')
}

export async function convertLeadToSale(leadId: string) {
  const supabase = await createClient()

  const { data: lead } = await supabase.from('leads').select('*').eq('id', leadId).single()
  if (!lead) return { error: '리드를 찾을 수 없습니다.' }

  const serviceType = lead.service_type as string | null
  const department = (serviceType && SERVICE_TO_DEPT[serviceType]) || null

  // 고객 DB에서 customer_id 조회 (createLead 시 sync됨)
  let customerId: string | null = null
  if (lead.client_org) {
    const adminDb = createAdminClient()
    const { data: cust } = await adminDb.from('customers').select('id').ilike('name', lead.client_org.trim()).limit(1).single()
    customerId = cust?.id ?? null
  }

  const { data: sale, error } = await supabase.from('sales').insert({
    name: lead.client_org ? `${lead.client_org} (리드전환)` : '(리드전환)',
    client_org: lead.client_org,
    customer_id: customerId,
    service_type: serviceType,
    department,
    assignee_id: lead.assignee_id,
    revenue: 0,
    payment_status: '계약전',
    memo: lead.initial_content,
    inflow_date: lead.inflow_date || new Date().toISOString().slice(0, 10),
  }).select('id').single()

  if (error) return { error: error.message }

  // Dropbox 폴더 자동 생성
  if (sale && serviceType) {
    const dropboxUrl = await createSaleFolder({
      service_type: serviceType,
      name: lead.client_org || '(리드전환)',
      inflow_date: lead.inflow_date,
    })
    if (dropboxUrl) {
      await supabase.from('sales').update({ dropbox_url: dropboxUrl }).eq('id', sale.id)
    }
  }

  // 리드에 converted_sale_id 업데이트
  await supabase.from('leads').update({
    converted_sale_id: sale!.id,
    status: '완료',
    updated_at: new Date().toISOString(),
  }).eq('id', leadId)

  revalidatePath('/leads')
  revalidatePath('/sales/report')

  return { success: true, sale_id: sale!.id }
}
