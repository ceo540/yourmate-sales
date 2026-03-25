import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    serviceKeyLength: process.env.SUPABASE_SERVICE_ROLE_KEY?.length ?? 0,
    hasUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    nodeEnv: process.env.NODE_ENV,
  })
}
