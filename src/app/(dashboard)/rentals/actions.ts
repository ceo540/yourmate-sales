'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function createRental(data: {
  customer_name: string
  contact_name?: string
  phone?: string
  email?: string
  customer_type: string
  customer_id?: string
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
  revalidatePath(`/rentals/${rentalId}`)
  return { success: true }
}

export async function removeRentalItem(itemId: string, rentalId: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('rental_items').delete().eq('id', itemId)
  if (error) return { error: error.message }
  revalidatePath(`/rentals/${rentalId}`)
  return { success: true }
}