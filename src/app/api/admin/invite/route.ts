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

  const { email, name, departments, role, existingProfileId } = await request.json()

  if (!email || !name) {
    return NextResponse.json({ error: '이메일과 이름은 필수입니다' }, { status: 400 })
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY 환경변수가 설정되지 않았습니다' }, { status: 500 })
  }

  try {
    const admin = createAdminClient()

    const origin = process.env.NEXT_PUBLIC_APP_URL ?? request.nextUrl.origin
    const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
      data: { name },
      redirectTo: `${origin}/auth/callback?type=invite`,
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    if (data.user) {
      if (existingProfileId) {
        // 기존 프로필 데이터 조회 후 새 auth UUID로 이관
        const { data: oldProfile } = await admin.from('profiles').select('*').eq('id', existingProfileId).single()
        await admin.from('profiles').upsert({
          id: data.user.id,
          name: oldProfile?.name ?? name,
          departments: oldProfile?.departments ?? departments ?? [],
          role: oldProfile?.role ?? role ?? 'member',
          join_date: (oldProfile as any)?.join_date ?? null,
          entity_id: (oldProfile as any)?.entity_id ?? null,
          phone: (oldProfile as any)?.phone ?? null,
          emergency_name: (oldProfile as any)?.emergency_name ?? null,
          emergency_phone: (oldProfile as any)?.emergency_phone ?? null,
          bank_name: (oldProfile as any)?.bank_name ?? null,
          account_number: (oldProfile as any)?.account_number ?? null,
          birth_date: (oldProfile as any)?.birth_date ?? null,
        })
        // employee_cards.profile_id 갱신
        await admin.from('employee_cards').update({ profile_id: data.user.id }).eq('profile_id', existingProfileId)
        // 기존 프로필 삭제
        await admin.from('profiles').delete().eq('id', existingProfileId)
      } else {
        await admin
          .from('profiles')
          .upsert({ id: data.user.id, name, departments: departments ?? [], role: role || 'member' })
          .eq('id', data.user.id)
      }
    }

    return NextResponse.json({ success: true, userId: data.user?.id })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? '서버 오류가 발생했습니다' }, { status: 500 })
  }
}
