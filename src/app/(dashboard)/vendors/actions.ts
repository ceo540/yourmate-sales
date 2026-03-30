'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function createVendor(formData: FormData) {
  const supabase = await createClient()
  await supabase.from('vendors').insert({
    name: formData.get('name') as string,
    type: formData.get('type') as string,
    phone: (formData.get('phone') as string) || null,
    email: (formData.get('email') as string) || null,
    bank_info: (formData.get('bank_info') as string) || null,
    id_number: (formData.get('id_number') as string) || null,
    memo: (formData.get('memo') as string) || null,
  })
  redirect('/vendors')
}

export async function updateVendor(formData: FormData) {
  const supabase = await createClient()
  const id = formData.get('id') as string
  await supabase.from('vendors').update({
    name: formData.get('name') as string,
    type: formData.get('type') as string,
    phone: (formData.get('phone') as string) || null,
    email: (formData.get('email') as string) || null,
    bank_info: (formData.get('bank_info') as string) || null,
    id_number: (formData.get('id_number') as string) || null,
    memo: (formData.get('memo') as string) || null,
  }).eq('id', id)
  redirect('/vendors')
}

export async function deleteVendor(id: string) {
  const supabase = await createClient()
  await supabase.from('vendors').delete().eq('id', id)
  revalidatePath('/vendors')
}

export async function addVendorPayment(vendorId: string, amount: number, paidDate: string, memo: string) {
  const supabase = await createClient()
  const { data, error } = await supabase.from('vendor_payments').insert({
    vendor_id: vendorId,
    amount,
    paid_date: paidDate,
    memo: memo || null,
  }).select().single()
  if (error) throw error
  revalidatePath(`/vendors/${vendorId}/ledger`)
  return data
}

export async function deleteVendorPayment(paymentId: string, vendorId: string) {
  const supabase = await createClient()
  await supabase.from('vendor_payments').delete().eq('id', paymentId)
  revalidatePath(`/vendors/${vendorId}/ledger`)
}
