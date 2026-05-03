'use server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

/* ── 기관 ── */
// 모달 내 빠른 기관 등록 (이름만 필수, ID 반환)
export async function quickCreateCustomer(name: string): Promise<{ id: string } | { error: string }> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('customers')
    .insert({ name, type: '기타', status: '활성' })
    .select('id')
    .single()
  if (error) return { error: error.message }
  revalidatePath('/customers')
  return { id: data.id }
}

// 기관 + 담당자(부서/직급 포함) 한번에 등록
// 담당자 정보는 모두 선택. 이름이 있으면 persons 테이블 + job_history에 등록
// 부서는 수의계약 한도 파악에 중요해서 항상 입력 가능하게 유지
export async function quickCreateCustomerWithContact(data: {
  name: string
  contact?: {
    name?: string
    dept?: string
    title?: string
    phone?: string
    email?: string
  } | null
}): Promise<{ customer_id: string; person_id?: string } | { error: string }> {
  const supabase = createAdminClient()
  const contactName = data.contact?.name?.trim() || ''
  const customerInsert: Record<string, unknown> = {
    name: data.name,
    type: '기타',
    status: '활성',
  }
  // 담당자 정보가 있으면 customers의 contact_* 필드에도 채움 (요약용)
  if (contactName) customerInsert.contact_name = contactName
  if (data.contact?.phone) customerInsert.phone = data.contact.phone
  if (data.contact?.email) customerInsert.contact_email = data.contact.email

  const { data: customer, error: cErr } = await supabase
    .from('customers')
    .insert(customerInsert)
    .select('id')
    .single()
  if (cErr || !customer) return { error: cErr?.message ?? '고객사 생성 실패' }

  let personId: string | undefined
  if (contactName) {
    const { data: person, error: pErr } = await supabase
      .from('persons')
      .insert({
        name: contactName,
        phone: data.contact?.phone ?? null,
        email: data.contact?.email ?? null,
      })
      .select('id')
      .single()
    if (!pErr && person) {
      personId = person.id
      // job_history 연결 — dept/title 있으면 함께
      await supabase.from('person_org_relations').insert({
        person_id: person.id,
        customer_id: customer.id,
        dept: data.contact?.dept ?? null,
        title: data.contact?.title ?? null,
        started_at: new Date().toISOString().slice(0, 10),
        ended_at: null,
        is_current: true,
      })
    }
  }

  revalidatePath('/customers')
  return { customer_id: customer.id, person_id: personId }
}

export async function createCustomer(fd: FormData) {
  const supabase = createAdminClient()
  const { error } = await supabase.from('customers').insert({
    name:   fd.get('name') as string,
    type:   (fd.get('type') as string) || '기타',
    status: '활성',
    region: (fd.get('region') as string) || null,
    phone:  (fd.get('phone') as string) || null,
    notes:  (fd.get('notes') as string) || null,
  })
  if (error) return { error: error.message }
  revalidatePath('/customers')
  return {}
}

export async function updateCustomer(id: string, data: {
  name?: string; type?: string | null; region?: string | null
  phone?: string | null; notes?: string | null
}): Promise<{ error?: string }> {
  const supabase = createAdminClient()
  const { error } = await supabase.from('customers').update(data).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/customers')
  return {}
}

export async function deleteCustomer(id: string): Promise<{ error?: string }> {
  const { requireAdminOrManager } = await import('@/lib/auth-guard')
  try { await requireAdminOrManager() } catch (e) { return { error: e instanceof Error ? e.message : 'Forbidden' } }
  const supabase = createAdminClient()
  // FK 제약 해제: 소속 관계 먼저 삭제, 매출건은 customer_id null 처리
  await supabase.from('person_org_relations').delete().eq('customer_id', id)
  await supabase.from('sales').update({ customer_id: null }).eq('customer_id', id)
  const { error } = await supabase.from('customers').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/customers')
  return {}
}

/* ── 담당자 ── */
export async function createPerson(fd: FormData) {
  const supabase = createAdminClient()
  const { data: person, error } = await supabase.from('persons').insert({
    name:  fd.get('name') as string,
    phone: (fd.get('phone') as string) || null,
    email: (fd.get('email') as string) || null,
    notes: (fd.get('notes') as string) || null,
  }).select().single()
  if (error) return { error: error.message }

  const customerId = fd.get('customer_id') as string
  const dept       = fd.get('dept') as string
  const title      = fd.get('title') as string
  const startedAt  = fd.get('started_at') as string
  if (customerId && person) {
    await supabase.from('person_org_relations').insert({
      person_id: person.id, customer_id: customerId,
      dept: dept || null, title: title || null,
      started_at: startedAt || null, ended_at: null, is_current: true,
    })
  }
  revalidatePath('/customers')
  return {}
}

export async function updatePerson(id: string, data: {
  name?: string; phone?: string | null; email?: string | null; notes?: string | null
}): Promise<{ error?: string }> {
  const supabase = createAdminClient()
  const { error } = await supabase.from('persons').update(data).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/customers')
  return {}
}

export async function deletePerson(id: string): Promise<{ error?: string }> {
  const { requireAdminOrManager } = await import('@/lib/auth-guard')
  try { await requireAdminOrManager() } catch (e) { return { error: e instanceof Error ? e.message : 'Forbidden' } }
  const supabase = createAdminClient()
  await supabase.from('person_org_relations').delete().eq('person_id', id)
  const { error } = await supabase.from('persons').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/customers')
  return {}
}

/* ── 소속 관계 ── */
export async function addRelation(data: {
  person_id: string; customer_id: string
  dept?: string; title?: string; started_at?: string
}) {
  const supabase = createAdminClient()
  if (data.started_at) {
    await supabase.from('person_org_relations')
      .update({ is_current: false, ended_at: data.started_at })
      .eq('person_id', data.person_id).eq('is_current', true)
  }
  const { error } = await supabase.from('person_org_relations').insert({
    person_id:   data.person_id,
    customer_id: data.customer_id,
    dept:        data.dept || null,
    title:       data.title || null,
    started_at:  data.started_at || null,
    ended_at:    null,
    is_current:  true,
  })
  if (error) return { error: error.message }
  revalidatePath('/customers')
  return {}
}

export async function endRelation(id: string, endedAt: string) {
  const supabase = createAdminClient()
  const { error } = await supabase.from('person_org_relations')
    .update({ is_current: false, ended_at: endedAt }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/customers')
  return {}
}

export async function deleteRelation(id: string): Promise<{ error?: string }> {
  const { requireAdminOrManager } = await import('@/lib/auth-guard')
  try { await requireAdminOrManager() } catch (e) { return { error: e instanceof Error ? e.message : 'Forbidden' } }
  const supabase = createAdminClient()
  const { error } = await supabase.from('person_org_relations').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/customers')
  return {}
}

export async function updateRelation(id: string, data: {
  dept?: string | null; title?: string | null
  started_at?: string | null; ended_at?: string | null
}) {
  const supabase = createAdminClient()
  const { error } = await supabase.from('person_org_relations').update(data).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/customers')
  return {}
}
