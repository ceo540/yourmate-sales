// 서비스 관련 매핑 중앙 관리.
// 서비스 추가 시 이 세 맵을 한 곳에서 함께 업데이트한다.

// 서비스 → 사업부 자동 매핑
export const SERVICE_TO_DEPT: Record<string, string> = {
  'SOS':        'sound_of_school',
  '002ENT':     '002_entertainment',
  '교육프로그램':  'artkiwoom',
  '납품설치':    'school_store',
  '유지보수':    'school_store',
  '교구대여':    'school_store',
  '제작인쇄':    'school_store',
  '콘텐츠제작':  '002_creative',
  '행사운영':    '002_creative',
  '행사대여':    '002_creative',
  '프로젝트':    '002_creative',
}

// 서비스 → 채널톡 그룹 ID
export const SERVICE_TO_GROUP: Record<string, string> = {
  'SOS':        '395644', // 1_사운드오브스쿨
  '002ENT':     '462715', // 1_002ENT
  '교육프로그램': '404376', // 1_아트키움-예술교육
  '납품설치':    '416890', // 1_학교상점
  '유지보수':    '416890',
  '교구대여':    '416890',
  '제작인쇄':    '416890',
  '콘텐츠제작':  '433414', // 1_002CREATIVE
  '행사운영':    '433414',
  '행사대여':    '433414',
  '프로젝트':    '433414',
}

/**
 * service_type 정규화 — trim + NFC + 내부 공백 1칸 통일.
 * 폼 select는 안전하지만 빵빵이/외부 입력에서 'SOS ' 같은 미세 차이 방지.
 * SERVICE_PATHS·SERVICE_TO_DEPT·SERVICE_TO_GROUP lookup 직전에 항상 호출.
 */
export function normalizeServiceType(input: string | null | undefined): string | null {
  if (!input) return null
  const cleaned = input.normalize('NFC').trim().replace(/\s+/g, ' ')
  return cleaned.length > 0 ? cleaned : null
}

/**
 * SERVICE_PATHS 안전 조회. 정규화 후 매칭. 미매칭이면 null.
 * (호출자가 console.error 로깅 책임)
 */
export function resolveServicePath(serviceType: string | null | undefined): string | null {
  const normalized = normalizeServiceType(serviceType)
  if (!normalized) return null
  return SERVICE_PATHS[normalized] ?? null
}

// 서비스 → Dropbox 상위 폴더 경로 (★ DB 기준 상대경로)
export const SERVICE_PATHS: Record<string, string> = {
  'SOS':        '/2 SOS/2 프로젝트',
  '교육프로그램': '/1 아트키움/2 프로젝트',
  '납품설치':    '/3 학교상점/1 납품 설치',
  '유지보수':    '/3 학교상점/1 유지보수',
  '교구대여':    '/3 학교상점/1 교구대여',
  '제작인쇄':    '/3 학교상점/1 제작인쇄',
  '콘텐츠제작':  '/4 002Creative(영상,디자인,행사)/2 콘텐츠제작',
  '행사운영':    '/4 002Creative(영상,디자인,행사)/2 행사운영',
  '행사대여':    '/4 002Creative(영상,디자인,행사)/2 행사대여',
  '프로젝트':    '/4 002Creative(영상,디자인,행사)/2 프로젝트',
  '002ENT':     '/5 002ent',
}
