// 자동 업무표 일일 cron (yourmate-spec.md §5.4.2)
// KST 18시 = UTC 09시 매일 실행. 사용자 답변: "매일 18시 (퇴근 후)"
//
// 동작:
// 1. 모든 active profile (직원) 가져옴
// 2. 각 직원별 오늘 activity_logs 조회
// 3. 빵빵이가 1줄 요약 + 업무표 텍스트 생성 (이번 라운드는 기본 형식만)
// 4. project_memos 또는 daily_reports에 저장
//
// dryRun=1 — 검증용. INSERT X. 결과만 JSON 반환.

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const maxDuration = 60

export async function GET(req: NextRequest) {
  // CRON_SECRET 인증 (Vercel cron + 수동 dryRun 둘 다)
  const auth = req.headers.get('authorization')
  const expected = `Bearer ${process.env.CRON_SECRET ?? ''}`
  if (process.env.CRON_SECRET && auth !== expected) {
    // dryRun=1 + admin 사용자 호출은 운영 검증 시 우회 가능 (별도 체크는 다음 라운드)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = new URL(req.url)
  const dryRun = url.searchParams.get('dryRun') === '1'

  const admin = createAdminClient()

  // 한국 기준 오늘 (UTC+9)
  const now = new Date()
  const kstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000)
  const todayKst = kstNow.toISOString().slice(0, 10)
  const fromIso = `${todayKst}T00:00:00+09:00`
  const toIso = `${todayKst}T23:59:59+09:00`

  // active 직원
  const { data: profiles } = await admin
    .from('profiles')
    .select('id, name, role')

  const summaries: { actor_id: string; name: string; count: number; entries: { time: string; action: string; ref_name: string | null; summary: string | null }[]; saved_memo_id?: string | null }[] = []

  for (const p of (profiles ?? [])) {
    const { data: logs } = await admin
      .from('activity_logs')
      .select('action, ref_type, ref_id, summary, occurred_at')
      .eq('actor_id', p.id)
      .gte('occurred_at', fromIso)
      .lte('occurred_at', toIso)
      .order('occurred_at', { ascending: true })

    if (!logs || logs.length === 0) {
      summaries.push({ actor_id: p.id, name: p.name ?? '?', count: 0, entries: [] })
      continue
    }

    // ref_id → 이름 (project·lead·sale)
    const projIds = [...new Set(logs.filter(l => l.ref_type === 'project' && l.ref_id).map(l => l.ref_id as string))]
    const { data: prjs } = projIds.length > 0
      ? await admin.from('projects').select('id, name, project_number').in('id', projIds)
      : { data: [] }
    const refMap = new Map<string, string>()
    for (const pr of (prjs ?? [])) refMap.set(pr.id, pr.project_number ? `${pr.project_number} ${pr.name}` : pr.name)

    const entries = logs.map(l => ({
      time: new Date(l.occurred_at).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hour12: false }),
      action: l.action,
      ref_name: l.ref_id ? (refMap.get(l.ref_id) ?? null) : null,
      summary: l.summary,
    }))

    summaries.push({ actor_id: p.id, name: p.name ?? '?', count: logs.length, entries })

    // dryRun 아니면 실제 저장 — 임시: 간단 요약을 console에만. 본격 저장은 다음 라운드.
    // (project_memos는 project_id 필수라 적합 X. daily_reports 또는 별도 employee_daily_summary 테이블 검토)
  }

  return NextResponse.json({
    success: true,
    today_kst: todayKst,
    dry_run: dryRun,
    summary_count: summaries.filter(s => s.count > 0).length,
    summaries: summaries.filter(s => s.count > 0),  // 0건은 결과에서 제외
    note: '이번 라운드는 추출만 (조회). 직원별 daily_summary 저장 + 알림은 다음 라운드 (employee_daily_summary 테이블 신설).',
  })
}
