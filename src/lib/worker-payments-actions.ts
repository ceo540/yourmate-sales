'use server'

// 외부 인력 월 묶음 정산 + 세무사 핸드오프 server actions (yourmate-spec.md §5.5.5)
// CLAUDE.md: 'use server' 파일은 async 함수만 export 가능.

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { computeMonthlyPayment, generateTaxHandoffRows } from '@/lib/external-workers'
import type { ExternalWorker, WorkerEngagement } from '@/types'

/**
 * 특정 worker의 특정 월 정산 묶음을 worker_payments에 INSERT.
 * status='pending' 으로 시작. 사용자가 추후 [지급 완료] 클릭 시 status='paid' + paid_date.
 */
export async function createMonthlyPaymentAction(input: {
  worker_id: string
  year_month: string  // 'YYYY-MM'
  scheduled_date?: string | null
}): Promise<{ success: true; payment_id: string; total: number; engagement_count: number } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '로그인 필요' }

  const admin = createAdminClient()

  const [{ data: worker }, { data: engagements }] = await Promise.all([
    admin.from('external_workers').select('*').eq('id', input.worker_id).maybeSingle(),
    admin.from('worker_engagements').select('*').eq('worker_id', input.worker_id),
  ])
  if (!worker) return { error: '외부 인력을 찾을 수 없음' }

  const result = computeMonthlyPayment({
    worker: worker as ExternalWorker,
    engagements: (engagements ?? []) as WorkerEngagement[],
    yearMonth: input.year_month,
  })

  if (result.count === 0) return { error: `${input.year_month}에 active 참여 기록이 없음` }

  // 중복 방지 — 같은 worker·같은 month 이미 pending이면 갱신
  const { data: existing } = await admin
    .from('worker_payments')
    .select('id')
    .eq('worker_id', input.worker_id)
    .eq('status', 'pending')
    .contains('engagement_ids', result.engagement_ids)
    .maybeSingle()

  if (existing) {
    return { error: `이미 pending payment 있음 (id=${existing.id}). 먼저 처리·취소 후 재생성.` }
  }

  const { data: payment, error } = await admin
    .from('worker_payments')
    .insert({
      worker_id: input.worker_id,
      engagement_ids: result.engagement_ids,
      total_amount: result.total,
      scheduled_date: input.scheduled_date ?? null,
      status: 'pending',
      note: `${input.year_month} 묶음 (${result.count}건)`,
    })
    .select('id')
    .maybeSingle()
  if (error || !payment) return { error: error?.message ?? 'INSERT 실패' }

  revalidatePath('/team')
  revalidatePath('/admin')
  return { success: true, payment_id: payment.id, total: result.total, engagement_count: result.count }
}

/**
 * 세무사 핸드오프 .xlsx 자동 생성. 특정 월의 모든 pending worker_payments 묶음.
 * Q27 사용자 패턴: 매월 말·익월 초 카톡 전송용 .xlsx (이름·주민번호·계좌번호·금액·구분·비고).
 *
 * 반환: base64 .xlsx (server에서 클라이언트로 다운로드).
 */
export async function generateTaxHandoffXlsxAction(input: {
  year_month: string  // 'YYYY-MM' — 이 월에 생성된 pending payments
  mark_sent?: boolean  // true면 tax_form_sent_at 갱신
}): Promise<
  | { success: true; xlsx_base64: string; filename: string; total: number; row_count: number; warnings: string[] }
  | { error: string }
> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '로그인 필요' }

  const admin = createAdminClient()

  // 해당 월에 *생성된* pending payments
  const monthStart = `${input.year_month}-01`
  const nextMonth = (() => {
    const [y, m] = input.year_month.split('-').map(Number)
    return m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`
  })()

  const { data: payments } = await admin
    .from('worker_payments')
    .select('id, worker_id, total_amount, note')
    .eq('status', 'pending')
    .gte('created_at', monthStart)
    .lt('created_at', nextMonth)

  if (!payments || payments.length === 0) {
    return { error: `${input.year_month}에 pending worker_payments 없음. 먼저 createMonthlyPaymentAction 호출 권장.` }
  }

  const workerIds = Array.from(new Set(payments.map(p => p.worker_id)))
  const { data: workers } = await admin
    .from('external_workers')
    .select('*')
    .in('id', workerIds)

  const handoff = generateTaxHandoffRows({
    payments: payments.map(p => ({ worker_id: p.worker_id, total_amount: p.total_amount, note: p.note })),
    workers: (workers ?? []) as ExternalWorker[],
  })

  // .xlsx 생성
  const XLSX = await import('xlsx')
  const ws = XLSX.utils.aoa_to_sheet([handoff.headers, ...handoff.rows])
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, `${input.year_month}_인건비`)
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
  const xlsx_base64 = buf.toString('base64')

  // 발송 표시 (옵션)
  if (input.mark_sent) {
    const paymentIds = payments.map(p => p.id)
    await admin
      .from('worker_payments')
      .update({ tax_form_sent_at: new Date().toISOString() })
      .in('id', paymentIds)
  }

  const filename = `${input.year_month}_yourmate_인건비.xlsx`

  return {
    success: true,
    xlsx_base64,
    filename,
    total: handoff.total,
    row_count: handoff.rows.length,
    warnings: handoff.warnings,
  }
}

export async function markPaymentPaidAction(input: {
  payment_id: string
  paid_date: string
}): Promise<{ success: true } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '로그인 필요' }

  const admin = createAdminClient()
  const { data: payment, error } = await admin
    .from('worker_payments')
    .update({ status: 'paid', paid_date: input.paid_date })
    .eq('id', input.payment_id)
    .select('id, worker_id, total_amount')
    .maybeSingle()
  if (error || !payment) return { error: error?.message ?? '갱신 실패' }

  // worker total_paid 누적
  const { data: allPaid } = await admin
    .from('worker_payments')
    .select('total_amount')
    .eq('worker_id', payment.worker_id)
    .eq('status', 'paid')
  const totalPaid = (allPaid ?? []).reduce((s, x) => s + (x.total_amount ?? 0), 0)
  await admin.from('external_workers').update({ total_paid: totalPaid }).eq('id', payment.worker_id)

  return { success: true }
}
