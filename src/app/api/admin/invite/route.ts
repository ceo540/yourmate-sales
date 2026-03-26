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

  const { email, name, departments, role } = await request.json()

  if (!email || !name) {
    return NextResponse.json({ error: '이메일과 이름은 필수입니다' }, { status: 400 })
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY 환경변수가 설정되지 않았습니다' }, { status: 500 })
  }

  try {
    const admin = createAdminClient()

    const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
      data: { name },
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    // profiles 테이블에 role 설정 (초대 수락 후 트리거로 생성되므로 실패해도 무시)
    if (data.user) {
      await admin
        .from('profiles')
        .upsert({ id: data.user.id, name, departments: departments ?? [], role: role || 'member' })
        .eq('id', data.user.id)
    }

    return NextResponse.json({ success: true, userId: data.user?.id })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? '서버 오류가 발생했습니다' }, { status: 500 })
  }
}
