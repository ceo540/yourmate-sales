import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import RentalsClient from './RentalsClient'

export default async function RentalsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: rentalsRaw }, { data: itemCounts }, { data: profilesRaw }] = await Promise.all([
    supabase.from('rentals').select('*').order('created_at', { ascending: false }),
    supabase.from('rental_items').select('rental_id'),
    supabase.from('profiles').select('id, name').order('name'),
  ])

  const profileMap = Object.fromEntries((profilesRaw ?? []).map(p => [p.id, p.name]))

  // 계약별 품목 수 집계
  const countMap: Record<string, number> = {}
  for (const item of itemCounts ?? []) {
    countMap[item.rental_id] = (countMap[item.rental_id] || 0) + 1
  }

  const rentals = (rentalsRaw ?? []).map((r: any) => ({
    ...r,
    assignee_name: r.assignee_id ? (profileMap[r.assignee_id] ?? null) : null,
    items_count: countMap[r.id] ?? 0,
  }))

  return (
    <RentalsClient
      rentals={rentals}
      profiles={profilesRaw ?? []}
    />
  )
}