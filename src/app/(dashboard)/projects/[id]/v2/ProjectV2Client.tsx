'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import ProjectClaudeChat from '@/components/ProjectClaudeChat'
import MarkdownText from '@/components/MarkdownText'
import {
  updateProjectMemo,
  updateProjectNotes,
  createProjectLog,
  createTaskForProject,
  updateProjectOverviewSummary,
  updateProjectWorkDescription,
  updateProjectPendingDiscussion,
  generateAndSaveProjectOverview,
  generateAndSavePendingDiscussion,
  generateAndSuggestTasks,
  createAndLinkCalendarEvent,
} from '../project-actions'
import { updateTask, deleteTask } from '../../../sales/tasks/actions'

interface Project {
  id: string
  name: string
  project_number: string | null
  service_type: string | null
  department: string | null
  status: string
  dropbox_url: string | null
  memo: string | null
  notes: string | null
  overview_summary: string | null
  work_description: string | null
  pending_discussion: string | null
  customer_id: string | null
  pm_id: string | null
}
interface Customer {
  id: string; name: string; type: string | null
  contact_name: string | null; phone: string | null; contact_email: string | null
}
interface ContactPerson {
  name: string; dept: string | null; title: string | null
  phone: string | null; email: string | null
}
interface Finance {
  revenue: number; cost: number; received: number; contractCount: number
}
interface Contract {
  id: string; name: string; revenue: number | null
  contract_stage: string | null; progress_status: string | null
  client_org: string | null
}
interface Task {
  id: string; title: string; status: string; priority: string | null
  due_date: string | null; project_id: string | null
  assignee_id?: string | null
  assignee_name?: string | null
  description?: string | null
  bbang_suggested?: boolean
}
interface Log {
  id: string; content: string; log_type: string; log_category: string | null
  contacted_at: string | null; created_at: string
  author_name: string | null
  sale_id: string | null
  location: string | null
  participants: string[] | null
  outcome: string | null
}
interface Rental {
  id: string; sale_id: string | null; customer_name: string
  status: string; rental_start: string | null; rental_end: string | null
}

interface ProfileOpt { id: string; name: string }

interface Props {
  project: Project
  pmName: string | null
  customer: Customer | null
  contactPerson: ContactPerson | null
  finance: Finance
  contracts: Contract[]
  tasks: Task[]
  logs: Log[]
  rentals: Rental[]
  leadIds: string[]
  profiles: ProfileOpt[]
  isAdmin: boolean
  currentUserId: string
}

const STATUS_CLR: Record<string, string> = {
  '진행중': 'bg-blue-100 text-blue-700',
  '완료':   'bg-green-100 text-green-700',
  '보류':   'bg-red-100 text-red-600',
  '취소':   'bg-gray-100 text-gray-500',
}

function fmtMoney(n: number) {
  if (n >= 100000000) return `${(n / 100000000).toFixed(1)}억`
  if (n >= 10000) return `${Math.round(n / 10000)}만`
  return n.toLocaleString()
}

function fmtRelativeDate(iso: string | null) {
  if (!iso) return '—'
  const then = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - then.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  if (diffDays === 0) return '오늘'
  if (diffDays === 1) return '어제'
  if (diffDays < 7) return `${diffDays}일 전`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}주 전`
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}개월 전`
  return iso.slice(0, 10)
}

const KPI_TONE: Record<string, string> = {
  green: 'bg-green-50 text-green-700 border-green-100',
  yellow: 'bg-yellow-50 text-yellow-700 border-yellow-100',
  blue: 'bg-blue-50 text-blue-700 border-blue-100',
  red: 'bg-red-50 text-red-700 border-red-100',
  orange: 'bg-orange-50 text-orange-700 border-orange-100',
  gray: 'bg-gray-50 text-gray-600 border-gray-100',
}

function KpiPill({ icon, label, value, tone }: { icon: string; label: string; value: string; tone: keyof typeof KPI_TONE | string }) {
  return (
    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs ${KPI_TONE[tone] ?? KPI_TONE.gray}`}>
      <span>{icon}</span>
      <span className="text-gray-500 font-medium">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  )
}

export default function ProjectV2Client({
  project, pmName, customer, contactPerson, finance,
  contracts, tasks, logs, rentals, leadIds, profiles, currentUserId,
}: Props) {
  const profitRate = finance.revenue > 0
    ? Math.round(((finance.revenue - finance.cost) / finance.revenue) * 100)
    : null
  const receivedRate = finance.revenue > 0
    ? Math.round((finance.received / finance.revenue) * 100)
    : 0

  // 헤더 한 줄 KPI 계산
  const pendingTaskCount = tasks.filter(t => t.status !== '완료' && t.status !== '보류').length
  const urgentTaskCount = tasks.filter(t => (t.priority === '긴급' || t.priority === '높음') && t.status !== '완료' && t.status !== '보류').length
  const taskCompletedRate = tasks.length > 0
    ? Math.round((tasks.filter(t => t.status === '완료').length / tasks.length) * 100)
    : null
  const lastLog = logs[0]
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const upcomingTasks = tasks
    .filter(t => t.due_date && t.status !== '완료' && t.status !== '보류')
    .map(t => ({ task: t, due: new Date(t.due_date!) }))
    .filter(x => x.due >= today)
    .sort((a, b) => a.due.getTime() - b.due.getTime())
  const nextMilestone = upcomingTasks[0]
  const nextMilestoneDays = nextMilestone
    ? Math.ceil((nextMilestone.due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    : null

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* ── 헤더 ── */}
      <div className="mb-5">
        <div className="flex items-center gap-2 mb-2 text-xs">
          <Link href="/projects" className="text-gray-400 hover:text-gray-700">← 프로젝트 목록</Link>
          <span className="text-gray-300">·</span>
          <Link href={`/projects/${project.id}`} className="text-gray-400 hover:text-gray-700">기존 페이지</Link>
          <span className="ml-2 text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ backgroundColor: '#FFCE00', color: '#121212' }}>V2 미리보기</span>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {project.project_number && (
            <span className="text-sm font-semibold text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full">
              {project.project_number}
            </span>
          )}
          <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_CLR[project.status] ?? 'bg-gray-100 text-gray-500'}`}>
            {project.status}
          </span>
          {project.service_type && (
            <span className="text-xs text-gray-500 border border-gray-200 px-2 py-0.5 rounded-full">
              {project.service_type}
            </span>
          )}
          {pmName && (
            <span className="text-xs text-gray-400">PM {pmName}</span>
          )}
        </div>

        {/* V1.10: 핵심 KPI 한 줄 — "30초 안에 파악" */}
        <div className="mt-3 flex items-center gap-1.5 flex-wrap text-sm">
          {finance.revenue > 0 && (
            <KpiPill
              icon="💰"
              label="수금"
              value={`${receivedRate}%`}
              tone={receivedRate >= 100 ? 'green' : receivedRate >= 50 ? 'yellow' : 'gray'}
            />
          )}
          {taskCompletedRate !== null && (
            <KpiPill
              icon="✅"
              label="진행"
              value={`${taskCompletedRate}%`}
              tone={taskCompletedRate === 100 ? 'green' : taskCompletedRate >= 50 ? 'blue' : 'gray'}
            />
          )}
          {pendingTaskCount > 0 && (
            <KpiPill
              icon="📋"
              label="진행중 업무"
              value={`${pendingTaskCount}건`}
              tone="gray"
            />
          )}
          {urgentTaskCount > 0 && (
            <KpiPill
              icon="⚠"
              label="긴급"
              value={`${urgentTaskCount}건`}
              tone="red"
            />
          )}
          {nextMilestone && nextMilestoneDays !== null && (
            <KpiPill
              icon="📅"
              label={`다음: ${nextMilestone.task.title.slice(0, 14)}${nextMilestone.task.title.length > 14 ? '…' : ''}`}
              value={nextMilestoneDays === 0 ? 'D-day' : `D-${nextMilestoneDays}`}
              tone={nextMilestoneDays === 0 ? 'red' : nextMilestoneDays <= 3 ? 'orange' : 'blue'}
            />
          )}
          {lastLog && (
            <KpiPill
              icon="💬"
              label="최근 소통"
              value={fmtRelativeDate(lastLog.contacted_at ?? lastLog.created_at)}
              tone="gray"
            />
          )}
        </div>
      </div>

      {/* ── 2-column 본문 ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5">
        {/* 좌: 메인 */}
        <div className="space-y-4">
          {/* 1. 메모 (인플레이스) */}
          <MemoBlock project={project} />

          {/* 2. 2박스: 개요(빵빵이) / 협의해야할 내용 (접/펼) */}
          <TwoBoxesBlock project={project} />

          {/* 3. 할일 (tasks) */}
          <TasksSection tasks={tasks} contracts={contracts} projectId={project.id} profiles={profiles} serviceType={project.service_type} />

          {/* 5. 일정 (due_date 임박 순) */}
          <ScheduleSection tasks={tasks} />

          {/* 6. 소통 Timeline (종류 변경) */}
          <CommunicationTimeline logs={logs} contracts={contracts} projectId={project.id} />

          {/* 7. 연관 서비스 */}
          <RelatedServicesV2
            serviceType={project.service_type}
            rentals={rentals}
            contracts={contracts}
          />

          {/* 8. 계약 관리 (분리) */}
          <ContractsSection contracts={contracts} projectId={project.id} />
        </div>

        {/* 우: 사이드 */}
        <aside className="space-y-3 lg:sticky lg:top-4 self-start">
          {/* 🤖 빵빵이 — V1.3 */}
          <BbangiCard project={project} contracts={contracts} tasks={tasks} logs={logs} currentUserId={currentUserId} leadIds={leadIds} />

          {/* 📋 기본정보 — V1.4 */}
          <BasicInfoCard customer={customer} contactPerson={contactPerson} pmName={pmName} project={project} />

          {/* 💰 재무 요약 — V1.5 */}
          <FinanceCard finance={finance} profitRate={profitRate} receivedRate={receivedRate} />

          {/* 📁 드롭박스 */}
          {project.dropbox_url && (
            <a href={project.dropbox_url} target="_blank" rel="noopener noreferrer"
              className="block bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 hover:bg-blue-100 transition-colors">
              <p className="text-xs text-blue-600 font-semibold">📁 드롭박스 폴더</p>
              <p className="text-xs text-blue-400 mt-1 truncate">열기 ↗</p>
            </a>
          )}
        </aside>
      </div>

      <p className="text-center text-xs text-gray-300 mt-8">
        V2는 구축 중입니다. 한 단계씩 채워집니다.
      </p>
    </div>
  )
}

/* ── 우측 사이드 위젯들 ─────────────────────────────────── */

function BbangiCard({ project }: {
  project: Project; contracts: Contract[]; tasks: Task[]; logs: Log[]; currentUserId: string; leadIds: string[]
}) {
  return (
    <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
      <div className="px-4 py-2.5 border-b border-gray-100 flex items-center justify-between">
        <p className="text-xs font-semibold text-gray-700">🤖 빵빵이</p>
        <span className="text-[10px] text-gray-400">프로젝트 협업</span>
      </div>
      <ProjectClaudeChat
        projectId={project.id}
        projectName={project.name}
        serviceType={project.service_type}
        dropboxUrl={project.dropbox_url}
        defaultOpen={true}
      />
    </div>
  )
}

function BasicInfoCard({ customer, contactPerson, pmName, project }: {
  customer: Customer | null; contactPerson: ContactPerson | null; pmName: string | null; project: Project
}) {
  return (
    <div className="bg-white border border-gray-100 rounded-xl px-4 py-3 space-y-2.5">
      <p className="text-xs font-semibold text-gray-700">📋 기본정보</p>

      {customer ? (
        <div>
          <p className="text-[10px] text-gray-400 mb-0.5">고객사</p>
          <p className="text-sm font-medium text-gray-800">{customer.name}</p>
          {customer.type && <p className="text-[11px] text-gray-400">{customer.type}</p>}
        </div>
      ) : (
        <div>
          <p className="text-[10px] text-gray-400 mb-0.5">고객사</p>
          <p className="text-sm text-gray-400">미연결</p>
        </div>
      )}

      {(contactPerson || customer?.contact_name) && (
        <div>
          <p className="text-[10px] text-gray-400 mb-0.5">담당자</p>
          <p className="text-sm font-medium text-gray-800">
            {contactPerson?.name ?? customer?.contact_name}
            {contactPerson?.title && <span className="text-gray-400 font-normal ml-1">· {contactPerson.title}</span>}
          </p>
          {contactPerson?.dept && (
            <p className="text-[11px] text-gray-500">{contactPerson.dept}</p>
          )}
          {(contactPerson?.phone || customer?.phone) && (
            <p className="text-[11px] text-gray-400">{contactPerson?.phone ?? customer?.phone}</p>
          )}
          {(contactPerson?.email || customer?.contact_email) && (
            <p className="text-[11px] text-gray-400 truncate">{contactPerson?.email ?? customer?.contact_email}</p>
          )}
        </div>
      )}

      {pmName && (
        <div>
          <p className="text-[10px] text-gray-400 mb-0.5">PM</p>
          <p className="text-sm font-medium text-gray-800">{pmName}</p>
        </div>
      )}

      {project.service_type && (
        <div>
          <p className="text-[10px] text-gray-400 mb-0.5">서비스</p>
          <p className="text-sm text-gray-800">{project.service_type}</p>
        </div>
      )}
    </div>
  )
}

function FinanceCard({ finance, profitRate, receivedRate }: {
  finance: Finance; profitRate: number | null; receivedRate: number
}) {
  const profit = finance.revenue - finance.cost
  return (
    <div className="bg-white border border-gray-100 rounded-xl px-4 py-3 space-y-2.5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-gray-700">💰 재무 요약</p>
        <span className="text-[10px] text-gray-400">계약 {finance.contractCount}건</span>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-gray-500">매출</span>
          <span className="text-sm font-semibold text-gray-900">{fmtMoney(finance.revenue)}원</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-gray-500">원가</span>
          <span className="text-sm text-gray-600">{fmtMoney(finance.cost)}원</span>
        </div>
        <div className="flex items-center justify-between pt-1 border-t border-gray-50">
          <span className="text-[11px] text-gray-500">이익</span>
          <span className={`text-sm font-semibold ${profit >= 0 ? 'text-green-600' : 'text-red-500'}`}>
            {fmtMoney(profit)}원
            {profitRate !== null && (
              <span className="ml-1 text-[10px] text-gray-400">({profitRate}%)</span>
            )}
          </span>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-[11px] text-gray-500">수금</span>
          <span className="text-[11px] text-gray-600">{fmtMoney(finance.received)}원 / {receivedRate}%</span>
        </div>
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(receivedRate, 100)}%`, backgroundColor: receivedRate >= 100 ? '#22c55e' : '#FFCE00' }} />
        </div>
      </div>
    </div>
  )
}

function PlaceholderCard({ title, subtitle, small }: { title: string; subtitle: string; small?: boolean }) {
  return (
    <div className={`bg-white border border-dashed border-gray-200 rounded-xl ${small ? 'px-4 py-3' : 'px-5 py-4'}`}>
      <p className={`font-semibold text-gray-700 ${small ? 'text-xs' : 'text-sm'}`}>{title}</p>
      <p className="text-xs text-gray-400 mt-1">{subtitle}</p>
    </div>
  )
}

/* ── 1. 메모 (인라인 편집) ─────────────────────────────── */
function MemoBlock({ project }: { project: Project }) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [editing, setEditing] = useState(false)
  const [input, setInput] = useState(project.memo ?? '')

  function save() {
    startTransition(async () => {
      await updateProjectMemo(project.id, input)
      setEditing(false)
      router.refresh()
    })
  }

  return (
    <div className="bg-white border border-gray-100 rounded-xl px-5 py-3">
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-xs font-semibold text-gray-700">📝 메모</p>
        {!editing && (
          <button onClick={() => { setInput(project.memo ?? ''); setEditing(true) }}
            className="text-[11px] text-gray-400 hover:text-gray-700">
            {project.memo ? '편집' : '+ 추가'}
          </button>
        )}
      </div>
      {editing ? (
        <div className="space-y-2">
          <textarea value={input} onChange={e => setInput(e.target.value)} rows={3} autoFocus
            placeholder="프로젝트 일반 메모..."
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-yellow-400 bg-white" />
          <div className="flex gap-2">
            <button onClick={save}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg hover:opacity-80"
              style={{ backgroundColor: '#FFCE00', color: '#121212' }}>저장</button>
            <button onClick={() => setEditing(false)}
              className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg text-gray-500">취소</button>
          </div>
        </div>
      ) : project.memo ? (
        <p className="text-sm text-gray-700 whitespace-pre-line">{project.memo}</p>
      ) : (
        <p className="text-xs text-gray-400 italic">메모 없음</p>
      )}
    </div>
  )
}

/* ── 2. 2박스: 개요(빵빵이) / 협의해야할 내용 (빵빵이) ─── */
function TwoBoxesBlock({ project }: { project: Project }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <OverviewSummaryBox project={project} />
      <PendingDiscussionBox project={project} />
    </div>
  )
}

/* 협의해야할 내용 박스 — 빵빵이 자동 분석 + 직접 수정 */
function PendingDiscussionBox({ project }: { project: Project }) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [open, setOpen] = useState(true)
  const [editing, setEditing] = useState(false)
  const [input, setInput] = useState(project.pending_discussion ?? '')
  const [generating, setGenerating] = useState(false)
  const [genError, setGenError] = useState<string | null>(null)

  function save() {
    startTransition(async () => {
      await updateProjectPendingDiscussion(project.id, input)
      setEditing(false)
      router.refresh()
    })
  }

  async function generate() {
    setGenerating(true)
    setGenError(null)
    try {
      const res = await generateAndSavePendingDiscussion(project.id)
      if ('error' in res) setGenError(res.error)
      else { setInput(res.summary); router.refresh() }
    } catch (e: any) {
      setGenError(e?.message ?? '실패')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
      <button onClick={() => setOpen(o => !o)}
        className="w-full px-4 py-2.5 flex items-center justify-between hover:bg-gray-50 transition-colors text-left">
        <div>
          <p className="text-xs font-semibold text-gray-700">💭 협의해야할 내용</p>
          <p className="text-[10px] text-gray-400">빵빵이가 미결·협의 사항 분석</p>
        </div>
        <span className="text-gray-300 text-xs">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="px-4 py-3 border-t border-gray-50 space-y-2">
          {editing ? (
            <>
              <textarea value={input} onChange={e => setInput(e.target.value)} rows={8} autoFocus
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 resize-y focus:outline-none focus:ring-1 focus:ring-yellow-400 bg-white" />
              <div className="flex gap-2">
                <button onClick={save}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg hover:opacity-80"
                  style={{ backgroundColor: '#FFCE00', color: '#121212' }}>저장</button>
                <button onClick={() => { setEditing(false); setInput(project.pending_discussion ?? '') }}
                  className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg text-gray-500">취소</button>
              </div>
            </>
          ) : project.pending_discussion ? (
            <>
              <MarkdownText>{project.pending_discussion}</MarkdownText>
              <div className="flex gap-2 pt-1 border-t border-gray-50">
                <button onClick={generate} disabled={generating}
                  className="text-[11px] text-blue-500 hover:text-blue-700 disabled:opacity-40">
                  {generating ? '🤖 분석 중...' : '🤖 다시 분석'}
                </button>
                <button onClick={() => { setInput(project.pending_discussion ?? ''); setEditing(true) }}
                  className="text-[11px] text-gray-400 hover:text-gray-700">직접 수정</button>
              </div>
            </>
          ) : (
            <>
              <p className="text-[11px] text-gray-400 italic">아직 협의·미결 사항 분석이 없습니다.</p>
              <div className="flex gap-2">
                <button onClick={generate} disabled={generating}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg hover:opacity-80 disabled:opacity-40"
                  style={{ backgroundColor: '#FFCE00', color: '#121212' }}>
                  {generating ? '🤖 분석 중...' : '🤖 빵빵이로 분석'}
                </button>
                <button onClick={() => { setInput(''); setEditing(true) }}
                  className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg text-gray-500">직접 작성</button>
              </div>
            </>
          )}
          {genError && (
            <p className="text-[11px] text-red-500">⚠ {genError}</p>
          )}
        </div>
      )}
    </div>
  )
}

/* ── 2-A. 빵빵이 자동 개요 박스 ─────────────────────────── */
function OverviewSummaryBox({ project }: { project: Project }) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [open, setOpen] = useState(true)
  const [editing, setEditing] = useState(false)
  const [input, setInput] = useState(project.overview_summary ?? '')
  const [generating, setGenerating] = useState(false)
  const [genError, setGenError] = useState<string | null>(null)

  function save() {
    startTransition(async () => {
      await updateProjectOverviewSummary(project.id, input)
      setEditing(false)
      router.refresh()
    })
  }

  async function generate() {
    setGenerating(true)
    setGenError(null)
    try {
      const res = await generateAndSaveProjectOverview(project.id)
      if ('error' in res) {
        setGenError(res.error)
      } else {
        setInput(res.summary)
        router.refresh()
      }
    } catch (e: any) {
      setGenError(e?.message ?? '실패')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
      <button onClick={() => setOpen(o => !o)}
        className="w-full px-4 py-2.5 flex items-center justify-between hover:bg-gray-50 transition-colors text-left">
        <div>
          <p className="text-xs font-semibold text-gray-700">📌 프로젝트 개요</p>
          <p className="text-[10px] text-gray-400">빵빵이가 정리</p>
        </div>
        <span className="text-gray-300 text-xs">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="px-4 py-3 border-t border-gray-50 space-y-2">
          {editing ? (
            <>
              <textarea value={input} onChange={e => setInput(e.target.value)} rows={8} autoFocus
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 resize-y focus:outline-none focus:ring-1 focus:ring-yellow-400 bg-white" />
              <div className="flex gap-2">
                <button onClick={save}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg hover:opacity-80"
                  style={{ backgroundColor: '#FFCE00', color: '#121212' }}>저장</button>
                <button onClick={() => { setEditing(false); setInput(project.overview_summary ?? '') }}
                  className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg text-gray-500">취소</button>
              </div>
            </>
          ) : project.overview_summary ? (
            <>
              <MarkdownText>{project.overview_summary}</MarkdownText>
              <div className="flex gap-2 pt-1 border-t border-gray-50">
                <button onClick={generate} disabled={generating}
                  className="text-[11px] text-blue-500 hover:text-blue-700 disabled:opacity-40">
                  {generating ? '🤖 생성 중...' : '🤖 다시 생성'}
                </button>
                <button onClick={() => { setInput(project.overview_summary ?? ''); setEditing(true) }}
                  className="text-[11px] text-gray-400 hover:text-gray-700">직접 수정</button>
              </div>
            </>
          ) : (
            <>
              <p className="text-[11px] text-gray-400 italic">아직 작성된 개요가 없습니다.</p>
              <div className="flex gap-2">
                <button onClick={generate} disabled={generating}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg hover:opacity-80 disabled:opacity-40"
                  style={{ backgroundColor: '#FFCE00', color: '#121212' }}>
                  {generating ? '🤖 생성 중...' : '🤖 빵빵이로 자동 생성'}
                </button>
                <button onClick={() => { setInput(''); setEditing(true) }}
                  className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg text-gray-500">직접 작성</button>
              </div>
            </>
          )}
          {genError && (
            <p className="text-[11px] text-red-500">⚠ {genError}</p>
          )}
        </div>
      )}
    </div>
  )
}

/* ── 2-B. 자유 작성 박스 (work_description, pending_discussion 공용) ─── */
function EditableBox({ projectId, title, subtitle, value, save, emptyText }: {
  projectId: string
  title: string
  subtitle: string
  value: string | null
  save: (projectId: string, value: string) => Promise<void>
  emptyText: string
}) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [open, setOpen] = useState(true)
  const [editing, setEditing] = useState(false)
  const [input, setInput] = useState(value ?? '')

  function handleSave() {
    startTransition(async () => {
      await save(projectId, input)
      setEditing(false)
      router.refresh()
    })
  }

  return (
    <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
      <button onClick={() => setOpen(o => !o)}
        className="w-full px-4 py-2.5 flex items-center justify-between hover:bg-gray-50 transition-colors text-left">
        <div>
          <p className="text-xs font-semibold text-gray-700">{title}</p>
          <p className="text-[10px] text-gray-400">{subtitle}</p>
        </div>
        <span className="text-gray-300 text-xs">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="px-4 py-3 border-t border-gray-50 space-y-2">
          {editing ? (
            <>
              <textarea value={input} onChange={e => setInput(e.target.value)} rows={6} autoFocus
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 resize-y focus:outline-none focus:ring-1 focus:ring-yellow-400 bg-white" />
              <div className="flex gap-2">
                <button onClick={handleSave}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg hover:opacity-80"
                  style={{ backgroundColor: '#FFCE00', color: '#121212' }}>저장</button>
                <button onClick={() => { setEditing(false); setInput(value ?? '') }}
                  className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg text-gray-500">취소</button>
              </div>
            </>
          ) : value ? (
            <>
              <p className="text-sm text-gray-700 whitespace-pre-line">{value}</p>
              <button onClick={() => { setInput(value); setEditing(true) }}
                className="text-[11px] text-gray-400 hover:text-gray-700">편집</button>
            </>
          ) : (
            <>
              <p className="text-[11px] text-gray-400 italic">{emptyText}</p>
              <button onClick={() => { setInput(''); setEditing(true) }}
                className="text-[11px] text-blue-500 hover:text-blue-700">+ 추가</button>
            </>
          )}
        </div>
      )}
    </div>
  )
}

/* ── 3. 한눈에 (KPI 요약) ───────────────────────────────── */
function ProjectGlanceSection({ project, customer, pmName, contracts, tasks, finance }: {
  project: Project; customer: Customer | null; pmName: string | null
  contracts: Contract[]; tasks: Task[]; finance: Finance
}) {
  const completedRate = tasks.length > 0
    ? Math.round((tasks.filter(t => t.status === '완료').length / tasks.length) * 100)
    : 0
  const stage = contracts[0]?.contract_stage ?? null
  const profit = finance.revenue - finance.cost

  return (
    <div className="bg-white border border-gray-100 rounded-xl px-5 py-4 space-y-3">
      <p className="text-sm font-semibold text-gray-800">📊 한눈에</p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
        <div>
          <p className="text-[10px] text-gray-400 mb-1">고객사</p>
          <p className="font-medium text-gray-800 truncate">{customer?.name ?? '미연결'}</p>
        </div>
        <div>
          <p className="text-[10px] text-gray-400 mb-1">담당 PM</p>
          <p className="font-medium text-gray-800 truncate">{pmName ?? '미지정'}</p>
        </div>
        <div>
          <p className="text-[10px] text-gray-400 mb-1">계약 단계</p>
          <p className="font-medium text-gray-800">{stage ?? '—'}</p>
        </div>
        <div>
          <p className="text-[10px] text-gray-400 mb-1">매출 / 이익</p>
          <p className="font-medium text-gray-800">
            {fmtMoney(finance.revenue)}원
            <span className={`ml-1 text-xs ${profit >= 0 ? 'text-green-600' : 'text-red-500'}`}>
              ({fmtMoney(profit)}원)
            </span>
          </p>
        </div>
      </div>
      <div className="bg-gray-50 rounded-lg px-4 py-2.5">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-medium text-gray-600">업무 진행</span>
          <span className="text-xs text-gray-500">
            {tasks.length > 0 ? `${tasks.filter(t => t.status === '완료').length}/${tasks.length} · ${completedRate}%` : '업무 없음'}
          </span>
        </div>
        {tasks.length > 0 && (
          <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all" style={{ width: `${completedRate}%`, backgroundColor: completedRate === 100 ? '#22c55e' : '#FFCE00' }} />
          </div>
        )}
      </div>
    </div>
  )
}

/* ── 4. 할일 (별도 섹션) ─────────────────────────────────── */
function TasksSection({ tasks, contracts, projectId, profiles, serviceType }: {
  tasks: Task[]; contracts: Contract[]; projectId: string; profiles: ProfileOpt[]; serviceType: string | null
}) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const pendingTasks = tasks.filter(t => t.status !== '완료' && t.status !== '보류')
  const [newTitle, setNewTitle] = useState('')
  const [newAssigneeId, setNewAssigneeId] = useState('')
  const [newDue, setNewDue] = useState('')
  const [newPriority, setNewPriority] = useState('보통')
  const [showDetail, setShowDetail] = useState(false)
  const [suggesting, setSuggesting] = useState(false)
  const [suggestMsg, setSuggestMsg] = useState<string | null>(null)
  const canAdd = contracts.length > 0
  function add() {
    if (!newTitle.trim() || !canAdd) return
    const title = newTitle.trim()
    const firstSaleId = contracts[0].id
    startTransition(async () => {
      const result = await createTaskForProject(firstSaleId, title, newAssigneeId || null, newDue || null, newPriority, null)
      if (result && 'error' in result) {
        setSuggestMsg(`⚠ 추가 실패: ${result.error}`)
        setTimeout(() => setSuggestMsg(null), 8000)
        return
      }
      setNewTitle(''); setNewAssigneeId(''); setNewDue(''); setNewPriority('보통'); setShowDetail(false)
      setSuggestMsg('✓ 추가됨')
      setTimeout(() => setSuggestMsg(null), 2000)
      router.refresh()
    })
  }

  async function suggest() {
    setSuggesting(true)
    setSuggestMsg(null)
    try {
      const res = await generateAndSuggestTasks(projectId)
      if ('error' in res) {
        setSuggestMsg(`⚠ ${res.error}`)
      } else {
        setSuggestMsg(`🤖 ${res.added}건 추천 추가됨`)
        router.refresh()
      }
      setTimeout(() => setSuggestMsg(null), 4000)
    } catch (e: any) {
      setSuggestMsg(`⚠ ${e?.message ?? '실패'}`)
    } finally {
      setSuggesting(false)
    }
  }

  return (
    <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between gap-2 flex-wrap">
        <p className="text-sm font-semibold text-gray-800">✅ 할일 ({pendingTasks.length}/{tasks.length})</p>
        <div className="flex items-center gap-2">
          {suggestMsg && <span className="text-[11px] text-gray-500">{suggestMsg}</span>}
          {canAdd && (
            <button onClick={suggest} disabled={suggesting}
              className="text-xs px-2.5 py-1 rounded-lg border border-blue-200 text-blue-600 hover:bg-blue-50 disabled:opacity-50">
              {suggesting ? '🤖 분석 중...' : '🤖 빵빵이 추천'}
            </button>
          )}
          <Link href={`/projects/${projectId}`} className="text-xs text-gray-400 hover:text-gray-700">상세 편집 →</Link>
        </div>
      </div>
      {canAdd && (
        <div className="px-5 py-2 bg-yellow-50 border-b border-yellow-100 space-y-1.5">
          <div className="flex gap-2">
            <input value={newTitle} onChange={e => setNewTitle(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !showDetail) add() }}
              placeholder="할일 제목 (Enter로 추가)..."
              className="flex-1 text-xs border border-yellow-200 rounded px-2.5 py-1.5 bg-white focus:outline-none focus:border-yellow-400" />
            <button onClick={() => setShowDetail(s => !s)}
              className="text-[11px] text-gray-500 hover:text-gray-800 px-2 py-1.5 rounded">
              {showDetail ? '간단히' : '상세'}
            </button>
            <button onClick={add} disabled={!newTitle.trim()}
              className="text-xs px-3 py-1.5 rounded font-medium hover:opacity-80 disabled:opacity-40"
              style={{ backgroundColor: '#FFCE00', color: '#121212' }}>+ 추가</button>
          </div>
          {showDetail && (
            <div className="grid grid-cols-3 gap-1.5">
              <select value={newAssigneeId} onChange={e => setNewAssigneeId(e.target.value)}
                className="text-xs border border-yellow-200 rounded px-2 py-1.5 bg-white focus:outline-none focus:border-yellow-400">
                <option value="">담당자 (선택)</option>
                {profiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <input type="date" value={newDue} onChange={e => setNewDue(e.target.value)}
                className="text-xs border border-yellow-200 rounded px-2 py-1.5 bg-white focus:outline-none focus:border-yellow-400" />
              <select value={newPriority} onChange={e => setNewPriority(e.target.value)}
                className="text-xs border border-yellow-200 rounded px-2 py-1.5 bg-white focus:outline-none focus:border-yellow-400">
                {['낮음', '보통', '높음', '긴급'].map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          )}
        </div>
      )}
      {tasks.length === 0 ? (
        <p className="text-center py-6 text-xs text-gray-400">등록된 할일 없음</p>
      ) : (
        <ul className="divide-y divide-gray-50">
          {tasks.slice(0, 20).map(t => (
            <TaskRow key={t.id} task={t} profiles={profiles} projectId={projectId} serviceType={serviceType} />
          ))}
        </ul>
      )}
      {tasks.length > 20 && (
        <div className="px-5 py-2 border-t border-gray-50 text-center text-xs text-gray-400">
          +{tasks.length - 20}건 더
        </div>
      )}
    </div>
  )
}

/* ── 4-A. 할일 row: 클릭 → expand 인라인 편집 + 캘린더 연동 ─── */
const SERVICE_TO_CALENDAR: Record<string, string> = {
  'SOS': 'sos',
  '교구대여': 'rental',
  '행사대여': 'rental',
  '교육프로그램': 'artqium',
}
const CALENDAR_LABELS: Record<string, string> = {
  main: '개인/전체',
  sos: '사운드오브스쿨',
  rental: '렌탈',
  artqium: '아트키움',
}

function TaskRow({ task, profiles, projectId, serviceType }: {
  task: Task; profiles: ProfileOpt[]; projectId: string; serviceType: string | null
}) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [expanded, setExpanded] = useState(false)
  const [form, setForm] = useState({
    title: task.title,
    status: task.status,
    priority: task.priority ?? '보통',
    assignee_id: task.assignee_id ?? '',
    due_date: task.due_date ?? '',
    description: task.description ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [savedMsg, setSavedMsg] = useState<string | null>(null)

  // 캘린더 연동 폼
  const [calOpen, setCalOpen] = useState(false)
  const [calKey, setCalKey] = useState(serviceType ? (SERVICE_TO_CALENDAR[serviceType] ?? 'main') : 'main')
  const [calDate, setCalDate] = useState(task.due_date ?? '')
  const [calAllDay, setCalAllDay] = useState(true)
  const [calStart, setCalStart] = useState('09:00')
  const [calEnd, setCalEnd] = useState('18:00')
  const [calMsg, setCalMsg] = useState<string | null>(null)

  function save() {
    if (!form.title.trim()) return
    setSaving(true)
    const fd = new FormData()
    fd.set('id', task.id)
    fd.set('title', form.title.trim())
    fd.set('status', form.status)
    fd.set('priority', form.priority)
    fd.set('assignee_id', form.assignee_id)
    fd.set('due_date', form.due_date)
    fd.set('description', form.description)
    if (task.project_id) fd.set('sale_id', task.project_id) // task.project_id는 sale.id
    startTransition(async () => {
      try {
        await updateTask(fd)
        setSavedMsg('✓ 저장됨')
        setTimeout(() => setSavedMsg(null), 2000)
        router.refresh()
      } catch (e: any) {
        setSavedMsg(`⚠ ${e?.message ?? '실패'}`)
      } finally {
        setSaving(false)
      }
    })
  }

  function addToCalendar() {
    if (!calDate) {
      setCalMsg('⚠ 날짜를 선택하세요')
      return
    }
    setCalMsg('처리 중...')
    startTransition(async () => {
      const res = await createAndLinkCalendarEvent(projectId, calKey, {
        title: form.title.trim(),
        date: calDate,
        startTime: calAllDay ? undefined : calStart,
        endTime: calAllDay ? undefined : calEnd,
        description: form.description || undefined,
        isAllDay: calAllDay,
      })
      if (res.error) {
        setCalMsg(`⚠ ${res.error}`)
      } else {
        setCalMsg(`✓ ${CALENDAR_LABELS[calKey]} 캘린더에 추가됨`)
        setTimeout(() => setCalMsg(null), 4000)
        setCalOpen(false)
        router.refresh()
      }
    })
  }

  return (
    <li className={task.bbang_suggested ? 'bg-blue-50/40' : ''}>
      {/* 요약 row */}
      <button onClick={() => setExpanded(e => !e)} className="w-full px-5 py-2.5 hover:bg-gray-50 text-left">
        <div className="flex items-center gap-2">
          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${PRIORITY_DOT[task.priority ?? '보통'] ?? 'bg-gray-300'}`} />
          {task.bbang_suggested && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 font-semibold flex-shrink-0" title="빵빵이가 추천한 할 일">🤖</span>
          )}
          <span className={`flex-1 text-sm truncate ${task.status === '완료' ? 'line-through text-gray-300' : 'text-gray-700'}`}>{task.title}</span>
          {task.assignee_name && <span className="text-[11px] text-gray-500 flex-shrink-0">@{task.assignee_name}</span>}
          {task.due_date && <span className="text-[11px] text-gray-400 flex-shrink-0">{task.due_date.slice(5)}</span>}
          <span className={`text-[10px] px-2 py-0.5 rounded-full flex-shrink-0 ${TASK_STATUS_BADGE[task.status] ?? 'bg-gray-100 text-gray-500'}`}>{task.status}</span>
          <span className="text-gray-300 text-xs flex-shrink-0">{expanded ? '▲' : '▼'}</span>
        </div>
      </button>

      {/* 상세 편집 */}
      {expanded && (
        <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 space-y-2">
          <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            placeholder="제목" className="w-full text-sm font-medium border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:border-yellow-400" />
          <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            placeholder="상세 내용 (할 일의 배경, 산출물, 주의사항 등)" rows={3}
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:border-yellow-400 resize-none" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <select value={form.assignee_id} onChange={e => setForm(f => ({ ...f, assignee_id: e.target.value }))}
              className="text-xs border border-gray-200 rounded px-2 py-1.5 bg-white focus:outline-none focus:border-yellow-400">
              <option value="">담당자</option>
              {profiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))}
              className="text-xs border border-gray-200 rounded px-2 py-1.5 bg-white focus:outline-none focus:border-yellow-400" />
            <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}
              className="text-xs border border-gray-200 rounded px-2 py-1.5 bg-white focus:outline-none focus:border-yellow-400">
              {['낮음', '보통', '높음', '긴급'].map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
              className="text-xs border border-gray-200 rounded px-2 py-1.5 bg-white focus:outline-none focus:border-yellow-400">
              {['할 일', '진행중', '검토중', '완료', '보류'].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={save} disabled={saving || !form.title.trim()}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg hover:opacity-80 disabled:opacity-40"
              style={{ backgroundColor: '#FFCE00', color: '#121212' }}>
              {saving ? '저장 중...' : '💾 저장'}
            </button>
            <button onClick={() => setCalOpen(o => !o)}
              className="px-3 py-1.5 text-xs font-medium rounded-lg border border-blue-200 text-blue-600 hover:bg-blue-50">
              📅 캘린더에 추가
            </button>
            <button onClick={() => {
              if (!confirm(`"${task.title}" 할일을 삭제할까요?`)) return
              startTransition(async () => {
                await deleteTask(task.id, task.project_id ?? null)
                router.refresh()
              })
            }} className="ml-auto px-3 py-1.5 text-xs font-medium rounded-lg border border-red-200 text-red-500 hover:bg-red-50">
              🗑 삭제
            </button>
            {savedMsg && <span className="text-[11px] text-green-600">{savedMsg}</span>}
            {calMsg && <span className="text-[11px] text-gray-500">{calMsg}</span>}
          </div>

          {/* 캘린더 연동 폼 */}
          {calOpen && (
            <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 space-y-2">
              <p className="text-[11px] font-semibold text-blue-700">📅 구글 캘린더 일정 추가</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <select value={calKey} onChange={e => setCalKey(e.target.value)}
                  className="text-xs border border-blue-200 rounded px-2 py-1.5 bg-white focus:outline-none focus:border-blue-400">
                  {Object.entries(CALENDAR_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
                <input type="date" value={calDate} onChange={e => setCalDate(e.target.value)}
                  className="text-xs border border-blue-200 rounded px-2 py-1.5 bg-white focus:outline-none focus:border-blue-400" />
                <label className="flex items-center gap-1.5 text-xs text-gray-600 px-2">
                  <input type="checkbox" checked={calAllDay} onChange={e => setCalAllDay(e.target.checked)} />
                  종일
                </label>
              </div>
              {!calAllDay && (
                <div className="grid grid-cols-2 gap-2">
                  <input type="time" value={calStart} onChange={e => setCalStart(e.target.value)}
                    className="text-xs border border-blue-200 rounded px-2 py-1.5 bg-white focus:outline-none focus:border-blue-400" />
                  <input type="time" value={calEnd} onChange={e => setCalEnd(e.target.value)}
                    className="text-xs border border-blue-200 rounded px-2 py-1.5 bg-white focus:outline-none focus:border-blue-400" />
                </div>
              )}
              <div className="flex gap-2">
                <button onClick={addToCalendar}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-500 text-white hover:bg-blue-600">
                  추가
                </button>
                <button onClick={() => { setCalOpen(false); setCalMsg(null) }}
                  className="px-3 py-1.5 text-xs border border-blue-200 rounded-lg text-blue-600">
                  취소
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </li>
  )
}

/* ── 5. 일정 (due_date 임박 순) ─────────────────────────── */
function ScheduleSection({ tasks }: { tasks: Task[] }) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const upcoming = tasks
    .filter(t => t.due_date && t.status !== '완료' && t.status !== '보류')
    .map(t => ({ task: t, due: new Date(t.due_date!) }))
    .sort((a, b) => a.due.getTime() - b.due.getTime())
    .slice(0, 8)

  return (
    <div className="bg-white border border-gray-100 rounded-xl px-5 py-3">
      <p className="text-sm font-semibold text-gray-800 mb-2">📅 일정</p>
      {upcoming.length === 0 ? (
        <p className="text-xs text-gray-400 py-2">예정된 일정 없음 (할일에 기한 추가 시 표시)</p>
      ) : (
        <ul className="space-y-1.5">
          {upcoming.map(({ task, due }) => {
            const diffDays = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
            const overdue = diffDays < 0
            const today0 = diffDays === 0
            const soon = diffDays > 0 && diffDays <= 3
            return (
              <li key={task.id} className="flex items-center gap-2 text-xs">
                <span className={`px-2 py-0.5 rounded-full font-semibold flex-shrink-0 ${overdue ? 'bg-red-100 text-red-700' : today0 ? 'bg-red-100 text-red-700' : soon ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-500'}`}>
                  {overdue ? `D+${-diffDays}` : today0 ? 'D-day' : `D-${diffDays}`}
                </span>
                <span className="text-gray-700 flex-1 truncate">{task.title}</span>
                <span className="text-gray-400">{due.toISOString().slice(5, 10)}</span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

/* ── 8. 계약 관리 (별도) ─────────────────────────────────── */
function ContractsSection({ contracts, projectId }: { contracts: Contract[]; projectId: string }) {
  return (
    <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
        <p className="text-sm font-semibold text-gray-800">📜 계약 관리 ({contracts.length}건)</p>
        <Link href={`/projects/${projectId}`} className="text-xs text-gray-400 hover:text-gray-700">상세 편집 →</Link>
      </div>
      {contracts.length === 0 ? (
        <p className="text-center py-6 text-xs text-gray-400">등록된 계약 없음</p>
      ) : (
        <ul className="divide-y divide-gray-50">
          {contracts.map(c => (
            <li key={c.id} className="px-5 py-2.5 hover:bg-gray-50/50">
              <div className="flex items-center justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-800 truncate">{c.name}</p>
                  {c.client_org && <p className="text-[11px] text-gray-400 truncate">{c.client_org}</p>}
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {c.contract_stage && (
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${CONTRACT_STAGE_BADGE[c.contract_stage] ?? 'bg-gray-100 text-gray-500'}`}>
                      {c.contract_stage}
                    </span>
                  )}
                  {c.revenue !== null && c.revenue > 0 && (
                    <span className="text-xs font-medium text-gray-600">{fmtMoney(c.revenue)}원</span>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/* ── V1.7: 소통 Timeline ─────────────────────────────────── */
const LOG_ICON: Record<string, string> = {
  통화: '📞', 이메일: '✉️', 문자: '💬', 미팅: '🤝',
  내부회의: '🗣', 메모: '📝', 기타: '·',
  // 과거 데이터 호환
  방문: '🏢', 출장: '🚗',
}
const LOG_COLOR: Record<string, string> = {
  통화:     'bg-blue-50 text-blue-700 border-blue-100',
  이메일:   'bg-purple-50 text-purple-700 border-purple-100',
  문자:     'bg-yellow-50 text-yellow-700 border-yellow-100',
  미팅:     'bg-teal-50 text-teal-700 border-teal-100',
  내부회의: 'bg-orange-50 text-orange-700 border-orange-100',
  메모:     'bg-gray-50 text-gray-600 border-gray-100',
  기타:     'bg-gray-50 text-gray-500 border-gray-100',
  방문:     'bg-green-50 text-green-700 border-green-100',
  출장:     'bg-cyan-50 text-cyan-700 border-cyan-100',
}
const LOG_TYPES_NEW = ['통화', '이메일', '문자', '미팅', '내부회의', '메모', '기타']

/* ── V1.8: 연관 서비스 카드 ─────────────────────────────── */
const RENTAL_STATUS_BADGE: Record<string, string> = {
  유입: 'bg-gray-100 text-gray-500',
  견적발송: 'bg-purple-100 text-purple-700',
  렌탈확정: 'bg-yellow-100 text-yellow-700',
  진행중: 'bg-green-100 text-green-700',
  수거완료: 'bg-teal-100 text-teal-700',
  검수중: 'bg-blue-100 text-blue-700',
  완료: 'bg-gray-100 text-gray-400',
  취소: 'bg-red-100 text-red-400',
}

function fmtRentalRange(start: string | null, end: string | null) {
  if (!start && !end) return ''
  const s = start ? start.slice(5).replace('-', '/') : ''
  const e = end ? end.slice(5).replace('-', '/') : ''
  if (s && e) return `${s} ~ ${e}`
  return s || e
}

function RelatedServicesV2({ serviceType, rentals, contracts }: {
  serviceType: string | null; rentals: Rental[]; contracts: Contract[]
}) {
  const isRentalService = serviceType === '교구대여' || serviceType === '행사대여'
  const isSosService = serviceType === 'SOS'
  // 미래 확장: SOS, 교육프로그램 등
  const showSection = isRentalService || isSosService || rentals.length > 0
  if (!showSection) return null

  return (
    <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-gray-800">🔗 연관 서비스</p>
          <p className="text-[11px] text-gray-400 mt-0.5">서비스 페이지에서 세부 운영</p>
        </div>
        <Link href="/rentals" className="text-xs text-gray-400 hover:text-gray-700">
          전체 렌탈 →
        </Link>
      </div>

      {/* 렌탈 섹션 */}
      {(isRentalService || rentals.length > 0) && (
        <div className="px-5 py-3 border-b border-gray-50 last:border-0">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium text-gray-600">🛠 렌탈 ({rentals.length}건)</p>
            <Link
              href={`/rentals?from_project=${contracts[0]?.id ?? ''}`}
              className="text-xs px-2.5 py-1 rounded-lg font-medium hover:opacity-80"
              style={{ backgroundColor: '#FFCE00', color: '#121212' }}>
              + 새 렌탈
            </Link>
          </div>
          {rentals.length === 0 ? (
            <p className="text-xs text-gray-400 py-2">등록된 렌탈 없음</p>
          ) : (
            <div className="space-y-1.5">
              {rentals.map(r => (
                <Link
                  key={r.id}
                  href={`/rentals/${r.id}`}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors group border border-gray-50 hover:border-gray-200"
                >
                  <span className="text-base">🛠</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-800 truncate group-hover:text-blue-600">
                      {r.customer_name || '(이름 없음)'}
                    </p>
                    {(r.rental_start || r.rental_end) && (
                      <p className="text-[11px] text-gray-400">{fmtRentalRange(r.rental_start, r.rental_end)}</p>
                    )}
                  </div>
                  {r.status && (
                    <span className={`text-[10px] px-2 py-0.5 rounded-full flex-shrink-0 ${RENTAL_STATUS_BADGE[r.status] ?? 'bg-gray-100 text-gray-400'}`}>
                      {r.status}
                    </span>
                  )}
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SOS 섹션 (placeholder, 추후 구현) */}
      {isSosService && (
        <div className="px-5 py-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium text-gray-600">🎤 SOS 공연</p>
            <Link href="/sos" className="text-xs text-gray-400 hover:text-gray-700">SOS 페이지 →</Link>
          </div>
          <p className="text-xs text-gray-400 py-2">SOS 데이터 연동은 추후 추가</p>
        </div>
      )}
    </div>
  )
}

/* ── V1.9: 계약 + 업무 요약 ─────────────────────────────── */
const CONTRACT_STAGE_BADGE: Record<string, string> = {
  계약: 'bg-blue-50 text-blue-600',
  착수: 'bg-purple-50 text-purple-600',
  선금: 'bg-yellow-50 text-yellow-700',
  중도금: 'bg-orange-50 text-orange-600',
  완수: 'bg-teal-50 text-teal-600',
  계산서발행: 'bg-indigo-50 text-indigo-600',
  잔금: 'bg-green-50 text-green-600',
}
const TASK_STATUS_BADGE: Record<string, string> = {
  '할 일': 'bg-gray-100 text-gray-600',
  진행중: 'bg-blue-100 text-blue-700',
  검토중: 'bg-yellow-100 text-yellow-700',
  완료: 'bg-green-100 text-green-700',
  보류: 'bg-red-100 text-red-600',
}
const PRIORITY_DOT: Record<string, string> = {
  긴급: 'bg-red-500', 높음: 'bg-orange-400', 보통: 'bg-gray-300', 낮음: 'bg-gray-200',
}

function ContractsTasksSection({ contracts, tasks, projectId }: {
  contracts: Contract[]; tasks: Task[]; projectId: string
}) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const pendingTasks = tasks.filter(t => t.status !== '완료' && t.status !== '보류')

  // V1.12: 빠른 업무 추가 (계약 1건 이상일 때만)
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const canAddTask = contracts.length > 0
  function addTask() {
    if (!newTaskTitle.trim() || !canAddTask) return
    const title = newTaskTitle.trim()
    const firstSaleId = contracts[0].id
    startTransition(async () => {
      await createTaskForProject(firstSaleId, title, null, null, '보통', null)
      setNewTaskTitle('')
      router.refresh()
    })
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* 계약 목록 */}
      <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <p className="text-sm font-semibold text-gray-800">📜 계약 ({contracts.length}건)</p>
          <Link href={`/projects/${projectId}`} className="text-xs text-gray-400 hover:text-gray-700">상세 편집 →</Link>
        </div>
        {contracts.length === 0 ? (
          <p className="text-center py-6 text-xs text-gray-400">등록된 계약 없음</p>
        ) : (
          <ul className="divide-y divide-gray-50">
            {contracts.map(c => (
              <li key={c.id} className="px-5 py-2.5 hover:bg-gray-50/50">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-800 truncate">{c.name}</p>
                    {c.client_org && <p className="text-[11px] text-gray-400 truncate">{c.client_org}</p>}
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {c.contract_stage && (
                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${CONTRACT_STAGE_BADGE[c.contract_stage] ?? 'bg-gray-100 text-gray-500'}`}>
                        {c.contract_stage}
                      </span>
                    )}
                    {c.revenue !== null && c.revenue > 0 && (
                      <span className="text-xs font-medium text-gray-600">{fmtMoney(c.revenue)}원</span>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* 업무 목록 */}
      <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <p className="text-sm font-semibold text-gray-800">✅ 업무 ({pendingTasks.length}/{tasks.length})</p>
          <Link href={`/projects/${projectId}`} className="text-xs text-gray-400 hover:text-gray-700">상세 편집 →</Link>
        </div>
        {/* 빠른 추가 */}
        {canAddTask && (
          <div className="px-5 py-2 bg-yellow-50 border-b border-yellow-100">
            <div className="flex gap-2">
              <input value={newTaskTitle} onChange={e => setNewTaskTitle(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') addTask() }}
                placeholder="업무 제목 (Enter로 추가)..."
                className="flex-1 text-xs border border-yellow-200 rounded px-2.5 py-1.5 bg-white focus:outline-none focus:border-yellow-400" />
              <button onClick={addTask} disabled={!newTaskTitle.trim()}
                className="text-xs px-3 py-1.5 rounded font-medium hover:opacity-80 disabled:opacity-40"
                style={{ backgroundColor: '#FFCE00', color: '#121212' }}>+</button>
            </div>
          </div>
        )}
        {tasks.length === 0 ? (
          <p className="text-center py-6 text-xs text-gray-400">등록된 업무 없음</p>
        ) : (
          <ul className="divide-y divide-gray-50">
            {tasks.slice(0, 8).map(t => (
              <li key={t.id} className="px-5 py-2.5">
                <div className="flex items-center gap-2">
                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${PRIORITY_DOT[t.priority ?? '보통'] ?? 'bg-gray-300'}`} />
                  <span className={`flex-1 text-sm truncate ${t.status === '완료' ? 'line-through text-gray-300' : 'text-gray-700'}`}>{t.title}</span>
                  {t.due_date && <span className="text-[11px] text-gray-400 flex-shrink-0">{t.due_date.slice(5)}</span>}
                  <span className={`text-[10px] px-2 py-0.5 rounded-full flex-shrink-0 ${TASK_STATUS_BADGE[t.status] ?? 'bg-gray-100 text-gray-500'}`}>
                    {t.status}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
        {tasks.length > 8 && (
          <div className="px-5 py-2 border-t border-gray-50 text-center text-xs text-gray-400">
            +{tasks.length - 8}건 더 — 상세 페이지에서 보기
          </div>
        )}
      </div>
    </div>
  )
}

function CommunicationTimeline({ logs, contracts, projectId }: { logs: Log[]; contracts: Contract[]; projectId: string }) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const contractNameMap = Object.fromEntries(contracts.map(c => [c.id, c.name]))

  // V1.11: 필터·검색
  const [typeFilter, setTypeFilter] = useState<string>('전체')
  const [search, setSearch] = useState('')

  // V1.12: 인라인 추가
  const [adding, setAdding] = useState(false)
  const [newType, setNewType] = useState<string>('통화')
  const [newContent, setNewContent] = useState('')

  function submitNew() {
    if (!newContent.trim()) return
    const category = ['내부회의', '메모'].includes(newType) ? '내부' : '외부'
    startTransition(async () => {
      await createProjectLog(projectId, newContent.trim(), newType, category)
      setNewContent('')
      setAdding(false)
      router.refresh()
    })
  }

  const availableTypes = Array.from(new Set(logs.map(l => l.log_type)))
  const typeCounts = availableTypes.reduce<Record<string, number>>((acc, t) => {
    acc[t] = logs.filter(l => l.log_type === t).length
    return acc
  }, {})

  const filteredLogs = logs.filter(l => {
    if (typeFilter !== '전체' && l.log_type !== typeFilter) return false
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      const matched = (l.content ?? '').toLowerCase().includes(q)
        || (l.author_name ?? '').toLowerCase().includes(q)
        || (l.outcome ?? '').toLowerCase().includes(q)
        || (l.location ?? '').toLowerCase().includes(q)
      if (!matched) return false
    }
    return true
  })

  return (
    <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-100 space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-gray-800">💬 소통 Timeline</p>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">{filteredLogs.length} / {logs.length}건</span>
            <button onClick={() => setAdding(s => !s)}
              className="text-xs px-2 py-0.5 rounded font-medium hover:opacity-80"
              style={{ backgroundColor: '#FFCE00', color: '#121212' }}>
              {adding ? '닫기' : '+ 추가'}
            </button>
          </div>
        </div>

        {/* 인라인 소통 추가 */}
        {adding && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 space-y-2">
            <div className="flex gap-1.5 flex-wrap">
              {LOG_TYPES_NEW.map(t => (
                <button key={t} onClick={() => setNewType(t)}
                  className={`text-[11px] px-2 py-0.5 rounded-full border transition-all ${newType === t ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'}`}>
                  {LOG_ICON[t] ?? '·'} {t === '문자' ? '문자(카카오)' : t}
                </button>
              ))}
            </div>
            <textarea value={newContent} onChange={e => setNewContent(e.target.value)} rows={2}
              placeholder="소통 내용을 입력하세요..." autoFocus
              onKeyDown={e => { if (e.key === 'Enter' && e.metaKey) submitNew() }}
              className="w-full text-sm border border-yellow-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-yellow-400 bg-white" />
            <div className="flex gap-2">
              <button onClick={submitNew} disabled={!newContent.trim()}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg hover:opacity-80 disabled:opacity-40"
                style={{ backgroundColor: '#FFCE00', color: '#121212' }}>저장 (⌘+Enter)</button>
              <button onClick={() => { setAdding(false); setNewContent('') }}
                className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg text-gray-500">취소</button>
            </div>
          </div>
        )}
        {logs.length > 0 && (
          <>
            {/* 검색 */}
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="🔍 내용·작성자·결과·장소 검색..."
              className="w-full text-xs border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-yellow-400"
            />
            {/* 종류 필터 */}
            <div className="flex flex-wrap gap-1">
              <button onClick={() => setTypeFilter('전체')}
                className={`text-[11px] px-2 py-0.5 rounded-full border transition-all ${typeFilter === '전체' ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'}`}>
                전체 {logs.length}
              </button>
              {availableTypes.map(t => (
                <button key={t} onClick={() => setTypeFilter(t)}
                  className={`text-[11px] px-2 py-0.5 rounded-full border transition-all ${typeFilter === t ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'}`}>
                  {LOG_ICON[t] ?? '·'} {t} {typeCounts[t]}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
      {filteredLogs.length === 0 ? (
        <p className="text-center py-8 text-sm text-gray-400">
          {logs.length === 0 ? '소통 기록이 없습니다' : '검색 조건에 맞는 기록이 없습니다'}
        </p>
      ) : (
        <ul className="divide-y divide-gray-50">
          {filteredLogs.slice(0, 50).map(l => {
            const dateStr = (l.contacted_at ?? l.created_at).slice(0, 16).replace('T', ' ')
            const icon = LOG_ICON[l.log_type] ?? '·'
            const color = LOG_COLOR[l.log_type] ?? 'bg-gray-50 text-gray-600 border-gray-100'
            const saleName = l.sale_id ? contractNameMap[l.sale_id] : null
            return (
              <li key={l.id} className="px-5 py-3 hover:bg-gray-50/50">
                <div className="flex items-start gap-3">
                  <div className={`text-xs px-2 py-1 rounded-full border font-medium flex-shrink-0 ${color}`}>
                    <span className="mr-0.5">{icon}</span>{l.log_type}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-xs text-gray-400">{dateStr}</span>
                      {l.author_name && <span className="text-xs text-gray-500">· {l.author_name}</span>}
                      {saleName && <span className="text-[10px] text-purple-500 bg-purple-50 px-1.5 py-0.5 rounded">계약: {saleName.slice(0, 14)}</span>}
                    </div>
                    <p className="text-sm text-gray-700 whitespace-pre-line line-clamp-3">{l.content}</p>
                    {(l.location || (l.participants && l.participants.length > 0)) && (
                      <p className="text-[11px] text-gray-400 mt-1">
                        {l.location && <span>📍 {l.location}</span>}
                        {l.location && l.participants && l.participants.length > 0 && <span> · </span>}
                        {l.participants && l.participants.length > 0 && <span>참석: {l.participants.join(', ')}</span>}
                      </p>
                    )}
                    {l.outcome && (
                      <p className="text-[11px] text-blue-600 mt-1 bg-blue-50 px-2 py-1 rounded">→ {l.outcome}</p>
                    )}
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}
      {filteredLogs.length > 50 && (
        <div className="px-5 py-2 border-t border-gray-100 text-center">
          <span className="text-xs text-gray-400">최근 50건 표시 ({filteredLogs.length - 50}건 더 있음 — 검색으로 좁히세요)</span>
        </div>
      )}
    </div>
  )
}
