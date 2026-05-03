// 프로젝트 분류 체계 — yourmate-company-spec-v2 §5~8
// "service_type"(영업 언어) 위에 "main_type + expansion_tags + capability_tags"(운영 구조) 추가.
//
// ⚠️ 데모 단계: localStorage 기반.
//    DB 마이그(projects ALTER) 후에는 server action 호출로 교체.
//    타입 구조는 명세 §4.2 와 1:1 일치 — 마이그 시 그대로 매핑.

// ────────────────────────────────────────────────────────────
// 메인유형 (1개) — yourmate-company-spec-v2 §5
// ────────────────────────────────────────────────────────────
export type MainType =
  | '학교공연형'
  | '교육운영형'
  | '복합행사형'
  | '렌탈·납품형'
  | '콘텐츠제작형'

export const MAIN_TYPES: { key: MainType; label: string; hint: string }[] = [
  { key: '학교공연형',   label: '학교공연형',   hint: '학교/기관이 공연프로그램 자체를 요청 (진로콘서트, 또래상담)' },
  { key: '교육운영형',   label: '교육운영형',   hint: '교육프로그램 운영 위탁 (예술교육, 기관 연계 교육)' },
  { key: '복합행사형',   label: '복합행사형',   hint: '학교축제·발표회·턴키 행사' },
  { key: '렌탈·납품형',  label: '렌탈·납품형',  hint: '교구대여, 납품, 유지보수' },
  { key: '콘텐츠제작형', label: '콘텐츠제작형', hint: '영상·사진·디자인 제작 산출물' },
]

// ────────────────────────────────────────────────────────────
// 확장태그 (다중) — yourmate-company-spec-v2 §7
// ────────────────────────────────────────────────────────────
export type ExpansionTag =
  | '행사운영' | '행사진행' | '영상제작' | '사진촬영' | '디자인'
  | '인쇄물제작' | '기념품제작' | '교구대여' | '교육용악기렌탈'
  | '행사장비렌탈' | '음향운영' | '조명운영' | '설치철수'
  | '유지보수' | 'SNS운영'

export const EXPANSION_TAGS: ExpansionTag[] = [
  '행사운영', '행사진행', '영상제작', '사진촬영', '디자인',
  '인쇄물제작', '기념품제작', '교구대여', '교육용악기렌탈',
  '행사장비렌탈', '음향운영', '조명운영', '설치철수',
  '유지보수', 'SNS운영',
]

// 그룹별 묶음 (UI 가독성용)
export const EXPANSION_TAG_GROUPS: { label: string; tags: ExpansionTag[] }[] = [
  { label: '행사·운영', tags: ['행사운영', '행사진행', '음향운영', '조명운영', '설치철수', '유지보수'] },
  { label: '제작·콘텐츠', tags: ['영상제작', '사진촬영', '디자인', '인쇄물제작', '기념품제작', 'SNS운영'] },
  { label: '렌탈',       tags: ['교구대여', '교육용악기렌탈', '행사장비렌탈'] },
]

// ────────────────────────────────────────────────────────────
// 역량태그 (다중) — yourmate-company-spec-v2 §8
// ────────────────────────────────────────────────────────────
export type CapabilityTag =
  | '공연기획' | '행사기획' | '출연진운영'
  | '교육기획' | '강사섭외' | '교육운영'
  | '현장총괄' | '행사진행' | '운영스태프관리'
  | '디자인제작' | '영상촬영' | '사진촬영' | '영상편집' | '사진편집'
  | '인쇄제작관리' | '기념품제작관리'
  | '장비세팅' | '음향오퍼레이팅' | '조명오퍼레이팅'
  | '물류/배송' | '설치철수관리' | '유지보수대응'
  | '정산관리' | '계약관리'

export const CAPABILITY_TAGS: CapabilityTag[] = [
  '공연기획', '행사기획', '출연진운영',
  '교육기획', '강사섭외', '교육운영',
  '현장총괄', '행사진행', '운영스태프관리',
  '디자인제작', '영상촬영', '사진촬영', '영상편집', '사진편집',
  '인쇄제작관리', '기념품제작관리',
  '장비세팅', '음향오퍼레이팅', '조명오퍼레이팅',
  '물류/배송', '설치철수관리', '유지보수대응',
  '정산관리', '계약관리',
]

export const CAPABILITY_TAG_GROUPS: { label: string; tags: CapabilityTag[] }[] = [
  { label: '기획',     tags: ['공연기획', '행사기획', '출연진운영', '교육기획', '강사섭외'] },
  { label: '운영·총괄', tags: ['교육운영', '현장총괄', '행사진행', '운영스태프관리'] },
  { label: '제작',     tags: ['디자인제작', '영상촬영', '사진촬영', '영상편집', '사진편집', '인쇄제작관리', '기념품제작관리'] },
  { label: '현장 기술', tags: ['장비세팅', '음향오퍼레이팅', '조명오퍼레이팅', '설치철수관리', '유지보수대응'] },
  { label: '지원',     tags: ['물류/배송', '정산관리', '계약관리'] },
]

// ────────────────────────────────────────────────────────────
// 분류 객체 — DB 컬럼과 1:1 매핑 (명세 §4.2)
// ────────────────────────────────────────────────────────────
export interface ProjectClassification {
  main_type: MainType | null
  expansion_tags: ExpansionTag[]
  capability_tags: CapabilityTag[]
  classification_note: string | null         // "왜 이렇게 분류했는지"
  classification_confidence: number | null   // AI 자동분류 시 (0~100)
  updated_at?: string                         // 데모용 — DB 마이그 후 서버가 채움
}

export const EMPTY_CLASSIFICATION: ProjectClassification = {
  main_type: null,
  expansion_tags: [],
  capability_tags: [],
  classification_note: null,
  classification_confidence: null,
}

// ────────────────────────────────────────────────────────────
// localStorage 헬퍼 (데모 단계 only)
// ────────────────────────────────────────────────────────────
const STORAGE_PREFIX = 'yourmate:project_classification:'

export function loadClassification(projectId: string): ProjectClassification | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + projectId)
    if (!raw) return null
    const parsed = JSON.parse(raw) as ProjectClassification
    return { ...EMPTY_CLASSIFICATION, ...parsed }
  } catch {
    return null
  }
}

export function saveClassification(projectId: string, c: ProjectClassification): void {
  if (typeof window === 'undefined') return
  try {
    const payload = { ...c, updated_at: new Date().toISOString() }
    localStorage.setItem(STORAGE_PREFIX + projectId, JSON.stringify(payload))
  } catch {
    // quota·private mode 무시
  }
}

export function clearClassification(projectId: string): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem(STORAGE_PREFIX + projectId)
  } catch {
    // 무시
  }
}

// ────────────────────────────────────────────────────────────
// service_type → main_type 추천 매핑 (명세 §5.2 보조 규칙)
// 데모 단계 = 사용자가 [추천] 버튼 클릭 시 노출. 자동 적용 X.
// ────────────────────────────────────────────────────────────
export function suggestMainTypeFromText(text: string | null | undefined): MainType | null {
  if (!text) return null
  const t = text.toLowerCase()
  if (/(축제|발표회|행사\s*전체|턴키)/i.test(t)) return '복합행사형'
  if (/(콘서트|공연|sos|sound\s*of\s*school|진로|또래상담)/i.test(t)) return '학교공연형'
  if (/(교육|강사|차시|수업|예술교육|연수)/i.test(t)) return '교육운영형'
  if (/(납품|렌탈|교구|유지보수|설치)/i.test(t)) return '렌탈·납품형'
  if (/(영상|촬영|디자인|사진|콘텐츠|영상편집|이미지|로고)/i.test(t)) return '콘텐츠제작형'
  return null
}
