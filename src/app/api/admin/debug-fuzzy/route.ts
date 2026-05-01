import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { fuzzyMatch } from '@/lib/fuzzy-search'

// 디버그: 운영에서 진짜 fuzzy 동작하는지 확인
// GET /api/admin/debug-fuzzy?type=projects&query=용인%20미르아이밴드캠프
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '로그인 필요' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type') ?? 'projects'
  const query = searchParams.get('query') ?? ''
  if (!query) return NextResponse.json({ error: 'query 필수' }, { status: 400 })

  const admin = createAdminClient()

  if (type === 'projects') {
    // 1차 ILIKE
    const { data: exact } = await admin
      .from('projects')
      .select('id, name, project_number, status')
      .or(`name.ilike.%${query}%,project_number.ilike.%${query}%`)
      .neq('status', '취소')
      .limit(10)

    let mode = 'exact'
    let result = exact ?? []

    if (result.length === 0) {
      const { data: all } = await admin
        .from('projects').select('id, name, project_number, status').neq('status', '취소')
      const fb = fuzzyMatch(all ?? [], query, ['name', 'project_number'])
      result = fb.matched.slice(0, 10)
      mode = fb.mode === 'none' ? 'exact' : fb.mode
    }

    return NextResponse.json({ query, mode, count: result.length, results: result })
  }

  if (type === 'workers') {
    const { data: exact } = await admin
      .from('external_workers')
      .select('id, name, type, phone, default_rate')
      .ilike('name', `%${query}%`)
      .eq('archive_status', 'active')
      .limit(10)

    let mode = 'exact'
    let result = exact ?? []

    if (result.length === 0) {
      const { data: all } = await admin
        .from('external_workers').select('id, name, type, phone, default_rate')
        .eq('archive_status', 'active')
      const fb = fuzzyMatch(all ?? [], query, ['name', 'phone'])
      result = fb.matched.slice(0, 10)
      mode = fb.mode === 'none' ? 'exact' : fb.mode
    }

    return NextResponse.json({ query, mode, count: result.length, results: result })
  }

  return NextResponse.json({ error: 'type=projects|workers' }, { status: 400 })
}
