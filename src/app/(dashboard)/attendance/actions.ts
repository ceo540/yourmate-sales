'use server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export interface AttendanceRecord {
  id?: string
  employee_name: string
  employee_no: number | null
  work_date: string
  check_in: string | null
  check_out: string | null
  work_minutes: number | null
  late_minutes: number
  early_leave_minutes: number
  is_absent: boolean
  year_month: string
}

export interface Holiday {
  id: string
  holiday_date: string
  name: string
}

export interface WorkSchedule {
  id?: string
  employee_name: string
  work_start: string // HH:MM
  work_end: string   // HH:MM
}

/* ── 근태 기록 ── */
export async function saveAttendanceRecords(records: AttendanceRecord[]) {
  const supabase = createAdminClient()
  const yearMonths = [...new Set(records.map(r => r.year_month))]
  for (const ym of yearMonths) {
    await supabase.from('attendance_records').delete().eq('year_month', ym)
  }
  const { error } = await supabase.from('attendance_records').insert(records)
  if (error) throw new Error(error.message)
  return { success: true, count: records.length }
}

export async function getAttendanceByMonth(yearMonth: string) {
  const supabase = createAdminClient()
  const clientSupabase = await createClient()
  const { data: { user } } = await clientSupabase.auth.getUser()
  if (!user) return []

  const { data: profile } = await supabase
    .from('profiles').select('role, name').eq('id', user.id).single()

  let query = supabase
    .from('attendance_records')
    .select('*')
    .eq('year_month', yearMonth)
    .order('employee_name')
    .order('work_date')

  if (profile?.role === 'member') {
    query = query.eq('employee_name', profile.name)
  }

  const { data, error } = await query
  if (error) return []
  return data as AttendanceRecord[]
}

export async function getAvailableMonths() {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('attendance_records')
    .select('year_month')
    .order('year_month', { ascending: false })
  return [...new Set(data?.map(r => r.year_month) || [])] as string[]
}

/* ── 공휴일 ── */
export async function getHolidays() {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('public_holidays')
    .select('*')
    .order('holiday_date')
  return (data || []) as Holiday[]
}

export async function addHoliday(date: string, name: string) {
  const supabase = createAdminClient()
  const { error } = await supabase.from('public_holidays').insert({ holiday_date: date, name })
  if (error) throw new Error(error.message)
}

export async function deleteHoliday(id: string) {
  const supabase = createAdminClient()
  await supabase.from('public_holidays').delete().eq('id', id)
}

/* ── 직원별 근무시간 ── */
export async function getWorkSchedules() {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('employee_work_schedules')
    .select('*')
    .order('employee_name')
  return (data || []) as WorkSchedule[]
}

export async function upsertWorkSchedule(schedule: WorkSchedule) {
  const supabase = createAdminClient()
  const { error } = await supabase.from('employee_work_schedules').upsert(
    { employee_name: schedule.employee_name, work_start: schedule.work_start, work_end: schedule.work_end, updated_at: new Date().toISOString() },
    { onConflict: 'employee_name' }
  )
  if (error) throw new Error(error.message)
}
