'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

/* ── 기관 ── */
export async function createCustomer(fd: FormData) {
  const supabase = await createClient()
  const { error } = await supabase.from('customers').insert({
    name:     fd.get('name') as string,
    type:     fd.get('type') as string || null,
    region:   fd.get('region') as string || null,
    phone:    fd.get('phone') as string || null,
    email:    fd.get('email') as string || null,
    homepage: fd.get('homepage') as string || null,
    notes:    fd.get('notes') as string || null,
  })
  if (error) return { error: error.message }
  revalidatePath('/customers')
  return {}
}

export async function updateCustomer(id: string, data: {
  name?: string; type?: string | null; region?: string | null
  phone?: string | null; email?: string | null; homepage?: string | null; notes?: string | null
}) {
  const supabase = await createClient()
  const { error } = await supabase.from('customers').update({ ...data, updated_at: new Date().toISOString() }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/customers')
  return {}
}

export async function deleteCustomer(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('customers').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/customers')
  return {}
}

/* ── 담당자 ── */
export async function createPerson(fd: FormData) {
  const supabase = await createClient()
  const { data: person, error } = await supabase.from('persons').insert({
    name:  fd.get('name') as string,
    phone: fd.get('phone') as string || null,
    email: fd.get('email') as string || null,
    notes: fd.get('notes') as string || null,
  }).select().single()
  if (error) return { error: error.message }

  // 소속 기관 바로 연결 (선택적)
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
}) {
  const supabase = await createClient()
  const { error } = await supabase.from('persons').update({ ...data, updated_at: new Date().toISOString() }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/customers')
  return {}
}

export async function deletePerson(id: string) {
  const supabase = await createClient()
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
  const supabase = await createClient()
  // 기존 현재 소속 종료
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
  const supabase = await createClient()
  const { error } = await supabase.from('person_org_relations')
    .update({ is_current: false, ended_at: endedAt }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/customers')
  return {}
}
