import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import AttendanceClient from './AttendanceClient'
import { AttendanceRecord, Holiday, WorkSchedule } from './actions'

export default async function AttendancePage() {
  const supabase = createAdminClient()
  const clientSupabase = await createClient()

  const { data: { user } } = await clientSupabase.auth.getUser()
  const { data: profile } = await supabase
    .from('profiles').select('role, name').eq('id', user!.id).single()

  const isAdmin = profile?.role === 'admin' || profile?.role === 'manager'

  const [{ data: monthsRaw }, { data: holidaysRaw }, { data: schedulesRaw }] = await Promise.all([
    supabase.from('attendance_records').select('year_month').order('year_month', { ascending: false }),
    supabase.from('public_holidays').select('*').order('holiday_date'),
    supabase.from('employee_work_schedules').select('*').order('employee_name'),
  ])

  const months = [...new Set(monthsRaw?.map((r: { year_month: string }) => r.year_month) || [])] as string[]
  const holidays = (holidaysRaw || []) as Holiday[]
  const schedules = (schedulesRaw || []) as WorkSchedule[]
  const latestMonth = months[0] || null

  let records: AttendanceRecord[] = []
  if (latestMonth) {
    let query = supabase
      .from('attendance_records')
      .select('*')
      .eq('year_month', latestMonth)
      .order('employee_name')
      .order('work_date')

    if (!isAdmin) query = query.eq('employee_name', profile?.name || '')
    const { data } = await query
    records = (data || []) as AttendanceRecord[]
  }

  return (
    <AttendanceClient
      months={months}
      initialRecords={records}
      initialMonth={latestMonth}
      isAdmin={isAdmin}
      myName={profile?.name || ''}
      holidays={holidays}
      schedules={schedules}
    />
  )
}
