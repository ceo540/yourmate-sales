// 수의계약 한도 매핑 — business_entities.entity_type 기준 부서당 회계연도 한도 (부가세 포함)
// 일반기업 2,200만원 / 여성기업 5,500만원
// 법적 한도라 거의 안 바뀜 → DB 컬럼 대신 코드 상수로

export const ENTITY_TYPE_LIMITS: Record<string, number> = {
  '일반기업': 22_000_000,
  '여성기업': 55_000_000,
}

export const ENTITY_TYPES = ['일반기업', '여성기업'] as const
export type EntityType = typeof ENTITY_TYPES[number]

export function getLimitForEntity(entityType: string | null | undefined): number {
  if (!entityType) return ENTITY_TYPE_LIMITS['일반기업']
  return ENTITY_TYPE_LIMITS[entityType] ?? ENTITY_TYPE_LIMITS['일반기업']
}

// 결제 상태 자동 계산 — 5단계 색상 분류
export type PaymentStatus = 'paid' | 'partial' | 'upcoming' | 'overdue' | 'none'

export interface PaymentScheduleSlim {
  amount: number
  due_date: string | null
  is_received: boolean
}

export function computePaymentStatus(schedules: PaymentScheduleSlim[], today: string = new Date().toISOString().slice(0, 10)): PaymentStatus {
  if (!schedules || schedules.length === 0) return 'none'
  const allReceived = schedules.every(s => s.is_received)
  if (allReceived) return 'paid'
  const someReceived = schedules.some(s => s.is_received)
  const overdue = schedules.some(s => !s.is_received && s.due_date && s.due_date < today)
  if (overdue) return 'overdue'
  // 이번 주 안 (7일 내) 입금 예정
  const weekLater = new Date(today)
  weekLater.setDate(weekLater.getDate() + 7)
  const weekStr = weekLater.toISOString().slice(0, 10)
  const upcoming = schedules.some(s => !s.is_received && s.due_date && s.due_date >= today && s.due_date <= weekStr)
  if (upcoming) return 'upcoming'
  if (someReceived) return 'partial'
  return 'partial'
}

export const PAYMENT_STATUS_BADGE: Record<PaymentStatus, { label: string; className: string }> = {
  paid:     { label: '🟢 완납',     className: 'bg-green-100 text-green-700' },
  partial:  { label: '🟡 부분 입금', className: 'bg-yellow-100 text-yellow-700' },
  upcoming: { label: '🔵 예정',     className: 'bg-blue-100 text-blue-700' },
  overdue:  { label: '🔴 지연',     className: 'bg-red-100 text-red-700' },
  none:     { label: '⚪ 일정 없음', className: 'bg-gray-100 text-gray-500' },
}
