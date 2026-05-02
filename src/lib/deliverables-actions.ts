'use server'

// 결과물 아카이브 (yourmate-spec.md §5.8.1) — project_deliverables server actions

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { logActivity } from '@/lib/activity-log'

async function requireUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '로그인 필요' as const }
  return { user }
}

export async function addDeliverableAction(input: {
  project_id: string
  type: string
  title?: string | null
  dropbox_path?: string | null
  format?: string | null
  size_bytes?: number | null
  delivered_at?: string | null
  metadata?: unknown
  ai_summary?: string | null
  ai_tags?: string[] | null
}) {
  const u = await requireUser()
  if ('error' in u) return { error: u.error }
  if (!input.project_id) return { error: 'project_id 필수' as const }
  if (!input.type) return { error: '결과물 유형 필수' as const }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('project_deliverables')
    .insert({
      project_id: input.project_id,
      type: input.type,
      title: input.title ?? null,
      dropbox_path: input.dropbox_path ?? null,
      format: input.format ?? null,
      size_bytes: input.size_bytes ?? null,
      delivered_at: input.delivered_at ?? null,
      metadata: input.metadata ?? null,
      ai_summary: input.ai_summary ?? null,
      ai_tags: input.ai_tags ?? null,
      created_by: u.user.id,
    })
    .select('id')
    .single()
  if (error) return { error: error.message }

  logActivity({
    actor_id: u.user.id,
    action: 'other',
    ref_type: 'project_deliverables',
    ref_id: data.id,
    summary: `결과물 등록: ${input.type}${input.title ? ` — ${input.title}` : ''}`,
  })

  revalidatePath(`/projects/${input.project_id}/v2`)
  return { id: data.id }
}

export async function markDeliverableConfirmedAction(input: { id: string }) {
  const u = await requireUser()
  if ('error' in u) return { error: u.error }
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('project_deliverables')
    .update({ client_confirmed_at: new Date().toISOString() })
    .eq('id', input.id)
    .select('project_id')
    .single()
  if (error) return { error: error.message }
  if (data?.project_id) revalidatePath(`/projects/${data.project_id}/v2`)
  return { ok: true }
}

export async function archiveDeliverableAction(input: { id: string }) {
  const u = await requireUser()
  if ('error' in u) return { error: u.error }
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('project_deliverables')
    .update({ archive_status: 'cancelled' })
    .eq('id', input.id)
    .select('project_id')
    .single()
  if (error) return { error: error.message }
  if (data?.project_id) revalidatePath(`/projects/${data.project_id}/v2`)
  return { ok: true }
}
