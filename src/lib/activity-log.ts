// 자동 업무표 로그 헬퍼 (yourmate-spec.md §5.4.2)
// 시스템 내부 행위 발생 시 호출. 매일 18시 빵빵이가 자동 업무표 생성에 활용.

import { createAdminClient } from '@/lib/supabase/admin'

export type ActivitySource = 'yourmate' | 'channeltalk' | 'calendar' | 'dropbox' | 'gmail' | 'sms' | 'kakao'
export type ActivityAction =
  | 'create_log' | 'update_log'
  | 'create_memo' | 'update_memo'
  | 'create_task' | 'complete_task' | 'update_task'
  | 'create_lead' | 'update_lead'
  | 'create_sale' | 'update_sale'
  | 'create_engagement' | 'cancel_engagement'
  | 'create_payment' | 'mark_paid' | 'cancel_payment'
  | 'reply' | 'meeting' | 'visit' | 'cold_call' | 'email_sent'
  | 'create_quote' | 'update_quote'
  | 'other'

export interface LogActivityInput {
  actor_id: string
  source?: ActivitySource
  action: ActivityAction
  ref_type?: string
  ref_id?: string
  summary?: string
  raw?: unknown
  occurred_at?: Date | string
}

/**
 * 비동기로 activity_logs INSERT. 실패해도 호출자 흐름 영향 X.
 * 핵심 INSERT 위치(server actions·API routes)에 await 없이 .catch(() => {}) 패턴.
 */
export async function logActivity(input: LogActivityInput): Promise<void> {
  try {
    const admin = createAdminClient()
    await admin.from('activity_logs').insert({
      actor_id: input.actor_id,
      source: input.source ?? 'yourmate',
      action: input.action,
      ref_type: input.ref_type ?? null,
      ref_id: input.ref_id ?? null,
      summary: input.summary ?? null,
      raw: input.raw ? (typeof input.raw === 'string' ? { text: input.raw } : input.raw as object) : null,
      occurred_at: input.occurred_at
        ? (typeof input.occurred_at === 'string' ? input.occurred_at : input.occurred_at.toISOString())
        : new Date().toISOString(),
    })
  } catch {
    // silent — 실패해도 핵심 흐름 멈추지 않음
  }
}

/**
 * 특정 직원의 특정 기간 행위 가져오기 (자동 업무표 생성용).
 */
export async function getActivitiesByActor(input: {
  actor_id: string
  from: string  // 'YYYY-MM-DD' (포함)
  to: string    // 'YYYY-MM-DD' (포함)
  source?: ActivitySource
  limit?: number
}): Promise<{
  id: string
  source: string
  action: string
  ref_type: string | null
  ref_id: string | null
  summary: string | null
  occurred_at: string
}[]> {
  const admin = createAdminClient()
  const fromIso = `${input.from}T00:00:00Z`
  const toIso = `${input.to}T23:59:59Z`

  let q = admin.from('activity_logs')
    .select('id, source, action, ref_type, ref_id, summary, occurred_at')
    .eq('actor_id', input.actor_id)
    .gte('occurred_at', fromIso)
    .lte('occurred_at', toIso)
    .order('occurred_at', { ascending: true })
    .limit(input.limit ?? 500)

  if (input.source) q = q.eq('source', input.source)

  const { data } = await q
  return (data ?? []) as never[]
}
