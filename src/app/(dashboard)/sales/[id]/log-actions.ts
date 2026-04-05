'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

export async function createLog(saleId: string, content: string, logType: string, contactedAt?: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const admin = createAdminClient()
  const { error } = await admin.from('project_logs').insert({
    sale_id: saleId,
    content,
    log_type: logType,
    author_id: user.id,
    contacted_at: contactedAt || new Date().toISOString(),
  })

  if (error) throw new Error(error.message)
  revalidatePath(`/sales/${saleId}`)
}

export async function deleteLog(logId: string, saleId: string) {
  const admin = createAdminClient()
  await admin.from('project_logs').delete().eq('id', logId)
  revalidatePath(`/sales/${saleId}`)
}

export async function createLeadLog(leadId: string, content: string, logType: string, contactedAt?: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const admin = createAdminClient()
  const { error } = await admin.from('project_logs').insert({
    lead_id: leadId,
    content,
    log_type: logType,
    author_id: user.id,
    contacted_at: contactedAt || new Date().toISOString(),
  })

  if (error) throw new Error(error.message)
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
