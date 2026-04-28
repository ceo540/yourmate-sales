// 빵빵이 + 자동 매칭(/api/channeltalk 등)에서 customer_id 정합화에 쓰는 헬퍼.
// /customers/actions.ts 의 quickCreateCustomerWithContact와 동일 정책을 따른다.

import { createAdminClient } from '@/lib/supabase/admin'

type Admin = ReturnType<typeof createAdminClient>

/**
 * 정확히(case-insensitive) 일치하는 기관(customers.id)을 찾는다.
 * 부분 일치는 의도적으로 안 함 — 잘못된 자동 매칭을 막기 위해.
 */
export async function findCustomerByExactOrg(
  admin: Admin,
  clientOrg: string | null | undefined,
): Promise<string | null> {
  const name = clientOrg?.trim()
  if (!name) return null
  const { data } = await admin
    .from('customers')
    .select('id')
    .ilike('name', name)
    .limit(1)
    .maybeSingle()
  return data?.id ?? null
}

/**
 * customer_id 검증. 존재하지 않으면 null.
 */
export async function validateCustomerId(admin: Admin, customerId: string | null | undefined): Promise<string | null> {
  if (!customerId) return null
  const { data } = await admin.from('customers').select('id').eq('id', customerId).maybeSingle()
  return data?.id ?? null
}

interface QuickCreateInput {
  name: string
  type?: string | null
  contact_name?: string | null
  contact_dept?: string | null
  contact_title?: string | null
  phone?: string | null
  email?: string | null
}

/**
 * 신규 기관(+선택적 담당자) 일괄 생성. customer_id 반환.
 * - persons 테이블에 contact_name 등록 시 person_org_relations로 묶음
 */
export async function quickCreateCustomer(
  admin: Admin,
  input: QuickCreateInput,
): Promise<{ customer_id: string; person_id?: string } | { error: string }> {
  const name = input.name?.trim()
  if (!name) return { error: '기관명은 필수' }

  const customerInsert: Record<string, unknown> = {
    name,
    type: input.type || '기타',
    status: '활성',
  }
  if (input.contact_name) customerInsert.contact_name = input.contact_name.trim()
  if (input.phone) customerInsert.phone = input.phone
  if (input.email) customerInsert.contact_email = input.email

  const { data: customer, error: cErr } = await admin
    .from('customers')
    .insert(customerInsert)
    .select('id')
    .single()
  if (cErr || !customer) return { error: cErr?.message ?? '기관 생성 실패' }

  let personId: string | undefined
  const contactName = input.contact_name?.trim()
  if (contactName) {
    const { data: person } = await admin
      .from('persons')
      .insert({
        name: contactName,
        phone: input.phone || null,
        email: input.email || null,
      })
      .select('id')
      .single()
    if (person) {
      personId = person.id
      await admin.from('person_org_relations').insert({
        person_id: person.id,
        customer_id: customer.id,
        dept: input.contact_dept || null,
        title: input.contact_title || null,
        started_at: new Date().toISOString().slice(0, 10),
        ended_at: null,
        is_current: true,
      })
    }
  }

  return { customer_id: customer.id, person_id: personId }
}

/**
 * 입력의 customer_id → 검증; 없으면 client_org 정확 매칭.
 * 자동 생성은 하지 않음 (사용자 컨펌 흐름은 빵빵이 도구가 담당).
 */
export async function resolveCustomerId(
  admin: Admin,
  input: { customer_id?: string | null; client_org?: string | null },
): Promise<string | null> {
  if (input.customer_id) {
    const ok = await validateCustomerId(admin, input.customer_id)
    if (ok) return ok
  }
  return findCustomerByExactOrg(admin, input.client_org)
}

/**
 * 자동 매칭 실패 시 자동 생성까지 한다. (채널톡 자동 등록용)
 */
export async function resolveOrCreateCustomerId(
  admin: Admin,
  input: {
    customer_id?: string | null
    client_org?: string | null
    contact_name?: string | null
    phone?: string | null
    email?: string | null
  },
): Promise<string | null> {
  const matched = await resolveCustomerId(admin, input)
  if (matched) return matched
  if (!input.client_org?.trim()) return null
  const created = await quickCreateCustomer(admin, {
    name: input.client_org.trim(),
    contact_name: input.contact_name,
    phone: input.phone,
    email: input.email,
  })
  if ('error' in created) return null
  return created.customer_id
}
