import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { isAdminOrManager } from '@/lib/permissions'
import DailyReportClient from './DailyReportClient'

export default async function DailyReportPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const { data: profile } = await supabase.from('profiles').select('id, role, name').eq('id', user.id).single()
  const isAdmin = isAdminOrManager(profile?.role)
  const today = new Date().toISOString().slice(0, 10)

  // 내 담당 업무 목록 (링크용)
  const { data: myTasks } = await admin
    .from('tasks')
    .select('id, title, status, project_id')
    .eq('assignee_id', user.id)
    .not('status', 'eq', 'done')
    .order('due_date', { ascending: true, nullsFirst: false })
    .limit(50)

  // 테이블 없을 때 graceful fallback
  let myReports: any[] = []
  let todayTeamReports: any[] = []
  let profiles: any[] = []
  let tableExists = true

  try {
    const { data: reports, error } = await admin
      .from('daily_reports')
      .select('id, report_date, tasks_done, issues, tomorrow_plan, status, linked_task_ids')
      .eq('user_id', user.id)
      .order('report_date', { ascending: false })
      .limit(7)

    if (error && error.message.includes('does not exist')) {
      tableExists = false
    } else {
      myReports = reports ?? []
    }

    if (tableExists && isAdmin) {
      const { data: team } = await admin
        .from('daily_reports')
        .select('id, report_date, tasks_done, issues, tomorrow_plan, status, user:user_id(name)')
        .eq('report_date', today)
      todayTeamReports = team ?? []

      const { data: allProfiles } = await admin
        .from('profiles')
        .select('id, name')
        .order('name')
      profiles = allProfiles ?? []
    }
  } catch {
    tableExists = false
  }

  if (!tableExists) {
    return (
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">일일업무표</h1>
        <div className="bg-orange-50 border border-orange-200 rounded-2xl p-6">
          <p className="text-sm font-semibold text-orange-700 mb-3">Supabase에 테이블을 먼저 생성해주세요</p>
          <p className="text-xs text-orange-600 mb-3">아래 SQL을 Supabase SQL Editor에서 실행하세요:</p>
          <pre className="bg-white border border-orange-100 rounded-xl p-4 text-xs text-gray-700 overflow-x-auto whitespace-pre">{`create table daily_reports (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) not null,
  report_date date not null default current_date,
  tasks_done text,
  issues text,
  tomorrow_plan text,
  status text not null default '작성중'
    check (status in ('작성중', '제출완료')),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, report_date)
);

alter table daily_reports enable row level security;

create policy "users manage own daily reports"
on daily_reports for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "admins view all daily reports"
on daily_reports for select
using (
  exists (
    select 1 from profiles
    where id = auth.uid()
    and role in ('admin', 'manager')
  )
);`}</pre>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-gray-900">일일업무표</h1>
        <p className="text-sm text-gray-400 mt-1">매일 업무를 기록하고 팀과 공유하세요</p>
      </div>
      <DailyReportClient
        myReports={myReports}
        todayTeamReports={todayTeamReports}
        profiles={profiles}
        currentUserId={user.id}
        isAdmin={isAdmin}
        today={today}
        myTasks={myTasks ?? []}
      />
    </div>
  )
}
