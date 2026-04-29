import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { createProfileNameMap } from '@/lib/utils'
import RentalsClient from './RentalsClient'

export default async function RentalsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()

  const [
    { data: rentalsRaw },
    { data: allItems },
    { data: profilesRaw },
    { data: customersRaw },
    { data: projectsRaw },
  ] = await Promise.all([
    supabase.from('rentals').select('*').order('created_at', { ascending: false }),
    supabase.from('rental_items').select('*').order('created_at'),
    admin.from('profiles').select('id, name').order('name'),
    admin.from('customers').select('id, name, type').order('name'),
    admin.from('projects').select('id, name, project_number, customer_id, status').order('created_at', { ascending: false }).limit(500),
  ])

  const profileMap = createProfileNameMap(profilesRaw)

  // 프로젝트 → 고객명 수동 조인 (CLAUDE.md FK 조인 금지)
  const customerNameMap = Object.fromEntries((customersRaw ?? []).map(c => [c.id, c.name]))
  const projects = (projectsRaw ?? []).map(p => ({
    id: p.id,
    name: p.name,
    project_number: p.project_number ?? null,
    customer_name: p.customer_id ? (customerNameMap[p.customer_id] ?? null) : null,
    status: p.status ?? null,
  }))
  const projectMap = Object.fromEntries(projects.map(p => [p.id, p]))

  // 렌탈별 품목 그룹핑
  const itemsByRental: Record<string, typeof allItems> = {}
  for (const item of allItems ?? []) {
    if (!itemsByRental[item.rental_id]) itemsByRental[item.rental_id] = []
    itemsByRental[item.rental_id]!.push(item)
  }

  const rentals = (rentalsRaw ?? []).map((r: any) => ({
    ...r,
    assignee_name: r.assignee_id ? (profileMap[r.assignee_id] ?? null) : null,
    project_name: r.project_id ? (projectMap[r.project_id]?.name ?? null) : null,
    items: itemsByRental[r.id] ?? [],
  }))

  return (
    <RentalsClient
      rentals={rentals}
      profiles={profilesRaw ?? []}
      customers={customersRaw ?? []}
      projects={projects}
    />
  )
}
