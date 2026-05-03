'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { createProfileNameMap } from '@/lib/utils'
import { requireUser, requireLogOwnerOrAdmin } from '@/lib/auth-guard'
import { assertNotSensitive } from '@/lib/sensitive-data-policy'
import { recordAudit } from '@/lib/audit'

export async function createLog(saleId: string, content: string, logType: string, contactedAt?: string) {
  const u = await requireUser()
  await assertNotSensitive({ content }, u.role, u.id)

  const admin = createAdminClient()
  const { error: rpcError } = await admin.rpc('insert_project_log', {
    p_sale_id: saleId,
    p_lead_id: null,
    p_content: content,
    p_log_type: logType,
    p_author_id: u.id,
    p_contacted_at: contactedAt || new Date().toISOString(),
  })

  if (rpcError) {
    console.error('[createLog] RPC error:', rpcError.message)
    const { error: fallbackError } = await admin.from('project_logs').insert({
      sale_id: saleId,
      content,
      log_type: logType,
      author_id: u.id,
    })
    if (fallbackError) {
      console.error('[createLog] fallback error:', fallbackError.message)
      throw new Error(fallbackError.message)
    }
    console.log('[createLog] fallback insert success')
  } else {
    console.log('[createLog] RPC success')
  }

  // 자동 업무표 (§5.4.2)
  const { logActivity } = await import('@/lib/activity-log')
  void logActivity({
    actor_id: u.id,
    action: 'create_log',
    ref_type: 'sale',
    ref_id: saleId,
    summary: `계약 소통 (${logType}): ${content.slice(0, 80)}`,
  })

  void recordAudit({
    actor_id: u.id,
    actor_role: u.role,
    action: 'LOG_CREATED',
    entity_type: 'log',
    entity_id: null,
    after: { sale_id: saleId, log_type: logType, content_preview: content.slice(0, 80) },
    summary: `계약 소통 (${logType}) — ${content.slice(0, 80)}`,
  })

  revalidatePath(`/sales/${saleId}`)
  revalidatePath('/departments', 'layout')
}

export async function deleteLog(logId: string, saleId: string) {
  const u = await requireLogOwnerOrAdmin(logId)
  const admin = createAdminClient()
  await admin.from('project_logs').delete().eq('id', logId)
  void recordAudit({
    actor_id: u.id,
    actor_role: u.role,
    action: 'LOG_DELETED',
    entity_type: 'log',
    entity_id: logId,
    after: { sale_id: saleId },
    summary: `소통 기록 삭제 — sale ${saleId}`,
  })
  revalidatePath(`/sales/${saleId}`)
  revalidatePath('/departments', 'layout')
}

export async function getSaleLogs(saleId: string) {
  await requireUser()
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('project_logs')
    .select('id, content, log_type, created_at, author_id')
    .eq('sale_id', saleId)
    .order('created_at', { ascending: false })
    .limit(50)
  if (error || !data) return []

  const authorIds = [...new Set(data.map((l: any) => l.author_id).filter(Boolean))]
  let profileMap: Record<string, string> = {}
  if (authorIds.length > 0) {
    const { data: profiles } = await admin.from('profiles').select('id, name').in('id', authorIds)
    profileMap = createProfileNameMap(profiles)
  }

  return data.map((l: any) => ({
    ...l,
    contacted_at: l.created_at,
    author: l.author_id ? { name: profileMap[l.author_id] ?? null } : null,
  }))
}

export async function createLeadLog(leadId: string, content: string, logType: string, contactedAt?: string) {
  const u = await requireUser()
  await assertNotSensitive({ content }, u.role, u.id)

  const admin = createAdminClient()
  const { error } = await admin.from('project_logs').insert({
    lead_id: leadId,
    content,
    log_type: logType,
    author_id: u.id,
    contacted_at: contactedAt || new Date().toISOString(),
  })

  if (error) throw new Error(error.message)

  // 자동 업무표 (§5.4.2)
  const { logActivity } = await import('@/lib/activity-log')
  void logActivity({
    actor_id: u.id,
    action: 'create_log',
    ref_type: 'lead',
    ref_id: leadId,
    summary: `리드 소통 (${logType}): ${content.slice(0, 80)}`,
  })
  void recordAudit({
    actor_id: u.id,
    actor_role: u.role,
    action: 'LOG_CREATED',
    entity_type: 'log',
    entity_id: null,
    after: { lead_id: leadId, log_type: logType, content_preview: content.slice(0, 80) },
    summary: `리드 소통 (${logType}) — ${content.slice(0, 80)}`,
  })
}

export async function getLeadLogs(leadId: string) {
  await requireUser()
  const admin = createAdminClient()
  const { data } = await admin
    .from('project_logs')
    .select('id, content, log_type, contacted_at, created_at, author:author_id(name)')
    .eq('lead_id', leadId)
    .order('contacted_at', { ascending: false })
  return data ?? []
}

export async function deleteLeadLog(logId: string) {
  const u = await requireLogOwnerOrAdmin(logId)
  const admin = createAdminClient()
  await admin.from('project_logs').delete().eq('id', logId)
  void recordAudit({
    actor_id: u.id,
    actor_role: u.role,
    action: 'LOG_DELETED',
    entity_type: 'log',
    entity_id: logId,
    summary: `리드 소통 기록 삭제`,
  })
}
