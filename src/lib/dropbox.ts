const DB_BASE = '/방 준영/1. 가업/★ DB'
const ROOT_NAMESPACE = process.env.DROPBOX_ROOT_NAMESPACE ?? '3265523555'

// 서비스 타입 → Dropbox 상위 폴더 경로
const SERVICE_PATHS: Record<string, string> = {
  'SOS':        `${DB_BASE}/2 SOS/2 프로젝트`,
  '교육프로그램': `${DB_BASE}/1 아트키움/2 프로젝트`,
  '납품설치':    `${DB_BASE}/3 학교상점/1 납품 설치`,
  '유지보수':    `${DB_BASE}/3 학교상점/1 유지보수`,
  '교구대여':    `${DB_BASE}/3 학교상점/1 교구대여`,
  '제작인쇄':    `${DB_BASE}/3 학교상점/1 제작인쇄`,
  '콘텐츠제작':  `${DB_BASE}/4 002Creative(영상,디자인,행사)/2 콘텐츠제작`,
  '행사운영':    `${DB_BASE}/4 002Creative(영상,디자인,행사)/2 행사운영`,
  '행사대여':    `${DB_BASE}/4 002Creative(영상,디자인,행사)/2 행사대여`,
  '프로젝트':    `${DB_BASE}/4 002Creative(영상,디자인,행사)/2 프로젝트`,
}

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

async function createFolder(path: string, token: string): Promise<void> {
  await fetch('https://api.dropboxapi.com/2/files/create_folder_v2', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Dropbox-API-Path-Root': JSON.stringify({ '.tag': 'root', 'root': ROOT_NAMESPACE }),
    },
    body: JSON.stringify({ path, autorename: false }),
  })
  // 폴더가 이미 존재해도 무시
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

  await createFolder(folderPath, token)
  await createFolder(`${folderPath}/0 행정`, token)

  if (service_type === '제작인쇄') {
    await createFolder(`${folderPath}/9 목업`, token)
  } else {
    await createFolder(`${folderPath}/99 사진,영상`, token)
  }

  // Dropbox 웹 링크
  return encodeURI(`https://www.dropbox.com/home${folderPath}`)
}
