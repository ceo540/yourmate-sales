'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { renameDropboxFolder } from '@/lib/dropbox'

export type ProjectSyncResult = {
  success: boolean
  dropbox: 'synced' | 'skipped' | 'error' | 'same'
  dropboxError?: string
  message: string
}

// 프로젝트명과 Dropbox 폴더명을 동기화.
// updateProjectName가 자동으로 처리하지만, 실패 후 복구 수단으로 이 버튼 사용.
export async function syncProjectName(projectId: string): Promise<ProjectSyncResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, dropbox: 'skipped', message: '인증 필요' }

  const admin = createAdminClient()
  const { data: project } = await admin
    .from('projects')
    .select('id, name, dropbox_url')
    .eq('id', projectId)
    .single()

  if (!project) return { success: false, dropbox: 'skipped', message: '프로젝트를 찾을 수 없음' }
  if (!project.dropbox_url) return { success: false, dropbox: 'skipped', message: 'Dropbox URL 없음' }

  const result = await renameDropboxFolder(project.dropbox_url, project.name)
  if ('error' in result) {
    return { success: false, dropbox: 'error', dropboxError: result.error, message: `드롭박스 오류: ${result.error}` }
  }
  if (result.newUrl === project.dropbox_url) {
    return { success: true, dropbox: 'same', message: '드롭박스 이미 동일' }
  }

  await admin.from('projects').update({ dropbox_url: result.newUrl }).eq('id', projectId)
  revalidatePath(`/projects/${projectId}`)
  return {
    success: true,
    dropbox: 'synced',
    message: result.recovered
      ? '폴더 위치가 바뀌었지만 자동으로 찾아서 이름 변경 완료'
      : '드롭박스 폴더명 변경됨',
  }
}
