// Dropbox `7 Claude협업` 폴더에서 회사 매뉴얼을 읽어 빵빵이 system prompt에 주입한다.
// Single source of truth = Dropbox. 서비스 매뉴얼 수정 시 배포 없이 다음 대화부터 반영.
//
// 정책:
// - 전사: 7 Claude협업/YOURMATE_CLAUDE.md (한 파일)
// - 서비스별: 7 Claude협업/<서비스폴더>/*.md  ← 폴더 안의 모든 .md 자동 합침
//   사용자가 견적기준.md, SOP.md, FAQ.md 추가만 하면 다음 대화부터 자동 활용

import { readDropboxFile, listDropboxFolder } from './dropbox'

const MANUAL_BASE = '/방 준영/1. 가업/★ DB/0 유어메이트/7 Claude협업'

// service_type → Dropbox 매뉴얼 폴더 (이 폴더 내 모든 .md를 합쳐서 컨텍스트로 사용)
const SERVICE_MANUAL_FOLDER: Record<string, string> = {
  'SOS':         '01_SOS',
  '교육프로그램':  '02_아트키움',
  '납품설치':    '03_학교상점',
  '유지보수':    '03_학교상점',
  '교구대여':    '03_학교상점',
  '제작인쇄':    '03_학교상점',
  '콘텐츠제작':  '04_002Creative',
  '행사운영':    '04_002Creative',
  '행사대여':    '04_002Creative',
  '프로젝트':    '04_002Creative',
  '002ENT':     '05_002ent',
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

// 공통 운영 매뉴얼 (00_공통 폴더 — 견적·계약·환불 등 모든 서비스 공용)
// 모든 빵빵이 대화에 포함됨.
export async function loadCommonManuals(): Promise<string | null> {
  return loadFolderManuals('00_공통')
}

// 폴더 안 모든 .md 합쳐서 가져오기 — 견적기준·SOP·FAQ 등 분할 보관 가능
async function loadFolderManuals(folder: string): Promise<string | null> {
  const folderCacheKey = `__folder__${folder}`
  const now = Date.now()
  const cached = cache.get(folderCacheKey)
  if (cached && cached.expiresAt > now) return cached.text || null

  const files = await listDropboxFolder(`${MANUAL_BASE}/${folder}`).catch(() => [])
  const mdFiles = files.filter(f => f.type === 'file' && f.name.endsWith('.md')).sort((a, b) => a.name.localeCompare(b.name))
  if (mdFiles.length === 0) {
    cache.set(folderCacheKey, { text: '', expiresAt: now + TTL_MS })
    return null
  }

  const parts = await Promise.all(
    mdFiles.map(async f => {
      const r = await readDropboxFile(`${MANUAL_BASE}/${folder}/${f.name}`).catch(() => null)
      if (!r || 'error' in r) return null
      return `<!-- 📄 ${f.name} -->\n${r.text}`
    })
  )
  const merged = parts.filter(Boolean).join('\n\n---\n\n')
  cache.set(folderCacheKey, { text: merged, expiresAt: now + TTL_MS })
  return merged || null
}

// 서비스별 매뉴얼 (해당 service_type 폴더 안 모든 .md 합쳐서 반환)
export async function loadServiceManual(serviceType: string | null | undefined): Promise<string | null> {
  if (!serviceType) return null
  const folder = SERVICE_MANUAL_FOLDER[serviceType]
  if (!folder) return null
  return loadFolderManuals(folder)
}

// 캐시 강제 비우기 (관리자 페이지나 webhook으로 호출 가능)
export function invalidateManualCache(): void {
  cache.clear()
}
