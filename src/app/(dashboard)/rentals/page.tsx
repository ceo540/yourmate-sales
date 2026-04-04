import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import RentalsClient from './RentalsClient'

export default async function RentalsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: rentalsRaw }, { data: allItems }, { data: profilesRaw }, { data: customersRaw }] = await Promise.all([
    supabase.from('rentals').select('*').order('created_at', { ascending: false }),
    supabase.from('rental_items').select('*').order('created_at'),
    supabase.from('profiles').select('id, name').order('name'),
    supabase.from('customers').select('id, name, type').order('name'),
  ])

  const profileMap = Object.fromEntries((profilesRaw ?? []).map(p => [p.id, p.name]))

  // 렌탈별 품목 그룹핑
  const itemsByRental: Record<string, typeof allItems> = {}
  for (const item of allItems ?? []) {
    if (!itemsByRental[item.rental_id]) itemsByRental[item.rental_id] = []
    itemsByRental[item.rental_id]!.push(item)
  }

  const rentals = (rentalsRaw ?? []).map((r: any) => ({
    ...r,
    assignee_name: r.assignee_id ? (profileMap[r.assignee_id] ?? null) : null,
    items: itemsByRental[r.id] ?? [],
  }))

  return (
    <RentalsClient
      rentals={rentals}
      profiles={profilesRaw ?? []}
      customers={customersRaw ?? []}
    />
  )
}
