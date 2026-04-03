import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: '관리자만 실행 가능' }, { status: 403 })

  const db = createAdminClient()

  // 리드 전체 조회
  const { data: leads, error } = await db
    .from('leads')
    .select('client_org, contact_name, phone, email')
    .not('client_org', 'is', null)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  let synced = 0
  let skipped = 0

  for (const lead of leads ?? []) {
    const { client_org, contact_name, phone, email } = lead
    if (!client_org?.trim()) { skipped++; continue }

    try {
      let customerId: string | null = null
      let personId: string | null = null

      // 기관 upsert
      const { data: existingOrg } = await db
        .from('customers')
        .select('id')
        .ilike('name', client_org.trim())
        .limit(1)
        .single()

      if (existingOrg) {
        customerId = existingOrg.id
      } else {
        const { data: inserted } = await db
          .from('customers')
          .insert({ name: client_org.trim() })
          .select('id')
          .single()
        if (inserted) customerId = inserted.id
      }

      // 담당자 upsert
      if (contact_name?.trim()) {
        const { data: existingPerson } = await db
          .from('persons')
          .select('id, phone, email')
          .ilike('name', contact_name.trim())
          .limit(1)
          .single()

        if (existingPerson) {
          personId = existingPerson.id
          const updates: Record<string, string> = {}
          if (!existingPerson.phone && phone) updates.phone = phone
          if (!existingPerson.email && email) updates.email = email
          if (Object.keys(updates).length > 0) {
            await db.from('persons').update(updates).eq('id', existingPerson.id)
          }
        } else {
          const { data: inserted } = await db
            .from('persons')
            .insert({ name: contact_name.trim(), phone: phone || null, email: email || null })
            .select('id')
            .single()
          if (inserted) personId = inserted.id
        }
      }

      // 관계 연결
      if (customerId && personId) {
        const { data: existingRel } = await db
          .from('person_org_relations')
          .select('id')
          .eq('customer_id', customerId)
          .eq('person_id', personId)
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

      synced++
    } catch {
      skipped++
    }
  }

  return NextResponse.json({
    message: `완료: ${synced}개 동기화, ${skipped}개 스킵`,
    synced,
    skipped,
  })
}
