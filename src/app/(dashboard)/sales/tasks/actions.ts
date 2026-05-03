'use server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { SERVICE_TASK_TEMPLATES } from '@/lib/task-templates'

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
  const supabase = createAdminClient()
  const project_id = (formData.get('project_id') as string) || (formData.get('sale_id') as string) || null
  await supabase.from('tasks').insert({
    project_id,
    title:       formData.get('title') as string,
    status:      (formData.get('status') as string) || '할 일',
    priority:    (formData.get('priority') as string) || '보통',
    assignee_id: (formData.get('assignee_id') as string) || null,
    due_date:    (formData.get('due_date') as string) || null,
    description: (formData.get('description') as string) || null,
  })
  await revalidateForSale(project_id)
}

export async function updateTaskStatus(
  id: string,
  status: string,
  saleId: string | null,
  options?: { completedNote?: string | null; completedBy?: string | null },
) {
  const supabase = createAdminClient()
  const update: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  }
  if (status === '완료') {
    update.completed_at   = new Date().toISOString()
    update.completed_note = options?.completedNote ?? null
    update.completed_by   = options?.completedBy ?? null
  } else {
    // 완료에서 다른 상태로 되돌리면 완료 정보 클리어 (UX: 재완료 시 코멘트 다시 받음)
    update.completed_at   = null
    update.completed_note = null
    update.completed_by   = null
  }
  await supabase.from('tasks').update(update).eq('id', id)
  await revalidateForSale(saleId)
}

export async function deleteTask(id: string, saleId: string | null) {
  const supabase = createAdminClient()
  await supabase.from('tasks').delete().eq('id', id)
  await revalidateForSale(saleId)
}

export async function applyTaskTemplate(saleId: string, serviceType: string, createdBy: string) {
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
  const supabase = createAdminClient()
  const id = formData.get('id') as string
  const saleId = (formData.get('sale_id') as string) || (formData.get('project_id') as string) || null
  const checklistRaw = formData.get('checklist') as string | null
  const checklist = checklistRaw ? JSON.parse(checklistRaw) : undefined
  const newStatus = (formData.get('status') as string) || '할 일'
  // 완료 코멘트는 별도 폼 필드로도 받을 수 있음 (옵셔널)
  const completedNoteRaw = formData.get('completed_note') as string | null
  const completedByRaw = formData.get('completed_by') as string | null

  const update: Record<string, unknown> = {
    title:       formData.get('title') as string,
    status:      newStatus,
    priority:    (formData.get('priority') as string) || '보통',
    assignee_id: (formData.get('assignee_id') as string) || null,
    due_date:    (formData.get('due_date') as string) || null,
    description: (formData.get('description') as string) || null,
    updated_at:  new Date().toISOString(),
  }
  if (checklist !== undefined) update.checklist = checklist

  if (newStatus === '완료') {
    update.completed_at   = new Date().toISOString()
    update.completed_note = completedNoteRaw?.trim() || null
    update.completed_by   = completedByRaw?.trim() || null
  } else {
    update.completed_at   = null
    update.completed_note = null
    update.completed_by   = null
  }

  await supabase.from('tasks').update(update).eq('id', id)
  await revalidateForSale(saleId)
}
