'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// ── 계좌 관리 ──────────────────────────────
export async function upsertAccount(data: {
  id?: string
  business_entity: string
  name: string
  account_number?: string | null
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

// ── Granter CSV 일괄 import ──────────────────────────────
interface GranterRow {
  date: string        // '2026.03.30'
  accountNo: string   // '05230104268066'
  accountNick: string // '주사용계좌'
  bank: string        // '국민은행'
  company: string     // '유어메이트'
  description: string // '사용처'
  expense: number
  income: number
  status: string      // '출금' | '입금'
  category: string    // '계정과목'
  include: string     // '포함' | '미포함'
  memo: string        // '적요'
}

export async function importGranterTransactions(rows: GranterRow[]) {
  const supabase = await createClient()

  // 기존 계좌 조회
  const { data: existingAccounts } = await supabase.from('financial_accounts').select('*')

  // CSV에서 유니크 계좌 추출
  const uniqueAccounts = Array.from(
    new Map(rows.map(r => [r.accountNo, r])).values()
  )

  // 계좌번호 → UUID 매핑
  const accountMap: Record<string, string> = {}
  for (const row of uniqueAccounts) {
    const last4 = row.accountNo.slice(-4)
    const accName = `${row.bank} ${last4}${row.accountNick ? ` (${row.accountNick})` : ''}`
    const existing = existingAccounts?.find(a =>
      a.name.includes(last4) && a.business_entity === row.company
    )
    if (existing) {
      accountMap[row.accountNo] = existing.id
    } else {
      const { data } = await supabase.from('financial_accounts').insert({
        business_entity: row.company,
        name: accName,
        type: 'checking',
        initial_balance: 0,
        is_active: true,
      }).select('id').single()
      if (data) accountMap[row.accountNo] = data.id
    }
  }

  // 거래 insert (금액포함=포함 만)
  const transactions = rows
    .filter(r => r.include === '포함' && (r.expense > 0 || r.income > 0))
    .map(r => {
      const isIncome = r.status === '입금'
      const amount = isIncome ? r.income : r.expense
      const cat = r.category || null
      const type = isIncome ? 'income'
        : cat?.includes('이자') ? 'interest'
        : cat?.includes('대출') ? 'loan_repayment'
        : 'expense'
      return {
        date: r.date.replace(/\./g, '-'),
        account_id: accountMap[r.accountNo],
        type,
        amount,
        category: cat,
        description: r.description || null,
        memo: r.memo || null,
      }
    })
    .filter(t => t.account_id && t.amount > 0)

  if (transactions.length > 0) {
    await supabase.from('cashflow').insert(transactions)
  }

  revalidatePath('/cashflow')
  return { count: transactions.length }
}
