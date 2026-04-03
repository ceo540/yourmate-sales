'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function createExpense(data: {
  payment_type: string
  category: string
  title: string
  amount: number
  expense_date: string
  memo?: string
  receipt_url?: string
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '로그인 필요' }

  const { error } = await supabase.from('expenses').insert({
    ...data,
    employee_id: user.id,
    status: '대기',
  })
  if (error) return { error: error.message }
  revalidatePath('/expenses')
  return { success: true }
}

export async function approveExpense(id: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '로그인 필요' }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!['admin', 'manager'].includes(profile?.role)) return { error: '권한 없음' }

  const { data: expense } = await supabase.from('expenses').select('payment_type').eq('id', id).single()
  const newStatus = expense?.payment_type === '법인카드' ? '확인완료' : '승인'

  const { error } = await supabase.from('expenses').update({
    status: newStatus,
    approved_by: user.id,
    approved_at: new Date().toISOString(),
  }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/expenses')
  return { success: true }
}

export async function rejectExpense(id: string, reason: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '로그인 필요' }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!['admin', 'manager'].includes(profile?.role)) return { error: '권한 없음' }

  const { error } = await supabase.from('expenses').update({
    status: '반려',
    reject_reason: reason,
    approved_by: user.id,
    approved_at: new Date().toISOString(),
  }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/expenses')
  return { success: true }
}

export async function markAsPaid(id: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '로그인 필요' }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!['admin', 'manager'].includes(profile?.role)) return { error: '권한 없음' }

  const { error } = await supabase.from('expenses').update({ status: '지급완료' }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/expenses')
  return { success: true }
}

export async function deleteExpense(id: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '로그인 필요' }

  const { error } = await supabase.from('expenses').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/expenses')
  return { success: true }
}
