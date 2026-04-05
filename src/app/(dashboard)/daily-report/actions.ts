'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

export async function upsertDailyReport(
  reportDate: string,
  data: { tasks_done?: string; issues?: string; tomorrow_plan?: string; status?: string }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const admin = createAdminClient()
  const { error } = await admin.from('daily_reports').upsert(
    {
      user_id: user.id,
      report_date: reportDate,
      ...data,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,report_date' }
  )

  if (error) throw new Error(error.message)
  revalidatePath('/daily-report')
}

export async function getMyRecentReports(userId: string, limit = 7) {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('daily_reports')
    .select('id, report_date, tasks_done, issues, tomorrow_plan, status')
    .eq('user_id', userId)
    .order('report_date', { ascending: false })
    .limit(limit)
  if (error) return []
  return data ?? []
}

export async function getAllReportsForDate(date: string) {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('daily_reports')
    .select('id, report_date, tasks_done, issues, tomorrow_plan, status, user:user_id(name)')
    .eq('report_date', date)
    .order('created_at', { ascending: true })
  if (error) return []
  return data ?? []
}
