import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { createProfileNameMap } from '@/lib/utils'
import RentalDetailClient from './RentalDetailClient'

export default async function RentalDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: rental }, { data: items }, { data: profilesRaw }, { data: deliveries }, { data: linkedRentals }, { data: linkableRaw }] = await Promise.all([
    supabase.from('rentals').select('*').eq('id', id).single(),
    supabase.from('rental_items').select('*').eq('rental_id', id).order('created_at'),
    supabase.from('profiles').select('id, name').order('name'),
    supabase.from('rental_deliveries').select('*').eq('rental_id', id).order('delivery_date', { ascending: true }),
    supabase.from('rentals').select('id, title, customer_name, status, rental_start, rental_end, total_amount').eq('parent_rental_id', id).order('rental_start', { ascending: true }),
    supabase.from('rentals').select('id, title, customer_name, status, rental_start, rental_end, total_amount').is('parent_rental_id', null).neq('id', id).order('created_at', { ascending: false }),
  ])

  if (!rental) notFound()

  const profileMap = createProfileNameMap(profilesRaw)

  return (
    <RentalDetailClient
      rental={{
        ...rental,
        assignee_name: rental.assignee_id ? (profileMap[rental.assignee_id] ?? null) : null,
        content:       rental.content ?? null,
        dropbox_url:   rental.dropbox_url ?? null,
        contact_1:     rental.contact_1 ?? null,
        contact_2:     rental.contact_2 ?? null,
        contact_3:     rental.contact_3 ?? null,
        items:         items ?? [],
        deliveries:    deliveries ?? [],
        linkedRentals: linkedRentals ?? [],
      }}
      linkableRentals={linkableRaw ?? []}
      profiles={profilesRaw ?? []}
    />
  )
}
