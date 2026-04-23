import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { isAdminOrManager } from '@/lib/permissions'
import WeeklyReportClient from './WeeklyReportClient'
import { getRecentWeeks } from './utils'

export default async function WeeklyReportPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, name, role')
    .eq('id', user.id)
    .single()

  const isAdmin = isAdminOrManager(profile?.role)

  // 최근 8주치 보고서 조회
  const weeks = getRecentWeeks(8)
  const starts = weeks.map(w => w.start)

  // 내 보고서
  const { data: myReports } = await supabase
    .from('weekly_reports')
    .select('*')
    .eq('user_id', user.id)
    .in('week_start', starts)
    .order('week_start', { ascending: false })

  // 관리자면 모든 팀원 보고서도 조회
  let allReports: any[] = []
  let profiles: any[] = []

  if (isAdmin) {
    const { data: allRaw } = await supabase
      .from('weekly_reports')
      .select('*, profiles(id, name)')
      .in('week_start', starts)
      .order('week_start', { ascending: false })
    allReports = allRaw ?? []

    const { data: profilesRaw } = await supabase
      .from('profiles')
      .select('id, name, role')
      .in('role', ['admin', 'manager', 'member'])
      .order('name')
    profiles = profilesRaw ?? []
  }

  return (
    <WeeklyReportClient
      currentUserId={user.id}
      currentUserName={profile?.name ?? ''}
      isAdmin={isAdmin}
      weeks={weeks}
      myReports={myReports ?? []}
      allReports={allReports}
      profiles={profiles}
    />
  )
}
