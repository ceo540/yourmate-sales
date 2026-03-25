import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  // 현재 로그인 사용자가 admin인지 확인
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: '인증 필요' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: '관리자 권한 필요' }, { status: 403 })
  }

  const { email, name, department, role } = await request.json()

  if (!email || !name) {
    return NextResponse.json({ error: '이메일과 이름은 필수입니다' }, { status: 400 })
  }

  const admin = createAdminClient()

  // 임시 비밀번호로 사용자 생성 (이메일로 링크 전송)
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { name, department: department || null },
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  // profiles 테이블에 role 설정
  if (data.user) {
    await admin
      .from('profiles')
      .update({ role: role || 'member' })
      .eq('id', data.user.id)
  }

  return NextResponse.json({ success: true, userId: data.user?.id })
}
