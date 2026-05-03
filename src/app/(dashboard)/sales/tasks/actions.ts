'use server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { SERVICE_TASK_TEMPLATES } from '@/lib/task-templates'
import { requireUser, requireAdminOrManager, requireTaskOwnership } from '@/lib/auth-guard'
import { assertNotSensitive } from '@/lib/sensitive-data-policy'

// saleId → sale.project_id 자동 lookup 후 모든 관련 경로 revalidate.
// 이렇게 안 하면 V2 프로젝트 허브가 stale (Phase 9.2 최신화 fix).
async function revalidateForSale(saleId: string | null) {
  revalidatePath('/tasks')
  if (!saleId) return
  revalidatePath(`/sales/${saleId}`)
  revalidatePath('/departments')
  const supabase = createAdminClient()
  const { data: sale } = await supabase
    .from('sales')
    .select('project_id')
    .eq('id', saleId)
    .maybeSingle()
  if (sale?.project_id) revalidatePath(`/projects/${sale.project_id}`)
}

export async function createTask(formData: FormData) {
  const user = await requireUser()
  const project_id = (formData.get('project_id') as string) || (formData.get('sale_id') as string) || null
  const title = formData.get('title') as string
  const description = (formData.get('description') as string) || null
  // 민감 정보 차단 (P1-2)
  assertNotSensitive({ title, description }, user.role)

  const supabase = createAdminClient()
  await supabase.from('tasks').insert({
    project_id,
    title,
    status:      (formData.get('status') as string) || '할 일',
    priority:    (formData.get('priority') as string) || '보통',
    assignee_id: (formData.get('assignee_id') as string) || null,
    due_date:    (formData.get('due_date') as string) || null,
    description,
  })
  await revalidateForSale(project_id)
}

export async function updateTaskStatus(
  id: string,
  status: string,
  saleId: string | null,
  options?: { completedNote?: string | null; completedBy?: string | null },
) {
  // ownership 검증 (admin 또는 본인 담당). completedBy 인자는 *무시* — 서버 user.id 강제 (P1-1)
  const user = await requireTaskOwnership(id)

  const supabase = createAdminClient()
  const update: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  }
  if (status === '완료') {
    update.completed_at   = new Date().toISOString()
    // completion_note 만 클라 입력 허용. 단 민감 키워드 차단
    const note = options?.completedNote ?? null
    assertNotSensitive({ completed_note: note }, user.role)
    update.completed_note = note
    update.completed_by   = user.id  // 서버 강제 (클라 옵션 무시)
  } else {
    // 완료에서 다른 상태로 되돌리면 완료 정보 클리어
    update.completed_at   = null
    update.completed_note = null
    update.completed_by   = null
  }
  await supabase.from('tasks').update(update).eq('id', id)
  await revalidateForSale(saleId)
}

export async function deleteTask(id: string, saleId: string | null) {
  // 위험 액션 — admin/manager 만
  await requireAdminOrManager()
  const supabase = createAdminClient()
  await supabase.from('tasks').delete().eq('id', id)
  await revalidateForSale(saleId)
}

export async function applyTaskTemplate(saleId: string, serviceType: string, _createdBy: string) {
  // 일괄 템플릿 적용 — admin/manager 만
  await requireAdminOrManager()
  const templates = SERVICE_TASK_TEMPLATES[serviceType]
  if (!templates || templates.length === 0) return

  const supabase = createAdminClient()
  const rows = templates.map(t => ({
    project_id:  saleId,
    title:       t.title,
    status:      '할 일',
    priority:    t.priority,
    description: t.description ?? null,
  }))
  await supabase.from('tasks').insert(rows)
  await revalidateForSale(saleId)
}

export async function updateTask(formData: FormData) {
  const id = formData.get('id') as string
  // ownership 검증 (admin 또는 본인 담당)
  const user = await requireTaskOwnership(id)

  const saleId = (formData.get('sale_id') as string) || (formData.get('project_id') as string) || null
  const checklistRaw = formData.get('checklist') as string | null
  const checklist = checklistRaw ? JSON.parse(checklistRaw) : undefined
  const newStatus = (formData.get('status') as string) || '할 일'
  // completed_by 클라 입력은 무시 (P1-1). completed_note 만 받음
  const completedNoteRaw = formData.get('completed_note') as string | null
  const title = formData.get('title') as string
  const description = (formData.get('description') as string) || null

  // 민감 정보 차단 (P1-2)
  assertNotSensitive({ title, description, completed_note: completedNoteRaw }, user.role)

  const supabase = createAdminClient()
  const update: Record<string, unknown> = {
    title,
    status:      newStatus,
    priority:    (formData.get('priority') as string) || '보통',
    assignee_id: (formData.get('assignee_id') as string) || null,
    due_date:    (formData.get('due_date') as string) || null,
    description,
    updated_at:  new Date().toISOString(),
  }
  if (checklist !== undefined) update.checklist = checklist

  if (newStatus === '완료') {
    update.completed_at   = new Date().toISOString()
    update.completed_note = completedNoteRaw?.trim() || null
    update.completed_by   = user.id  // 서버 강제 (클라 입력 무시)
  } else {
    update.completed_at   = null
    update.completed_note = null
    update.completed_by   = null
  }

  await supabase.from('tasks').update(update).eq('id', id)
  await revalidateForSale(saleId)
}
