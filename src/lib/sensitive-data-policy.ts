// 민감 정보 입력 차단 정책 (Phase 9.3)
//
// 정책 (사용자 메모리 [feedback_no_salary_in_db.md] 그대로 코드화):
// 직원 전체 열람 구조라 공용 DB·Dropbox 공용 영역에 급여·연봉·인건비 성격 데이터 X.
//
// 1차 차단: UI 입력단 onSubmit / onBlur 에서 호출 (선택)
// 2차 차단: 서버 액션 첫 줄에 호출 (필수 — 우회 API 호출도 막힘)
//
// P2-4: throw 직전 audit 자동 기록 (POLICY_BLOCKED_SENSITIVE_INPUT). DRY.

export type SensitivePolicyMode =
  | 'block_all'      // 모든 사용자 차단 (현재 default)
  | 'admin_only'     // admin/manager 만 허용 (후속 옵션)

export const SENSITIVE_POLICY_MODE: SensitivePolicyMode = 'block_all'

// 한국어 키워드
export const SENSITIVE_KEYWORDS_KR = [
  '급여', '연봉', '인건비', '시급', '월급',
  '인센티브', '성과급', '보너스', '상여금',
] as const

// 영어 키워드 (대소문자 무시)
export const SENSITIVE_KEYWORDS_EN = [
  'salary', 'payroll', 'compensation', 'wage', 'wages',
  'bonus', 'incentive', 'commission',
] as const

// DB 컬럼·필드명 후보
export const SENSITIVE_FIELD_NAMES = [
  'salary', 'wage', 'wages', 'compensation', 'payroll',
  'monthly_pay', 'hourly_rate', 'bonus', 'incentive',
] as const

/**
 * 텍스트 안에 민감 키워드 포함 여부 검사.
 */
export function containsSensitiveKeyword(text: string | null | undefined): boolean {
  if (!text) return false
  const t = String(text)
  for (const k of SENSITIVE_KEYWORDS_KR) {
    if (t.includes(k)) return true
  }
  const lower = t.toLowerCase()
  for (const k of SENSITIVE_KEYWORDS_EN) {
    if (lower.includes(k)) return true
  }
  return false
}

export const SENSITIVE_BLOCK_MESSAGE =
  '🔒 급여·연봉·인건비 같은 민감 정보는 공용 시스템에 저장할 수 없습니다. 관리자 직접 채널 사용 필요.'

/**
 * 서버 액션 가드 — 차단 시 audit + throw.
 * P2-4: actorId 받으면 throw 직전 audit 자동 기록. DRY.
 *
 * 시그니처 호환:
 *   - 기존: assertNotSensitive(fields, role) — sync
 *   - P2-4: assertNotSensitive(fields, role, actorId?) — async
 */
export async function assertNotSensitive(
  fields: Record<string, string | null | undefined>,
  role: 'admin' | 'manager' | 'member' | string = 'member',
  actorId: string | null = null,
): Promise<void> {
  if (SENSITIVE_POLICY_MODE === 'admin_only' && (role === 'admin' || role === 'manager')) {
    return
  }
  for (const [name, value] of Object.entries(fields)) {
    const lowerName = name.toLowerCase()
    for (const f of SENSITIVE_FIELD_NAMES) {
      if (lowerName.includes(f)) {
        if (actorId) {
          const { auditSensitiveBlock } = await import('./audit')
          await auditSensitiveBlock({ actor_id: actorId, actor_role: role, fields })
        }
        throw new Error(`${SENSITIVE_BLOCK_MESSAGE} (필드: ${name})`)
      }
    }
    if (containsSensitiveKeyword(value)) {
      if (actorId) {
        const { auditSensitiveBlock } = await import('./audit')
        await auditSensitiveBlock({ actor_id: actorId, actor_role: role, fields })
      }
      throw new Error(`${SENSITIVE_BLOCK_MESSAGE} (입력 내용에 민감 키워드)`)
    }
  }
}
