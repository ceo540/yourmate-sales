import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { syncLeadToCustomerDB } from '@/lib/customer-sync'
import { createOrUpdateLeadBrief } from '@/lib/brief-generator'

async function generateLeadId(supabase: Awaited<ReturnType<typeof createClient>>): Promise<string> {
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

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { client_org, contact_name, phone, email, service_type, initial_content, channel, inflow_source, remind_date } = body

    if (!client_org) return NextResponse.json({ error: '기관명은 필수야.' }, { status: 400 })

    // 기존 리드 참고용 조회 (차단 없음 — 같은 기관도 별도 건 허용)
    const { data: existing } = await supabase
      .from('leads')
      .select('lead_id, status, service_type')
      .ilike('client_org', client_org)
      .neq('status', '취소')
      .limit(5)

    const lead_id = await generateLeadId(supabase)
    const today = new Date().toISOString().slice(0, 10)

    const { data, error } = await supabase.from('leads').insert({
      lead_id,
      client_org: client_org.trim(),
      contact_name: contact_name || null,
      phone: phone || null,
      email: email || null,
      service_type: service_type || null,
      initial_content: initial_content || null,
      channel: channel || null,
      inflow_source: inflow_source || null,
      remind_date: remind_date || null,
      inflow_date: today,
      status: '유입',
      assignee_id: user.id,
    }).select('id, lead_id').single()

    if (error) throw new Error(error.message)

    // 고객 DB 자동 upsert (콜드메일 리스트용)
    await syncLeadToCustomerDB({ client_org, contact_name, phone, email })

    // service_type이 있으면 Dropbox 폴더 + brief.md 자동 생성
    if (service_type && data.id) {
      createOrUpdateLeadBrief(data.id).catch(() => {})
    }

    const note = existing && existing.length > 0
      ? ` (참고: 동일 기관 기존 리드 ${existing.length}건 — ${existing.map((e: { lead_id: string; service_type: string | null; status: string }) => `${e.lead_id} ${e.service_type || ''} ${e.status}`).join(', ')})`
      : ''
    return NextResponse.json({ id: data.id, lead_id: data.lead_id, note })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
