import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: '관리자 권한 필요' }, { status: 403 })
  }

  const admin = createAdminClient()
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, name, departments, role, created_at')
    .order('created_at', { ascending: false })

  // auth.users에서 마지막 로그인 시간 가져오기
  const { data: authUsers } = await admin.auth.admin.listUsers()
  const authMap = new Map(authUsers?.users?.map(u => [u.id, {
    email: u.email,
    last_sign_in_at: u.last_sign_in_at,
    confirmed_at: u.confirmed_at,
  }]))

  const users = (profiles ?? []).map(p => {
    const rawDepts = (p as any).departments
    const departments: string[] = Array.isArray(rawDepts) ? rawDepts : (typeof rawDepts === 'string' ? (() => { try { return JSON.parse(rawDepts) } catch { return [] } })() : [])
    return {
      ...p,
      departments,
      email: authMap.get(p.id)?.email ?? null,
      last_sign_in_at: authMap.get(p.id)?.last_sign_in_at ?? null,
      confirmed_at: authMap.get(p.id)?.confirmed_at ?? null,
    }
  })

  return NextResponse.json({ users })
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: '관리자 권한 필요' }, { status: 403 })
  }

  const { userId } = await request.json()

  if (userId === user.id) {
    return NextResponse.json({ error: '자기 자신은 삭제할 수 없습니다' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { error } = await admin.auth.admin.deleteUser(userId)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({ success: true })
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: '관리자 권한 필요' }, { status: 403 })
  }

  const { userId, role, departments } = await request.json()

  if (userId === user.id && role) {
    return NextResponse.json({ error: '자신의 권한은 변경할 수 없습니다' }, { status: 400 })
  }

  const updateData: Record<string, unknown> = {}
  if (role !== undefined) updateData.role = role
  if (departments !== undefined) updateData.departments = departments

  const { error } = await supabase
    .from('profiles')
    .update(updateData)
    .eq('id', userId)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({ success: true })
}
