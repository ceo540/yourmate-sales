// 시급 할 일 우선순위 알고리즘 (yourmate-spec.md §4.8.3)
// 점수 = (마감 가까움 × 가중치) + (금액 규모 × 가중치) + (고객 등급 × 가중치) + (지연 위험 × 가중치)
// Critical > 100 / High 70~100 / Medium 40~70 / Low < 40

export type UrgencyLevel = 'critical' | 'high' | 'medium' | 'low'

const DAY_MS = 86_400_000

export interface UrgencyInput {
  due_date?: string | null              // 'YYYY-MM-DD'
  amount?: number | null                // 매출·금액
  customer_priority?: 'high' | 'normal' | 'low' | null
  response_delay_days?: number | null   // 응답 지연 (소통 공백)
  status?: string | null
}

export function calculateUrgencyScore(input: UrgencyInput): { score: number; level: UrgencyLevel; reasons: string[] } {
  const reasons: string[] = []
  let score = 0

  // 1. 마감 가까움 (0~100)
  if (input.due_date) {
    const due = new Date(input.due_date)
    const now = new Date()
    const daysToDue = (due.getTime() - now.getTime()) / DAY_MS
    let dueScore = 0
    if (daysToDue < 0) {
      dueScore = 100
      reasons.push(`⏱ ${Math.abs(Math.round(daysToDue))}일 지남`)
    } else if (daysToDue <= 1) {
      dueScore = 90
      reasons.push('⏱ D-day')
    } else if (daysToDue <= 3) {
      dueScore = 70
      reasons.push(`⏱ D-${Math.round(daysToDue)}`)
    } else if (daysToDue <= 7) {
      dueScore = 40
      reasons.push(`⏱ D-${Math.round(daysToDue)}`)
    } else if (daysToDue <= 14) {
      dueScore = 15
    }
    score += dueScore
  }

  // 2. 금액 규모 (0~30) — 1억 이상 만점
  const amount = input.amount ?? 0
  if (amount > 0) {
    const amountScore = Math.min((amount / 100_000_000) * 30, 30)
    score += amountScore
    if (amount >= 50_000_000) reasons.push(`💰 ${Math.round(amount / 10_000_000)}천만+`)
  }

  // 3. 고객 등급 (0/10/20)
  if (input.customer_priority === 'high') {
    score += 20
    reasons.push('⭐ 우선 고객')
  } else if (input.customer_priority === 'normal') {
    score += 10
  }

  // 4. 응답 지연 (0~30)
  if (input.response_delay_days && input.response_delay_days > 0) {
    const delayScore = Math.min(input.response_delay_days * 4, 30)
    score += delayScore
    if (input.response_delay_days >= 7) reasons.push(`📭 ${input.response_delay_days}일 지연`)
  }

  let level: UrgencyLevel
  if (score >= 100) level = 'critical'
  else if (score >= 70) level = 'high'
  else if (score >= 40) level = 'medium'
  else level = 'low'

  return { score, level, reasons }
}

export const LEVEL_LABEL: Record<UrgencyLevel, string> = {
  critical: '🔴 Critical',
  high: '🟠 High',
  medium: '🟡 Medium',
  low: '⚪ Low',
}

export const LEVEL_COLOR: Record<UrgencyLevel, string> = {
  critical: 'bg-red-50 text-red-700 border-red-200',
  high: 'bg-orange-50 text-orange-700 border-orange-200',
  medium: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  low: 'bg-gray-50 text-gray-500 border-gray-200',
}
