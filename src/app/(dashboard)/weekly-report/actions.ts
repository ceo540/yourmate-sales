'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function upsertWeeklyReport(data: {
  week_start: string
  week_end: string
  this_week_done: string
  next_week_todo: string
  issues: string
  ideas: string
  support_needed: string
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '로그인 필요' }

  // 같은 주차 기존 보고서 있는지 확인
  const { data: existing } = await supabase
    .from('weekly_reports')
    .select('id')
    .eq('user_id', user.id)
    .eq('week_start', data.week_start)
    .single()

  if (existing) {
    await supabase.from('weekly_reports').update({
      ...data,
      submitted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', existing.id)
  } else {
    await supabase.from('weekly_reports').insert({
      user_id: user.id,
      ...data,
      submitted_at: new Date().toISOString(),
    })
  }

  revalidatePath('/weekly-report')
  return { success: true }
}

export async function saveWeeklyReportDraft(data: {
  week_start: string
  week_end: string
  this_week_done: string
  next_week_todo: string
  issues: string
  ideas: string
  support_needed: string
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '로그인 필요' }

  const { data: existing } = await supabase
    .from('weekly_reports')
    .select('id')
    .eq('user_id', user.id)
    .eq('week_start', data.week_start)
    .single()

  if (existing) {
    await supabase.from('weekly_reports').update({
      ...data,
      updated_at: new Date().toISOString(),
    }).eq('id', existing.id)
  } else {
    await supabase.from('weekly_reports').insert({
      user_id: user.id,
      ...data,
    })
  }

  revalidatePath('/weekly-report')
  return { success: true }
}

export async function addFeedback(reportId: string, feedback: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '로그인 필요' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || !['admin', 'manager'].includes(profile.role)) {
    return { error: '권한 없음' }
  }

  await supabase.from('weekly_reports')
    .update({ feedback, updated_at: new Date().toISOString() })
    .eq('id', reportId)

  revalidatePath('/weekly-report')
  return { success: true }
}
