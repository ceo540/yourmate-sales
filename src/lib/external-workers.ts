// 외부 인력 통합 헬퍼 (yourmate-spec.md §5.5)
// 정산·평가·재사용 결정 로직.

import type {
  ExternalWorker,
  WorkerEngagement,
} from '@/types'

/**
 * engagement amount 자동 계산.
 * - per_hour: hours × rate
 * - per_session: rate (단일 회차)
 * - per_project: rate (프로젝트 단위 고정)
 */
export function computeEngagementAmount(input: {
  rate_type: 'per_hour' | 'per_session' | 'per_project' | null
  rate: number | null
  hours: number | null
}): number {
  const { rate_type, rate, hours } = input
  if (!rate || rate <= 0) return 0
  switch (rate_type) {
    case 'per_hour': return (hours ?? 0) * rate
    case 'per_session': return rate
    case 'per_project': return rate
    default: return rate
  }
}

/**
 * 월별 묶음 정산 계산 — 특정 worker의 특정 월 engagement 합산.
 * 외부 인력은 월 묶음 (Q31 사용자 답변).
 */
export function computeMonthlyPayment(input: {
  worker: ExternalWorker
  engagements: WorkerEngagement[]
  yearMonth: string  // 'YYYY-MM'
}): {
  total: number
  engagement_ids: string[]
  count: number
  details: { id: string; project_id: string; date: string | null; amount: number }[]
} {
  const { engagements, yearMonth } = input
  const filtered = engagements.filter(e => {
    if (e.archive_status !== 'active') return false
    if (!e.date_start) return false
    return e.date_start.startsWith(yearMonth)
  })

  const details = filtered.map(e => ({
    id: e.id,
    project_id: e.project_id,
    date: e.date_start,
    amount: e.amount ?? 0,
  }))

  const total = details.reduce((s, d) => s + d.amount, 0)
  return {
    total,
    engagement_ids: filtered.map(e => e.id),
    count: filtered.length,
    details,
  }
}

/**
 * 평가·재사용 결정 알고리즘 (§5.5.4)
 * 정량 신호 + 정성 결합 → rating 0~5 자동 산출.
 *
 * 신호별 가중치 (사용자 PM 평가가 가장 큼):
 * - 프로젝트 완수율 30%
 * - 결제 분쟁 0  10%
 * - 클라이언트 피드백 (project_logs 분석)  20%
 * - PM 평가 (사람 직접)  30%
 * - 재계약률 (engagement 횟수)  10%
 */
export function computeWorkerRating(input: {
  total_engagements: number
  completed_count: number     // archive_status='active' 또는 완료된 engagement 수
  payment_disputes: number    // worker_payments.status='failed' 등
  pm_rating: number | null    // 사람 직접 입력 (0~5)
  client_feedback_score: number | null  // 0~5, project_logs 분석 결과
}): number {
  const { total_engagements, completed_count, payment_disputes, pm_rating, client_feedback_score } = input

  // 완수율 (0~30)
  const completion = total_engagements > 0
    ? (completed_count / total_engagements) * 30
    : 15  // 데이터 없으면 중간

  // 결제 분쟁 0 → 10점, 1건+ → 0점
  const disputeScore = payment_disputes === 0 ? 10 : Math.max(0, 10 - payment_disputes * 5)

  // 클라이언트 피드백 (0~20)
  const clientScore = client_feedback_score !== null
    ? (client_feedback_score / 5) * 20
    : 10  // 데이터 없으면 중간

  // PM 평가 (0~30)
  const pmScore = pm_rating !== null ? (pm_rating / 5) * 30 : 15

  // 재계약률 (0~10) — engagement 5건 이상이면 만점
  const reuseScore = Math.min(total_engagements / 5, 1) * 10

  const total100 = completion + disputeScore + clientScore + pmScore + reuseScore  // 0~100
  const rating0to5 = (total100 / 100) * 5
  return Math.round(rating0to5 * 10) / 10  // 소수점 1자리
}

/**
 * rating → reuse_status 자동 결정.
 * 사용자 명시 정책 외에 빵빵이가 자동 추천.
 */
export function suggestReuseStatus(rating: number): 'preferred' | 'normal' | 'avoid' {
  if (rating >= 4.0) return 'preferred'
  if (rating < 2.0) return 'avoid'
  return 'normal'
}

/**
 * 단가 변동 감지 — 같은 worker의 engagement 단가가 *고정* vs *변동* 판단.
 */
export function detectRateVariation(engagements: WorkerEngagement[]): {
  isStable: boolean
  uniqueRates: number[]
  mostCommon: number | null
} {
  const rates = engagements
    .filter(e => e.rate !== null && e.rate > 0)
    .map(e => e.rate as number)
  const uniqueRates = Array.from(new Set(rates))
  if (uniqueRates.length === 0) return { isStable: false, uniqueRates: [], mostCommon: null }
  const counts = new Map<number, number>()
  for (const r of rates) counts.set(r, (counts.get(r) ?? 0) + 1)
  let mostCommon = uniqueRates[0]
  let maxCount = 0
  for (const [r, c] of counts) {
    if (c > maxCount) { maxCount = c; mostCommon = r }
  }
  return {
    isStable: uniqueRates.length === 1,
    uniqueRates,
    mostCommon,
  }
}

/**
 * 신분증·통장사본 누락 감지 — 정산 진행 가능 여부.
 */
export function isPayableWorker(worker: ExternalWorker): {
  payable: boolean
  missing: string[]
} {
  const missing: string[] = []
  if (!worker.name) missing.push('이름')
  if (!worker.bank_account_text) missing.push('계좌번호')
  if (!worker.ssn_text) missing.push('주민번호 (세무용)')
  if (!worker.bank_book_url) missing.push('통장 사본')
  return { payable: missing.length === 0, missing }
}
