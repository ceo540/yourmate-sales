// 회의 페이지 (yourmate-spec.md §5.9)
// admin only — 검증 단계.

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { isAdminOrManager } from '@/lib/permissions'
import MeetingsClient from './MeetingsClient'
import type { MeetingRecord, Decision } from '@/types'

export default async function MeetingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('id, role').eq('id', user.id).single()
  const isAdmin = isAdminOrManager(profile?.role)
  if (!isAdmin) {
    return <div className="p-8 text-gray-500">관리자만 접근 가능 (회의 관리는 검증 단계)</div>
  }

  const [{ data: meetingsRaw }, { data: decisionsRaw }, { data: projectsRaw }, { data: profilesRaw }] = await Promise.all([
    admin.from('meetings').select('*').eq('archive_status', 'active').order('date', { ascending: false }).limit(200),
    admin.from('decisions').select('*').eq('archive_status', 'active').order('decided_at', { ascending: false }).limit(200),
    admin.from('projects').select('id, name, project_number'),
    admin.from('profiles').select('id, name'),
  ])

  const projectMap = Object.fromEntries(
    (projectsRaw ?? []).map(p => [p.id, { name: p.name, number: p.project_number }]),
  )
  const profileMap = Object.fromEntries((profilesRaw ?? []).map(p => [p.id, p.name]))

  return (
    <MeetingsClient
      meetings={(meetingsRaw ?? []) as MeetingRecord[]}
      decisions={(decisionsRaw ?? []) as Decision[]}
      projectMap={projectMap}
      profileMap={profileMap}
      currentUserId={user.id}
    />
  )
}
