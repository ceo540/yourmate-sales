'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { createSaleFolder } from '@/lib/dropbox'

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
  payment_method?: string
  inflow_source?: string
  notes?: string
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '로그인 필요' }

  const { data: rental, error } = await supabase.from('rentals').insert({
    ...data,
    status: '유입',
  }).select('id').single()
  if (error) return { error: error.message }

  // sales 레코드 자동 생성 + 연결
  let dropboxUrl: string | null = null
  try {
    const folderUrl = await createSaleFolder({
      service_type: '교구대여',
      name: data.customer_name,
      inflow_date: data.rental_start ?? null,
    })
    if (folderUrl) {
      dropboxUrl = folderUrl
      await supabase.from('rentals').update({ dropbox_url: folderUrl }).eq('id', rental.id)
    }
  } catch (_) {}

  const { data: newSale } = await supabase.from('sales').insert({
    name: `${data.customer_name} 교구대여`,
    service_type: '교구대여',
    department: 'school_store',
    revenue: data.total_amount ?? 0,
    payment_status: '계약전',
    client_org: data.customer_name,
    customer_id: data.customer_id ?? null,
    assignee_id: data.assignee_id ?? null,
    inflow_date: data.rental_start ?? null,
    dropbox_url: dropboxUrl,
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

  // sales 동기화 (total_amount, status 변경 시)
  const { data: rental } = await supabase.from('rentals').select('sale_id').eq('id', id).single()
  if (rental?.sale_id) {
    const salesUpdate: Record<string, unknown> = {}
    if (data.total_amount !== undefined) salesUpdate.revenue = data.total_amount
    if (data.status !== undefined) {
      const statusMap: Record<string, string> = {
        '유입': '계약전', '확정': '계약완료', '진행중': '선금수령', '반납': '완납',
      }
      salesUpdate.payment_status = statusMap[data.status as string] ?? '계약전'
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
  const updates: Record<string, unknown> = { checklist, updated_at: new Date().toISOString() }

  // 검수 완료 + 보증금 환급 모두 체크 시 자동으로 완료 처리
  if (checklist.final_inspection && checklist.deposit_returned) {
    updates.status = '완료'
    const { data: rental } = await supabase.from('rentals').select('sale_id').eq('id', id).single()
    if (rental?.sale_id) {
      await supabase.from('sales').update({ payment_status: '완납' }).eq('id', rental.sale_id)
    }
  }

  const { error } = await supabase.from('rentals').update(updates).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/rentals')
  revalidatePath(`/rentals/${id}`)
  return { success: true }
}

// 소통 이력 추가 (contact_1 → contact_2 → contact_3 순서로 채움)
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
