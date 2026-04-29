import { NextRequest, NextResponse } from 'next/server'
import { getDropboxToken } from '@/lib/dropbox'
import { createAdminClient } from '@/lib/supabase/admin'

const WEB_BASE = 'https://www.dropbox.com/home'

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams
  const projectId = sp.get('project_id')
  const saleId = sp.get('sale_id')
  const customPath = sp.get('path')

  const token = await getDropboxToken()
  if (!token) {
    return NextResponse.json({ status: 'error', stage: 'token', message: '토큰 발급 실패' })
  }

  let testPath = customPath || '/방 준영/1. 가업/★ DB'
  let projectInfo: Record<string, unknown> | null = null

  if (projectId || saleId) {
    const admin = createAdminClient()
    let pid = projectId
    if (saleId && !pid) {
      const { data: s } = await admin.from('sales').select('project_id').eq('id', saleId).maybeSingle()
      pid = s?.project_id ?? null
    }
    if (pid) {
      const { data: p } = await admin.from('projects').select('id, name, dropbox_url').eq('id', pid).maybeSingle()
      projectInfo = p as Record<string, unknown> | null
      if (p?.dropbox_url) {
        const projectFolderPath = decodeURIComponent(p.dropbox_url.replace(WEB_BASE, '')).replace(/\/$/, '')
        testPath = `${projectFolderPath}/0 행정/원가`
      }
    }
  }

  const res = await fetch('https://api.dropboxapi.com/2/files/list_folder', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Dropbox-API-Path-Root': JSON.stringify({ '.tag': 'root', 'root': process.env.DROPBOX_ROOT_NAMESPACE ?? '3265523555' }),
    },
    body: JSON.stringify({ path: testPath, limit: 50 }),
  })
  const data = await res.json()

  return NextResponse.json({
    status: res.ok ? 'ok' : 'error',
    httpStatus: res.status,
    testedPath: testPath,
    projectInfo,
    hasEntries: !!data.entries,
    entriesCount: data.entries?.length ?? 0,
    entries: data.entries?.map((e: { '.tag': string; name: string; path_display: string }) => ({
      tag: e['.tag'],
      name: e.name,
      path: e.path_display,
    })) ?? null,
    rawError: res.ok ? null : data,
  })
}
