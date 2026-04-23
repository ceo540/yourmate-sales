import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { updateEvent, deleteEvent } from '@/lib/google-calendar'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: eventId } = await params
  const body = await req.json()
  const { calendarKey, ...data } = body
  if (!calendarKey) return NextResponse.json({ error: 'calendarKey 필요' }, { status: 400 })

  try {
    const event = await updateEvent(calendarKey, eventId, data)
    return NextResponse.json({ event })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: eventId } = await params
  const { searchParams } = new URL(req.url)
  const calendarKey = searchParams.get('calendarKey')
  if (!calendarKey) return NextResponse.json({ error: 'calendarKey 필요' }, { status: 400 })

  try {
    await deleteEvent(calendarKey, eventId)
    return NextResponse.json({ success: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
