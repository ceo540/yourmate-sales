'use server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { SERVICE_TASK_TEMPLATES } from '@/lib/task-templates'

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
  if (project_id) {
    revalidatePath(`/sales/${project_id}`)
    revalidatePath(`/departments`)
  }
  revalidatePath('/tasks')
}

export async function updateTaskStatus(id: string, status: string, saleId: string | null) {
  const supabase = createAdminClient()
  await supabase.from('tasks').update({ status, updated_at: new Date().toISOString() }).eq('id', id)
  if (saleId) revalidatePath(`/sales/${saleId}`)
  revalidatePath('/tasks')
}

export async function deleteTask(id: string, saleId: string | null) {
  const supabase = createAdminClient()
  await supabase.from('tasks').delete().eq('id', id)
  if (saleId) revalidatePath(`/sales/${saleId}`)
  revalidatePath('/tasks')
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
  revalidatePath(`/sales/${saleId}`)
  revalidatePath('/tasks')
}

export async function updateTask(formData: FormData) {
  const supabase = createAdminClient()
  const id = formData.get('id') as string
  const saleId = (formData.get('sale_id') as string) || (formData.get('project_id') as string) || null
  const checklistRaw = formData.get('checklist') as string | null
  const checklist = checklistRaw ? JSON.parse(checklistRaw) : undefined

  const update: Record<string, unknown> = {
    title:       formData.get('title') as string,
    status:      (formData.get('status') as string) || '할 일',
    priority:    (formData.get('priority') as string) || '보통',
    assignee_id: (formData.get('assignee_id') as string) || null,
    due_date:    (formData.get('due_date') as string) || null,
    description: (formData.get('description') as string) || null,
    updated_at:  new Date().toISOString(),
  }
  if (checklist !== undefined) update.checklist = checklist

  await supabase.from('tasks').update(update).eq('id', id)
  if (saleId) {
    revalidatePath(`/sales/${saleId}`)
    revalidatePath(`/departments`)
  }
  revalidatePath('/tasks')
}
