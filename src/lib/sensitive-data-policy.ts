// 민감 정보 입력 차단 정책 (Phase 9.3)
//
// 정책 (사용자 메모리 [feedback_no_salary_in_db.md] 그대로 코드화):
// 직원 전체 열람 구조라 공용 DB·Dropbox 공용 영역에 급여·연봉·인건비 성격 데이터 X.
//
// 1차 차단: UI 입력단 onSubmit / onBlur 에서 호출
// 2차 차단: 서버 액션 첫 줄에 호출 (필수 — 우회 API 호출도 막힘)
//
// 추후 정책 변경 가능성 (admin/manager 한정 허용 등) 위해 모드 플래그 분리.

export type SensitivePolicyMode =
  | 'block_all'      // 모든 사용자 차단 (현재 default)
  | 'admin_only'     // admin/manager 만 허용 (후속 옵션)

export const SENSITIVE_POLICY_MODE: SensitivePolicyMode = 'block_all'

// 한국어 키워드 (그대로 일치)
export const SENSITIVE_KEYWORDS_KR = [
  '급여', '연봉', '인건비', '시급', '월급',
  '인센티브', '성과급', '보너스', '상여금',
] as const

// 영어 키워드 (대소문자 무시)
export const SENSITIVE_KEYWORDS_EN = [
  'salary', 'payroll', 'compensation', 'wage', 'wages',
  'bonus', 'incentive', 'commission',
] as const

// DB 컬럼·필드명 후보 (이런 이름으로 컬럼 추가 시도 시 review)
export const SENSITIVE_FIELD_NAMES = [
  'salary', 'wage', 'wages', 'compensation', 'payroll',
  'monthly_pay', 'hourly_rate', 'bonus', 'incentive',
] as const

/**
 * 텍스트 안에 민감 키워드 포함 여부 검사.
 * 한국어는 대소문자 의미 없음(그대로 검사), 영어는 lower 변환 후 검사.
 */
export function containsSensitiveKeyword(text: string | null | undefined): boolean {
  if (!text) return false
  const t = String(text)
  for (const k of SENSITIVE_KEYWORDS_KR) {
    if (t.includes(k)) return true
  }
  const lower = t.toLowerCase()
  for (const k of SENSITIVE_KEYWORDS_EN) {
    // 단어 경계 의식 — "ad-salary" 같은 부분 매칭도 일단 잡고 시작 (보수적)
    if (lower.includes(k)) return true
  }
  return false
}

export const SENSITIVE_BLOCK_MESSAGE =
  '🔒 급여·연봉·인건비 같은 민감 정보는 공용 시스템에 저장할 수 없습니다. 관리자 직접 채널 사용 필요.'

/**
 * 서버 액션 가드 — 차단 시 throw.
 * 필드명 + 값 모두 검사. role 인자는 향후 admin_only 모드 대비.
 */
export function assertNotSensitive(
  fields: Record<string, string | null | undefined>,
  role: 'admin' | 'manager' | 'member' | string = 'member',
): void {
  if (SENSITIVE_POLICY_MODE === 'admin_only' && (role === 'admin' || role === 'manager')) {
    return  // 후속 정책: admin/manager 통과
  }
  for (const [name, value] of Object.entries(fields)) {
    // 필드명 자체에 민감 토큰
    const lowerName = name.toLowerCase()
    for (const f of SENSITIVE_FIELD_NAMES) {
      if (lowerName.includes(f)) {
        throw new Error(`${SENSITIVE_BLOCK_MESSAGE} (필드: ${name})`)
      }
    }
    // 값 안에 민감 키워드
    if (containsSensitiveKeyword(value)) {
      throw new Error(`${SENSITIVE_BLOCK_MESSAGE} (입력 내용에 민감 키워드)`)
    }
  }
}
