// Dropbox `7 Claude협업` 폴더에서 회사 매뉴얼을 읽어 빵빵이 system prompt에 주입한다.
// Single source of truth = Dropbox. 서비스 매뉴얼 수정 시 배포 없이 다음 대화부터 반영.

import { readDropboxFile } from './dropbox'

const MANUAL_BASE = '/방 준영/1. 가업/★ DB/0 유어메이트/7 Claude협업'

// service_type → Dropbox 매뉴얼 파일 (상대 경로)
const SERVICE_MANUAL_PATH: Record<string, string> = {
  'SOS':         '01_SOS/SOS_공연.md',
  '교육프로그램':  '02_아트키움/아트키움_교육프로그램.md',
  '납품설치':    '03_학교상점/납품설치.md',
  '유지보수':    '03_학교상점/유지보수.md',
  '교구대여':    '03_학교상점/교구대여.md',
  '제작인쇄':    '03_학교상점/제작인쇄.md',
  '콘텐츠제작':  '04_002Creative/콘텐츠제작.md',
  '행사운영':    '04_002Creative/행사운영.md',
  '행사대여':    '04_002Creative/행사대여.md',
  '프로젝트':    '04_002Creative/프로젝트.md',
  '002ENT':     '05_002ent/002ent_음원유통.md',
}

// in-memory cache — Vercel Fluid Compute는 instance 재사용해서 효과적.
// 사용자가 Dropbox에서 매뉴얼 수정해도 최대 10분 안에 반영.
const cache = new Map<string, { text: string; expiresAt: number }>()
const TTL_MS = 10 * 60 * 1000

async function readWithCache(relativePath: string): Promise<string | null> {
  const now = Date.now()
  const cached = cache.get(relativePath)
  if (cached && cached.expiresAt > now) return cached.text

  const result = await readDropboxFile(`${MANUAL_BASE}/${relativePath}`).catch(() => null)
  if (!result || 'error' in result) return null
  cache.set(relativePath, { text: result.text, expiresAt: now + TTL_MS })
  return result.text
}

// 전사 매뉴얼 (모든 빵빵이 대화에 포함)
export async function loadCompanyManual(): Promise<string | null> {
  return readWithCache('YOURMATE_CLAUDE.md')
}

// 서비스별 매뉴얼 (해당 service_type 컨텍스트일 때만)
export async function loadServiceManual(serviceType: string | null | undefined): Promise<string | null> {
  if (!serviceType) return null
  const path = SERVICE_MANUAL_PATH[serviceType]
  if (!path) return null
  return readWithCache(path)
}

// 캐시 강제 비우기 (관리자 페이지나 webhook으로 호출 가능)
export function invalidateManualCache(): void {
  cache.clear()
}
