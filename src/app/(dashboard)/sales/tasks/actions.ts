'use server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { SERVICE_TASK_TEMPLATES } from '@/lib/task-templates'

export async function createTask(formData: FormData) {
  const supabase = createAdminClient()
  await supabase.from('tasks').insert({
    sale_id:     formData.get('sale_id') as string,
    title:       formData.get('title') as string,
    status:      '할 일',
    priority:    (formData.get('priority') as string) || '보통',
    assignee_id: (formData.get('assignee_id') as string) || null,
    due_date:    (formData.get('due_date') as string) || null,
    memo:        (formData.get('memo') as string) || null,
    created_by:  (formData.get('created_by') as string) || null,
  })
  revalidatePath(`/sales/${formData.get('sale_id')}`)
  revalidatePath('/tasks')
}

export async function updateTaskStatus(id: string, status: string, saleId: string) {
  const supabase = createAdminClient()
  await supabase.from('tasks').update({ status, updated_at: new Date().toISOString() }).eq('id', id)
  revalidatePath(`/sales/${saleId}`)
  revalidatePath('/tasks')
}

export async function deleteTask(id: string, saleId: string) {
  const supabase = createAdminClient()
  await supabase.from('tasks').delete().eq('id', id)
  revalidatePath(`/sales/${saleId}`)
  revalidatePath('/tasks')
}

export async function applyTaskTemplate(saleId: string, serviceType: string, createdBy: string) {
  const templates = SERVICE_TASK_TEMPLATES[serviceType]
  if (!templates || templates.length === 0) return

  const supabase = createAdminClient()
  const rows = templates.map(t => ({
    sale_id:    saleId,
    title:      t.title,
    status:     '할 일',
    priority:   t.priority,
    memo:       t.memo ?? null,
    created_by: createdBy,
  }))
  await supabase.from('tasks').insert(rows)
  revalidatePath(`/sales/${saleId}`)
  revalidatePath('/tasks')
}

export async function updateTask(formData: FormData) {
  const supabase = createAdminClient()
  const id = formData.get('id') as string
  const saleId = formData.get('sale_id') as string
  await supabase.from('tasks').update({
    title:       formData.get('title') as string,
    priority:    (formData.get('priority') as string) || '보통',
    assignee_id: (formData.get('assignee_id') as string) || null,
    due_date:    (formData.get('due_date') as string) || null,
    memo:        (formData.get('memo') as string) || null,
    updated_at:  new Date().toISOString(),
  }).eq('id', id)
  revalidatePath(`/sales/${saleId}`)
}
