'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// ── 계좌 관리 ──────────────────────────────
export async function upsertAccount(data: {
  id?: string
  business_entity: string
  name: string
  type: 'checking' | 'savings' | 'loan' | 'cash'
  initial_balance: number
}) {
  const supabase = await createClient()
  if (data.id) {
    const { id, ...rest } = data
    await supabase.from('financial_accounts').update(rest).eq('id', id)
  } else {
    await supabase.from('financial_accounts').insert(data)
  }
  revalidatePath('/cashflow')
}

export async function deleteAccount(id: string) {
  const supabase = await createClient()
  await supabase.from('financial_accounts').delete().eq('id', id)
  revalidatePath('/cashflow')
}

// ── 거래 내역 ──────────────────────────────
export async function upsertTransaction(data: {
  id?: string
  date: string
  account_id: string
  type: 'income' | 'expense' | 'transfer' | 'loan_repayment' | 'interest'
  amount: number
  transfer_account_id?: string | null
  category?: string | null
  description?: string | null
  memo?: string | null
}) {
  const supabase = await createClient()
  if (data.id) {
    const { id, ...rest } = data
    await supabase.from('cashflow').update(rest).eq('id', id)
  } else {
    await supabase.from('cashflow').insert(data)
  }
  revalidatePath('/cashflow')
}

export async function deleteTransaction(id: string) {
  const supabase = await createClient()
  await supabase.from('cashflow').delete().eq('id', id)
  revalidatePath('/cashflow')
}
