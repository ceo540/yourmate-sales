import { createAdminClient } from './supabase/admin'

/**
 * 리드 등록 시 고객 DB(customers + persons)에 자동 upsert
 * - 실패해도 리드 등록 흐름에 영향 없도록 try-catch로 감쌈
 * - customers 테이블: name, type만 (실제 DB 컬럼 불확실한 항목 제외)
 * - persons 테이블: name, phone, email
 */
export async function syncLeadToCustomerDB(params: {
  client_org?: string | null
  contact_name?: string | null
  phone?: string | null
  email?: string | null
}) {
  try {
    const { client_org, contact_name, phone, email } = params
    if (!client_org && !contact_name) return

    const db = createAdminClient()
    let customerId: string | null = null
    let personId: string | null = null

    // 1. 기관 upsert (name, type만 — 없는 컬럼 insert 방지)
    if (client_org?.trim()) {
      const name = client_org.trim()
      const { data: existing } = await db
        .from('customers')
        .select('id')
        .ilike('name', name)
        .limit(1)
        .single()

      if (existing) {
        customerId = existing.id
      } else {
        const { data: inserted } = await db
          .from('customers')
          .insert({ name })
          .select('id')
          .single()
        if (inserted) customerId = inserted.id
      }
    }

    // 2. 담당자 upsert (name, phone, email)
    if (contact_name?.trim()) {
      const name = contact_name.trim()
      const { data: existing } = await db
        .from('persons')
        .select('id, phone, email')
        .ilike('name', name)
        .limit(1)
        .single()

      if (existing) {
        personId = existing.id
        const updates: Record<string, string> = {}
        if (!existing.phone && phone) updates.phone = phone
        if (!existing.email && email) updates.email = email
        if (Object.keys(updates).length > 0) {
          await db.from('persons').update(updates).eq('id', existing.id)
        }
      } else {
        const { data: inserted } = await db
          .from('persons')
          .insert({ name, phone: phone || null, email: email || null })
          .select('id')
          .single()
        if (inserted) personId = inserted.id
      }
    }

    // 3. 기관-담당자 관계 연결
    if (customerId && personId) {
      const { data: existingRel } = await db
        .from('person_org_relations')
        .select('id')
        .eq('customer_id', customerId)
        .eq('person_id', personId)
        .eq('is_current', true)
        .limit(1)
        .single()

      if (!existingRel) {
        await db.from('person_org_relations').insert({
          customer_id: customerId,
          person_id: personId,
          is_current: true,
          started_at: new Date().toISOString().slice(0, 10),
        })
      }
    }
  } catch {
    // 동기화 실패는 무시 — 리드 등록 자체에 영향 없음
  }
}
