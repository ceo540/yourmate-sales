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
