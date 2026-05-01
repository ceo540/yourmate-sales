import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// worker_engagement archive_status 변경 (삭제 X — §4.6.1.a 정책)
// POST /api/admin/worker-engagement-archive
//   body: { engagement_id, archive_status: 'pending' | 'cancelled' | 'archived' | 'active' }
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '로그인 필요' }, { status: 401 })

  const body = await req.json().catch(() => null) as null | { engagement_id?: string; archive_status?: string }
  if (!body?.engagement_id || !body.archive_status) {
    return NextResponse.json({ error: 'engagement_id, archive_status 필수' }, { status: 400 })
  }
  if (!['active', 'pending', 'cancelled', 'archived'].includes(body.archive_status)) {
    return NextResponse.json({ error: 'archive_status 잘못됨' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('worker_engagements')
    .update({ archive_status: body.archive_status })
    .eq('id', body.engagement_id)
    .select('id, worker_id')
    .maybeSingle()
  if (error || !data) return NextResponse.json({ error: error?.message ?? '갱신 실패' }, { status: 400 })

  return NextResponse.json({ success: true, engagement: data })
}
