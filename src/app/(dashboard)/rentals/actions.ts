'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

const STATUS_FLOW = ['유입', '견적발송', '렌탈확정', '진행중', '수거완료', '검수중', '완료']
function statusIdx(s: string) { return STATUS_FLOW.indexOf(s) }

export async function createRental(data: {
  customer_name: string
  customer_id?: string
  contact_name?: string
  phone?: string
  email?: string
  customer_type: string
  lead_id?: string
  sale_id?: string
  assignee_id?: string
  rental_start?: string
  rental_end?: string
  payment_due?: string
  delivery_method?: string
  pickup_method?: string
  total_amount?: number
  deposit?: number
  has_deposit?: boolean
  payment_method?: string
  inflow_source?: string
  notes?: string
  title?: string  // 사용자가 입력한 제목 (예: "260301 대한초등학교")
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '로그인 필요' }

  const { data: rental, error } = await supabase.from('rentals').insert({
    ...data,
    status: '유입',
    has_deposit: data.has_deposit ?? (data.deposit ? data.deposit > 0 : false),
  }).select('id').single()
  if (error) return { error: error.message }

  const { data: newSale } = await supabase.from('sales').insert({
    name: `${data.customer_name} 교구대여`,
    service_type: '교구대여',
    department: 'school_store',
    revenue: data.total_amount ?? 0,
    contract_stage: '계약',
    client_org: data.customer_name,
    customer_id: data.customer_id ?? null,
    assignee_id: data.assignee_id ?? null,
    inflow_date: data.rental_start ?? null,
  }).select('id').single()

  if (newSale) {
    await supabase.from('rentals').update({ sale_id: newSale.id }).eq('id', rental.id)
  }

  revalidatePath('/rentals')
  revalidatePath('/sales')
  return { success: true, id: rental.id }
}

export async function updateRental(id: string, data: Record<string, unknown>) {
  const supabase = await createClient()

  const { data: rental } = await supabase.from('rentals').select('sale_id').eq('id', id).single()
  if (rental?.sale_id) {
    const salesUpdate: Record<string, unknown> = {}
    if (data.total_amount !== undefined) salesUpdate.revenue = data.total_amount
    if (data.status !== undefined) {
      const statusMap: Record<string, string> = {
        '유입': '계약', '견적발송': '계약', '렌탈확정': '계약',
        '진행중': '착수', '수거완료': '착수', '검수중': '완수',
        '완료': '잔금',
      }
      salesUpdate.contract_stage = statusMap[data.status as string] ?? '계약'
    }
    if (data.dropbox_url !== undefined) salesUpdate.dropbox_url = data.dropbox_url
    if (Object.keys(salesUpdate).length > 0) {
      await supabase.from('sales').update(salesUpdate).eq('id', rental.sale_id)
    }
  }

  const { error } = await supabase.from('rentals').update({ ...data, updated_at: new Date().toISOString() }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/rentals')
  revalidatePath(`/rentals/${id}`)
  revalidatePath('/sales')
  return { success: true }
}

export async function updateRentalStatus(id: string, status: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('rentals').update({ status, updated_at: new Date().toISOString() }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/rentals')
  revalidatePath(`/rentals/${id}`)
  return { success: true }
}

export async function deleteRental(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('rentals').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/rentals')
  return { success: true }
}

export async function addRentalItem(rentalId: string, item: {
  item_name: string
  model_code?: string
  quantity: number
  months: number
  unit_price: number
  notes?: string
}) {
  const supabase = await createClient()
  const total_price = item.quantity * item.months * item.unit_price
  const { error } = await supabase.from('rental_items').insert({ ...item, rental_id: rentalId, total_price })
  if (error) return { error: error.message }
  revalidatePath('/rentals')
  revalidatePath(`/rentals/${rentalId}`)
  return { success: true }
}

export async function removeRentalItem(itemId: string, rentalId: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('rental_items').delete().eq('id', itemId)
  if (error) return { error: error.message }
  revalidatePath('/rentals')
  revalidatePath(`/rentals/${rentalId}`)
  return { success: true }
}

export async function updateRentalChecklist(id: string, checklist: Record<string, boolean>) {
  const supabase = await createClient()

  const { data: rental } = await supabase
    .from('rentals').select('status, has_deposit, sale_id').eq('id', id).single()
  if (!rental) return { error: '렌탈을 찾을 수 없습니다.' }

  const cur = statusIdx(rental.status)
  let newStatus: string | null = null

  // 계약 3개 완료 → 렌탈확정
  if (checklist.contract_sent && checklist.contract_signed && checklist.docs_received) {
    if (cur < statusIdx('렌탈확정')) newStatus = '렌탈확정'
  }

  // 배송완료 체크 → 진행중
  if (checklist.delivered && cur < statusIdx('진행중')) {
    newStatus = '진행중'
  }

  // 수거완료 체크 → 수거완료
  if (checklist.returned && cur < statusIdx('수거완료')) {
    newStatus = '수거완료'
  }

  // 검수 시작 → 검수중
  if (checklist.inspection_done && cur < statusIdx('검수중')) {
    newStatus = '검수중'
  }

  // 완료 조건: 검수완료 + (이슈없음 OR 이슈조치완료) + 보증금 환급 (보증금 있는 경우)
  const inspectionOk = checklist.inspection_done && (checklist.no_issue || checklist.issue_resolved)
  const depositOk = !rental.has_deposit || checklist.deposit_returned
  if (inspectionOk && depositOk && cur < statusIdx('완료')) {
    newStatus = '완료'
  }

  const updates: Record<string, unknown> = { checklist, updated_at: new Date().toISOString() }
  if (newStatus) updates.status = newStatus

  if (newStatus === '완료' && rental.sale_id) {
    await supabase.from('sales').update({ contract_stage: '잔금' }).eq('id', rental.sale_id)
  }

  const { error } = await supabase.from('rentals').update(updates).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/rentals')
  revalidatePath(`/rentals/${id}`)
  return { success: true, newStatus }
}

export async function addRentalDelivery(rentalId: string, data: {
  location: string
  contact_name?: string
  phone?: string
  delivery_date?: string | null
  pickup_date?: string | null
  delivery_method?: string
  notes?: string
}): Promise<{ id: string } | { error: string }> {
  const supabase = await createClient()
  const { data: row, error } = await supabase.from('rental_deliveries').insert({
    rental_id: rentalId,
    location: data.location,
    contact_name: data.contact_name || null,
    phone: data.phone || null,
    delivery_date: data.delivery_date || null,
    pickup_date: data.pickup_date || null,
    delivery_method: data.delivery_method || null,
    notes: data.notes || null,
    status: '대기',
    checklist: {},
  }).select('id').single()
  if (error) return { error: error.message }
  revalidatePath(`/rentals/${rentalId}`)
  return { id: row.id }
}

export async function updateRentalDelivery(id: string, rentalId: string, data: Record<string, unknown>) {
  const supabase = await createClient()
  const { error } = await supabase.from('rental_deliveries')
    .update({ ...data, updated_at: new Date().toISOString() }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath(`/rentals/${rentalId}`)
  return { success: true }
}

export async function deleteRentalDelivery(id: string, rentalId: string) {
  const supabase = await createClient()
  await supabase.from('rental_deliveries').delete().eq('id', id)
  revalidatePath(`/rentals/${rentalId}`)
  return { success: true }
}

const DELIVERY_STATUS_FLOW = ['대기', '배송완료', '수거완료', '검수완료']

export async function updateDeliveryChecklist(id: string, rentalId: string, checklist: Record<string, boolean>) {
  const supabase = await createClient()
  const { data: delivery } = await supabase.from('rental_deliveries').select('status').eq('id', id).single()
  if (!delivery) return { error: '배송 건을 찾을 수 없습니다.' }

  const curIdx = DELIVERY_STATUS_FLOW.indexOf(delivery.status)
  let newStatus: string | null = null

  if (checklist.delivered && curIdx < DELIVERY_STATUS_FLOW.indexOf('배송완료')) newStatus = '배송완료'
  if (checklist.returned && curIdx < DELIVERY_STATUS_FLOW.indexOf('수거완료')) newStatus = '수거완료'
  if (checklist.inspection_done && (checklist.no_issue || checklist.issue_resolved) && curIdx < DELIVERY_STATUS_FLOW.indexOf('검수완료')) newStatus = '검수완료'

  const updates: Record<string, unknown> = { checklist, updated_at: new Date().toISOString() }
  if (newStatus) updates.status = newStatus

  const { error } = await supabase.from('rental_deliveries').update(updates).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath(`/rentals/${rentalId}`)
  return { success: true, newStatus }
}

export async function linkRentalToParent(childId: string, parentId: string) {
  const supabase = await createClient()

  // 하위 렌탈에 연결된 sale 레코드를 영업 목록에서 제외하기 위해 삭제
  const { data: childRental } = await supabase.from('rentals').select('sale_id').eq('id', childId).single()
  if (childRental?.sale_id) {
    await supabase.from('rentals').update({ sale_id: null }).eq('id', childId)
    await supabase.from('sales').delete().eq('id', childRental.sale_id)
  }

  const { error } = await supabase.from('rentals').update({ parent_rental_id: parentId }).eq('id', childId)
  if (error) return { error: error.message }
  revalidatePath(`/rentals/${parentId}`)
  revalidatePath('/rentals')
  revalidatePath('/sales')
  return { success: true }
}

export async function unlinkRentalFromParent(childId: string, parentId: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('rentals').update({ parent_rental_id: null }).eq('id', childId)
  if (error) return { error: error.message }
  revalidatePath(`/rentals/${parentId}`)
  revalidatePath('/rentals')
  return { success: true }
}

export async function addRentalContact(rentalId: string, text: string) {
  const supabase = await createClient()
  const { data: rental } = await supabase
    .from('rentals').select('contact_1, contact_2, contact_3').eq('id', rentalId).single()
  if (!rental) return { error: '렌탈 건을 찾을 수 없습니다.' }

  const date = new Date().toISOString().slice(0, 10)
  const entry = `[${date}] ${text.trim()}`

  const nextField = !rental.contact_1 ? 'contact_1'
    : !rental.contact_2 ? 'contact_2'
    : !rental.contact_3 ? 'contact_3' : null

  if (!nextField) return { error: '소통 내역이 3개 가득 찼습니다. 수정에서 직접 편집해주세요.' }

  const { error } = await supabase.from('rentals').update({ [nextField]: entry }).eq('id', rentalId)
  if (error) return { error: error.message }
  revalidatePath('/rentals')
  revalidatePath(`/rentals/${rentalId}`)
  return { success: true }
}
