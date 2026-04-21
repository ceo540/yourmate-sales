'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createGoal, updateGoal, deleteGoal, createSaleFromDept, updateSaleRemindDate, updateSaleServiceType } from './actions'
import { createTask } from '../../sales/tasks/actions'
import { SERVICE_TYPES } from '@/types'

interface Profile { id: string; name: string }

interface Goal {
  id: string
  department: string
  title: string
  description: string | null
  year: number
  target_value: number | null
  current_value: number
  unit: string | null
  status: string
  deadline: string | null
}

interface Sale {
  id: string
  name: string
  service_type: string | null
  contract_stage: string | null
  progress_status: string | null
  revenue: number | null
  inflow_date: string | null
  remind_date: string | null
  client_org: string | null
  memo: string | null
  project_id: string | null
  assignee: { name: string } | null
}

interface Task {
  id: string
  title: string
  status: string
  priority: string | null
  assignee: { name: string } | null
  project_id: string | null
  sale: { name: string } | null
  due_date: string | null
}

interface TaskStats { total: number; done: number; urgent: number; overdue: number }

interface DeptClientProps {
  dept: string
  deptLabel: string
  deptIcon: string
  sales: Sale[]
  goals: Goal[]
  tasks: Task[]
  profiles: Profile[]
  taskStatsBySale: Record<string, TaskStats>
  isAdmin: boolean
  year: number
}

const PAY_STATUS_COLORS: Record<string, string> = {
  '계약':       'bg-blue-50 text-blue-600 border-blue-100',
  '착수':       'bg-purple-50 text-purple-600 border-purple-100',
  '선금':       'bg-yellow-50 text-yellow-700 border-yellow-100',
  '중도금':     'bg-orange-50 text-orange-600 border-orange-100',
  '완수':       'bg-teal-50 text-teal-600 border-teal-100',
  '계산서발행': 'bg-indigo-50 text-indigo-600 border-indigo-100',
  '잔금':       'bg-green-50 text-green-700 border-green-100',
}

const TASK_STATUS_DOT: Record<string, string> = {
  '할 일':  'bg-gray-300',
  '진행중': 'bg-blue-500',
  '검토중': 'bg-purple-500',
  '완료':   'bg-green-400',
  '보류':   'bg-yellow-400',
}

const TASK_STATUS_COLORS: Record<string, string> = {
  '할 일':  'bg-gray-100 text-gray-500',
  '진행중': 'bg-blue-100 text-blue-700',
  '검토중': 'bg-purple-100 text-purple-700',
  '완료':   'bg-green-100 text-green-700',
  '보류':   'bg-yellow-100 text-yellow-700',
}

const STATUS_COLORS: Record<string, string> = {
  '진행전': 'bg-gray-100 text-gray-500',
  '진행중': 'bg-blue-100 text-blue-700',
  '달성':   'bg-green-100 text-green-700',
  '보류':   'bg-yellow-100 text-yellow-700',
}

const RENTAL_SERVICES = new Set(['교구대여'])

function calcDday(dateStr: string | null) {
  if (!dateStr) return null
  const date = new Date(dateStr)
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const diff = Math.ceil((date.getTime() - today.getTime()) / 86400000)
  if (diff < 0) return { label: `D+${Math.abs(diff)}`, color: 'bg-red-100 text-red-600' }
  if (diff === 0) return { label: 'D-day', color: 'bg-red-100 text-red-600' }
  if (diff <= 3) return { label: `D-${diff}`, color: 'bg-orange-100 text-orange-600' }
  if (diff <= 7) return { label: `D-${diff}`, color: 'bg-yellow-100 text-yellow-700' }
  return { label: `D-${diff}`, color: 'bg-gray-100 text-gray-400' }
}

function formatTaskDue(d: string | null) {
  if (!d) return null
  const date = new Date(d)
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const diff = Math.ceil((date.getTime() - today.getTime()) / 86400000)
  const str = `${date.getMonth() + 1}/${date.getDate()}`
  if (diff < 0) return { str, color: 'text-red-500 font-semibold' }
  if (diff === 0) return { str: '오늘', color: 'text-red-500 font-semibold' }
  if (diff <= 3) return { str, color: 'text-orange-500' }
  return { str, color: 'text-gray-400' }
}

function fmtWon(n: number) {
  if (n >= 100_000_000) return `${(n / 100_000_000).toFixed(1)}억`
  if (n >= 10_000) return `${Math.round(n / 10_000).toLocaleString()}만`
  return `${n.toLocaleString()}원`
}

export default function DeptClient({ dept, deptLabel, deptIcon, sales, goals, tasks, profiles, taskStatsBySale, isAdmin, year }: DeptClientProps) {
  const router = useRouter()
  const definedServices = (SERVICE_TYPES as Record<string, string[]>)[dept] ?? []
  const dataServices = Array.from(new Set(sales.map(s => s.service_type ?? '미분류')))
  const extraServices = dataServices.filter(s => s !== '미분류' && !definedServices.includes(s))
  const serviceTabs = [...definedServices, ...extraServices, '미분류'].filter(
    s => s === '미분류' ? dataServices.includes('미분류') : true
  )

  const [service, setService] = useState(serviceTabs[0] ?? '미분류')
  const [section, setSection] = useState<'projects' | 'tasks' | 'goals'>('projects')
  const [showGoalForm, setShowGoalForm] = useState(false)
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null)
  const [filterAssignee, setFilterAssignee] = useState('')
  const [hideCompleted, setHideCompleted] = useState(true)
  const [showNewSaleForm, setShowNewSaleForm] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [addingSale, setAddingSale] = useState(false)
  const [editingRemindId, setEditingRemindId] = useState<string | null>(null)
  const [remindInputVal, setRemindInputVal] = useState('')
  const [quickAddSaleId, setQuickAddSaleId] = useState<string | null>(null)
  const [quickAddTitle, setQuickAddTitle] = useState('')
  const [quickServiceSaleId, setQuickServiceSaleId] = useState<string | null>(null)
  const [hiddenSaleIds, setHiddenSaleIds] = useState<Set<string>>(new Set())

  // ── 헤더 KPI 계산
  const totalRevAll = sales.reduce((s, r) => s + (r.revenue ?? 0), 0)
  const activeCount = sales.filter(s => s.contract_stage !== '잔금').length
  const doneCount = sales.filter(s => s.contract_stage === '잔금').length
  const totalOverdue = Object.values(taskStatsBySale).reduce((s, v) => s + v.overdue, 0)

  // ── 서비스별 통계
  const serviceCount = (svc: string) =>
    svc === '미분류' ? sales.filter(s => !s.service_type).length : sales.filter(s => s.service_type === svc).length
  const serviceRevenue = (svc: string) =>
    (svc === '미분류' ? sales.filter(s => !s.service_type) : sales.filter(s => s.service_type === svc))
      .reduce((s, r) => s + (r.revenue ?? 0), 0)

  // ── 필터링
  let serviceSales = service === '미분류'
    ? sales.filter(s => !s.service_type)
    : sales.filter(s => s.service_type === service)

  const completedCount = serviceSales.filter(s => s.contract_stage === '잔금').length
  if (hideCompleted) serviceSales = serviceSales.filter(s => s.contract_stage !== '잔금')
  if (filterAssignee) serviceSales = serviceSales.filter(s => s.assignee?.name === filterAssignee)
  serviceSales = serviceSales.filter(s => !hiddenSaleIds.has(s.id))

  serviceSales = [...serviceSales].sort((a, b) => {
    if (a.remind_date && b.remind_date) return a.remind_date.localeCompare(b.remind_date)
    if (a.remind_date) return -1
    if (b.remind_date) return 1
    return 0
  })

  const totalRevService = serviceSales.reduce((s, r) => s + (r.revenue ?? 0), 0)
  const assigneeOptions = Array.from(new Set(
    (service === '미분류' ? sales.filter(s => !s.service_type) : sales.filter(s => s.service_type === service))
      .map(s => s.assignee?.name).filter(Boolean)
  )) as string[]

  // ── 액션
  async function handleDeleteGoal(id: string) {
    if (!confirm('목표를 삭제할까요?')) return
    await deleteGoal(id, dept)
  }

  async function handleCreateSale(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    fd.set('department', dept)
    fd.set('service_type', service !== '미분류' ? service : '')
    setAddingSale(true)
    await createSaleFromDept(fd)
    setAddingSale(false)
    setShowNewSaleForm(false)
  }

  function handleRemindSave(saleId: string) {
    startTransition(() => updateSaleRemindDate(saleId, remindInputVal || null, dept))
    setEditingRemindId(null)
  }

  function handleQuickAddTask(saleId: string) {
    if (!quickAddTitle.trim()) return
    const fd = new FormData()
    fd.set('title', quickAddTitle)
    fd.set('project_id', saleId)
    fd.set('status', '할 일')
    fd.set('priority', '보통')
    startTransition(() => createTask(fd))
    setQuickAddTitle('')
    setQuickAddSaleId(null)
  }

  return (
    <div className="min-h-screen bg-[#F5F5F3] -mx-4 md:-mx-8 -mt-4">
      {quickServiceSaleId && <div className="fixed inset-0 z-20" onClick={() => setQuickServiceSaleId(null)} />}

      {/* ── 스티키 헤더 ── */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 sticky top-0 z-20">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{deptIcon}</span>
              <div>
                <h1 className="text-lg font-bold text-gray-900 leading-tight">{deptLabel}</h1>
                <p className="text-xs text-gray-400 mt-0.5">{year}년</p>
              </div>
            </div>

            {/* KPI 수치 */}
            <div className="flex items-center gap-5">
              <div className="text-center">
                <p className="text-xl font-bold text-gray-900">{activeCount}</p>
                <p className="text-[11px] text-gray-400">진행 중</p>
              </div>
              <div className="w-px h-8 bg-gray-100" />
              <div className="text-center">
                <p className="text-xl font-bold text-gray-900">{doneCount}</p>
                <p className="text-[11px] text-gray-400">완료</p>
              </div>
              <div className="w-px h-8 bg-gray-100" />
              <div className="text-center">
                <p className="text-xl font-bold text-gray-900">{fmtWon(totalRevAll)}</p>
                <p className="text-[11px] text-gray-400">총 매출</p>
              </div>
              {totalOverdue > 0 && (
                <>
                  <div className="w-px h-8 bg-gray-100" />
                  <div className="text-center">
                    <p className="text-xl font-bold text-red-500">{totalOverdue}</p>
                    <p className="text-[11px] text-gray-400">업무 지연</p>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── 메인 콘텐츠 ── */}
      <div className="max-w-5xl mx-auto px-6 py-5">

        {/* ── 서비스 탭 + 보조 탭 ── */}
        {serviceTabs.length > 0 && (
          <div className="flex items-end gap-2 flex-wrap mb-5">
            <div className="flex gap-2 flex-wrap flex-1">
              {serviceTabs.map(svc => {
                const cnt = serviceCount(svc)
                const rev = serviceRevenue(svc)
                const active = service === svc && section === 'projects'
                return (
                  <button
                    key={svc}
                    onClick={() => {
                      if (RENTAL_SERVICES.has(svc)) { router.push('/rentals'); return }
                      setService(svc); setSection('projects'); setFilterAssignee(''); setShowNewSaleForm(false)
                    }}
                    className={`flex flex-col items-start px-4 py-2.5 rounded-xl text-sm font-medium transition-all border ${
                      active
                        ? 'border-transparent shadow-sm'
                        : 'border-gray-200 bg-white text-gray-500 hover:text-gray-800 hover:border-gray-300'
                    }`}
                    style={active ? { backgroundColor: '#FFCE00', color: '#121212', borderColor: '#FFCE00' } : {}}
                  >
                    <div className="flex items-center gap-1.5">
                      <span>{svc}</span>
                      <span className={`text-[11px] rounded-full px-1.5 py-0.5 font-semibold ${
                        active ? 'bg-black/10 text-black' : cnt === 0 ? 'bg-gray-100 text-gray-300' : 'bg-gray-100 text-gray-500'
                      }`}>{cnt}</span>
                    </div>
                    {rev > 0 && (
                      <span className={`text-[10px] mt-0.5 ${active ? 'text-black/60' : 'text-gray-400'}`}>
                        {fmtWon(rev)}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
            <div className="flex gap-1.5 flex-shrink-0">
              {(['tasks', 'goals'] as const).map(s => (
                <button
                  key={s}
                  onClick={() => setSection(s)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-all border ${
                    section === s ? 'bg-gray-900 text-white border-gray-900' : 'bg-white border-gray-200 text-gray-400 hover:border-gray-300'
                  }`}
                >
                  {s === 'tasks' ? `업무 ${tasks.length}` : `목표 ${goals.length}`}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── 프로젝트 뷰 ── */}
        {section === 'projects' && (
          <div>
            {RENTAL_SERVICES.has(service) ? (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm text-gray-500">렌탈은 배송·수거 일정 중심으로 관리</p>
                  <Link href="/rentals" className="px-3 py-1.5 text-sm font-semibold rounded-lg hover:opacity-80" style={{ backgroundColor: '#FFCE00', color: '#121212' }}>
                    렌탈 관리 →
                  </Link>
                </div>
                {serviceSales.length > 0 && (
                  <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
                    {serviceSales.map((s, idx) => (
                      <Link
                        key={s.id}
                        href={s.project_id ? `/projects/${s.project_id}` : `/departments/${dept}/${s.id}`}
                        className={`flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50 transition-colors ${idx !== serviceSales.length - 1 ? 'border-b border-gray-50' : ''}`}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">{s.name}</p>
                          {s.client_org && <p className="text-xs text-gray-400 mt-0.5">{s.client_org}</p>}
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {s.revenue && <span className="text-sm text-gray-600">{fmtWon(s.revenue)}</span>}
                          <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium border ${PAY_STATUS_COLORS[s.contract_stage ?? ''] ?? 'bg-gray-100 text-gray-400 border-gray-100'}`}>
                            {s.contract_stage ?? '-'}
                          </span>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div>
                {service === '미분류' && (
                  <div className="mb-3 px-4 py-2.5 bg-orange-50 border border-orange-100 rounded-xl flex items-center justify-between">
                    <p className="text-xs text-orange-700">서비스 미지정 건 — 카드의 &ldquo;서비스 지정&rdquo; 버튼으로 바로 지정하세요.</p>
                    {definedServices.length === 0 && <p className="text-xs text-orange-400">이 사업부에 정의된 서비스 없음</p>}
                  </div>
                )}

                {/* 툴바 */}
                <div className="flex items-center gap-2 mb-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-500">
                      {filterAssignee ? `${filterAssignee} · ` : ''}{serviceSales.length}건
                      {hideCompleted && completedCount > 0 && (
                        <span className="text-gray-400"> (완료 {completedCount}건 숨김)</span>
                      )}
                    </span>
                    {!filterAssignee && totalRevService > 0 && (
                      <span className="text-sm font-bold text-gray-900">{fmtWon(totalRevService)}</span>
                    )}
                  </div>

                  {completedCount > 0 && (
                    <button
                      onClick={() => setHideCompleted(v => !v)}
                      className={`text-xs px-2.5 py-1 rounded-lg border transition-all ${
                        hideCompleted ? 'border-gray-200 text-gray-400 bg-white hover:border-gray-300' : 'border-green-300 text-green-600 bg-green-50'
                      }`}
                    >
                      {hideCompleted ? '완료 표시' : '완료 숨기기'}
                    </button>
                  )}
                  {assigneeOptions.length > 1 && (
                    <select
                      value={filterAssignee}
                      onChange={e => setFilterAssignee(e.target.value)}
                      className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:border-yellow-400"
                    >
                      <option value="">전체 담당자</option>
                      {assigneeOptions.map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                  )}
                  <button
                    onClick={() => setShowNewSaleForm(v => !v)}
                    className="ml-auto px-3 py-1.5 text-sm font-semibold rounded-xl hover:opacity-80 transition-all"
                    style={{ backgroundColor: '#FFCE00', color: '#121212' }}
                  >
                    + 새 건
                  </button>
                </div>

                {/* 새 건 추가 폼 */}
                {showNewSaleForm && (
                  <form onSubmit={handleCreateSale} className="mb-4 p-5 bg-white border border-yellow-200 rounded-xl space-y-3 shadow-sm">
                    <p className="text-sm font-semibold text-gray-800">새 프로젝트 · {service !== '미분류' ? service : '미분류'}</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] text-gray-500 block mb-1">건명 *</label>
                        <input name="name" required placeholder="프로젝트명"
                          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-yellow-400 bg-white" />
                      </div>
                      <div>
                        <label className="text-[11px] text-gray-500 block mb-1">발주처</label>
                        <input name="client_org" placeholder="예: 서울중학교"
                          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-yellow-400 bg-white" />
                      </div>
                      <div>
                        <label className="text-[11px] text-gray-500 block mb-1">담당자</label>
                        <select name="assignee_id"
                          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:border-yellow-400">
                          <option value="">미지정</option>
                          {profiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-[11px] text-gray-500 block mb-1">매출액 (원)</label>
                        <input name="revenue" type="number" min="0" defaultValue="0"
                          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-yellow-400 bg-white" />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button type="submit" disabled={addingSale}
                        className="px-4 py-2 text-sm font-semibold rounded-xl hover:opacity-80 disabled:opacity-50"
                        style={{ backgroundColor: '#FFCE00', color: '#121212' }}>
                        {addingSale ? '추가 중...' : '추가'}
                      </button>
                      <button type="button" onClick={() => setShowNewSaleForm(false)}
                        className="px-4 py-2 text-sm border border-gray-200 rounded-xl text-gray-500">
                        취소
                      </button>
                    </div>
                  </form>
                )}

                {serviceSales.length === 0 && !showNewSaleForm ? (
                  <div className="text-center py-16 text-gray-400 text-sm bg-white border border-dashed border-gray-200 rounded-xl">
                    <p className="text-2xl mb-2">📭</p>
                    <p>{service} 건 없음</p>
                    <p className="text-xs mt-1">위의 &ldquo;+ 새 건&rdquo; 버튼으로 추가하세요</p>
                  </div>
                ) : serviceSales.length > 0 ? (
                  <div className="space-y-2">
                    {serviceSales.map(s => {
                      const stats = taskStatsBySale[s.id]
                      const pct = stats && stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : null
                      const dday = calcDday(s.remind_date)
                      const isEditingRemind = editingRemindId === s.id
                      const isQuickAdding = quickAddSaleId === s.id
                      const stageDot =
                        s.contract_stage === '잔금' ? 'bg-green-400' :
                        ['착수', '선금', '중도금', '완수', '계산서발행'].includes(s.contract_stage ?? '') ? 'bg-yellow-400' :
                        'bg-gray-300'

                      return (
                        <div key={s.id} className="group bg-white border border-gray-100 rounded-xl overflow-hidden hover:border-gray-200 hover:shadow-sm transition-all">
                          <Link
                            href={s.project_id ? `/projects/${s.project_id}` : `/departments/${dept}/${s.id}`}
                            className="flex items-center gap-4 px-5 py-4"
                          >
                            {/* 상태 점 */}
                            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${stageDot}`} />

                            {/* 건명 + 클라이언트 */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="text-sm font-semibold text-gray-900 group-hover:text-gray-700">{s.name}</p>
                                {s.progress_status && s.progress_status !== '착수전' && (
                                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 ${
                                    s.progress_status === '완수' ? 'bg-teal-50 text-teal-600' :
                                    s.progress_status === '착수중' ? 'bg-blue-50 text-blue-600' :
                                    'bg-gray-100 text-gray-400'
                                  }`}>{s.progress_status}</span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 mt-0.5">
                                {s.client_org && <p className="text-xs text-gray-400">{s.client_org}</p>}
                                {s.inflow_date && <p className="text-xs text-gray-300">{s.inflow_date.slice(5).replace('-', '/')}</p>}
                              </div>
                              {/* 업무 진행바 */}
                              {stats && stats.total > 0 && (
                                <div className="flex items-center gap-2 mt-2">
                                  <div className="w-24 h-1 bg-gray-100 rounded-full overflow-hidden">
                                    <div className="h-full rounded-full transition-all"
                                      style={{ width: `${pct}%`, backgroundColor: pct === 100 ? '#22c55e' : '#FFCE00' }} />
                                  </div>
                                  <span className="text-[11px] text-gray-400">{stats.done}/{stats.total}</span>
                                  {stats.overdue > 0 && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-50 text-red-500 font-semibold">
                                      ⚠ {stats.overdue}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>

                            {/* 우측 메타 */}
                            <div className="flex items-center gap-3 flex-shrink-0">
                              {/* D-day */}
                              <div onClick={e => e.preventDefault()}>
                                {isEditingRemind ? (
                                  <input autoFocus type="date" value={remindInputVal}
                                    onChange={e => setRemindInputVal(e.target.value)}
                                    onBlur={() => handleRemindSave(s.id)}
                                    onKeyDown={e => {
                                      if (e.key === 'Enter') handleRemindSave(s.id)
                                      if (e.key === 'Escape') setEditingRemindId(null)
                                    }}
                                    className="text-xs border border-yellow-300 rounded-lg px-2 py-1 focus:outline-none w-32 bg-white" />
                                ) : dday ? (
                                  <button onClick={e => { e.stopPropagation(); setEditingRemindId(s.id); setRemindInputVal(s.remind_date ?? '') }}
                                    className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${dday.color}`}>
                                    {dday.label}
                                  </button>
                                ) : (
                                  <button onClick={e => { e.stopPropagation(); setEditingRemindId(s.id); setRemindInputVal('') }}
                                    className="text-[11px] px-2 py-0.5 rounded-full text-gray-300 hover:text-gray-500 hover:bg-gray-100 opacity-0 group-hover:opacity-100 transition-opacity">
                                    + 마감
                                  </button>
                                )}
                              </div>

                              {s.assignee && (
                                <span className="text-xs text-gray-400 hidden sm:block">{s.assignee.name}</span>
                              )}
                              {s.revenue ? (
                                <span className="text-xs font-semibold text-gray-700">{fmtWon(s.revenue)}</span>
                              ) : null}
                              <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium border ${PAY_STATUS_COLORS[s.contract_stage ?? ''] ?? 'bg-gray-100 text-gray-400 border-gray-100'}`}>
                                {s.contract_stage ?? '-'}
                              </span>
                              {service === '미분류' && definedServices.length > 0 && (
                                <div className="relative" onClick={e => e.preventDefault()}>
                                  <button onClick={e => { e.stopPropagation(); setQuickServiceSaleId(s.id === quickServiceSaleId ? null : s.id) }}
                                    className="text-[11px] px-2 py-0.5 rounded-full border border-dashed border-orange-300 text-orange-500 hover:bg-orange-50 transition-colors whitespace-nowrap">
                                    서비스 지정
                                  </button>
                                  {quickServiceSaleId === s.id && (
                                    <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-30 py-1 min-w-28">
                                      {definedServices.map(svc => (
                                        <button key={svc} type="button" onClick={e => {
                                          e.stopPropagation()
                                          startTransition(async () => { await updateSaleServiceType(s.id, svc, dept) })
                                          setHiddenSaleIds(prev => new Set([...prev, s.id]))
                                          setQuickServiceSaleId(null)
                                        }} className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 text-gray-700">{svc}</button>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )}
                              <span className="text-gray-300 group-hover:text-gray-500 text-xs">→</span>
                            </div>
                          </Link>

                          {/* + 업무 버튼 */}
                          <div className="px-5 pb-0 opacity-0 group-hover:opacity-100 transition-opacity -mt-1"
                            onClick={e => e.preventDefault()}>
                            <button
                              onClick={e => { e.stopPropagation(); setQuickAddSaleId(isQuickAdding ? null : s.id); setQuickAddTitle('') }}
                              className="text-[11px] px-2 py-0.5 mb-2 rounded-full border border-gray-200 text-gray-400 hover:border-yellow-300 hover:text-gray-700 transition-colors"
                            >
                              + 업무 추가
                            </button>
                          </div>

                          {/* 빠른 업무 추가 폼 */}
                          {isQuickAdding && (
                            <div className="px-5 py-3 bg-yellow-50 border-t border-yellow-100">
                              <input autoFocus value={quickAddTitle}
                                onChange={e => setQuickAddTitle(e.target.value)}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') handleQuickAddTask(s.id)
                                  if (e.key === 'Escape') { setQuickAddSaleId(null); setQuickAddTitle('') }
                                }}
                                placeholder="업무명 입력 후 Enter"
                                className="w-full text-sm bg-white border border-yellow-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-yellow-400" />
                              <p className="text-[11px] text-gray-400 mt-1">Esc 취소</p>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                ) : null}
              </div>
            )}
          </div>
        )}

        {/* ── 업무 탭 ── */}
        {section === 'tasks' && (
          <div>
            <p className="text-sm text-gray-500 mb-4">이 사업부 프로젝트 업무 {tasks.length}개</p>
            {tasks.length === 0 ? (
              <div className="text-center py-16 text-gray-400 text-sm bg-white rounded-xl border border-gray-100">등록된 업무가 없습니다</div>
            ) : (() => {
              const grouped = tasks.reduce((acc, t) => {
                const key = t.project_id ?? '__internal__'
                if (!acc[key]) acc[key] = { sale: t.sale, tasks: [] }
                acc[key].tasks.push(t)
                return acc
              }, {} as Record<string, { sale: { name: string } | null; tasks: Task[] }>)

              const sortedKeys = Object.keys(grouped).sort((a, b) => {
                if (a === '__internal__') return 1
                if (b === '__internal__') return -1
                return (grouped[a].sale?.name ?? '').localeCompare(grouped[b].sale?.name ?? '')
              })

              return (
                <div className="space-y-3">
                  {sortedKeys.map(key => {
                    const group = grouped[key]
                    const activeTasks = group.tasks.filter(t => t.status !== '완료' && t.status !== '보류')
                    const doneTasks = group.tasks.filter(t => t.status === '완료')
                    const projectName = key === '__internal__' ? '사업부 공통 업무' : (group.sale?.name ?? '프로젝트 없음')
                    return (
                      <div key={key} className="bg-white border border-gray-100 rounded-xl overflow-hidden">
                        <div className="flex items-center justify-between px-5 py-3 bg-gray-50 border-b border-gray-100">
                          <span className="text-sm font-semibold text-gray-800">{projectName}</span>
                          <span className="text-[11px] text-gray-400">완료 {doneTasks.length}/{group.tasks.length}</span>
                        </div>
                        {activeTasks.map((task, idx) => {
                          const due = formatTaskDue(task.due_date)
                          return (
                            <div key={task.id} className={`flex items-center gap-3 px-5 py-2.5 ${idx !== activeTasks.length - 1 || doneTasks.length > 0 ? 'border-b border-gray-50' : ''}`}>
                              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${TASK_STATUS_DOT[task.status] ?? 'bg-gray-300'}`} />
                              <p className="text-sm text-gray-900 flex-1 truncate">{task.title}</p>
                              <div className="flex items-center gap-2 flex-shrink-0 text-xs">
                                <span className={`${TASK_STATUS_COLORS[task.status]} text-[10px] px-1.5 py-0.5 rounded-full font-medium`}>{task.status}</span>
                                {task.assignee && <span className="text-gray-400">{task.assignee.name}</span>}
                                {due && <span className={due.color}>{due.str}</span>}
                              </div>
                            </div>
                          )
                        })}
                        {doneTasks.length > 0 && (
                          <div className="px-5 py-2 bg-gray-50">
                            <p className="text-[11px] text-gray-400">완료 {doneTasks.length}건: {doneTasks.map(t => t.title).join(', ')}</p>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )
            })()}
          </div>
        )}

        {/* ── 목표 탭 ── */}
        {section === 'goals' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <p className="text-sm text-gray-500">{year}년 목표 {goals.length}개</p>
              {isAdmin && (
                <button
                  onClick={() => { setEditingGoal(null); setShowGoalForm(true) }}
                  className="px-3 py-1.5 text-sm font-semibold rounded-lg hover:opacity-80"
                  style={{ backgroundColor: '#FFCE00', color: '#121212' }}
                >
                  + 목표 추가
                </button>
              )}
            </div>

            {showGoalForm && (
              <div className="bg-white border border-yellow-300 rounded-xl p-5 mb-4 shadow-sm">
                <h3 className="font-semibold text-gray-900 mb-3">{editingGoal ? '목표 수정' : '새 목표'}</h3>
                <form
                  action={async (fd) => {
                    if (editingGoal) { fd.set('id', editingGoal.id); await updateGoal(fd) }
                    else await createGoal(fd)
                    setShowGoalForm(false); setEditingGoal(null)
                  }}
                  className="space-y-3"
                >
                  <input type="hidden" name="department" value={dept} />
                  <input type="hidden" name="year" value={year} />
                  <input name="title" required defaultValue={editingGoal?.title ?? ''} placeholder="목표명 *"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-yellow-400" />
                  <input name="description" defaultValue={editingGoal?.description ?? ''} placeholder="설명 (선택)"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-yellow-400" />
                  <div className="grid grid-cols-2 gap-3">
                    <input name="target_value" type="number" defaultValue={editingGoal?.target_value ?? ''} placeholder="목표값"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-yellow-400" />
                    <input name="unit" defaultValue={editingGoal?.unit ?? ''} placeholder="단위 (원, 건, %)"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-yellow-400" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <select name="status" defaultValue={editingGoal?.status ?? '진행중'}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-yellow-400 bg-white">
                      {['진행전', '진행중', '달성', '보류'].map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <input name="deadline" type="date" defaultValue={editingGoal?.deadline ?? ''}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-yellow-400" />
                  </div>
                  <div className="flex gap-2">
                    <button type="submit" className="px-4 py-2 text-sm font-semibold rounded-lg hover:opacity-80" style={{ backgroundColor: '#FFCE00', color: '#121212' }}>저장</button>
                    <button type="button" onClick={() => { setShowGoalForm(false); setEditingGoal(null) }} className="px-4 py-2 text-sm text-gray-500 border border-gray-200 rounded-lg">취소</button>
                  </div>
                </form>
              </div>
            )}

            {goals.length === 0 ? (
              <div className="text-center py-16 text-gray-400 text-sm bg-white rounded-xl border border-gray-100">
                {isAdmin ? '+ 목표 추가 버튼으로 목표를 등록하세요' : '등록된 목표가 없습니다'}
              </div>
            ) : (
              <div className="space-y-3">
                {goals.map(goal => {
                  const pct = goal.target_value && goal.target_value > 0
                    ? Math.min(100, Math.round((goal.current_value / goal.target_value) * 100)) : null
                  return (
                    <div key={goal.id} className="bg-white border border-gray-100 rounded-xl p-5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold text-gray-900">{goal.title}</p>
                            <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[goal.status] ?? 'bg-gray-100 text-gray-400'}`}>{goal.status}</span>
                          </div>
                          {goal.description && <p className="text-sm text-gray-500 mt-0.5">{goal.description}</p>}
                        </div>
                        {isAdmin && (
                          <div className="flex gap-1 flex-shrink-0">
                            <button onClick={() => { setEditingGoal(goal); setShowGoalForm(true) }} className="text-xs text-gray-400 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-100">수정</button>
                            <button onClick={() => handleDeleteGoal(goal.id)} className="text-xs text-gray-400 hover:text-red-500 px-2 py-1 rounded hover:bg-red-50">삭제</button>
                          </div>
                        )}
                      </div>
                      {pct !== null && (
                        <div className="mt-3">
                          <div className="flex justify-between text-xs text-gray-400 mb-1">
                            <span>{goal.current_value.toLocaleString()}{goal.unit} / {goal.target_value?.toLocaleString()}{goal.unit}</span>
                            <span className="font-medium text-gray-700">{pct}%</span>
                          </div>
                          <div className="w-full bg-gray-100 rounded-full h-2">
                            <div className="h-2 rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: pct >= 100 ? '#22c55e' : '#FFCE00' }} />
                          </div>
                        </div>
                      )}
                      {goal.deadline && <p className="text-[11px] text-gray-400 mt-2">마감 {goal.deadline}</p>}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  )
}
