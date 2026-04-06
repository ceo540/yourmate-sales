'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

export async function createLog(saleId: string, content: string, logType: string, contactedAt?: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const admin = createAdminClient()
  const { error: rpcError } = await admin.rpc('insert_project_log', {
    p_sale_id: saleId,
    p_lead_id: null,
    p_content: content,
    p_log_type: logType,
    p_author_id: user.id,
    p_contacted_at: contactedAt || new Date().toISOString(),
  })

  if (rpcError) {
    console.error('[createLog] RPC error:', rpcError.message)
    const { error: fallbackError } = await admin.from('project_logs').insert({
      sale_id: saleId,
      content,
      log_type: logType,
      author_id: user.id,
    })
    if (fallbackError) {
      console.error('[createLog] fallback error:', fallbackError.message)
      throw new Error(fallbackError.message)
    }
    console.log('[createLog] fallback insert success')
  } else {
    console.log('[createLog] RPC success')
  }
  revalidatePath(`/sales/${saleId}`)
  revalidatePath('/departments', 'layout')
}

export async function deleteLog(logId: string, saleId: string) {
  const admin = createAdminClient()
  await admin.from('project_logs').delete().eq('id', logId)
  revalidatePath(`/sales/${saleId}`)
  revalidatePath('/departments', 'layout')
}

export async function getSaleLogs(saleId: string) {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('project_logs')
    .select('*, profiles:author_id(name)')
    .eq('sale_id', saleId)
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) console.error('[getSaleLogs] error:', error.message, '| code:', error.code)
  console.log('[getSaleLogs] rows:', data?.length ?? 'null')
  return (data ?? []).map((l: any) => ({ ...l, author: l.profiles ?? null }))
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
