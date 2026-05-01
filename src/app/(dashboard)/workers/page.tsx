import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { isAdminOrManager } from '@/lib/permissions'
import WorkersClient from './WorkersClient'
import type { ExternalWorker, WorkerEngagement, WorkerPayment } from '@/types'

export default async function WorkersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('id, role').eq('id', user.id).single()
  const isAdmin = isAdminOrManager(profile?.role)

  const [{ data: workersRaw }, { data: engagementsRaw }, { data: paymentsRaw }, { data: projectsRaw }] = await Promise.all([
    admin.from('external_workers').select('*').eq('archive_status', 'active').order('name'),
    admin.from('worker_engagements').select('*').eq('archive_status', 'active').order('date_start', { ascending: false }),
    admin.from('worker_payments').select('*').eq('archive_status', 'active').order('created_at', { ascending: false }),
    admin.from('projects').select('id, name, project_number'),
  ])

  const projectMap = new Map((projectsRaw ?? []).map(p => [p.id, { name: p.name, number: p.project_number }]))

  return (
    <WorkersClient
      workers={(workersRaw ?? []) as ExternalWorker[]}
      engagements={(engagementsRaw ?? []) as WorkerEngagement[]}
      payments={(paymentsRaw ?? []) as WorkerPayment[]}
      projectMap={Object.fromEntries(projectMap)}
      isAdmin={isAdmin}
      currentUserId={user.id}
    />
  )
}
