import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const type = searchParams.get('type')

  if (code) {
    const supabase = await createClient()
    await supabase.auth.exchangeCodeForSession(code)
  }

  // 초대 링크인 경우 비밀번호 설정 페이지로
  if (type === 'invite') {
    return NextResponse.redirect(`${origin}/set-password`)
  }

  return NextResponse.redirect(`${origin}/sales`)
}
