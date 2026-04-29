import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // 외부 웹훅 — 인증 없이 통과 (라우트 자체에서 검증)
  if (request.nextUrl.pathname.startsWith('/api/channeltalk')) {
    return NextResponse.next()
  }
  // Cron 라우트 — Vercel cron + 자체 Bearer 토큰 검증 (라우트 안에서)
  if (request.nextUrl.pathname.startsWith('/api/cron')) {
    return NextResponse.next()
  }

  if (request.nextUrl.pathname.startsWith('/register')) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  const isAuthPage =
    request.nextUrl.pathname.startsWith('/login') ||
    request.nextUrl.pathname.startsWith('/set-password') ||
    request.nextUrl.pathname.startsWith('/auth/callback')

  if (!user && !isAuthPage) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (user && isAuthPage) {
    return NextResponse.redirect(new URL('/sales', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
