'use server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { SERVICE_TASK_TEMPLATES } from '@/lib/task-templates'
import { requireUser, requireAdminOrManager, requireTaskOwnership } from '@/lib/auth-guard'
import { assertNotSensitive } from '@/lib/sensitive-data-policy'
import { recordAudit } from '@/lib/audit'

// saleId → sale.project_id 자동 lookup 후 모든 관련 경로 revalidate.
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
  await assertNotSensitive({ title, description }, user.role, user.id)

  const supabase = createAdminClient()
  const { data: created } = await supabase.from('tasks').insert({
    project_id,
    title,
    status:      (formData.get('status') as string) || '할 일',
    priority:    (formData.get('priority') as string) || '보통',
    assignee_id: (formData.get('assignee_id') as string) || null,
    due_date:    (formData.get('due_date') as string) || null,
    description,
  }).select('id').single()

  void recordAudit({
    actor_id: user.id,
    actor_role: user.role,
    action: 'TASK_CREATED',
    entity_type: 'task',
    entity_id: created?.id ?? null,
    after: { title, project_id, priority: (formData.get('priority') as string) || '보통' },
    summary: `업무 생성 — ${title}`,
  })

  await revalidateForSale(project_id)
}

export async function updateTaskStatus(
  id: string,
  status: string,
  saleId: string | null,
  options?: { completedNote?: string | null; completedBy?: string | null },
) {
  const user = await requireTaskOwnership(id)

  const supabase = createAdminClient()
  // 이전 status snapshot (정확한 audit action 분기용)
  const { data: prev } = await supabase.from('tasks').select('status, title').eq('id', id).maybeSingle()
  const prevStatus = prev?.status ?? null
  const title = prev?.title ?? '(unknown)'

  const update: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  }
  if (status === '완료') {
    update.completed_at   = new Date().toISOString()
    const note = options?.completedNote ?? null
    await assertNotSensitive({ completed_note: note }, user.role, user.id)
    update.completed_note = note
    update.completed_by   = user.id
  } else {
    update.completed_at   = null
    update.completed_note = null
    update.completed_by   = null
  }
  await supabase.from('tasks').update(update).eq('id', id)

  // audit 분기 (P2-4)
  let auditAction: 'TASK_COMPLETED' | 'TASK_REOPENED' | 'TASK_STATUS_CHANGED' = 'TASK_STATUS_CHANGED'
  if (status === '완료' && prevStatus !== '완료') auditAction = 'TASK_COMPLETED'
  else if (prevStatus === '완료' && status !== '완료') auditAction = 'TASK_REOPENED'
  void recordAudit({
    actor_id: user.id,
    actor_role: user.role,
    action: auditAction,
    entity_type: 'task',
    entity_id: id,
    before: { status: prevStatus },
    after: { status },
    summary: `업무 '${title}' ${prevStatus ?? '?'} → ${status}`,
  })

  await revalidateForSale(saleId)
}

export async function deleteTask(id: string, saleId: string | null) {
  const user = await requireAdminOrManager()
  const supabase = createAdminClient()
  // before snapshot
  const { data: prev } = await supabase.from('tasks').select('title, status').eq('id', id).maybeSingle()
  await supabase.from('tasks').delete().eq('id', id)

  void recordAudit({
    actor_id: user.id,
    actor_role: user.role,
    action: 'TASK_DELETED',
    entity_type: 'task',
    entity_id: id,
    before: prev ? { title: prev.title, status: prev.status } : null,
    summary: `업무 삭제 — ${prev?.title ?? id}`,
  })

  await revalidateForSale(saleId)
}

export async function applyTaskTemplate(saleId: string, serviceType: string, _createdBy: string) {
  const user = await requireAdminOrManager()
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

  void recordAudit({
    actor_id: user.id,
    actor_role: user.role,
    action: 'TASK_CREATED',
    entity_type: 'task',
    entity_id: null,
    after: { count: rows.length, service_type: serviceType, sale_id: saleId },
    summary: `${serviceType} 표준 업무 ${rows.length}건 일괄 생성`,
  })

  await revalidateForSale(saleId)
}

export async function updateTask(formData: FormData) {
  const id = formData.get('id') as string
  const user = await requireTaskOwnership(id)

  const saleId = (formData.get('sale_id') as string) || (formData.get('project_id') as string) || null
  const checklistRaw = formData.get('checklist') as string | null
  const checklist = checklistRaw ? JSON.parse(checklistRaw) : undefined
  const newStatus = (formData.get('status') as string) || '할 일'
  const completedNoteRaw = formData.get('completed_note') as string | null
  const title = formData.get('title') as string
  const description = (formData.get('description') as string) || null
  const newAssigneeId = (formData.get('assignee_id') as string) || null
  const newPriority = (formData.get('priority') as string) || '보통'
  const newDueDate = (formData.get('due_date') as string) || null

  await assertNotSensitive({ title, description, completed_note: completedNoteRaw }, user.role, user.id)

  const supabase = createAdminClient()
  // before snapshot for audit
  const { data: prev } = await supabase.from('tasks')
    .select('title, status, assignee_id, priority, due_date')
    .eq('id', id).maybeSingle()

  const update: Record<string, unknown> = {
    title,
    status:      newStatus,
    priority:    newPriority,
    assignee_id: newAssigneeId,
    due_date:    newDueDate,
    description,
    updated_at:  new Date().toISOString(),
  }
  if (checklist !== undefined) update.checklist = checklist

  if (newStatus === '완료') {
    update.completed_at   = new Date().toISOString()
    update.completed_note = completedNoteRaw?.trim() || null
    update.completed_by   = user.id
  } else {
    update.completed_at   = null
    update.completed_note = null
    update.completed_by   = null
  }

  await supabase.from('tasks').update(update).eq('id', id)

  // audit 분기 — 가장 의미 있는 액션 1개만 기록 (DRY)
  const prevStatus = prev?.status ?? null
  const prevAssignee = prev?.assignee_id ?? null
  let auditAction:
    | 'TASK_COMPLETED' | 'TASK_REOPENED' | 'TASK_STATUS_CHANGED'
    | 'TASK_REASSIGNED' | 'TASK_UPDATED' = 'TASK_UPDATED'
  if (newStatus === '완료' && prevStatus !== '완료') auditAction = 'TASK_COMPLETED'
  else if (prevStatus === '완료' && newStatus !== '완료') auditAction = 'TASK_REOPENED'
  else if (prevStatus !== newStatus) auditAction = 'TASK_STATUS_CHANGED'
  else if (prevAssignee !== newAssigneeId) auditAction = 'TASK_REASSIGNED'

  void recordAudit({
    actor_id: user.id,
    actor_role: user.role,
    action: auditAction,
    entity_type: 'task',
    entity_id: id,
    before: { status: prevStatus, assignee_id: prevAssignee, priority: prev?.priority ?? null, due_date: prev?.due_date ?? null },
    after: { status: newStatus, assignee_id: newAssigneeId, priority: newPriority, due_date: newDueDate },
    summary: `업무 '${title}' ${auditAction === 'TASK_REASSIGNED' ? '담당자 변경' : auditAction === 'TASK_STATUS_CHANGED' ? `${prevStatus}→${newStatus}` : auditAction === 'TASK_COMPLETED' ? '완료 처리' : auditAction === 'TASK_REOPENED' ? '재오픈' : '수정'}`,
  })

  await revalidateForSale(saleId)
}
