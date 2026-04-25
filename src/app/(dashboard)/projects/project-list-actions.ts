'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { SERVICE_TO_DEPT } from '@/types'
import { generateProjectNumber } from '@/lib/projects'
import { createSaleFolder } from '@/lib/dropbox'

export async function assignProjectNumbers(): Promise<{ assigned: number }> {
  const admin = createAdminClient()

  const [{ data: noNum }, { data: existing }] = await Promise.all([
    admin.from('projects').select('id, created_at').is('project_number', null).order('created_at', { ascending: true }),
    admin.from('projects').select('project_number').not('project_number', 'is', null),
  ])

  if (!noNum?.length) return { assigned: 0 }

  // Count existing numbers per YY
  const countByYear = new Map<string, number>()
  for (const p of (existing ?? [])) {
    const yy = String(p.project_number).split('-')[0]
    countByYear.set(yy, (countByYear.get(yy) ?? 0) + 1)
  }

  let assigned = 0
  for (const p of noNum) {
    const yy = String(new Date(p.created_at).getFullYear()).slice(-2)
    const seq = (countByYear.get(yy) ?? 0) + 1
    countByYear.set(yy, seq)
    const projectNumber = `${yy}-${String(seq).padStart(3, '0')}`
    await admin.from('projects').update({ project_number: projectNumber }).eq('id', p.id)
    assigned++
  }

  revalidatePath('/projects')
  return { assigned }
}

// 새 프로젝트 직접 생성 (리드 없이) — projects 메뉴에서 사용
// service_type 있으면 SERVICE_TO_DEPT로 department 자동 채움.
// 매출(sales)은 같이 만들지 않음. 프로젝트 들어가서 [+ 새 매출]로 추가.
// 드롭박스 폴더도 자동 생성 (서비스 분류된 위치에). 실패해도 프로젝트 생성은 성공.
export async function createProjectStandalone(data: {
  name: string
  service_type?: string | null
  customer_id?: string | null
  pm_id?: string | null
}): Promise<{
  id?: string
  project_number?: string
  dropbox_url?: string | null
  dropbox_error?: string
  error?: string
}> {
  if (!data.service_type) {
    return { error: '서비스는 필수입니다.' }
  }
  const admin = createAdminClient()
  const department = SERVICE_TO_DEPT[data.service_type] || null
  const projectNumber = await generateProjectNumber()
  const folderDisplayName = `${projectNumber} ${data.name}`
  const today = new Date().toISOString().slice(0, 10)

  const { data: project, error } = await admin.from('projects').insert({
    name: data.name,
    service_type: data.service_type ?? null,
    department,
    customer_id: data.customer_id ?? null,
    pm_id: data.pm_id ?? null,
    status: '진행중',
    project_number: projectNumber,
  }).select('id').single()

  if (error || !project) return { error: error?.message ?? '생성 실패' }

  if (data.pm_id) {
    await admin
      .from('project_members')
      .insert({ project_id: project.id, profile_id: data.pm_id, role: 'PM' })
      .single()
  }

  // 드롭박스 폴더 자동 생성 (실패해도 프로젝트는 살아 있음)
  let dropboxUrl: string | null = null
  let dropboxError: string | undefined
  if (data.service_type) {
    try {
      dropboxUrl = await createSaleFolder({
        service_type: data.service_type,
        name: folderDisplayName,
        inflow_date: today,
      })
      if (dropboxUrl) {
        await admin.from('projects').update({ dropbox_url: dropboxUrl }).eq('id', project.id)
      }
    } catch (e) {
      dropboxError = e instanceof Error ? e.message : '드롭박스 폴더 생성 실패'
    }
  }

  revalidatePath('/projects')
  return {
    id: project.id,
    project_number: projectNumber,
    dropbox_url: dropboxUrl,
    dropbox_error: dropboxError,
  }
}
