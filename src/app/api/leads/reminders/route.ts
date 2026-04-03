import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const isMember = profile?.role === 'member'

  const today = new Date().toISOString().slice(0, 10)

  let query = supabase
    .from('leads')
    .select('id, lead_id, client_org, contact_name, status, remind_date, service_type')
    .lte('remind_date', today)
    .not('status', 'in', '(완료,취소)')
    .order('remind_date', { ascending: true })
    .limit(10)

  if (isMember) query = query.eq('assignee_id', user.id)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ leads: data ?? [], today })
}
