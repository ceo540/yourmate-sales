'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export interface BankTxRow {
  tx_date: string
  tx_time: string | null
  method: string | null
  account_no: string | null
  description: string | null
  debit: number
  credit: number
  tx_status: string | null
  category: string | null
  category_code: string | null
  company: string | null
  balance: number | null
  counterparty: string | null
  transaction_type: string | null
  memo: string | null
  bank: string | null
  import_batch: string
}

export async function importBankTransactions(rows: BankTxRow[]) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const admin = createAdminClient()
  const { error } = await admin.from('bank_transactions').insert(rows)
  if (error) throw new Error(error.message)
  revalidatePath('/payroll')
  return { imported: rows.length }
}

export async function autoMatchTransactions(year: number, month: number, importBatch: string) {
  const admin = createAdminClient()

  const { data: payrollEntries } = await admin
    .from('payroll')
    .select('id, employee_name, base_salary, payment_confirmed')
    .eq('year', year)
    .eq('month', month)
    .eq('payment_confirmed', false)

  if (!payrollEntries?.length) return { matched: 0 }

  const { data: transactions } = await admin
    .from('bank_transactions')
    .select('id, counterparty, debit, tx_date')
    .eq('import_batch', importBatch)
    .gt('debit', 0)
    .is('payroll_id', null)

  if (!transactions?.length) return { matched: 0 }

  let matched = 0
  for (const entry of payrollEntries) {
    const tx = transactions.find(t =>
      t.counterparty && entry.employee_name &&
      (t.counterparty.includes(entry.employee_name) || entry.employee_name.includes(t.counterparty))
    )
    if (tx) {
      await admin.from('bank_transactions').update({ payroll_id: entry.id }).eq('id', tx.id)
      await admin.from('payroll').update({
        payment_confirmed: true,
        payment_date: tx.tx_date,
      }).eq('id', entry.id)
      matched++
    }
  }

  revalidatePath('/payroll')
  return { matched, total: payrollEntries.length as number }
}

export async function manualConfirmPayment(payrollId: string, paymentDate: string) {
  const admin = createAdminClient()
  await admin.from('payroll').update({
    payment_confirmed: true,
    payment_date: paymentDate,
  }).eq('id', payrollId)
  revalidatePath('/payroll')
}
