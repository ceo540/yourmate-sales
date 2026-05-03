import { SERVICE_PATHS, normalizeServiceType } from './services'

// ROOT_NAMESPACE는 계정 루트 네임스페이스
// → API 경로는 절대경로 (/방 준영/1. 가업/★ DB/...), 웹 URL에서 /home 제거 후 그대로 사용
const DB_BASE = '/방 준영/1. 가업/★ DB'
const WEB_BASE = 'https://www.dropbox.com/home'
const ROOT_NAMESPACE = process.env.DROPBOX_ROOT_NAMESPACE ?? '3265523555'

// 리프레시 토큰으로 액세스 토큰 발급
export async function getDropboxToken(): Promise<string | null> {
  const refreshToken = process.env.DROPBOX_REFRESH_TOKEN
  const appKey = process.env.DROPBOX_APP_KEY
  const appSecret = process.env.DROPBOX_APP_SECRET

  if (!refreshToken || !appKey || !appSecret) {
    console.error('[dropbox] env 누락 — DROPBOX_REFRESH_TOKEN/APP_KEY/APP_SECRET 중 일부 없음', {
      has_refresh: !!refreshToken,
      has_key: !!appKey,
      has_secret: !!appSecret,
    })
    return null
  }

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
  if (!data.access_token) {
    console.error('[dropbox] 토큰 발급 실패', JSON.stringify(data).slice(0, 300))
    return null
  }
  return data.access_token
}

// 부모 webUrl 안에 서브폴더 자동 생성 (다단계 가능). 이미 있으면 conflict OK 처리.
// 사용 예: ensureSubFolderPath(saleDropboxUrl, '0 행정/견적')
//   → /0 행정 폴더 생성(또는 이미 있음) → /0 행정/견적 폴더 생성 → 그 webUrl 반환
export async function ensureSubFolderPath(
  parentWebUrl: string,
  subPath: string,
): Promise<{ ok: true; webUrl: string } | { ok: false; error: string }> {
  const token = await getDropboxToken()
  if (!token) return { ok: false, error: 'Dropbox token 없음' }
  if (!parentWebUrl.startsWith(WEB_BASE)) return { ok: false, error: `URL 형식 오류: ${parentWebUrl}` }

  let currentPath = decodeURIComponent(parentWebUrl.replace(WEB_BASE, ''))
  let currentWebUrl = parentWebUrl

  const segments = subPath.split('/').map(s => s.trim()).filter(Boolean)
  for (const seg of segments) {
    currentPath = `${currentPath}/${seg}`
    const err = await createFolder(currentPath, token)
    if (err) return { ok: false, error: `폴더 '${seg}' 생성 실패: ${err}` }
    currentWebUrl = `${currentWebUrl}/${encodeURIComponent(seg)}`
  }
  return { ok: true, webUrl: currentWebUrl }
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
    body: JSON.stringify({ path: relativePath, limit: 300 }),
  })
  const data = await res.json()
  if (!data.entries) {
    console.error('[listDropboxFolder] no entries, path:', relativePath, 'response:', JSON.stringify(data).slice(0, 300))
    return []
  }

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
  if (!token) {
    console.error('[dropbox.createSaleFolder] 토큰 없음 — 폴더 생성 불가. env 확인 필요.', { name: params.name, service_type: params.service_type })
    return null
  }

  const { name, inflow_date } = params
  // 정규화 — 'SOS ' 같은 공백 / NFC 차이 흡수
  const service_type = normalizeServiceType(params.service_type)
  if (!service_type) {
    console.error('[dropbox.createSaleFolder] service_type 비어 있음 — 폴더 생성 불가.', { name, raw: params.service_type })
    return null
  }
  if (!SERVICE_PATHS[service_type]) {
    console.error(`[dropbox.createSaleFolder] SERVICE_PATHS 미매칭 service_type="${service_type}" (정규화 후) — 폴더 경로 알 수 없음.`, { raw: params.service_type, name, allowed: Object.keys(SERVICE_PATHS) })
    return null
  }

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
  await createFolder(`${apiPath}/1 기획`, token)
  if (service_type === '제작인쇄') {
    await createFolder(`${apiPath}/9 목업`, token)
  } else {
    await createFolder(`${apiPath}/99 사진,영상`, token)
  }

  // Dropbox 웹 링크
  return `https://www.dropbox.com/home${DB_BASE}${folderPath}`
}

// 계약 폴더 생성: <프로젝트폴더>/0 행정/{N}. {사업자정식명}_{금액}만원/
// 평면 1폴더 구조. 단일 계약도 N=1로 만들어 일관성 유지.
// 매출 미입력이면 _금액 부분 생략. 폴더명은 처음 만들 때만 박고 이후 변경 시 갱신 안 함.
export async function createContractFolder(params: {
  projectFolderWebUrl: string  // 프로젝트의 dropbox_url (https://www.dropbox.com/home/...)
  entityFullName: string       // 사업자 정식명 (호출자가 ㈜·(주)·주식회사 prefix 정리해서 전달)
  revenue: number | null       // 매출액 (null 또는 0이면 _금액 생략)
  saleSequence: number         // 같은 프로젝트 내 계약 순서 (1, 2, ...)
}): Promise<{ webUrl: string } | { error: string }> {
  const token = await getDropboxToken()
  if (!token) return { error: '드롭박스 토큰 없음' }

  const { projectFolderWebUrl, entityFullName, revenue, saleSequence } = params
  if (!projectFolderWebUrl.startsWith(WEB_BASE)) {
    return { error: '프로젝트 폴더 URL이 /home/ 형식이 아닙니다' }
  }

  const projectRelative = decodeURIComponent(projectFolderWebUrl.replace(WEB_BASE, '')).replace(/\/$/, '')
  const safeEntity = entityFullName.replace(/[\/\\:*?"<>|]/g, '_').trim()
  if (!safeEntity) return { error: '사업자 이름이 비어있음' }

  const revenueText = revenue && revenue > 0 ? `_${Math.round(revenue / 10000)}만원` : ''
  const folderName = `${saleSequence}. ${safeEntity}${revenueText}`

  const adminPath = `${projectRelative}/0 행정`
  const contractPath = `${adminPath}/${folderName}`

  await createFolder(adminPath, token)
  const contractErr = await createFolder(contractPath, token)
  if (contractErr && !contractErr.includes('conflict')) return { error: `계약 폴더 생성 실패: ${contractErr}` }

  return { webUrl: `${WEB_BASE}${contractPath}` }
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
    // 권한 오류: 사용자가 알 수 있게 친절한 메시지
    if (errBody.includes('no_write_permission')) {
      return {
        ok: false,
        error: `이 Dropbox 폴더에 쓰기 권한이 없어:\n${filePath}\n\n원인 가능성:\n- 다른 사람이 공유한 폴더이고 읽기 권한만 받았음\n- 폴더 소유주에게 편집자(Editor) 권한 요청 필요\n- 또는 yourmate가 만든 새 폴더로 변경 (drop URL 수정)`
      }
    }
    if (errBody.includes('not_found')) {
      return { ok: false, error: `Dropbox 폴더를 찾을 수 없어:\n${filePath}\n폴더가 이동·삭제됐거나 URL이 잘못됨.` }
    }
    return { ok: false, error: `Dropbox ${res.status}: ${errBody.slice(0, 300)}` }
  }
  const json = await res.json().catch(() => ({}))
  console.log('[uploadTextFile] saved at', json.path_display)
  return { ok: true as const, filename: params.filename, savedPath: json.path_display as string }
}

// 폴더명으로 Dropbox 자동 검색 — *정확히 일치*하는 폴더만 path 반환.
// 부분 매칭 자동 적용 X (잘못된 폴더 매칭 위험).
export async function findDropboxFolderByName(folderName: string): Promise<string | null> {
  const token = await getDropboxToken()
  if (!token) return null
  // 검색어: 원본 폴더명 그대로 (접두사 포함). exact 매칭만 하니까 가장 강한 시그널.
  const stripPrefix = (s: string) => s.replace(/^(\d{6}\s|\d{2}-\d{3}\s)/, '').trim()
  const targetClean = stripPrefix(folderName)
  if (!targetClean || targetClean.length < 3) return null // 너무 짧으면 위험

  const res = await fetch('https://api.dropboxapi.com/2/files/search_v2', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Dropbox-API-Path-Root': JSON.stringify({ '.tag': 'root', root: ROOT_NAMESPACE }),
    },
    body: JSON.stringify({ query: targetClean, options: { max_results: 30, file_status: 'active' } }),
  }).catch(() => null)
  if (!res?.ok) return null
  const data = await res.json().catch(() => null)
  if (!data?.matches) return null

  type Match = { metadata: { metadata: { '.tag': string; name: string; path_display: string } } }
  const folders = (data.matches as Match[])
    .filter(m => m.metadata?.metadata?.['.tag'] === 'folder')
    .map(m => m.metadata.metadata)

  // *정확한* 이름 매칭만 자동 적용 (대소문자 무시, 접두사 제거 비교)
  const exact = folders.find(f => stripPrefix(f.name).toLowerCase() === targetClean.toLowerCase())
  if (exact) return exact.path_display

  // 부분 매칭은 자동 적용 X — 사용자가 수동으로 선택해야
  return null
}

// 공유 링크(/scl/...) → /home/... URL로 자동 변환
export async function resolveDropboxSharedLink(sharedUrl: string): Promise<string | null> {
  const token = await getDropboxToken()
  if (!token) return null
  const res = await fetch('https://api.dropboxapi.com/2/sharing/get_shared_link_metadata', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: sharedUrl }),
  }).catch(() => null)
  if (!res?.ok) return null
  const data = await res.json().catch(() => null)
  const path = data?.path_lower as string | undefined
  if (!path) return null
  // path_lower는 /폴더이름 형식. 실제 풀 경로는 search로 다시 찾기.
  const name = path.split('/').filter(Boolean).pop()
  if (!name) return null
  return await findDropboxFolderByName(name)
}

// Dropbox URL 형식 검증 — /home/ 형식만 허용 (공유 링크 /scl/ 거부)
export function validateDropboxUrl(url: string): { ok: true } | { ok: false; error: string } {
  const trimmed = url.trim()
  if (!trimmed) return { ok: false, error: '비어있어' }
  if (!trimmed.startsWith('https://www.dropbox.com/')) {
    return { ok: false, error: 'Dropbox URL 형식 아님 (https://www.dropbox.com/... 으로 시작해야)' }
  }
  if (trimmed.includes('/scl/')) {
    return {
      ok: false,
      error: '공유 링크(/scl/...) 형식은 시스템에서 다룰 수 없어. Dropbox 웹·앱에서 그 폴더 열고 주소창의 /home/... 형식 URL 복사해서 붙여줘.'
    }
  }
  if (!trimmed.startsWith('https://www.dropbox.com/home')) {
    return { ok: false, error: '/home/ 형식 URL 필요 (예: https://www.dropbox.com/home/방%20준영/...)' }
  }
  return { ok: true }
}

// 드롭박스 단일 파일 rename (move_v2). 폴더 안에서 파일 이름만 변경.
export async function renameDropboxFile(
  folderWebUrl: string,
  oldFilename: string,
  newFilename: string,
): Promise<{ ok: true } | { error: string }> {
  const token = await getDropboxToken()
  if (!token) return { error: '드롭박스 토큰 없음' }
  const WEB_BASE = 'https://www.dropbox.com/home'
  if (!folderWebUrl.startsWith(WEB_BASE)) return { error: 'URL 형식 오류' }
  if (oldFilename === newFilename) return { ok: true }

  const folderPath = decodeURIComponent(folderWebUrl.replace(WEB_BASE, '')).replace(/\/$/, '')
  const fromPath = `${folderPath}/${oldFilename}`
  const toPath = `${folderPath}/${newFilename}`

  const res = await fetch('https://api.dropboxapi.com/2/files/move_v2', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Dropbox-API-Path-Root': JSON.stringify({ '.tag': 'root', 'root': ROOT_NAMESPACE }),
    },
    body: JSON.stringify({ from_path: fromPath, to_path: toPath, allow_shared_folder: true, autorename: false }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    return { error: `파일 이름 변경 실패: ${JSON.stringify(err).slice(0, 200)}` }
  }
  return { ok: true }
}

// 파일을 다른 경로로 이동 (절대경로 기준, 이동 실패 시 autorename으로 충돌 방지)
export async function moveDropboxFileByPath(
  fromPath: string,
  toPath: string,
): Promise<{ ok: true; finalPath: string } | { error: string }> {
  const token = await getDropboxToken()
  if (!token) return { error: '드롭박스 토큰 없음' }
  if (fromPath === toPath) return { ok: true, finalPath: toPath }
  const res = await fetch('https://api.dropboxapi.com/2/files/move_v2', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Dropbox-API-Path-Root': JSON.stringify({ '.tag': 'root', 'root': ROOT_NAMESPACE }),
    },
    body: JSON.stringify({ from_path: fromPath, to_path: toPath, allow_shared_folder: true, autorename: true }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    return { error: `파일 이동 실패: ${JSON.stringify(err).slice(0, 200)}` }
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = await res.json().catch(() => ({} as any))
  return { ok: true, finalPath: data?.metadata?.path_display ?? toPath }
}

// 드롭박스 폴더명 변경 (현재 sale.name 기준으로 rename)
// not_found 시 자동으로 폴더 검색해서 새 경로 찾기 → 재시도.
export async function renameDropboxFolder(
  dropboxUrl: string,
  newName: string,
): Promise<{ newUrl: string; recovered?: boolean } | { error: string }> {
  const token = await getDropboxToken()
  if (!token) return { error: '드롭박스 토큰 없음' }

  const WEB_BASE = 'https://www.dropbox.com/home'
  let workingUrl = dropboxUrl
  // shared link 자동 변환
  if (workingUrl.includes('/scl/')) {
    const resolved = await resolveDropboxSharedLink(workingUrl)
    if (resolved) workingUrl = `${WEB_BASE}${resolved}`
  }
  if (!workingUrl.startsWith(WEB_BASE)) return { error: '지원하지 않는 Dropbox URL 형식' }

  let fullPath = decodeURIComponent(workingUrl.replace(WEB_BASE, ''))
  const lastSlash = fullPath.lastIndexOf('/')
  if (lastSlash < 0) return { error: '잘못된 경로 형식' }

  let parentPath = fullPath.substring(0, lastSlash)
  let folderName = fullPath.substring(lastSlash + 1)
  let recovered = false

  // 날짜 접두사 추출 (예: "260416 ")
  // newName이 이미 날짜 패턴(260416) 또는 프로젝트 번호 패턴(26-109)으로 시작하면
  // 접두사를 중복으로 붙이지 않는다.
  const dateMatch = folderName.match(/^(\d{6})\s/)
  const newNameAlreadyHasPrefix = /^(\d{6}\s|\d{2}-\d)/.test(newName)
  const datePrefix = (dateMatch && !newNameAlreadyHasPrefix) ? dateMatch[1] + ' ' : ''

  const newFolderName = `${datePrefix}${newName}`
  let newPath = `${parentPath}/${newFolderName}`

  if (newPath === fullPath) return { newUrl: dropboxUrl }

  const tryMove = async (from: string, to: string) => {
    return await fetch('https://api.dropboxapi.com/2/files/move_v2', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Dropbox-API-Path-Root': JSON.stringify({ '.tag': 'root', 'root': ROOT_NAMESPACE }),
      },
      body: JSON.stringify({ from_path: from, to_path: to, allow_shared_folder: true, autorename: false }),
    })
  }

  let res = await tryMove(fullPath, newPath)

  // not_found 시 자동 검색해서 재시도
  if (!res.ok) {
    const errFirst = await res.json().catch(() => ({}))
    const errFirstStr = JSON.stringify(errFirst)
    if (errFirstStr.includes('from_lookup/not_found')) {
      const foundPath = await findDropboxFolderByName(folderName)
      if (foundPath && foundPath !== fullPath) {
        // 새 경로로 fullPath 갱신 + 재시도
        fullPath = foundPath
        const newLastSlash = foundPath.lastIndexOf('/')
        parentPath = foundPath.substring(0, newLastSlash)
        folderName = foundPath.substring(newLastSlash + 1)
        const newDateMatch = folderName.match(/^(\d{6})\s/)
        const newDatePrefix = (newDateMatch && !newNameAlreadyHasPrefix) ? newDateMatch[1] + ' ' : ''
        newPath = `${parentPath}/${newDatePrefix}${newName}`
        if (newPath === fullPath) return { newUrl: `${WEB_BASE}${fullPath}`, recovered: true }
        res = await tryMove(fullPath, newPath)
        recovered = true
      }
    }
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    const errStr = JSON.stringify(err)
    // 친절한 진단 메시지
    if (errStr.includes('from_lookup/not_found')) {
      return { error: `Dropbox 폴더를 찾을 수 없고 자동 검색도 일치하는 폴더 못 찾음.\n경로: ${fullPath}\n→ Dropbox에서 직접 찾고 yourmate에서 새 URL 붙여줘.` }
    }
    if (errStr.includes('to/conflict')) {
      return { error: `같은 이름의 폴더가 이미 있어. 다른 이름 사용 또는 기존 폴더 정리 필요.` }
    }
    if (errStr.includes('no_write_permission') || errStr.includes('insufficient_permissions')) {
      return { error: `이 폴더 이름 변경 권한이 없어. 외부 공유 폴더면 소유주 권한 필요.` }
    }
    return { error: `드롭박스 이름 변경 실패: ${errStr.slice(0, 200)}` }
  }

  return { newUrl: `${WEB_BASE}${newPath}`, recovered }
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
    const errStr = JSON.stringify(err)
    // 친절한 진단 메시지
    if (errStr.includes('from_lookup/not_found')) {
      return { error: `현재 저장된 Dropbox 폴더 경로를 찾을 수 없어. 누군가 폴더를 이동·삭제하거나 이름을 바꾼 것 같아.\n\n해결: Dropbox 웹/앱에서 그 폴더 직접 찾고 yourmate에서 새 URL 다시 붙여넣어줘.\n경로: ${fullPath}` }
    }
    if (errStr.includes('to/conflict')) {
      return { error: `같은 이름의 폴더가 이미 있어. 다른 이름 사용 또는 기존 폴더 정리 필요.` }
    }
    if (errStr.includes('no_write_permission') || errStr.includes('insufficient_permissions')) {
      return { error: `이 폴더 이름 변경 권한이 없어. 외부 공유 폴더면 소유주 권한 필요.` }
    }
    return { error: `드롭박스 이름 변경 실패: ${errStr.slice(0, 200)}` }
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
  // fullPath/cancelPath에 이미 DB_BASE가 포함되어 있으므로 다시 붙이지 않는다
  await fetch('https://api.dropboxapi.com/2/files/create_folder_v2', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Dropbox-API-Path-Root': JSON.stringify({ '.tag': 'root', 'root': ROOT_NAMESPACE }),
    },
    body: JSON.stringify({ path: cancelPath, autorename: false }),
  }).catch(() => {})

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
    return { error: `드롭박스 이동 실패: ${JSON.stringify(err).slice(0, 120)}` }
  }

  return { newUrl: `${WEB_BASE}${newPath}` }
}

// 드롭박스 파일 다운로드 후 텍스트 추출 (PDF → 텍스트, 기타 → 미지원)
// PDF 등 바이너리 파일을 base64로 받음 — Claude/OpenAI document 입력용 (OCR 자동)
export async function readDropboxFileBinary(relativePath: string): Promise<{ base64: string; bytes: number } | { error: string }> {
  const token = await getDropboxToken()
  if (!token) return { error: '드롭박스 토큰 없음' }

  const arg = encodeURIComponent(JSON.stringify({ path: relativePath }))
  const pathRoot = encodeURIComponent(JSON.stringify({ '.tag': 'root', root: ROOT_NAMESPACE }))
  const res = await fetch(
    `https://content.dropboxapi.com/2/files/download?arg=${arg}&path_root=${pathRoot}`,
    { method: 'POST', headers: { 'Authorization': `Bearer ${token}` } },
  )
  if (!res.ok) {
    const err = await res.text()
    return { error: `다운로드 실패: ${err.slice(0, 100)}` }
  }
  const buf = Buffer.from(await res.arrayBuffer())
  return { base64: buf.toString('base64'), bytes: buf.length }
}

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
