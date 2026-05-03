'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createProfileNameMap } from '@/lib/utils'
import { requireUser, requireLogOwnerOrAdmin } from '@/lib/auth-guard'
import { assertNotSensitive } from '@/lib/sensitive-data-policy'

export async function createLeadLog(
  leadId: string,
  content: string,
  logType: string,
  contactedAt?: string,
  location?: string,
  participants?: string[],
  outcome?: string,
) {
  const u = await requireUser()
  assertNotSensitive({ content, location: location ?? null, outcome: outcome ?? null }, u.role)

  const admin = createAdminClient()
  const { error } = await admin.from('project_logs').insert({
    sale_id: null,
    lead_id: leadId,
    content,
    log_type: logType,
    author_id: u.id,
    contacted_at: contactedAt || new Date().toISOString(),
    location: location || null,
    participants: participants?.length ? participants : null,
    outcome: outcome || null,
  })

  if (error) {
    console.error('[createLeadLog] insert error:', error.message, error.code, error.details)
    throw new Error(error.message)
  }

  // 자동 업무표 (§5.4.2)
  const { logActivity } = await import('@/lib/activity-log')
  void logActivity({
    actor_id: u.id,
    action: 'create_log',
    ref_type: 'lead',
    ref_id: leadId,
    summary: `리드 소통 (${logType}): ${content.slice(0, 80)}`,
  })
}

export async function getLeadLogs(leadId: string) {
  await requireUser()
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('project_logs')
    .select('id, content, log_type, contacted_at, created_at, author_id')
    .eq('lead_id', leadId)
    .order('contacted_at', { ascending: false })
  if (error || !data) return []

  const authorIds = [...new Set(data.map((l: any) => l.author_id).filter(Boolean))]
  let profileMap: Record<string, string> = {}
  if (authorIds.length > 0) {
    const { data: profiles } = await admin.from('profiles').select('id, name').in('id', authorIds)
    profileMap = createProfileNameMap(profiles)
  }

  return data.map((l: any) => ({
    ...l,
    author: l.author_id ? { name: profileMap[l.author_id] ?? null } : null,
  }))
}

export async function deleteLeadLog(logId: string) {
  // 작성자 또는 admin/manager만 (P1-3)
  await requireLogOwnerOrAdmin(logId)
  const admin = createAdminClient()
  await admin.from('project_logs').delete().eq('id', logId)
}
