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

  // 드롭박스 폴더 자동 생성 (교구대여 경로)
  try {
    const folderUrl = await createSaleFolder({
      service_type: '교구대여',
      name: data.customer_name,
      inflow_date: data.rental_start ?? null,
    })
    if (folderUrl) {
      await supabase.from('rentals').update({ dropbox_url: folderUrl }).eq('id', rental.id)
    }
  } catch (_) {
    // 드롭박스 실패해도 렌탈 등록은 성공으로 처리
  }

  revalidatePath('/rentals')
  return { success: true, id: rental.id }
}

export async function updateRental(id: string, data: Record<string, unknown>) {
  const supabase = await createClient()
  const { error } = await supabase.from('rentals').update({ ...data, updated_at: new Date().toISOString() }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/rentals')
  revalidatePath(`/rentals/${id}`)
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
