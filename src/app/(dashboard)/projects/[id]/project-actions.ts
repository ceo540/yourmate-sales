'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { renameDropboxFolder } from '@/lib/dropbox'

export async function createProjectLog(
  projectId: string,
  content: string,
  logType: string,
  logCategory: string,
  contactedAt?: string,
  location?: string,
  participants?: string[],
  outcome?: string,
  saleId?: string | null,
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const admin = createAdminClient()
  const { error } = await admin.from('project_logs').insert({
    project_id: projectId,
    content,
    log_type: logType,
    log_category: logCategory,
    author_id: user.id,
    contacted_at: contactedAt || new Date().toISOString(),
    location: location || null,
    participants: participants?.length ? participants : null,
    outcome: outcome || null,
    sale_id: saleId || null,
  })
  if (error) throw new Error(error.message)
  revalidatePath(`/projects/${projectId}`)
}

export async function deleteProjectLog(logId: string, projectId: string) {
  const admin = createAdminClient()
  await admin.from('project_logs').delete().eq('id', logId)
  revalidatePath(`/projects/${projectId}`)
}

export async function getProjectLogs(projectId: string) {
  const admin = createAdminClient()
  const { data } = await admin
    .from('project_logs')
    .select('id, content, log_type, log_category, contacted_at, created_at, author_id, location, participants, outcome, sale_id')
    .eq('project_id', projectId)
    .order('contacted_at', { ascending: false })
    .limit(100)
  if (!data) return []

  const authorIds = [...new Set(data.map((l: any) => l.author_id).filter(Boolean))]
  let profileMap: Record<string, string> = {}
  if (authorIds.length > 0) {
    const { data: profiles } = await admin.from('profiles').select('id, name').in('id', authorIds)
    profileMap = Object.fromEntries((profiles ?? []).map((p: any) => [p.id, p.name]))
  }
  return data.map((l: any) => ({
    ...l,
    author: l.author_id ? { name: profileMap[l.author_id] ?? '알 수 없음' } : null,
  }))
}

export async function updateProjectMemo(projectId: string, memo: string) {
  const admin = createAdminClient()
  const { error } = await admin
    .from('projects')
    .update({ memo, updated_at: new Date().toISOString() })
    .eq('id', projectId)
  if (error) throw new Error(error.message)
  revalidatePath(`/projects/${projectId}`)
}

export async function addProjectMember(projectId: string, profileId: string, role: string) {
  const admin = createAdminClient()
  const { error } = await admin
    .from('project_members')
    .insert({ project_id: projectId, profile_id: profileId, role })
  if (error) throw new Error(error.message)
  revalidatePath(`/projects/${projectId}`)
}

export async function removeProjectMember(projectId: string, profileId: string) {
  const admin = createAdminClient()
  await admin
    .from('project_members')
    .delete()
    .eq('project_id', projectId)
    .eq('profile_id', profileId)
  revalidatePath(`/projects/${projectId}`)
}

export async function updateProjectStatus(projectId: string, status: string) {
  const admin = createAdminClient()
  const { error } = await admin
    .from('projects')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', projectId)
  if (error) throw new Error(error.message)
  revalidatePath(`/projects/${projectId}`)
}

export async function linkProjectCustomer(projectId: string, customerId: string) {
  const admin = createAdminClient()
  await admin.from('projects').update({ customer_id: customerId || null }).eq('id', projectId)
  revalidatePath(`/projects/${projectId}`)
}

export async function createAndLinkCustomer(
  projectId: string,
  data: { name: string; type: string; contact_name: string; phone: string; contact_email: string },
): Promise<{ error?: string; id?: string }> {
  const admin = createAdminClient()
  const { data: created, error: ce } = await admin
    .from('customers')
    .insert({ name: data.name, type: data.type || '기타', status: '활성', contact_name: data.contact_name || null, phone: data.phone || null, contact_email: data.contact_email || null })
    .select('id')
    .single()
  if (ce) return { error: ce.message }
  await admin.from('projects').update({ customer_id: created.id }).eq('id', projectId)
  revalidatePath(`/projects/${projectId}`)
  return { id: created.id }
}

export async function updateProjectName(
  projectId: string,
  name: string,
): Promise<{ newDropboxUrl?: string | null }> {
  const admin = createAdminClient()
  const { data: project } = await admin.from('projects').select('dropbox_url').eq('id', projectId).single()

  let newDropboxUrl: string | null = null
  if (project?.dropbox_url) {
    const result = await renameDropboxFolder(project.dropbox_url, name)
    if ('newUrl' in result) newDropboxUrl = result.newUrl
  }

  await admin.from('projects').update({
    name,
    ...(newDropboxUrl ? { dropbox_url: newDropboxUrl } : {}),
    updated_at: new Date().toISOString(),
  }).eq('id', projectId)

  revalidatePath(`/projects/${projectId}`)
  revalidatePath('/projects')
  return { newDropboxUrl }
}

export async function updateProjectDropbox(projectId: string, dropboxUrl: string) {
  const admin = createAdminClient()
  await admin.from('projects').update({ dropbox_url: dropboxUrl || null }).eq('id', projectId)
  revalidatePath(`/projects/${projectId}`)
}

export async function linkSaleToProject(projectId: string, saleId: string) {
  const admin = createAdminClient()
  await admin.from('sales').update({ project_id: projectId }).eq('id', saleId)
  revalidatePath(`/projects/${projectId}`)
}

export async function updateProjectNotes(projectId: string, notes: string) {
  const admin = createAdminClient()
  await admin.from('projects').update({ notes: notes || null, updated_at: new Date().toISOString() }).eq('id', projectId)
  revalidatePath(`/projects/${projectId}`)
}

export async function togglePaymentReceived(scheduleId: string, isReceived: boolean, projectId: string) {
  const admin = createAdminClient()
  await admin.from('payment_schedules').update({
    is_received: isReceived,
    received_date: isReceived ? new Date().toISOString().slice(0, 10) : null,
  }).eq('id', scheduleId)
  revalidatePath(`/projects/${projectId}`)
}

export async function addPaymentSchedule(
  saleId: string, label: string, amount: number, dueDate: string | null, projectId: string,
): Promise<{ id: string; label: string; amount: number; is_received: boolean; due_date: string | null } | null> {
  const admin = createAdminClient()
  const { data: existing } = await admin.from('payment_schedules').select('sort_order').eq('sale_id', saleId).order('sort_order', { ascending: false }).limit(1)
  const sortOrder = (existing?.[0]?.sort_order ?? -1) + 1
  const { data } = await admin.from('payment_schedules').insert({ sale_id: saleId, label, amount, due_date: dueDate || null, is_received: false, sort_order: sortOrder }).select('id, label, amount, is_received, due_date').single()
  revalidatePath(`/projects/${projectId}`)
  return data
}

export async function deletePaymentSchedule(scheduleId: string, projectId: string) {
  const admin = createAdminClient()
  await admin.from('payment_schedules').delete().eq('id', scheduleId)
  revalidatePath(`/projects/${projectId}`)
}

export async function addSaleCost(
  saleId: string, item: string, amount: number, category: string, projectId: string,
): Promise<{ id: string; item: string; amount: number; category: string; sale_id: string } | null> {
  const admin = createAdminClient()
  const { data } = await admin.from('sale_costs').insert({ sale_id: saleId, item, amount, category }).select('id, item, amount, category, sale_id').single()
  revalidatePath(`/projects/${projectId}`)
  return data
}

export async function deleteSaleCost(costId: string, projectId: string) {
  const admin = createAdminClient()
  await admin.from('sale_costs').delete().eq('id', costId)
  revalidatePath(`/projects/${projectId}`)
}

export async function updateContractStage(saleId: string, stage: string, projectId: string) {
  const admin = createAdminClient()
  await admin.from('sales').update({ contract_stage: stage, updated_at: new Date().toISOString() }).eq('id', saleId)
  revalidatePath(`/projects/${projectId}`)
}

export async function updateContractProgressStatus(saleId: string, status: string, projectId: string) {
  const admin = createAdminClient()
  await admin.from('sales').update({ progress_status: status, updated_at: new Date().toISOString() }).eq('id', saleId)
  revalidatePath(`/projects/${projectId}`)
}

export async function updateContractInfo(
  saleId: string,
  data: { name?: string; revenue?: number; contract_split_reason?: string | null; entity_id?: string | null; inflow_date?: string | null; payment_date?: string | null; client_org?: string | null; dropbox_url?: string | null },
  projectId: string,
) {
  const admin = createAdminClient()
  await admin.from('sales').update({ ...data, updated_at: new Date().toISOString() }).eq('id', saleId)
  revalidatePath(`/projects/${projectId}`)
}

export async function createTaskForProject(
  contractId: string | null, title: string, assigneeId: string | null, dueDate: string | null, priority: string, description: string | null,
): Promise<{ id: string; title: string; status: string; priority: string | null; due_date: string | null; assignee: { id: string; name: string } | null; project_id: string | null; description: string | null } | null> {
  const admin = createAdminClient()
  const { data } = await admin.from('tasks').insert({
    project_id: contractId || null, title, status: '할 일', priority, assignee_id: assigneeId || null, due_date: dueDate || null, description: description || null,
  }).select('id, title, status, priority, due_date, project_id, description, assignee_id').single()
  if (!data) return null
  let assignee: { id: string; name: string } | null = null
  if (data.assignee_id) {
    const { data: p } = await admin.from('profiles').select('id, name').eq('id', data.assignee_id).single()
    if (p) assignee = { id: p.id, name: p.name }
  }
  revalidatePath(`/projects/${contractId}`)
  return { ...data, assignee }
}

export async function updateCustomerContact(
  customerId: string,
  projectId: string,
  contactName: string,
  phone: string,
  contactEmail: string,
) {
  const admin = createAdminClient()
  await admin.from('customers').update({
    contact_name: contactName || null,
    phone: phone || null,
    contact_email: contactEmail || null,
  }).eq('id', customerId)
  revalidatePath(`/projects/${projectId}`)
}
