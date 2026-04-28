'use server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { SERVICE_TO_DEPT } from '@/types'
import { createSaleFolder, renameDropboxFolder, renameDropboxFolderFull, moveDropboxToCancel, validateDropboxUrl, resolveDropboxSharedLink } from '@/lib/dropbox'
import { syncLeadToCustomerDB } from '@/lib/customer-sync'
import { notifyLeadConverted } from '@/lib/channeltalk'
import { createOrUpdateLeadBrief } from '@/lib/brief-generator'
import { createEvent, CALENDAR_COLORS } from '@/lib/google-calendar'

// YY-NNN 형식 고유번호 생성 (예: 26-009)
async function generateProjectNumber(): Promise<string> {
  const admin = createAdminClient()
  const year = new Date().getFullYear()
  const yy = String(year).slice(2)
  const { count } = await admin.from('sales')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', `${year}-01-01`)
  const num = (count ?? 0) + 1
  return `${yy}-${String(num).padStart(3, '0')}`
}

export async function previewProjectNumber(): Promise<string> {
  return generateProjectNumber()
}

// LEAD{YYYYMMDD}-{NNNN} 형식 ID 생성
async function generateLeadId(): Promise<string> {
  const supabase = await createClient()
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const prefix = `LEAD${today}-`
  const { data } = await supabase
    .from('leads')
    .select('lead_id')
    .ilike('lead_id', `${prefix}%`)
    .order('lead_id', { ascending: false })
    .limit(1)
  if (!data || data.length === 0) return `${prefix}0001`
  const last = data[0].lead_id as string
  const num = parseInt(last.slice(-4)) + 1
  return `${prefix}${String(num).padStart(4, '0')}`
}

export async function createLead(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const lead_id = await generateLeadId()

  const { data: insertedLead } = await supabase.from('leads').insert({
    lead_id,
    person_id: (formData.get('person_id') as string) || null,
    customer_id: (formData.get('customer_id') as string) || null,
    inflow_date: (formData.get('inflow_date') as string) || new Date().toISOString().slice(0, 10),
    remind_date: (formData.get('remind_date') as string) || null,
    service_type: (formData.get('service_type') as string) || null,
    project_name: (formData.get('project_name') as string) || null,
    contact_name: (formData.get('contact_name') as string) || null,
    client_org: (formData.get('client_org') as string) || null,
    phone: (formData.get('phone') as string) || null,
    office_phone: (formData.get('office_phone') as string) || null,
    email: (formData.get('email') as string) || null,
    initial_content: (formData.get('initial_content') as string) || null,
    assignee_id: (formData.get('assignee_id') as string) || null,
    status: (formData.get('status') as string) || '유입',
    channel: (formData.get('channel') as string) || null,
    inflow_source: (formData.get('inflow_source') as string) || null,
    notes: (formData.get('notes') as string) || null,
    contact_1: (formData.get('contact_1') as string) || null,
    contact_2: (formData.get('contact_2') as string) || null,
    contact_3: (formData.get('contact_3') as string) || null,
  }).select('id').single()

  // 최초 유입 내용 → 소통내역 자동 등록
  const initial_content = formData.get('initial_content') as string | null
  if (insertedLead?.id && initial_content?.trim() && user) {
    const admin = createAdminClient()
    await admin.from('project_logs').insert({
      lead_id: insertedLead.id,
      sale_id: null,
      content: initial_content.trim(),
      log_type: '최초유입',
      author_id: user.id,
      contacted_at: new Date().toISOString(),
    })
  }

  // 고객 DB 자동 upsert (콜드메일 리스트용)
  const client_org = formData.get('client_org') as string | null
  const contact_name = formData.get('contact_name') as string | null
  const phone = formData.get('phone') as string | null
  const email = formData.get('email') as string | null
  await syncLeadToCustomerDB({ client_org, contact_name, phone, email })

  // service_type이 있으면 Dropbox 폴더 + brief.md 자동 생성
  const service_type = formData.get('service_type') as string | null
  if (service_type && insertedLead?.id) {
    try {
      await createOrUpdateLeadBrief(insertedLead.id)
    } catch {
      // brief 생성 실패는 무시 — 리드 등록 자체에 영향 없음
    }
  }

  revalidatePath('/leads')
}

const BRIEF_TRIGGER_FIELDS = ['project_name', 'client_org', 'contact_name', 'assignee_id', 'notes', 'initial_content']

export async function updateLead(id: string, data: Partial<{
  person_id: string | null
  customer_id: string | null
  inflow_date: string | null
  remind_date: string | null
  service_type: string | null
  project_name: string | null
  contact_name: string | null
  client_org: string | null
  phone: string | null
  office_phone: string | null
  email: string | null
  initial_content: string | null
  assignee_id: string | null
  status: string
  channel: string | null
  inflow_source: string | null
  notes: string | null
  contact_1: string | null
  contact_2: string | null
  contact_3: string | null
}>) {
  const supabase = await createClient()
  await supabase.from('leads').update({ ...data, updated_at: new Date().toISOString() }).eq('id', id)
  // 고객 DB 동기화 (연락처 관련 필드 변경 시)
  if ('client_org' in data || 'contact_name' in data || 'phone' in data || 'email' in data) {
    await syncLeadToCustomerDB({
      client_org: data.client_org ?? null,
      contact_name: data.contact_name ?? null,
      phone: data.phone ?? null,
      email: data.email ?? null,
    })
  }
  // 취소 상태로 변경 시 드롭박스 폴더를 999999.취소 폴더로 이동
  if (data.status === '취소') {
    const admin = createAdminClient()
    const { data: lead } = await admin.from('leads').select('dropbox_url').eq('id', id).single()
    if (lead?.dropbox_url) {
      const result = await moveDropboxToCancel(lead.dropbox_url)
      if ('newUrl' in result) {
        await admin.from('leads').update({ dropbox_url: result.newUrl }).eq('id', id)
      }
    }
  }
  // 주요 필드 변경 시 brief.md 갱신 (Dropbox 폴더가 있을 때만)
  const shouldRefreshBrief = BRIEF_TRIGGER_FIELDS.some(f => f in data)
  if (shouldRefreshBrief) {
    const admin = createAdminClient()
    const { data: lead } = await admin.from('leads').select('dropbox_url, service_type').eq('id', id).single()
    if (lead?.dropbox_url && lead?.service_type) {
      try {
        await createOrUpdateLeadBrief(id)
      } catch {
        // brief 갱신 실패는 무시
      }
    }
  }
  revalidatePath('/leads')
}

export async function refreshLeadBrief(id: string): Promise<{ ok: boolean; error?: string }> {
  try {
    await createOrUpdateLeadBrief(id)
    revalidatePath('/leads')
    return { ok: true }
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e)
    return { ok: false, error: message }
  }
}

export async function deleteLead(id: string) {
  const supabase = await createClient()
  await supabase.from('leads').delete().eq('id', id)
  revalidatePath('/leads')
}

export async function convertLeadToSale(leadId: string) {
  const supabase = await createClient()

  const { data: lead } = await supabase.from('leads').select('*').eq('id', leadId).single()
  if (!lead) return { error: '리드를 찾을 수 없습니다.' }

  const serviceType = lead.service_type as string | null
  const department = (serviceType && SERVICE_TO_DEPT[serviceType]) || null

  const adminDb = createAdminClient()

  // 고객 DB 조회 + 연락처 동기화
  let customerId: string | null = null
  if (lead.client_org) {
    const { data: cust } = await adminDb.from('customers').select('id, contact_name, phone, contact_email').ilike('name', lead.client_org.trim()).limit(1).single()
    if (cust) {
      customerId = cust.id
      // 고객에 연락처 없으면 리드 정보로 채움
      const patch: Record<string, string> = {}
      if (!cust.contact_name && lead.contact_name) patch.contact_name = lead.contact_name as string
      if (!cust.phone && (lead.phone || lead.office_phone)) patch.phone = (lead.phone || lead.office_phone) as string
      if (!cust.contact_email && lead.email) patch.contact_email = lead.email as string
      if (Object.keys(patch).length > 0) {
        await adminDb.from('customers').update(patch).eq('id', cust.id)
      }
    } else {
      // 고객 레코드 없으면 신규 생성
      const { data: newCust } = await adminDb.from('customers').insert({
        name: (lead.client_org as string).trim(),
        type: '기타',
        status: '활성',
        contact_name: (lead.contact_name as string | null) ?? null,
        phone: ((lead.phone || lead.office_phone) as string | null) ?? null,
        contact_email: (lead.email as string | null) ?? null,
      }).select('id').single()
      customerId = newCust?.id ?? null
    }
  }

  const displayName = (lead.project_name || lead.client_org) as string | null
  const projectNumber = await generateProjectNumber()
  const saleFullName = displayName ? `${projectNumber} ${displayName}` : projectNumber

  const { data: sale, error } = await supabase.from('sales').insert({
    name: saleFullName,
    client_org: lead.client_org,
    customer_id: customerId,
    service_type: serviceType,
    department,
    assignee_id: lead.assignee_id,
    revenue: 0,
    contract_stage: '계약',
    memo: lead.initial_content,
    notes: (lead.notes as string | null) ?? null,
    inflow_date: lead.inflow_date || new Date().toISOString().slice(0, 10),
    lead_id: leadId,
    project_number: projectNumber,
  }).select('id').single()

  if (error) return { error: error.message }

  // Dropbox 폴더: 리드 폴더 있으면 고유번호로 rename, 없으면 새로 생성
  let finalDropboxUrl: string | null = null
  if (sale && serviceType) {
    const existingUrl = lead.dropbox_url as string | null
    const folderDisplayName = `${projectNumber} ${displayName || '(이름없음)'}`
    if (existingUrl) {
      const renamed = await renameDropboxFolderFull(existingUrl, folderDisplayName)
      finalDropboxUrl = 'newUrl' in renamed ? renamed.newUrl : existingUrl
    } else {
      const newUrl = await createSaleFolder({
        service_type: serviceType,
        name: folderDisplayName,
        inflow_date: lead.inflow_date,
      }).catch(() => null)
      finalDropboxUrl = newUrl
    }
    if (finalDropboxUrl) {
      await supabase.from('sales').update({ dropbox_url: finalDropboxUrl }).eq('id', sale.id)

      // brief 파일명도 새 정책(<번호> <건이름>.md)으로 자동 갱신
      try {
        const { getBriefFilename, findExistingBriefFile } = await import('@/lib/brief-generator')
        const { renameDropboxFile } = await import('@/lib/dropbox')
        const targetFilename = getBriefFilename({
          project_name: displayName || saleFullName,
          project_number: projectNumber,
        })
        const existing = await findExistingBriefFile(finalDropboxUrl, targetFilename)
        if (existing && existing !== targetFilename) {
          await renameDropboxFile(finalDropboxUrl, existing, targetFilename).catch(() => null)
        }
      } catch { /* brief rename 실패는 무시 */ }
    }
  }

  // project 자동 생성
  const { data: project } = await adminDb.from('projects').insert({
    name: saleFullName,
    service_type: serviceType,
    department,
    pm_id: lead.assignee_id ?? null,
    customer_id: customerId,
    status: '진행중',
    _source_sale_id: sale!.id,
    project_number: projectNumber,
  }).select('id').single()

  if (project) {
    await adminDb.from('sales').update({ project_id: project.id }).eq('id', sale!.id)
    if (finalDropboxUrl) {
      await adminDb.from('projects').update({ dropbox_url: finalDropboxUrl }).eq('id', project.id)
    }
    if (lead.assignee_id) {
      await adminDb.from('project_members').insert({ project_id: project.id, profile_id: lead.assignee_id, role: 'PM' }).single()
    }
  }

  // 리드에 converted_sale_id + project_id 업데이트, 상태 '완료'
  await supabase.from('leads').update({
    converted_sale_id: sale!.id,
    project_id: project?.id ?? null,
    is_primary_lead: true,
    status: '완료',
    updated_at: new Date().toISOString(),
  }).eq('id', leadId)

  // 리드의 할일들을 sale로 이전 (lead_id → null, project_id → sale.id)
  await adminDb.from('tasks').update({
    lead_id: null,
    project_id: sale!.id,
  }).eq('lead_id', leadId)

  // 채널톡 알림 (CHANNELTALK_GROUP_ID 설정 시)
  notifyLeadConverted({
    clientOrg: lead.client_org,
    serviceType: lead.service_type,
    saleName: saleFullName,
    saleId: sale!.id,
  }).catch(console.error)

  revalidatePath('/leads')
  revalidatePath('/projects')
  revalidatePath('/dashboard')
  revalidatePath('/sales/report')

  return { success: true, sale_id: sale!.id, project_id: project?.id ?? null, project_number: projectNumber }
}

export async function addSaleToLead(leadId: string, data: {
  name: string
  service_type: string | null
  revenue: number
  memo: string | null
}): Promise<{ sale_id: string } | { error: string }> {
  const supabase = await createClient()

  const { data: lead } = await supabase.from('leads').select('*').eq('id', leadId).single()
  if (!lead) return { error: '리드를 찾을 수 없습니다.' }

  const serviceType = data.service_type || (lead.service_type as string | null)
  const department = (serviceType && SERVICE_TO_DEPT[serviceType]) || null

  const { data: sale, error } = await supabase.from('sales').insert({
    name: data.name,
    client_org: lead.client_org,
    service_type: serviceType,
    department,
    assignee_id: lead.assignee_id,
    revenue: data.revenue,
    contract_stage: '계약',
    memo: data.memo,
    inflow_date: lead.inflow_date || new Date().toISOString().slice(0, 10),
    lead_id: leadId,
  }).select('id').single()

  if (error) return { error: error.message }

  // Dropbox 폴더 자동 생성
  if (sale && serviceType) {
    const dropboxUrl = await createSaleFolder({
      service_type: serviceType,
      name: lead.client_org || data.name,
      inflow_date: lead.inflow_date,
    })
    if (dropboxUrl) {
      await supabase.from('sales').update({ dropbox_url: dropboxUrl }).eq('id', sale.id)
    }
  }

  // converted_sale_id가 없으면 이 건을 대표 계약건으로 설정 + 상태 '완료'로
  const leadUpdates: Record<string, unknown> = {}
  if (!lead.converted_sale_id) leadUpdates.converted_sale_id = sale!.id
  if (!['완료', '취소'].includes(lead.status as string)) leadUpdates.status = '완료'
  if (Object.keys(leadUpdates).length > 0) {
    await supabase.from('leads').update({ ...leadUpdates, updated_at: new Date().toISOString() }).eq('id', leadId)
  }

  revalidatePath('/leads')
  revalidatePath('/sales/report')

  return { sale_id: sale!.id }
}

export async function createLeadFolder(leadId: string): Promise<{ url: string | null; error?: string }> {
  const admin = createAdminClient()
  const { data: lead } = await admin.from('leads').select('*').eq('id', leadId).single()
  if (!lead) return { url: null, error: '리드를 찾을 수 없습니다.' }

  if (!lead.service_type) {
    return { url: null, error: '서비스 타입이 없어서 폴더를 만들 수 없어요. URL을 직접 입력해주세요.' }
  }

  let url: string | null
  try {
    url = await createSaleFolder({
      service_type: lead.service_type as string,
      name: (lead.project_name || lead.client_org) as string || '(리드)',
      inflow_date: lead.inflow_date,
    })
  } catch (e: any) {
    return { url: null, error: e?.message ?? '드롭박스 폴더 생성 실패' }
  }

  if (!url) {
    return { url: null, error: `드롭박스 폴더 생성에 실패했습니다. (서비스: ${lead.service_type})` }
  }

  const { error: dbErr } = await admin.from('leads').update({ dropbox_url: url, updated_at: new Date().toISOString() }).eq('id', leadId)
  if (dbErr) return { url: null, error: 'DB 저장 실패: ' + dbErr.message }
  revalidatePath('/leads')

  return { url }
}

export async function createPerson(data: {
  name: string
  phone?: string
  email?: string
  dept?: string
  title?: string
  customer_name?: string
}): Promise<{ id: string; name: string; phone: string; email: string } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const admin = createAdminClient()
  const { data: person, error } = await supabase
    .from('persons')
    .insert({ name: data.name, phone: data.phone || null, email: data.email || null })
    .select('id, name, phone, email')
    .single()

  if (error) return { error: error.message }

  // 기관/부서/직급 정보 있으면 person_org_relations에 등록
  if (data.customer_name || data.dept || data.title) {
    let customerId: string | null = null
    if (data.customer_name) {
      const { data: existing } = await admin.from('customers').select('id').eq('name', data.customer_name).maybeSingle()
      if (existing?.id) {
        customerId = existing.id
      } else {
        const { data: newCust } = await admin.from('customers').insert({
          name: data.customer_name, type: '기타', status: '활성',
        }).select('id').single()
        customerId = newCust?.id ?? null
      }
    }

    if (customerId) {
      await admin.from('person_org_relations').insert({
        person_id: person.id, customer_id: customerId,
        dept: data.dept || null, title: data.title || null,
        started_at: new Date().toISOString().slice(0, 10),
        ended_at: null, is_current: true,
      })
    }
  }

  revalidatePath('/leads')
  return { id: person.id, name: person.name, phone: person.phone || '', email: person.email || '' }
}

export async function updateLeadPersonAndCustomer(
  leadId: string,
  personId: string,
  personData: { name: string; phone: string | null; email: string | null },
  customerId: string | null,
  customerData: { name: string; region?: string | null; type?: string | null },
  relationData?: { id: string | null; title?: string | null; dept?: string | null }
): Promise<{ error?: string }> {
  const admin = createAdminClient()

  // 1. persons 테이블 업데이트
  const { error: personErr } = await admin.from('persons').update(personData).eq('id', personId)
  if (personErr) return { error: personErr.message }

  // 2. customers 테이블 업데이트 (customerId 있을 때만)
  if (customerId && customerData.name) {
    const { error: custErr } = await admin.from('customers').update({
      name: customerData.name,
      region: customerData.region ?? null,
      type: customerData.type ?? null,
    }).eq('id', customerId)
    if (custErr) return { error: custErr.message }
  }

  // 3. person_org_relations 직급/부서 업데이트 (relationId 있을 때만)
  if (relationData?.id) {
    await admin.from('person_org_relations').update({
      title: relationData.title ?? null,
      dept: relationData.dept ?? null,
    }).eq('id', relationData.id)
  }

  // 4. leads 테이블 동기화 (contact_name, phone, email, client_org)
  await admin.from('leads').update({
    contact_name: personData.name,
    phone: personData.phone,
    email: personData.email,
    ...(customerId && customerData.name ? { client_org: customerData.name } : {}),
    updated_at: new Date().toISOString(),
  }).eq('id', leadId)

  revalidatePath('/leads')
  revalidatePath('/customers')
  return {}
}

export async function updateLeadNotes(leadId: string, notes: string): Promise<void> {
  const admin = createAdminClient()
  await admin.from('leads').update({ notes: notes || null, updated_at: new Date().toISOString() }).eq('id', leadId)
  revalidatePath('/leads')
}

export async function updateLeadDropboxUrl(leadId: string, url: string): Promise<{ error?: string; converted?: string }> {
  let finalUrl = url.trim()
  let converted: string | undefined

  // shared link (/scl/...) 자동 변환 시도
  if (finalUrl.includes('/scl/')) {
    const resolvedPath = await resolveDropboxSharedLink(finalUrl)
    if (resolvedPath) {
      converted = `https://www.dropbox.com/home${resolvedPath}`
      finalUrl = converted
    }
  }

  if (finalUrl) {
    const v = validateDropboxUrl(finalUrl)
    if (!v.ok) return { error: v.error }
  }
  const admin = createAdminClient()
  const { error } = await admin.from('leads').update({ dropbox_url: finalUrl || null, updated_at: new Date().toISOString() }).eq('id', leadId)
  if (error) return { error: error.message }
  revalidatePath('/leads')
  return converted ? { converted } : {}
}

export async function syncLeadDropboxFolderName(
  leadId: string,
  currentDropboxUrl: string,
  newProjectName: string,
): Promise<{ newUrl: string; recovered?: boolean } | { error: string }> {
  const result = await renameDropboxFolder(currentDropboxUrl, newProjectName)
  if ('error' in result) return result

  const admin = createAdminClient()
  await admin.from('leads').update({ dropbox_url: result.newUrl, updated_at: new Date().toISOString() }).eq('id', leadId)
  revalidatePath('/leads')
  return { newUrl: result.newUrl, recovered: result.recovered }
}

// 리드 할일 — tasks 테이블의 lead_id 컬럼 사용. 전환 시 sale로 자동 마이그.
export async function getLeadTasks(leadId: string) {
  const admin = createAdminClient()
  const { data } = await admin.from('tasks')
    .select('id, title, status, priority, due_date, description, assignee_id, bbang_suggested')
    .eq('lead_id', leadId)
    .order('created_at', { ascending: true })
  return data ?? []
}

export async function createLeadTask(leadId: string, data: { title: string; due_date?: string | null; priority?: string; assignee_id?: string | null }, force = false): Promise<{ id: string; title: string } | { error: string; duplicate?: { id: string; title: string; status: string }[] }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const admin = createAdminClient()
  const title = data.title.trim()
  if (!title) return { error: '제목 필수' }

  if (!force) {
    const { data: existing } = await admin.from('tasks')
      .select('id, title, status')
      .eq('lead_id', leadId).neq('status', '완료').neq('status', '보류')
      .ilike('title', `%${title}%`).limit(5)
    if (existing && existing.length > 0) {
      return { error: '유사 할일 있음', duplicate: existing }
    }
  }

  const validPriority = ['긴급', '높음', '보통', '낮음']
  const priority = validPriority.includes(data.priority ?? '') ? data.priority! : '보통'
  const { data: row, error } = await admin.from('tasks').insert({
    lead_id: leadId,
    title,
    status: '할 일',
    priority,
    due_date: data.due_date || null,
    assignee_id: data.assignee_id || null,
  }).select('id, title').single()
  if (error) return { error: error.message }
  revalidatePath('/leads')
  return { id: row.id, title: row.title }
}

export async function updateLeadTask(taskId: string, leadId: string, data: { title?: string; status?: string; priority?: string; due_date?: string | null; assignee_id?: string | null }) {
  const admin = createAdminClient()
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (data.title !== undefined) updates.title = data.title
  if (data.status !== undefined) updates.status = data.status
  if (data.priority !== undefined) updates.priority = data.priority
  if (data.due_date !== undefined) updates.due_date = data.due_date || null
  if (data.assignee_id !== undefined) updates.assignee_id = data.assignee_id || null
  const { error } = await admin.from('tasks').update(updates).eq('id', taskId).eq('lead_id', leadId)
  if (error) return { error: error.message }
  revalidatePath('/leads')
  return {}
}

export async function deleteLeadTask(taskId: string, leadId: string) {
  const admin = createAdminClient()
  const { error } = await admin.from('tasks').delete().eq('id', taskId).eq('lead_id', leadId)
  if (error) return { error: error.message }
  revalidatePath('/leads')
  return {}
}

// 기존 Google Calendar 일정 검색 (리드/프로젝트 어디서든 사용)
export async function searchCalendarEvents(query: string): Promise<{
  results: { id: string; calendarKey: string; title: string; date: string; color: string; isAllDay: boolean }[]
} | { error: string }> {
  try {
    const { searchEvents } = await import('@/lib/google-calendar')
    const events = await searchEvents(query, 6)
    return {
      results: events.slice(0, 30).map(ev => ({
        id: ev.id,
        calendarKey: ev.calendarKey,
        title: ev.title,
        date: ev.date,
        color: ev.color,
        isAllDay: ev.isAllDay,
      })),
    }
  } catch (e) {
    return { error: e instanceof Error ? e.message : '검색 실패' }
  }
}

type LinkedCalEvent = { id: string; calendarKey: string; title: string; date: string; color: string }

export async function linkLeadCalendarEvent(leadId: string, event: LinkedCalEvent): Promise<void> {
  const admin = createAdminClient()
  const { data: lead } = await admin.from('leads').select('linked_calendar_events').eq('id', leadId).single()
  const current: LinkedCalEvent[] = (lead?.linked_calendar_events as LinkedCalEvent[]) ?? []
  if (current.find(e => e.id === event.id)) return
  await admin.from('leads').update({ linked_calendar_events: [...current, event] }).eq('id', leadId)
  revalidatePath('/leads')
}

export async function unlinkLeadCalendarEvent(leadId: string, eventId: string): Promise<void> {
  const admin = createAdminClient()
  const { data: lead } = await admin.from('leads').select('linked_calendar_events').eq('id', leadId).single()
  const current: LinkedCalEvent[] = (lead?.linked_calendar_events as LinkedCalEvent[]) ?? []
  await admin.from('leads').update({ linked_calendar_events: current.filter(e => e.id !== eventId) }).eq('id', leadId)
  revalidatePath('/leads')
}

export async function createAndLinkLeadCalendarEvent(
  leadId: string,
  calendarKey: string,
  data: { title: string; date: string; startTime?: string; endTime?: string; description?: string; isAllDay?: boolean }
): Promise<{ error?: string }> {
  try {
    const ev = await createEvent(calendarKey, data)
    await linkLeadCalendarEvent(leadId, {
      id: ev.id ?? `ev-${Date.now()}`,
      calendarKey,
      title: data.title,
      date: data.date,
      color: CALENDAR_COLORS[calendarKey] ?? '#3B82F6',
    })
    return {}
  } catch (e: unknown) {
    return { error: e instanceof Error ? e.message : String(e) }
  }
}
