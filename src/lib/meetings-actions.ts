'use server'

// 회의 (yourmate-spec.md §5.9) — meetings server actions
// decisions 는 별도(prospects-actions 또는 직접 도구).

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { logActivity } from '@/lib/activity-log'

const PATH = '/meetings'

async function requireUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '로그인 필요' as const }
  return { user }
}

export async function createMeetingAction(input: {
  title: string
  type?: string
  project_id?: string | null
  date: string                // ISO timestamp
  duration_minutes?: number | null
  location?: string | null
  participants?: string[] | null
  external_participants?: string[] | null
  agenda?: string | null
  notes?: string | null
  source?: 'manual' | 'plaud' | 'whisper' | 'channeltalk'
  source_ref?: string | null
}) {
  const u = await requireUser()
  if ('error' in u) return { error: u.error }
  if (!input.title?.trim()) return { error: '제목 필수' as const }
  if (!input.date) return { error: '일시 필수' as const }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('meetings')
    .insert({
      title: input.title.trim(),
      type: input.type ?? 'irregular',
      project_id: input.project_id ?? null,
      date: input.date,
      duration_minutes: input.duration_minutes ?? null,
      location: input.location ?? null,
      participants: input.participants ?? null,
      external_participants: input.external_participants ?? null,
      agenda: input.agenda ?? null,
      notes: input.notes ?? null,
      source: input.source ?? 'manual',
      source_ref: input.source_ref ?? null,
      created_by: u.user.id,
    })
    .select('id')
    .single()
  if (error) return { error: error.message }

  logActivity({
    actor_id: u.user.id,
    action: 'meeting',
    ref_type: 'meetings',
    ref_id: data.id,
    summary: `회의 등록: ${input.title}`,
  })

  revalidatePath(PATH)
  if (input.project_id) revalidatePath(`/projects/${input.project_id}/v2`)
  return { id: data.id }
}

export async function updateMeetingAction(input: {
  id: string
  patch: Partial<{
    title: string
    type: string
    date: string
    location: string | null
    duration_minutes: number | null
    agenda: string | null
    minutes: string | null
    notes: string | null
    ai_summary: string | null
    participants: string[] | null
    external_participants: string[] | null
  }>
}) {
  const u = await requireUser()
  if ('error' in u) return { error: u.error }
  const admin = createAdminClient()
  const { error } = await admin.from('meetings').update(input.patch).eq('id', input.id)
  if (error) return { error: error.message }
  revalidatePath(PATH)
  return { ok: true }
}

export async function archiveMeetingAction(input: { id: string }) {
  const u = await requireUser()
  if ('error' in u) return { error: u.error }
  const admin = createAdminClient()
  const { error } = await admin
    .from('meetings')
    .update({ archive_status: 'cancelled' })
    .eq('id', input.id)
  if (error) return { error: error.message }
  revalidatePath(PATH)
  return { ok: true }
}

export async function recordDecisionFromMeetingAction(input: {
  meeting_id: string
  decision: string
  context?: string | null
  rationale?: string | null
  options_considered?: unknown
}) {
  const u = await requireUser()
  if ('error' in u) return { error: u.error }
  if (!input.decision?.trim()) return { error: '결정 내용 필수' as const }

  const admin = createAdminClient()
  const { data: meeting } = await admin.from('meetings').select('project_id, decision_ids, participants').eq('id', input.meeting_id).single()

  const { data: decision, error } = await admin
    .from('decisions')
    .insert({
      project_id: meeting?.project_id ?? null,
      context: input.context ?? null,
      options_considered: input.options_considered ?? null,
      decision: input.decision.trim(),
      decided_by: u.user.id,
      participants: meeting?.participants ?? null,
      rationale: input.rationale ?? null,
      decided_at: new Date().toISOString(),
    })
    .select('id')
    .single()
  if (error) return { error: error.message }

  // meetings.decision_ids 업데이트
  const newIds = [...(meeting?.decision_ids ?? []), decision.id]
  await admin.from('meetings').update({ decision_ids: newIds }).eq('id', input.meeting_id)

  revalidatePath(PATH)
  if (meeting?.project_id) revalidatePath(`/projects/${meeting.project_id}/v2`)
  return { decision_id: decision.id }
}
