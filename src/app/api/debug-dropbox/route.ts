import { NextResponse } from 'next/server'
import { getDropboxToken } from '@/lib/dropbox'

export async function GET() {
  // 토큰 발급 확인
  const token = await getDropboxToken()
  if (!token) {
    return NextResponse.json({
      status: 'error',
      stage: 'token',
      message: '토큰 발급 실패',
      env: {
        DROPBOX_REFRESH_TOKEN: !!process.env.DROPBOX_REFRESH_TOKEN,
        DROPBOX_APP_KEY: !!process.env.DROPBOX_APP_KEY,
        DROPBOX_APP_SECRET: !!process.env.DROPBOX_APP_SECRET,
      },
    })
  }

  // list_folder 호출 — 루트("/") 기준
  const res = await fetch('https://api.dropboxapi.com/2/files/list_folder', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Dropbox-API-Path-Root': JSON.stringify({ '.tag': 'root', 'root': process.env.DROPBOX_ROOT_NAMESPACE ?? '3265523555' }),
    },
    body: JSON.stringify({ path: '/방 준영/1. 가업/★ DB', limit: 5 }),
  })
  const data = await res.json()

  return NextResponse.json({
    status: res.ok ? 'ok' : 'error',
    httpStatus: res.status,
    hasEntries: !!data.entries,
    entriesCount: data.entries?.length ?? 0,
    firstEntry: data.entries?.[0]?.name ?? null,
    rawError: res.ok ? null : data,
  })
}
