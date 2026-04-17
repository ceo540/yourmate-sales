import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getWeekRange, getWeekLabel } from '../weekly-report/utils'

function formatMoney(n: number) {
  if (n >= 100000000) return `${(n / 100000000).toFixed(1)}억원`
  if (n >= 10000000) return `${Math.round(n / 10000000) * 10}백만원`
  if (n >= 10000) return `${Math.round(n / 10000)}만원`
  return n.toLocaleString() + '원'
}

function formatDate(d: string | null) {
  if (!d) return '-'
  return new Date(d).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
}

function formatDue(d: string | null) {
  if (!d) return null
  const date = new Date(d)
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const diff = Math.ceil((date.getTime() - today.getTime()) / 86400000)
  if (diff < 0) return { label: `D${diff}`, color: 'text-red-500 font-bold' }
  if (diff === 0) return { label: 'D-day', color: 'text-red-500 font-bold' }
  if (diff <= 3) return { label: `D-${diff}`, color: 'text-orange-500 font-semibold' }
  if (diff <= 7) return { label: `D-${diff}`, color: 'text-yellow-600 font-medium' }
  return { label: `D-${diff}`, color: 'text-gray-400' }
}

const CONTRACT_STAGE_COLORS: Record<string, string> = {
  '계약': 'bg-blue-50 text-blue-600',
  '착수': 'bg-purple-50 text-purple-600',
  '선금': 'bg-yellow-50 text-yellow-700',
  '중도금': 'bg-orange-50 text-orange-600',
  '완수': 'bg-teal-50 text-teal-600',
  '계산서발행': 'bg-indigo-50 text-indigo-600',
  '잔금': 'bg-green-50 text-green-600',
}

const STATUS_STYLE: Record<string, string> = {
  '할 일':  'bg-gray-100 text-gray-600',
  '진행중': 'bg-blue-100 text-blue-700',
  '검토중': 'bg-yellow-100 text-yellow-700',
  '완료':   'bg-green-100 text-green-700',
  '보류':   'bg-red-100 text-red-600',
}

const RENTAL_STATUS_COLORS: Record<string, string> = {
  '진행전': 'bg-gray-100 text-gray-500',
  '배송완료': 'bg-blue-50 text-blue-600',
  '수거완료': 'bg-green-50 text-green-600',
  '완료': 'bg-green-50 text-green-600',
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('id, role, name').eq('id', user.id).single()
  const isAdmin = profile?.role === 'admin'

  const now = new Date()
  const thisYear = now.getFullYear()
  const thisMonth = now.getMonth() + 1
  const today = now.toISOString().slice(0, 10)

  const admin = createAdminClient()

  // 어드민은 전체 조회, 일반은 본인 담당만
  const salesFilter = isAdmin ? {} : { assignee_id: user.id }

  let leadsReminderQuery = admin
    .from('leads')
    .select('id, client_org, contact_name, status, remind_date, service_type')
    .lte('remind_date', today)
    .not('status', 'in', '(완료,취소)')
    .order('remind_date', { ascending: true })
    .limit(5)
  if (!isAdmin) leadsReminderQuery = leadsReminderQuery.eq('assignee_id', user.id)

  let tasksQuery = admin
    .from('tasks')
    .select('id, title, status, priority, due_date, project_id')
    .not('status', 'in', '(완료,보류)')
    .order('due_date', { ascending: true, nullsFirst: false })
    .limit(10)
  if (!isAdmin) tasksQuery = tasksQuery.eq('assignee_id', user.id)

  let salesQuery = admin
    .from('sales')
    .select('id, name, revenue, contract_stage, inflow_date, created_at')
    .order('created_at', { ascending: false })
    .limit(8)
  if (!isAdmin) salesQuery = salesQuery.eq('assignee_id', user.id)

  let rentalsQuery = admin
    .from('rentals')
    .select('id, customer_name, rental_start, rental_end, status, delivery_date')
    .not('status', 'in', '(완료,취소)')
    .order('rental_start', { ascending: true, nullsFirst: false })
    .limit(8)
  if (!isAdmin) rentalsQuery = rentalsQuery.eq('assignee_id', user.id)

  const thisWeek = getWeekRange()
  const weeklyReportQuery = admin
    .from('weekly_reports')
    .select('id, status')
    .eq('user_id', user.id)
    .eq('week_start', thisWeek.start)
    .maybeSingle()

  const dailyReportQuery = admin
    .from('daily_reports')
    .select('id, status')
    .eq('user_id', user.id)
    .eq('report_date', today)
    .maybeSingle()

  const [
    { data: myTasks },
    { data: mySalesRaw },
    { data: myRentals },
    { data: leadsReminder },
    { data: myWeeklyReport },
    { data: myDailyReport },
  ] = await Promise.all([tasksQuery, salesQuery, rentalsQuery, leadsReminderQuery, weeklyReportQuery, dailyReportQuery])

  // task의 project_id → sale 이름 조인
  const projectIds = [...new Set((myTasks ?? []).map(t => t.project_id).filter(Boolean))]
  const { data: saleMeta } = projectIds.length > 0
    ? await admin.from('sales').select('id, name').in('id', projectIds)
    : { data: [] }
  const saleMetaMap = Object.fromEntries((saleMeta ?? []).map(s => [s.id, s.name]))

  const pendingTasks = myTasks ?? []
  const urgentTasks = pendingTasks.filter(t => {
    if (!t.due_date) return false
    const diff = Math.ceil((new Date(t.due_date).getTime() - new Date().setHours(0,0,0,0)) / 86400000)
    return diff <= 7
  })

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">안녕하세요, {profile?.name}님</h1>
        <p className="text-gray-500 text-sm mt-1">{thisYear}년 {thisMonth}월 {now.getDate()}일</p>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
        <div className={`rounded-xl border p-4 ${urgentTasks.length > 0 ? 'bg-red-50 border-red-100' : 'bg-white border-gray-100'}`}>
          <p className="text-xs text-gray-400 mb-1">긴급 업무</p>
          <p className={`text-2xl font-bold ${urgentTasks.length > 0 ? 'text-red-500' : 'text-gray-300'}`}>
            {urgentTasks.length}<span className="text-sm font-normal ml-1">건</span>
          </p>
          <p className="text-xs text-gray-400 mt-1">7일 이내 마감</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <p className="text-xs text-gray-400 mb-1">{isAdmin ? '전체 업무' : '내 업무'}</p>
          <p className="text-2xl font-bold text-gray-900">
            {pendingTasks.length}<span className="text-sm font-normal ml-1">건</span>
          </p>
          <p className="text-xs text-gray-400 mt-1">진행중 / 할 일</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <p className="text-xs text-gray-400 mb-1">{isAdmin ? '전체 계약' : '담당 계약'}</p>
          <p className="text-2xl font-bold text-gray-900">
            {(mySalesRaw ?? []).length}<span className="text-sm font-normal ml-1">건</span>
          </p>
          <p className="text-xs text-gray-400 mt-1">최근 순</p>
        </div>
        <Link href="/weekly-report" className={`rounded-xl border p-4 hover:opacity-90 transition-opacity ${
          myWeeklyReport?.status === '제출완료' ? 'bg-green-50 border-green-100' :
          myWeeklyReport ? 'bg-yellow-50 border-yellow-100' : 'bg-white border-gray-100'
        }`}>
          <p className="text-xs text-gray-400 mb-1">이번 주 주간보고</p>
          <p className={`text-sm font-bold mt-1 ${
            myWeeklyReport?.status === '제출완료' ? 'text-green-600' :
            myWeeklyReport ? 'text-yellow-600' : 'text-gray-300'
          }`}>
            {myWeeklyReport?.status === '제출완료' ? '제출완료 ✓' :
             myWeeklyReport ? '임시저장' : '미작성'}
          </p>
          <p className="text-xs text-gray-400 mt-1">{getWeekLabel(thisWeek.start, thisWeek.end)}</p>
        </Link>
        <Link href="/daily-report" className={`rounded-xl border p-4 hover:opacity-90 transition-opacity ${
          myDailyReport?.status === 'submitted' ? 'bg-green-50 border-green-100' :
          myDailyReport ? 'bg-yellow-50 border-yellow-100' : 'bg-white border-gray-100'
        }`}>
          <p className="text-xs text-gray-400 mb-1">오늘 일일업무표</p>
          <p className={`text-sm font-bold mt-1 ${
            myDailyReport?.status === 'submitted' ? 'text-green-600' :
            myDailyReport ? 'text-yellow-600' : 'text-gray-300'
          }`}>
            {myDailyReport?.status === 'submitted' ? '제출완료 ✓' :
             myDailyReport ? '임시저장' : '미작성'}
          </p>
          <p className="text-xs text-gray-400 mt-1">{now.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}</p>
        </Link>
      </div>

      {/* 리드 리마인드 */}
      {(leadsReminder ?? []).length > 0 && (
        <div className="mb-4 bg-orange-50 border border-orange-200 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-orange-100">
            <h2 className="text-sm font-semibold text-orange-700">🔔 리드 리마인드 {(leadsReminder ?? []).length}건</h2>
            <Link href="/leads" className="text-xs text-orange-500 hover:text-orange-700">전체 보기 →</Link>
          </div>
          <div className="divide-y divide-orange-100">
            {(leadsReminder ?? []).map(l => {
              const target = new Date(l.remind_date)
              target.setHours(0, 0, 0, 0)
              const diffDays = Math.round((target.getTime() - new Date().setHours(0,0,0,0)) / 86400000)
              const dday = diffDays === 0 ? 'D-day' : diffDays < 0 ? `D${diffDays}` : `D-${diffDays}`
              const ddayColor = diffDays <= 0 ? 'text-red-600 font-bold' : diffDays <= 3 ? 'text-orange-600 font-semibold' : 'text-yellow-600'
              return (
                <Link key={l.id} href="/leads" className="flex items-center gap-3 px-5 py-2.5 hover:bg-orange-100 transition-colors">
                  <span className={`text-xs w-12 shrink-0 ${ddayColor}`}>{dday}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{l.client_org || '-'}</p>
                    {l.contact_name && <p className="text-xs text-gray-400">{l.contact_name}</p>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {l.service_type && <span className="text-xs px-1.5 py-0.5 bg-orange-100 text-orange-600 rounded-full">{l.service_type}</span>}
                    <span className="text-xs text-gray-500">{l.status}</span>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 업무 목록 */}
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-700">{isAdmin ? '전체 업무' : '내 업무'}</h2>
            <Link href="/tasks" className="text-xs text-gray-400 hover:text-gray-600">전체 보기 →</Link>
          </div>
          {pendingTasks.length === 0 ? (
            <p className="px-5 py-8 text-sm text-gray-400 text-center">진행 중인 업무가 없습니다.</p>
          ) : (
            <div className="divide-y divide-gray-50">
              {pendingTasks.map(t => {
                const due = formatDue(t.due_date)
                return (
                  <Link key={t.id} href={t.project_id ? `/sales/${t.project_id}` : '/tasks'} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{t.title}</p>
                      {t.project_id && saleMetaMap[t.project_id] && (
                        <p className="text-xs text-gray-400 truncate">{saleMetaMap[t.project_id]}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {due && <span className={`text-xs ${due.color}`}>{due.label}</span>}
                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${STATUS_STYLE[t.status] ?? 'bg-gray-100 text-gray-500'}`}>{t.status}</span>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>

        {/* 계약 + 렌탈 */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-700">{isAdmin ? '최근 계약' : '담당 계약'}</h2>
              <Link href="/sales" className="text-xs text-gray-400 hover:text-gray-600">전체 보기 →</Link>
            </div>
            {(mySalesRaw ?? []).length === 0 ? (
              <p className="px-5 py-6 text-sm text-gray-400 text-center">계약 내역이 없습니다.</p>
            ) : (
              <div className="divide-y divide-gray-50">
                {(mySalesRaw ?? []).slice(0, 4).map(s => (
                  <Link key={s.id} href={`/sales/${s.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{s.name}</p>
                      <p className="text-xs text-gray-400">{formatDate(s.inflow_date ?? s.created_at)}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-semibold text-gray-700">{formatMoney(s.revenue ?? 0)}</p>
                      {s.contract_stage && (
                        <span className={`text-xs px-1.5 py-0.5 rounded-full ${CONTRACT_STAGE_COLORS[s.contract_stage] ?? 'bg-gray-100 text-gray-500'}`}>
                          {s.contract_stage}
                        </span>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-700">{isAdmin ? '전체 렌탈' : '담당 렌탈'}</h2>
              <Link href="/rentals" className="text-xs text-gray-400 hover:text-gray-600">전체 보기 →</Link>
            </div>
            {(myRentals ?? []).length === 0 ? (
              <p className="px-5 py-6 text-sm text-gray-400 text-center">진행 중인 렌탈이 없습니다.</p>
            ) : (
              <div className="divide-y divide-gray-50">
                {(myRentals ?? []).map(r => (
                  <Link key={r.id} href="/rentals" className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{r.customer_name}</p>
                      <p className="text-xs text-gray-400">
                        {r.delivery_date ? `배송 ${formatDate(r.delivery_date)}` : formatDate(r.rental_start)}
                      </p>
                    </div>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full flex-shrink-0 ${RENTAL_STATUS_COLORS[r.status ?? ''] ?? 'bg-gray-100 text-gray-500'}`}>
                      {r.status ?? '진행전'}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
