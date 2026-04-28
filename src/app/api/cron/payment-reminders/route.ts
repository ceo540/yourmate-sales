import { NextRequest, NextResponse } from 'next/server'
import { runPaymentReminders } from '@/lib/payment-reminders'

export const maxDuration = 60

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const auth = req.headers.get('authorization') ?? ''
  return auth === `Bearer ${secret}`
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const dryRun = url.searchParams.get('dryRun') === '1'
  const todayOverride = url.searchParams.get('today')

  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  try {
    const result = await runPaymentReminders({
      dryRun,
      ...(todayOverride ? { todayKst: todayOverride } : {}),
    })
    return NextResponse.json(result)
  } catch (e: any) {
    console.error('[cron/payment-reminders] error:', e)
    return NextResponse.json({ error: e?.message ?? String(e) }, { status: 500 })
  }
}
