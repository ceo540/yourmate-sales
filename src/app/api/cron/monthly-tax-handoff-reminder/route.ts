// 세무사 핸드오프 알림 cron (yourmate-spec.md §5.5.5)
// 매월 말일 KST 23시 — 외부 인력 정산 요약을 대표에게 채널톡으로 알림.
// 카톡 자동 발송은 안 함 (외부 노출 위험). 대표 본인이 받고 수동 전송.
//
// schedule: "0 14 28-31 * *"  (UTC 14 = KST 23)
// 내부에서 "오늘이 진짜 그 달 말일?" 체크 — 28~31 중 마지막 실행만 의미 있음.

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendGroupMessage, DEFAULT_GROUP } from '@/lib/channeltalk'

export const maxDuration = 60

function isLastDayOfMonthKst(): boolean {
  const now = new Date()
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000)
  const tomorrow = new Date(kst.getTime() + 24 * 60 * 60 * 1000)
  return kst.getUTCMonth() !== tomorrow.getUTCMonth()
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  const expected = `Bearer ${process.env.CRON_SECRET ?? ''}`
  if (process.env.CRON_SECRET && auth !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = new URL(req.url)
  const dryRun = url.searchParams.get('dryRun') === '1'
  const force = url.searchParams.get('force') === '1'

  // 28~31 중 진짜 말일만 알림 (force 시 우회)
  if (!force && !isLastDayOfMonthKst()) {
    return NextResponse.json({ skipped: '오늘은 말일 아님 — KST 기준', dryRun })
  }

  // KST 기준 이번 달 (YYYY-MM)
  const now = new Date()
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000)
  const yearMonth = `${kst.getUTCFullYear()}-${String(kst.getUTCMonth() + 1).padStart(2, '0')}`

  const admin = createAdminClient()

  // 이번 달 worker_payments 요약
  const { data: payments } = await admin
    .from('worker_payments')
    .select('id, worker_id, total_amount, status, scheduled_date, paid_date')
    .eq('archive_status', 'active')
    .or(`scheduled_date.gte.${yearMonth}-01,paid_date.gte.${yearMonth}-01`)
    .or(`scheduled_date.lte.${yearMonth}-31,paid_date.lte.${yearMonth}-31`)

  const total = (payments ?? []).reduce((s, p) => s + (p.total_amount ?? 0), 0)
  const count = (payments ?? []).length
  const pending = (payments ?? []).filter(p => p.status === 'pending').length

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://yourmate-system.vercel.app'
  const xlsxUrl = `${baseUrl}/api/admin/tax-handoff-xlsx?year_month=${yearMonth}`

  const text = `📋 ${yearMonth} 세무사 핸드오프 알림

외부 인력 정산: ${count}건 / ${(total / 10000).toFixed(0)}만원
대기: ${pending}건

엑셀 다운로드:
${xlsxUrl}

세무사 전송은 수동으로 부탁합니다.`

  if (dryRun) {
    return NextResponse.json({ year_month: yearMonth, count, total, pending, message: text, dryRun: true })
  }

  await sendGroupMessage(DEFAULT_GROUP, text)
  return NextResponse.json({ year_month: yearMonth, count, total, pending, sent_to: DEFAULT_GROUP })
}
