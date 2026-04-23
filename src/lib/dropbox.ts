import { SERVICE_PATHS } from './services'

// ROOT_NAMESPACE는 계정 루트 네임스페이스
// → API 경로는 절대경로 (/방 준영/1. 가업/★ DB/...), 웹 URL에서 /home 제거 후 그대로 사용
const DB_BASE = '/방 준영/1. 가업/★ DB'
const ROOT_NAMESPACE = process.env.DROPBOX_ROOT_NAMESPACE ?? '3265523555'

// 리프레시 토큰으로 액세스 토큰 발급
export async function getDropboxToken(): Promise<string | null> {
  const refreshToken = process.env.DROPBOX_REFRESH_TOKEN
  const appKey = process.env.DROPBOX_APP_KEY
  const appSecret = process.env.DROPBOX_APP_SECRET

  if (!refreshToken || !appKey || !appSecret) return null

  const res = await fetch('https://api.dropboxapi.com/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: appKey,
      client_secret: appSecret,
    }),
  })
  const data = await res.json()
  return data.access_token ?? null
}

// 성공/이미존재: null 반환 / 실패: 에러 문자열 반환 (too_many_write_operations 시 최대 3회 재시도)
async function createFolder(path: string, token: string, retries = 3): Promise<string | null> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch('https://api.dropboxapi.com/2/files/create_folder_v2', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Dropbox-API-Path-Root': JSON.stringify({ '.tag': 'root', 'root': ROOT_NAMESPACE }),
      },
      body: JSON.stringify({ path, autorename: false }),
    })
    if (res.ok) return null
    const err = await res.json().catch(() => ({}))
    const tag: string = err?.error_summary ?? err?.error?.['.tag'] ?? ''
    // 이미 존재하는 폴더는 성공으로 간주
    if (tag.includes('conflict')) return null
    // 쓰기 속도 제한(rate limit): 지수 백오프 후 재시도
    if (tag.includes('too_many_write_operations') && attempt < retries) {
      const delay = Math.pow(2, attempt) * 1000 // 1s → 2s → 4s
      await new Promise(r => setTimeout(r, delay))
      continue
    }
    return JSON.stringify(err)
  }
  return 'too_many_write_operations: 재시도 횟수 초과'
}

// 드롭박스에서 파일/폴더 검색 (★ DB 네임스페이스 기준)
export async function searchDropbox(query: string): Promise<{ name: string; path: string; type: 'file' | 'folder' }[]> {
  const token = await getDropboxToken()
  if (!token) return []

  const res = await fetch('https://api.dropboxapi.com/2/files/search_v2', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Dropbox-API-Path-Root': JSON.stringify({ '.tag': 'root', 'root': ROOT_NAMESPACE }),
    },
    body: JSON.stringify({
      query,
      options: { max_results: 20, file_status: 'active' },
    }),
  })
  const data = await res.json()
  if (!data.matches) return []

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return data.matches.map((m: any) => ({
    name: m.metadata?.metadata?.name || '',
    path: m.metadata?.metadata?.path_display || '',
    type: m.metadata?.metadata?.['.tag'] === 'folder' ? 'folder' : 'file',
  }))
}

// 드롭박스 폴더 내용 조회 (★ DB 기준 상대경로)
export async function listDropboxFolder(relativePath: string): Promise<{ name: string; path: string; type: 'file' | 'folder' }[]> {
  const token = await getDropboxToken()
  if (!token) return []

  const res = await fetch('https://api.dropboxapi.com/2/files/list_folder', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Dropbox-API-Path-Root': JSON.stringify({ '.tag': 'root', 'root': ROOT_NAMESPACE }),
    },
    body: JSON.stringify({ path: relativePath, limit: 50 }),
  })
  const data = await res.json()
  if (!data.entries) return []

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return data.entries.map((e: any) => ({
    name: e.name,
    path: e.path_display,
    type: e['.tag'] === 'folder' ? 'folder' : 'file',
  }))
}

export async function createSaleFolder(params: {
  service_type: string | null
  name: string
  inflow_date: string | null
}): Promise<string | null> {
  const token = await getDropboxToken()
  if (!token) return null

  const { service_type, name, inflow_date } = params
  if (!service_type || !SERVICE_PATHS[service_type]) return null

  const parentPath = SERVICE_PATHS[service_type]

  // YYMMDD 날짜 포맷
  const dateStr = inflow_date ?? new Date().toISOString().slice(0, 10)
  const [year, month, day] = dateStr.split('-')
  const datePrefix = `${year.slice(2)}${month}${day}`

  const folderName = `${datePrefix} ${name}`
  const folderPath = `${parentPath}/${folderName}`

  // API 경로: 네임스페이스 루트 기준 전체 경로 (DB_BASE 포함)
  const apiPath = `${DB_BASE}${folderPath}`

  // 메인 폴더 생성 실패 시 에러 throw (URL 저장 방지)
  const mainErr = await createFolder(apiPath, token)
  if (mainErr) throw new Error(`Dropbox API 오류 (경로: ${apiPath}): ${mainErr}`)

  // 하위 폴더는 실패해도 무시 (메인 폴더가 있으면 충분)
  await createFolder(`${apiPath}/0 행정`, token)
  await createFolder(`${apiPath}/0 행정/원가`, token)
  if (service_type === '제작인쇄') {
    await createFolder(`${apiPath}/9 목업`, token)
  } else {
    await createFolder(`${apiPath}/99 사진,영상`, token)
  }

  // Dropbox 웹 링크
  return `https://www.dropbox.com/home${DB_BASE}${folderPath}`
}

// 텍스트 파일을 드롭박스 폴더에 업로드 (Dropbox-API-Arg 헤더 한글 문제로 URL 파라미터 방식 사용)
export async function uploadTextFile(params: {
  folderWebUrl: string
  filename: string
  content: string
}): Promise<{ ok: true; filename: string; savedPath?: string } | { ok: false; error: string }> {
  const token = await getDropboxToken()
  if (!token) return { ok: false, error: '드롭박스 토큰 없음' }

  const WEB_BASE = 'https://www.dropbox.com/home'
  if (!params.folderWebUrl.startsWith(WEB_BASE)) return { ok: false, error: 'URL 형식 오류 (/home/... 필요)' }

  // URL 디코딩 후 절대경로 사용 (path_root + 절대경로 조합이 공유폴더 쓰기에 정상 작동)
  const folderPath = decodeURIComponent(params.folderWebUrl.replace(WEB_BASE, ''))
  const filePath = `${folderPath}/${params.filename}`

  const arg = encodeURIComponent(JSON.stringify({ path: filePath, mode: 'overwrite', autorename: false }))
  const pathRoot = encodeURIComponent(JSON.stringify({ '.tag': 'root', root: ROOT_NAMESPACE }))

  const res = await fetch(
    `https://content.dropboxapi.com/2/files/upload?arg=${arg}&path_root=${pathRoot}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/octet-stream',
      },
      body: Buffer.from(params.content, 'utf-8'),
    }
  )
  if (!res.ok) {
    const errBody = await res.text().catch(() => '')
    console.error('[uploadTextFile] Dropbox error', res.status, errBody, { filePath })
    return { ok: false, error: `Dropbox ${res.status}: ${errBody.slice(0, 200)}` }
  }
  const json = await res.json().catch(() => ({}))
  console.log('[uploadTextFile] saved at', json.path_display)
  return { ok: true as const, filename: params.filename, savedPath: json.path_display as string }
}

// 드롭박스 폴더명 변경 (현재 sale.name 기준으로 rename)
export async function renameDropboxFolder(
  dropboxUrl: string,
  newName: string,
): Promise<{ newUrl: string } | { error: string }> {
  const token = await getDropboxToken()
  if (!token) return { error: '드롭박스 토큰 없음' }

  const WEB_BASE = 'https://www.dropbox.com/home'
  if (!dropboxUrl.startsWith(WEB_BASE)) return { error: '지원하지 않는 Dropbox URL 형식' }

  const fullPath = decodeURIComponent(dropboxUrl.replace(WEB_BASE, ''))
  const lastSlash = fullPath.lastIndexOf('/')
  if (lastSlash < 0) return { error: '잘못된 경로 형식' }

  const parentPath = fullPath.substring(0, lastSlash)
  const folderName = fullPath.substring(lastSlash + 1)

  // 날짜 접두사 추출 (예: "260416 ")
  const dateMatch = folderName.match(/^(\d{6})\s/)
  const datePrefix = dateMatch ? dateMatch[1] + ' ' : ''

  const newFolderName = `${datePrefix}${newName}`
  const newPath = `${parentPath}/${newFolderName}`

  if (newPath === fullPath) return { newUrl: dropboxUrl }

  const res = await fetch('https://api.dropboxapi.com/2/files/move_v2', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Dropbox-API-Path-Root': JSON.stringify({ '.tag': 'root', 'root': ROOT_NAMESPACE }),
    },
    body: JSON.stringify({
      from_path: fullPath,
      to_path: newPath,
      allow_shared_folder: true,
      autorename: false,
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    return { error: `드롭박스 이름 변경 실패: ${JSON.stringify(err).slice(0, 120)}` }
  }

  return { newUrl: `${WEB_BASE}${newPath}` }
}

// 폴더명 전체 교체 (날짜 접두사 무시) — 계약 전환 고유번호 적용에 사용
export async function renameDropboxFolderFull(
  dropboxUrl: string,
  newFolderName: string,
): Promise<{ newUrl: string } | { error: string }> {
  const token = await getDropboxToken()
  if (!token) return { error: '드롭박스 토큰 없음' }

  const WEB_BASE = 'https://www.dropbox.com/home'
  if (!dropboxUrl.startsWith(WEB_BASE)) return { error: '지원하지 않는 Dropbox URL 형식' }

  const fullPath = decodeURIComponent(dropboxUrl.replace(WEB_BASE, ''))
  const lastSlash = fullPath.lastIndexOf('/')
  if (lastSlash < 0) return { error: '잘못된 경로 형식' }

  const parentPath = fullPath.substring(0, lastSlash)
  const newPath = `${parentPath}/${newFolderName}`

  if (newPath === fullPath) return { newUrl: dropboxUrl }

  const res = await fetch('https://api.dropboxapi.com/2/files/move_v2', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Dropbox-API-Path-Root': JSON.stringify({ '.tag': 'root', 'root': ROOT_NAMESPACE }),
    },
    body: JSON.stringify({
      from_path: fullPath,
      to_path: newPath,
      allow_shared_folder: true,
      autorename: false,
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    return { error: `드롭박스 이름 변경 실패: ${JSON.stringify(err).slice(0, 120)}` }
  }

  return { newUrl: `${WEB_BASE}${newPath}` }
}

// 취소된 리드 폴더를 서비스 폴더 내 "999999.취소" 하위 폴더로 이동
export async function moveDropboxToCancel(
  dropboxUrl: string,
): Promise<{ newUrl: string } | { error: string }> {
  const token = await getDropboxToken()
  if (!token) return { error: '드롭박스 토큰 없음' }

  const WEB_BASE = 'https://www.dropbox.com/home'
  if (!dropboxUrl.startsWith(WEB_BASE)) return { error: '지원하지 않는 Dropbox URL 형식' }

  const fullPath = decodeURIComponent(dropboxUrl.replace(WEB_BASE, ''))
  const lastSlash = fullPath.lastIndexOf('/')
  if (lastSlash < 0) return { error: '잘못된 경로 형식' }

  const parentPath = fullPath.substring(0, lastSlash)
  const folderName = fullPath.substring(lastSlash + 1)
  const cancelPath = `${parentPath}/999999.취소`
  const newPath = `${cancelPath}/${folderName}`

  // 취소 폴더가 없으면 생성
  await fetch('https://api.dropboxapi.com/2/files/create_folder_v2', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Dropbox-API-Path-Root': JSON.stringify({ '.tag': 'root', 'root': ROOT_NAMESPACE }),
    },
    body: JSON.stringify({ path: `${DB_BASE}${cancelPath}`, autorename: false }),
  }).catch(() => {})

  const res = await fetch('https://api.dropboxapi.com/2/files/move_v2', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Dropbox-API-Path-Root': JSON.stringify({ '.tag': 'root', 'root': ROOT_NAMESPACE }),
    },
    body: JSON.stringify({
      from_path: `${DB_BASE}${fullPath}`,
      to_path: `${DB_BASE}${newPath}`,
      allow_shared_folder: true,
      autorename: false,
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    return { error: `드롭박스 이동 실패: ${JSON.stringify(err).slice(0, 120)}` }
  }

  return { newUrl: `${WEB_BASE}${newPath}` }
}

// 드롭박스 파일 다운로드 후 텍스트 추출 (PDF → 텍스트, 기타 → 미지원)
export async function readDropboxFile(relativePath: string): Promise<{ text: string; truncated: boolean } | { error: string }> {
  const token = await getDropboxToken()
  if (!token) return { error: '드롭박스 토큰 없음' }

  // 한글 경로 헤더 ByteString 에러 방지 — URL 파라미터 방식 사용
  const arg = encodeURIComponent(JSON.stringify({ path: relativePath }))
  const pathRoot = encodeURIComponent(JSON.stringify({ '.tag': 'root', root: ROOT_NAMESPACE }))
  const res = await fetch(
    `https://content.dropboxapi.com/2/files/download?arg=${arg}&path_root=${pathRoot}`,
    {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
    }
  )

  if (!res.ok) {
    const err = await res.text()
    return { error: `다운로드 실패: ${err.slice(0, 100)}` }
  }

  const ext = relativePath.split('.').pop()?.toLowerCase()

  if (ext === 'pdf') {
    const buffer = Buffer.from(await res.arrayBuffer())
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require('pdf-parse') as (buffer: Buffer) => Promise<{ text: string }>
    const parsed = await pdfParse(buffer)
    const text = parsed.text.trim()
    const MAX = 4000
    if (text.length > MAX) {
      return { text: text.slice(0, MAX), truncated: true }
    }
    return { text, truncated: false }
  }

  // txt / csv 등 텍스트 파일
  if (['txt', 'csv', 'md'].includes(ext ?? '')) {
    const text = await res.text()
    const MAX = 4000
    return { text: text.slice(0, MAX), truncated: text.length > MAX }
  }

  return { error: `지원하지 않는 파일 형식: ${ext}. PDF, txt, csv만 읽을 수 있어.` }
}
