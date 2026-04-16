'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { renameDropboxFolder } from '@/lib/dropbox'

export type SyncResult = {
  success: boolean
  dropbox: 'synced' | 'skipped' | 'error' | 'same'
  notion: 'synced' | 'skipped' | 'error'
  dropboxError?: string
  message: string
}

export async function syncSaleName(saleId: string): Promise<SyncResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, dropbox: 'skipped', notion: 'skipped', message: '인증 필요' }

  const admin = createAdminClient()
  const { data: sale } = await admin
    .from('sales')
    .select('id, name, dropbox_url, notion_page_id')
    .eq('id', saleId)
    .single()

  if (!sale) return { success: false, dropbox: 'skipped', notion: 'skipped', message: '프로젝트를 찾을 수 없음' }

  let dropboxStatus: SyncResult['dropbox'] = 'skipped'
  let notionStatus: SyncResult['notion'] = 'skipped'
  let dropboxError: string | undefined

  // 1. Dropbox 폴더명 변경
  if (sale.dropbox_url) {
    const result = await renameDropboxFolder(sale.dropbox_url, sale.name)
    if ('error' in result) {
      dropboxStatus = 'error'
      dropboxError = result.error
    } else if (result.newUrl === sale.dropbox_url) {
      dropboxStatus = 'same'
    } else {
      await admin.from('sales').update({ dropbox_url: result.newUrl }).eq('id', saleId)
      dropboxStatus = 'synced'
    }
  }

  // 2. Notion 페이지 제목 변경
  const notionPageId = (sale as any).notion_page_id as string | null
  if (notionPageId) {
    const token = process.env.NOTION_TOKEN
    if (token) {
      const res = await fetch(`https://api.notion.com/v1/pages/${notionPageId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Notion-Version': '2022-06-28',
        },
        body: JSON.stringify({
          properties: {
            'Project name': { title: [{ text: { content: sale.name } }] },
          },
        }),
      })
      notionStatus = res.ok ? 'synced' : 'error'
    }
  }

  revalidatePath(`/sales/${saleId}`)

  const parts: string[] = []
  if (dropboxStatus === 'synced') parts.push('드롭박스 폴더명 변경됨')
  else if (dropboxStatus === 'same') parts.push('드롭박스 이미 동일')
  else if (dropboxStatus === 'error') parts.push(`드롭박스 오류: ${dropboxError ?? ''}`)
  if (notionStatus === 'synced') parts.push('노션 페이지 제목 변경됨')
  else if (notionStatus === 'error') parts.push('노션 업데이트 실패')
  else if (notionStatus === 'skipped') parts.push('노션 미연결 (건너뜀)')

  return {
    success: dropboxStatus !== 'error',
    dropbox: dropboxStatus,
    notion: notionStatus,
    dropboxError,
    message: parts.join(' · ') || '변경사항 없음',
  }
}
