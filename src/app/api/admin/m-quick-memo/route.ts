import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// 모바일 빠른 메모 저장 (yourmate-spec.md §4.7)
// project_memos 테이블에 INSERT
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '로그인 필요' }, { status: 401 })

  const body = await req.json().catch(() => null) as null | { project_id?: string; title?: string; content?: string }
  if (!body?.project_id || !body.content) {
    return NextResponse.json({ error: 'project_id, content 필수' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('project_memos')
    .insert({
      project_id: body.project_id,
      title: body.title ?? '현장 메모',
      content: body.content,
      author_id: user.id,
    })
    .select('id')
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ success: true, id: data?.id })
}
