import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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

    // 중복 체크
    const { data: existing } = await supabase
      .from('leads')
      .select('id, lead_id, status, client_org')
      .ilike('client_org', `%${client_org}%`)
      .neq('status', '취소')
      .limit(1)

    if (existing && existing.length > 0) {
      return NextResponse.json({
        duplicate: true,
        existing_lead: existing[0],
        message: `이미 "${existing[0].client_org}" 리드가 있어 (${existing[0].lead_id}, 상태: ${existing[0].status}).`,
      })
    }

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
      status: '신규',
      assignee_id: user.id,
    }).select('id, lead_id').single()

    if (error) throw new Error(error.message)

    return NextResponse.json({ id: data.id, lead_id: data.lead_id })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
