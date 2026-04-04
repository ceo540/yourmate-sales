import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import RentalDetailClient from './RentalDetailClient'

export default async function RentalDetailPage({ params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: rental }, { data: items }, { data: profilesRaw }] = await Promise.all([
    supabase.from('rentals').select('*').eq('id', params.id).single(),
    supabase.from('rental_items').select('*').eq('rental_id', params.id).order('created_at'),
    supabase.from('profiles').select('id, name').order('name'),
  ])

  if (!rental) notFound()

  const profileMap = Object.fromEntries((profilesRaw ?? []).map(p => [p.id, p.name]))

  return (
    <RentalDetailClient
      rental={{
        ...rental,
        assignee_name: rental.assignee_id ? (profileMap[rental.assignee_id] ?? null) : null,
        items: items ?? [],
      }}
      profiles={profilesRaw ?? []}
    />
  )
}
