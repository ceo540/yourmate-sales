'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function createLeadLog(leadId: string, content: string, logType: string, contactedAt?: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const admin = createAdminClient()
  const { error } = await admin.from('project_logs').insert({
    sale_id: null,
    lead_id: leadId,
    content,
    log_type: logType,
    author_id: user.id,
    contacted_at: contactedAt || new Date().toISOString(),
  })

  if (error) {
    console.error('[createLeadLog] insert error:', error.message, error.code, error.details)
    throw new Error(error.message)
  }
}

export async function getLeadLogs(leadId: string) {
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
    profileMap = Object.fromEntries((profiles ?? []).map((p: any) => [p.id, p.name]))
  }

  return data.map((l: any) => ({
    ...l,
    author: l.author_id ? { name: profileMap[l.author_id] ?? null } : null,
  }))
}

export async function deleteLeadLog(logId: string) {
  const admin = createAdminClient()
  await admin.from('project_logs').delete().eq('id', logId)
}
