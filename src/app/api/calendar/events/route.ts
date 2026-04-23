import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { listEvents, createEvent } from '@/lib/google-calendar'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const year = parseInt(searchParams.get('year') ?? String(new Date().getFullYear()))
  const month = parseInt(searchParams.get('month') ?? String(new Date().getMonth()))

  try {
    const events = await listEvents(year, month)
    return NextResponse.json({ events })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { calendarKey, title, date, endDate, startTime, endTime, description, isAllDay } = body
  if (!calendarKey || !title || !date) {
    return NextResponse.json({ error: 'calendarKey, title, date 필요' }, { status: 400 })
  }

  try {
    const event = await createEvent(calendarKey, { title, date, endDate, startTime, endTime, description, isAllDay })
    return NextResponse.json({ event })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
