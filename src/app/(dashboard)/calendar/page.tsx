import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import CalendarClient, { CalEvent } from './CalendarClient'

export default async function CalendarPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const currentYear = new Date().getFullYear()

  const [{ data: deliveries }, { data: concerts }] = await Promise.all([
    supabase.from('rental_deliveries')
      .select('id, rental_id, delivery_date, pickup_date')
      .or('delivery_date.not.is.null,pickup_date.not.is.null'),
    admin.from('sos_concerts')
      .select('id, name, year, month')
      .gte('year', currentYear),
  ])

  const events: CalEvent[] = []

  for (const d of deliveries ?? []) {
    if (d.delivery_date) {
      events.push({
        id: `del-${d.id}`,
        title: '렌탈 배송',
        date: d.delivery_date,
        type: 'rental_delivery',
        color: '#D97706',
        href: `/rentals/${d.rental_id}`,
      })
    }
    if (d.pickup_date) {
      events.push({
        id: `pick-${d.id}`,
        title: '렌탈 수거',
        date: d.pickup_date,
        type: 'rental_pickup',
        color: '#EF4444',
        href: `/rentals/${d.rental_id}`,
      })
    }
  }

  for (const c of concerts ?? []) {
    const mm = String(c.month).padStart(2, '0')
    events.push({
      id: `sos-${c.id}`,
      title: c.name ?? 'SOS 공연',
      date: `${c.year}-${mm}-01`,
      type: 'sos',
      color: '#7C3AED',
      href: '/sos',
    })
  }

  const today = new Date().toISOString().slice(0, 10)

  return (
    <div className="max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">캘린더</h1>
        <p className="text-gray-500 text-sm mt-1">배송 · 수거 · 공연 일정 한눈에</p>
      </div>
      <CalendarClient events={events} today={today} />
    </div>
  )
}
