import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect, notFound } from 'next/navigation'
import { createProfileNameMap } from '@/lib/utils'
import RentalDetailClient from './RentalDetailClient'

export default async function RentalDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()

  const [
    { data: rental },
    { data: items },
    { data: profilesRaw },
    { data: projectsRaw },
    { data: customersRaw },
  ] = await Promise.all([
    supabase.from('rentals').select('*').eq('id', id).single(),
    supabase.from('rental_items').select('*').eq('rental_id', id).order('created_at'),
    admin.from('profiles').select('id, name').order('name'),
    admin.from('projects').select('id, name, project_number, customer_id, status').order('created_at', { ascending: false }).limit(500),
    admin.from('customers').select('id, name'),
  ])

  if (!rental) notFound()

  const profileMap = createProfileNameMap(profilesRaw)
  const customerNameMap = Object.fromEntries((customersRaw ?? []).map(c => [c.id, c.name]))
  const projects = (projectsRaw ?? []).map(p => ({
    id: p.id,
    name: p.name,
    project_number: p.project_number ?? null,
    customer_name: p.customer_id ? (customerNameMap[p.customer_id] ?? null) : null,
    status: p.status ?? null,
  }))
  const linkedProject = rental.project_id ? projects.find(p => p.id === rental.project_id) ?? null : null

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
        project_id:    rental.project_id ?? null,
      }}
      linkedProject={linkedProject}
      projects={projects}
      profiles={profilesRaw ?? []}
    />
  )
}
