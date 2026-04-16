'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function updateContractStage(id: string, contract_stage: string) {
  const supabase = await createClient()
  await supabase.from('sales').update({ contract_stage, updated_at: new Date().toISOString() }).eq('id', id)
  revalidatePath('/contract-hub')
}

export async function updateContractContact(id: string, data: { contract_contact_name: string; contract_contact_phone: string }) {
  const supabase = await createClient()
  await supabase.from('sales').update({ ...data, updated_at: new Date().toISOString() }).eq('id', id)
  revalidatePath('/contract-hub')
}

export async function updateContractDocs(id: string, docs: { id: string; text: string; done: boolean }[]) {
  const supabase = await createClient()
  await supabase.from('sales').update({ contract_docs: docs, updated_at: new Date().toISOString() }).eq('id', id)
  revalidatePath('/contract-hub')
}

export interface PaymentScheduleInput {
  id?: string
  label: string
  amount: number
  due_date: string | null
  is_received: boolean
  received_date: string | null
  note: string | null
  sort_order: number
}

export async function savePaymentSchedules(saleId: string, schedules: PaymentScheduleInput[]) {
  const supabase = await createClient()
  await supabase.from('payment_schedules').delete().eq('sale_id', saleId)
  if (schedules.length > 0) {
    await supabase.from('payment_schedules').insert(
      schedules.map((s, i) => ({
        id: s.id ?? undefined,
        sale_id: saleId,
        label: s.label,
        amount: s.amount,
        due_date: s.due_date,
        is_received: s.is_received,
        received_date: s.received_date,
        note: s.note,
        sort_order: i,
      }))
    )
  }
  revalidatePath('/contract-hub')
}
