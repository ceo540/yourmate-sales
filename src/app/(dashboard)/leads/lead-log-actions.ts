'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function createLeadLog(leadId: string, content: string, logType: string, contactedAt?: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const admin = createAdminClient()
  const { error: rpcError } = await admin.rpc('insert_project_log', {
    p_sale_id: null,
    p_lead_id: leadId,
    p_content: content,
    p_log_type: logType,
    p_author_id: user.id,
    p_contacted_at: contactedAt || new Date().toISOString(),
  })

  if (rpcError) {
    const { error: fallbackError } = await admin.from('project_logs').insert({
      lead_id: leadId,
      content,
      log_type: logType,
      author_id: user.id,
    })
    if (fallbackError) throw new Error(fallbackError.message)
  }
}

export async function getLeadLogs(leadId: string) {
  const admin = createAdminClient()
  const { data } = await admin
    .from('project_logs')
    .select('id, content, log_type, contacted_at, created_at, author:author_id(name)')
    .eq('lead_id', leadId)
    .order('contacted_at', { ascending: false })
  return data ?? []
}

export async function deleteLeadLog(logId: string) {
  const admin = createAdminClient()
  await admin.from('project_logs').delete().eq('id', logId)
}
