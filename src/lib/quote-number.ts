// 견적번호 채번 — 'YY-MM-NNN' 형식 (예: '26-04-001')
//
// - 사업자 무관 전사 채번. 같은 YY-MM 안에서 max(NNN)+1.
// - generateQuoteNumber: 다음 번호 미리보기 (race 가능성 있음 — INSERT 직전엔 insertQuoteWithNumber 권장)
// - insertQuoteWithNumber: 채번 + INSERT를 함께. UNIQUE 위반(23505) 시 자동 재시도

import { createAdminClient } from '@/lib/supabase/admin'
import type { Quote } from '@/types'

const QUOTE_NUMBER_PATTERN = /^(\d{2})-(\d{2})-(\d{3,})$/

/**
 * 다음 견적번호 'YY-MM-NNN' 반환.
 * @param baseDate 기준일 (default: 오늘). YY-MM 추출용.
 */
export async function generateQuoteNumber(baseDate: Date = new Date()): Promise<string> {
  const prefix = formatYearMonthPrefix(baseDate)
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('quotes')
    .select('quote_number')
    .like('quote_number', `${prefix}%`)
    .order('quote_number', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(`견적번호 채번 조회 실패: ${error.message}`)

  const lastNumber = data?.quote_number ?? null
  const lastSeq = parseSequence(lastNumber)
  const nextSeq = lastSeq + 1
  return `${prefix}${String(nextSeq).padStart(3, '0')}`
}

/**
 * 견적 INSERT를 채번 + race-safe retry로 묶어서 처리.
 *
 * payload엔 quote_number 빼고 채울 컬럼들. (id/created_at/updated_at은 DB default)
 * UNIQUE 위반(SQLSTATE 23505) 시 maxRetries 회 까지 max+1 재계산 후 재삽입.
 */
export async function insertQuoteWithNumber(
  payload: Record<string, unknown>,
  options: { baseDate?: Date; maxRetries?: number } = {},
): Promise<Quote> {
  const { baseDate = new Date(), maxRetries = 5 } = options
  const admin = createAdminClient()

  let lastError: { code?: string; message?: string } | null = null

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const quoteNumber = await generateQuoteNumber(baseDate)
    const { data, error } = await admin
      .from('quotes')
      .insert({ ...payload, quote_number: quoteNumber })
      .select('*')
      .single()

    if (!error && data) {
      return data as Quote
    }
    lastError = error

    if (!isUniqueViolation(error)) {
      throw new Error(`견적 INSERT 실패: ${error?.message ?? '알 수 없는 오류'}`)
    }
    // UNIQUE 충돌 → 다음 attempt에서 max+1 재계산
  }

  throw new Error(
    `견적번호 채번 ${maxRetries}회 재시도 실패 (UNIQUE 충돌 지속). 마지막 에러: ${lastError?.message ?? ''}`,
  )
}

// ── 내부 ───────────────────────────────────────────────────────

function formatYearMonthPrefix(date: Date): string {
  const yy = String(date.getFullYear() % 100).padStart(2, '0')
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  return `${yy}-${mm}-`
}

function parseSequence(quoteNumber: string | null): number {
  if (!quoteNumber) return 0
  const m = quoteNumber.match(QUOTE_NUMBER_PATTERN)
  if (!m) return 0
  const seq = parseInt(m[3], 10)
  return Number.isFinite(seq) ? seq : 0
}

function isUniqueViolation(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false
  if (error.code === '23505') return true
  return /unique constraint|duplicate key/i.test(error.message ?? '')
}
