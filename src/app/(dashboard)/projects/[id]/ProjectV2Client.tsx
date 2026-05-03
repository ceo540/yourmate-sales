'use client'

import { useState, useTransition, useEffect } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import Link from 'next/link'
import ProjectClaudeChat from '@/components/ProjectClaudeChat'
import MarkdownText from '@/components/MarkdownText'
import MarkdownNoteBlock from '@/components/MarkdownNoteBlock'
import CustomerPicker from '@/components/CustomerPicker'
import dynamic from 'next/dynamic'

const BlockNoteEditor = dynamic(() => import('@/components/BlockNoteEditor'), { ssr: false })
import ProjectSettingsModal from './ProjectSettingsModal'
import ClassificationCard from './ClassificationCard'
import DropboxStatusBadge, { resolveDropboxStatus } from '@/components/DropboxStatus'
import QuickLogInput from '@/components/QuickLogInput'
import DropboxRetryButton from '@/components/DropboxRetryButton'
import CostModal from '../../sales/CostModal'
import CostPdfImportModal from '../../sales/[id]/CostPdfImportModal'
import { createClient as createSupabaseClient } from '@/lib/supabase/client'
import { askCompletionNote } from '@/lib/task-completion-prompt'
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
  updateProjectShortSummary,
  generateAndSaveProjectShortSummary,
  createAndLinkCalendarEvent,
  linkCalendarEvent,
  unlinkCalendarEvent,
  unlinkAndDeleteCalendarEvent,
  listProjectDropboxFiles,
  regenerateProjectBrief,
  getProjectBriefContent,
  deleteProjectLog,
  ensureContractFolder,
  createProjectDropboxFolder,
  updateContractStage,
  updateContractInfo,
  updateContractProgressStatus,
  togglePaymentReceived,
  addPaymentSchedule,
  deletePaymentSchedule,
  listSaleFolderPdfs,
  listProjectFolderPdfs,
  setSaleFinalQuote,
  analyzeFinalQuotePdf,
  analyzePdfByPath,
  applyQuoteAnalysis,
  createSaleFromQuote,
  deleteContract,
  createProjectMemo,
  updateProjectMemoCard,
  deleteProjectMemo,
  createSaleForProject,
  linkProjectCustomer,
  updateProjectStatus,
  addProjectMember,
  removeProjectMember,
  updateProjectContactPerson,
  createPersonAndLinkToProject,
} from './project-actions'
import { updateTask, deleteTask } from '../../sales/tasks/actions'
import { searchCalendarEvents } from '../../leads/actions'

type LinkedCalEvent = { id: string; calendarKey: string; title: string; date: string; color: string }
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
  short_summary: string | null
  work_description: string | null
  pending_discussion: string | null
  pending_discussion_client: string | null
  pending_discussion_internal: string | null
  pending_discussion_vendor: string | null
  customer_id: string | null
  contact_person_id: string | null
  pm_id: string | null
  linked_calendar_events: LinkedCalEvent[] | null
  // 운영 분류 (yourmate-company-spec-v2 §5~8) — Phase 3
  main_type: string | null
  expansion_tags: string[] | null
  capability_tags: string[] | null
  classification_confidence: number | null
  classification_note: string | null
  biz_completed_at: string | null
  finance_completed_at: string | null
}
interface Customer {
  id: string; name: string; type: string | null
  contact_name: string | null; phone: string | null; contact_email: string | null
}
interface ContactPerson {
  id: string; name: string; dept: string | null; title: string | null
  phone: string | null; email: string | null
}
interface CustomerPersonOpt {
  id: string; name: string; dept: string | null; title: string | null
}
interface Finance {
  revenue: number; cost: number; received: number; contractCount: number
  // N:M 분배 인지 영업이익 (yourmate-spec.md §3.3)
  // 1:1 케이스 = revenue·cost와 동일 결과. N:M 케이스 = 분배 비율 적용.
  profit?: number       // = revenue - cost (분배 후)
  margin?: number       // 이익률 (%)
  breakdown?: {
    sale_id: string
    sale_revenue: number
    revenue_share_pct: number
    revenue_attributed: number
    cost_share_pct: number
    cost_attributed: number
  }[]
}

interface WorkerEngagementProp {
  id: string
  worker_id: string
  worker_name: string
  worker_type: string
  worker_reuse_status: string
  role: string | null
  date_start: string | null
  date_end: string | null
  hours: number | null
  rate_type: string | null
  rate: number | null
  amount: number | null
  note: string | null
}
interface PaymentSchedule {
  id: string; label: string; amount: number
  due_date: string | null; is_received: boolean
  received_date: string | null; sort_order: number
}
interface Contract {
  id: string; name: string; revenue: number | null
  contract_stage: string | null; progress_status: string | null
  client_org: string | null
  client_dept: string | null
  entity_id: string | null
  dropbox_url: string | null
  contract_split_reason: string | null
  inflow_date: string | null
  payment_date: string | null
  final_quote_dropbox_path: string | null
  payment_schedules: PaymentSchedule[]
}
interface BusinessEntity {
  id: string; name: string; short_name: string | null
  is_primary: boolean; usage_note: string | null
}
interface Task {
  id: string; title: string; status: string; priority: string | null
  due_date: string | null; project_id: string | null
  assignee_id?: string | null
  assignee_name?: string | null
  description?: string | null
  bbang_suggested?: boolean
  created_at?: string | null
  // 완료 코멘트 (Phase 9.2)
  completed_at?: string | null
  completed_by?: string | null
  completed_by_name?: string | null
  completed_note?: string | null
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

type Memo = {
  id: string
  title: string | null
  content: string | null
  created_at: string
  updated_at: string
  author_name: string | null
}

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
  members: { profile_id: string; role: string; name: string }[]
  customersAll: { id: string; name: string; type: string | null }[]
  customerPersons: CustomerPersonOpt[]
  memos: Memo[]
  entities: BusinessEntity[]
  workerEngagements?: WorkerEngagementProp[]
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

type ProjectTab = 'core' | 'contract' | 'staff'
const VALID_TABS: ProjectTab[] = ['core', 'contract', 'staff']

export default function ProjectV2Client({
  project, pmName, customer, contactPerson, finance,
  contracts, tasks, logs, rentals, leadIds, profiles, currentUserId,
  members, customersAll, customerPersons, memos, entities, workerEngagements,
}: Props) {
  const [showSettings, setShowSettings] = useState(false)
  const [editingStatus, setEditingStatus] = useState(false)
  const [pendingStatus, startStatusTransition] = useTransition()

  // (Phase 9.5) 탭 구조 + URL query 동기화
  const _router = useRouter()
  const _searchParams = useSearchParams()
  const _pathname = usePathname()
  const initialTabRaw = _searchParams.get('tab')
  const initialTab: ProjectTab = (VALID_TABS as string[]).includes(initialTabRaw ?? '')
    ? (initialTabRaw as ProjectTab) : 'core'
  const [tab, setTab] = useState<ProjectTab>(initialTab)
  // tab 변경 → URL query update (history push, 새로고침·뒤로가기 보존)
  function handleTabChange(next: ProjectTab) {
    setTab(next)
    const sp = new URLSearchParams(_searchParams.toString())
    if (next === 'core') sp.delete('tab')
    else sp.set('tab', next)
    const qs = sp.toString()
    _router.replace(qs ? `${_pathname}?${qs}` : _pathname, { scroll: false })
  }
  // 외부에서 ?tab=... 변경 시 state sync (뒤로가기 등)
  useEffect(() => {
    const t = _searchParams.get('tab')
    const valid: ProjectTab = (VALID_TABS as string[]).includes(t ?? '') ? (t as ProjectTab) : 'core'
    if (valid !== tab) setTab(valid)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [_searchParams])

  const handleChangeStatus = (newStatus: string) => {
    if (newStatus === project.status) {
      setEditingStatus(false)
      return
    }
    startStatusTransition(async () => {
      const res = await updateProjectStatus(project.id, newStatus)
      if (res.cancelMsg) alert(`상태 변경됨 — 취소 후처리:\n${res.cancelMsg}`)
      setEditingStatus(false)
    })
  }

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
  // (Hydration safe) SSR(UTC) vs CSR(KST) 시간 차로 인한 mismatch 방지 — useEffect 후 클라이언트 시간으로 채움
  const [todayMs, setTodayMs] = useState<number | null>(null)
  useEffect(() => {
    const t = new Date(); t.setHours(0, 0, 0, 0)
    setTodayMs(t.getTime())
  }, [])
  const upcomingTasks = todayMs == null ? [] : tasks
    .filter(t => t.due_date && t.status !== '완료' && t.status !== '보류')
    .map(t => ({ task: t, due: new Date(t.due_date!) }))
    .filter(x => x.due.getTime() >= todayMs)
    .sort((a, b) => a.due.getTime() - b.due.getTime())
  const nextMilestone = upcomingTasks[0]
  const nextMilestoneDays = nextMilestone && todayMs != null
    ? Math.ceil((nextMilestone.due.getTime() - todayMs) / (1000 * 60 * 60 * 24))
    : null

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* ── 헤더 ── */}
      <div className="mb-5">
        <div className="flex items-center gap-2 mb-2 text-xs">
          <Link href="/projects" className="text-gray-400 hover:text-gray-700">← 프로젝트 목록</Link>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {project.project_number && (
            <span className="text-sm font-semibold text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full">
              {project.project_number}
            </span>
          )}
          <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
          {editingStatus ? (
            <select
              autoFocus
              value={project.status}
              onChange={e => handleChangeStatus(e.target.value)}
              onBlur={() => setEditingStatus(false)}
              disabled={pendingStatus}
              className="text-xs px-2 py-0.5 rounded-full font-medium border border-gray-300 bg-white"
            >
              {['기획중', '진행중', '완료', '취소', '보류'].map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          ) : (
            <button
              type="button"
              onClick={() => setEditingStatus(true)}
              title="클릭해서 상태 변경"
              className={`text-xs px-2 py-0.5 rounded-full font-medium hover:opacity-80 ${STATUS_CLR[project.status] ?? 'bg-gray-100 text-gray-500'}`}
            >
              {project.status}
            </button>
          )}
          {project.service_type && (
            <span className="text-xs text-gray-500 border border-gray-200 px-2 py-0.5 rounded-full" title="서비스 (영업용)">
              {project.service_type}
            </span>
          )}
          {/* 운영 분류 메인유형 배지 (Phase 5 가시성) */}
          {project.main_type && (
            <span
              className={`text-xs px-2.5 py-0.5 rounded-full font-semibold border ${
                project.main_type === '학교공연형'   ? 'bg-purple-50 text-purple-700 border-purple-200' :
                project.main_type === '교육운영형'   ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                project.main_type === '복합행사형'   ? 'bg-amber-50 text-amber-700 border-amber-200' :
                project.main_type === '렌탈·납품형'  ? 'bg-blue-50 text-blue-700 border-blue-200' :
                project.main_type === '콘텐츠제작형' ? 'bg-pink-50 text-pink-700 border-pink-200' :
                'bg-gray-100 text-gray-700 border-gray-200'
              }`}
              title="운영 분류 메인유형"
            >
              🧭 {project.main_type}
            </span>
          )}
          {/* Dropbox 상태 (Phase 6) */}
          <DropboxStatusBadge
            dropbox_url={project.dropbox_url}
            stage="project"
          />
          <ProjectMemberChips
            projectId={project.id}
            members={members}
            profiles={profiles}
            pmName={pmName}
          />
          <button
            onClick={() => setShowSettings(true)}
            className="ml-auto text-gray-400 hover:text-gray-700 p-1.5 rounded hover:bg-gray-100"
            title="프로젝트 설정"
          >
            ⚙️
          </button>
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

      {/* Dropbox 미연결 시 retry 안내 (Phase 7) */}
      {resolveDropboxStatus({ dropbox_url: project.dropbox_url, stage: 'project' }).kind === 'not_connected' && (
        <div className="mb-3 bg-red-50 border border-red-100 rounded-lg px-3 py-2 flex items-center gap-2 flex-wrap">
          <span className="text-xs text-red-700 font-medium">📁 운영 자료 폴더가 연결되어 있지 않아요.</span>
          <DropboxRetryButton stage="project" id={project.id} />
        </div>
      )}

      {/* ── 탭 헤더 (Phase 9.5) — sticky, URL 동기화 */}
      <div className="sticky top-0 z-10 -mx-4 px-4 py-2 bg-gradient-to-b from-gray-50 via-gray-50 to-transparent mb-3">
        <div className="flex items-center gap-2 border-b border-gray-200 pb-2 flex-wrap">
          {([
            { key: 'core',     label: '개요+실행', sub: '핵심' },
            { key: 'contract', label: '계약·정산', sub: `${contracts.length}건` },
            { key: 'staff',    label: '인력',      sub: `${(workerEngagements ?? []).length}건` },
          ] as { key: ProjectTab; label: string; sub: string }[]).map(t => (
            <button
              key={t.key}
              type="button"
              onClick={() => handleTabChange(t.key)}
              className={`text-sm px-4 py-2 rounded-full border transition-colors ${
                tab === t.key
                  ? 'bg-blue-50 border-blue-300 text-blue-700 font-bold'
                  : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {t.label} <span className="text-xs text-gray-500 ml-1">({t.sub})</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── 2-column 본문 (우측 460px — Phase 9.5 시안 매칭) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_460px] gap-5">
        {/* 좌: 탭별 메인 */}
        <div className="space-y-4">
          {/* === 개요+실행 탭 === */}
          {tab === 'core' && (
            <>
              {/* 1. 자동 개요 + 협의해야할 내용 (빵빵이) */}
              <TwoBoxesBlock project={project} />

              {/* 1.5. 운영 분류 (Phase 3) */}
              <ClassificationCard
                projectId={project.id}
                serviceType={project.service_type}
                projectName={project.name}
                initial={{
                  main_type: project.main_type,
                  expansion_tags: project.expansion_tags,
                  capability_tags: project.capability_tags,
                  classification_note: project.classification_note,
                  classification_confidence: project.classification_confidence,
                }}
              />

              {/* 2. 메모 + 유의사항 */}
              <MemosBlock projectId={project.id} memos={memos} legacyMemo={project.memo} />
              <NotesBlock project={project} />

              {/* 3. 할일 */}
              <TasksSection tasks={tasks} contracts={contracts} projectId={project.id} profiles={profiles} serviceType={project.service_type} currentUserId={currentUserId} />

              {/* 5. 일정 */}
              <ScheduleSection tasks={tasks} projectId={project.id} linkedEvents={project.linked_calendar_events ?? []} />

              {/* 6. 소통 Timeline */}
              <CommunicationTimeline logs={logs} contracts={contracts} projectId={project.id} />

              {/* 9. 자세한 개요 (PM 정독용) */}
              <OverviewSummaryBox project={project} />
            </>
          )}

          {/* === 계약·정산 탭 === */}
          {tab === 'contract' && (
            <>
              {/* 7. 연관 서비스 */}
              <RelatedServicesV2
                serviceType={project.service_type}
                rentals={rentals}
                contracts={contracts}
              />

              {/* 8. 계약 관리 (견적PDF/직접입력/결제일정 포함) */}
              <ContractsSection contracts={contracts} projectId={project.id} entities={entities}
                defaultCustomerId={customer?.id ?? null} defaultCustomerName={customer?.name ?? null}
                customersAll={customersAll} />
            </>
          )}

          {/* === 인력 탭 === */}
          {tab === 'staff' && (
            <>
              <WorkerEngagementsBlock projectId={project.id} engagements={workerEngagements ?? []} />
              {/* 인력 정산/이력은 권한 분리 안내 카드만 (단가 등 민감 필드는 WorkerEngagementsBlock 내부 정책 그대로) */}
              <div className="bg-white border border-gray-100 rounded-xl p-4">
                <p className="text-sm font-semibold text-gray-700 mb-1">🧾 인력 정산·이력</p>
                <p className="text-xs text-gray-500">참여 시간·역할·기간 기록은 위 [외부 인력 참여] 카드에. 단가·정산 필드는 admin/manager에만 노출(권한 정책).</p>
              </div>
            </>
          )}
        </div>

        {/* 우: 사이드 (탭 무관, sticky) */}
        <aside className="space-y-3 lg:sticky lg:top-4 self-start">
          {/* 🤖 빵빵이 — V1.3 */}
          <BbangiCard project={project} contracts={contracts} tasks={tasks} logs={logs} currentUserId={currentUserId} leadIds={leadIds} />

          {/* 📋 기본정보 — V1.4 */}
          <BasicInfoCard customer={customer} contactPerson={contactPerson} pmName={pmName} project={project} customersAll={customersAll} customerPersons={customerPersons} />

          {/* 💰 재무 요약 — V1.5 */}
          <FinanceCard finance={finance} profitRate={profitRate} receivedRate={receivedRate} contracts={contracts} projectId={project.id} />

          {/* 📁 드롭박스 */}
          {project.dropbox_url
            ? <DropboxFilesCard dropboxUrl={project.dropbox_url} projectId={project.id} />
            : <DropboxEmptyCard projectId={project.id} serviceType={project.service_type} />
          }
        </aside>
      </div>

      {showSettings && (
        <ProjectSettingsModal
          projectId={project.id}
          projectName={project.name}
          customerId={project.customer_id ?? null}
          customer={customer ? { id: customer.id, name: customer.name } : null}
          pmId={project.pm_id}
          dropboxUrl={project.dropbox_url}
          serviceType={project.service_type}
          customersAll={customersAll}
          profiles={profiles}
          members={members}
          onClose={() => setShowSettings(false)}
        />
      )}
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

function ProjectMemberChips({ projectId, members, profiles, pmName }: {
  projectId: string
  members: { profile_id: string; role: string; name: string }[]
  profiles: ProfileOpt[]
  pmName: string | null
}) {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [selectedProfile, setSelectedProfile] = useState('')
  const [selectedRole, setSelectedRole] = useState('팀원')

  const pmMember = members.find(m => m.role === 'PM')
  const pmId = pmMember?.profile_id ?? null
  const [editingPm, setEditingPm] = useState(false)
  const [draftPm, setDraftPm] = useState<string>('')

  const handleChangePm = () => {
    if (draftPm === (pmId ?? '')) {
      setEditingPm(false)
      return
    }
    startTransition(async () => {
      try {
        if (pmId) await removeProjectMember(projectId, pmId)
        if (draftPm) await addProjectMember(projectId, draftPm, 'PM')
        setEditingPm(false)
      } catch (e) {
        alert(`PM 변경 실패: ${e instanceof Error ? e.message : ''}`)
      }
    })
  }

  const memberIds = new Set(members.map(m => m.profile_id))
  const candidates = profiles.filter(p => !memberIds.has(p.id))

  const handleAdd = () => {
    if (!selectedProfile) return
    startTransition(async () => {
      try {
        await addProjectMember(projectId, selectedProfile, selectedRole)
        setSelectedProfile('')
        setOpen(false)
      } catch (e) {
        alert(`추가 실패: ${e instanceof Error ? e.message : ''}`)
      }
    })
  }

  const handleRemove = (profileId: string, name: string) => {
    if (!confirm(`${name}을(를) 멤버에서 제거할까?`)) return
    startTransition(async () => {
      try {
        await removeProjectMember(projectId, profileId)
      } catch (e) {
        alert(`제거 실패: ${e instanceof Error ? e.message : ''}`)
      }
    })
  }

  return (
    <div className="flex items-center gap-1.5">
      {editingPm ? (
        <div className="flex items-center gap-1 bg-gray-50 rounded px-1.5 py-0.5 mr-1">
          <span className="text-[10px] text-gray-400">PM</span>
          <select
            autoFocus
            value={draftPm}
            onChange={e => setDraftPm(e.target.value)}
            disabled={pending}
            className="text-xs border border-gray-200 rounded px-1 py-0.5"
          >
            <option value="">미지정</option>
            {profiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <button
            type="button"
            onClick={handleChangePm}
            disabled={pending}
            className="text-[10px] px-1.5 py-0.5 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {pending ? '...' : '저장'}
          </button>
          <button
            type="button"
            onClick={() => setEditingPm(false)}
            className="text-[10px] text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => { setDraftPm(pmId ?? ''); setEditingPm(true) }}
          title="클릭해서 PM 변경"
          className="text-xs text-gray-400 hover:text-gray-700 hover:bg-gray-50 rounded px-1.5 py-0.5 mr-1"
        >
          PM {pmName ?? '미지정'}
        </button>
      )}
      <div className="flex flex-wrap items-center gap-1">
        {members.filter(m => m.role !== 'PM').map(m => (
          <button
            key={m.profile_id}
            type="button"
            onClick={() => handleRemove(m.profile_id, m.name)}
            title={`${m.role} — 클릭해서 제거`}
            disabled={pending}
            className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 hover:bg-red-50 hover:text-red-700 hover:border-red-200 transition-colors disabled:opacity-50"
          >
            {m.name}
            {m.role !== '팀원' && <span className="text-[10px] text-gray-400 ml-0.5">·{m.role}</span>}
          </button>
        ))}
      </div>
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          title="멤버 추가"
          className="w-6 h-6 rounded-full border border-dashed border-gray-300 text-gray-400 text-xs hover:border-blue-400 hover:text-blue-500"
        >
          +
        </button>
        {open && (
          <div className="absolute top-7 left-0 z-30 bg-white border border-gray-200 rounded shadow-lg p-2 min-w-[240px] space-y-1.5">
            <div className="text-[10px] font-semibold text-gray-500">멤버 추가</div>
            <select
              value={selectedProfile}
              onChange={e => setSelectedProfile(e.target.value)}
              autoFocus
              className="w-full text-xs border border-gray-200 rounded px-2 py-1"
            >
              <option value="">-- 선택 --</option>
              {candidates.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <div className="flex gap-1">
              <select
                value={selectedRole}
                onChange={e => setSelectedRole(e.target.value)}
                className="flex-1 text-xs border border-gray-200 rounded px-2 py-1"
              >
                <option value="팀원">팀원</option>
                <option value="PM">PM</option>
                <option value="기타">기타</option>
              </select>
              <button
                type="button"
                onClick={handleAdd}
                disabled={!selectedProfile || pending}
                className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {pending ? '...' : '추가'}
              </button>
              <button
                type="button"
                onClick={() => { setOpen(false); setSelectedProfile('') }}
                className="text-xs px-2 py-1 text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            {candidates.length === 0 && (
              <p className="text-[10px] text-gray-400">추가 가능한 프로필이 없어</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function ContactPersonSection({ customer, contactPerson, customerPersons, projectId }: {
  customer: Customer | null
  contactPerson: ContactPerson | null
  customerPersons: CustomerPersonOpt[]
  projectId: string
}) {
  const [editing, setEditing] = useState(false)
  const [pending, startTransition] = useTransition()
  const [draftPersonId, setDraftPersonId] = useState<string>('')
  const [newName, setNewName] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newDept, setNewDept] = useState('')
  const [newTitle, setNewTitle] = useState('')

  useEffect(() => {
    if (editing) {
      setDraftPersonId(contactPerson?.id ?? '')
      setNewName(''); setNewPhone(''); setNewEmail(''); setNewDept(''); setNewTitle('')
    }
  }, [editing, contactPerson?.id])

  const handleSave = () => {
    if (draftPersonId === 'new') {
      if (!customer) { alert('고객사가 먼저 연결되어야 새 담당자 등록 가능'); return }
      if (!newName.trim()) { alert('이름은 필수'); return }
      startTransition(async () => {
        const res = await createPersonAndLinkToProject({
          projectId,
          customerId: customer.id,
          name: newName,
          phone: newPhone,
          email: newEmail,
          dept: newDept,
          title: newTitle,
        })
        if (!res.ok) { alert(res.error); return }
        setEditing(false)
      })
      return
    }
    if (draftPersonId === (contactPerson?.id ?? '')) {
      setEditing(false)
      return
    }
    startTransition(async () => {
      await updateProjectContactPerson(projectId, draftPersonId || null)
      setEditing(false)
    })
  }

  if (!customer && !contactPerson) return null

  return (
    <div>
      <div className="flex items-center justify-between mb-0.5">
        <p className="text-[10px] text-gray-400">고객</p>
        {!editing && customer && (
          <button onClick={() => setEditing(true)} className="text-[10px] text-blue-500 hover:text-blue-700">
            변경
          </button>
        )}
      </div>
      {editing ? (
        <div className="space-y-1.5">
          <select
            value={draftPersonId}
            onChange={e => setDraftPersonId(e.target.value)}
            disabled={pending}
            autoFocus
            className="w-full text-xs border border-gray-200 rounded px-2 py-1"
          >
            <option value="">-- 미지정 (자동 fallback) --</option>
            {customerPersons.map(p => (
              <option key={p.id} value={p.id}>
                {p.name}{p.title ? ` (${p.title})` : ''}{p.dept ? ` · ${p.dept}` : ''}
              </option>
            ))}
            <option value="new">+ 새 담당자 등록</option>
          </select>
          {draftPersonId === 'new' && (
            <div className="space-y-1 bg-gray-50 rounded p-2">
              <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="이름 *" className="w-full text-xs border border-gray-200 rounded px-2 py-1" />
              <div className="flex gap-1">
                <input value={newDept} onChange={e => setNewDept(e.target.value)} placeholder="부서" className="flex-1 text-xs border border-gray-200 rounded px-2 py-1" />
                <input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="직급" className="flex-1 text-xs border border-gray-200 rounded px-2 py-1" />
              </div>
              <input value={newPhone} onChange={e => setNewPhone(e.target.value)} placeholder="연락처" className="w-full text-xs border border-gray-200 rounded px-2 py-1" />
              <input value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="이메일" className="w-full text-xs border border-gray-200 rounded px-2 py-1" />
            </div>
          )}
          <div className="flex gap-1">
            <button onClick={handleSave} disabled={pending} className="text-[10px] px-2 py-0.5 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">
              {pending ? '저장 중…' : '저장'}
            </button>
            <button onClick={() => setEditing(false)} disabled={pending} className="text-[10px] px-2 py-0.5 text-gray-500 hover:text-gray-700">
              취소
            </button>
          </div>
        </div>
      ) : contactPerson ? (
        <>
          <p className="text-sm font-medium text-gray-800">
            {contactPerson.name}
            {contactPerson.title && <span className="text-gray-400 font-normal ml-1">· {contactPerson.title}</span>}
          </p>
          {contactPerson.dept && (
            <p className="text-[11px] text-gray-500">{contactPerson.dept}</p>
          )}
          {contactPerson.phone && (
            <p className="text-[11px] text-gray-400">{contactPerson.phone}</p>
          )}
          {contactPerson.email && (
            <p className="text-[11px] text-gray-400 truncate">{contactPerson.email}</p>
          )}
        </>
      ) : customer?.contact_name ? (
        <>
          <p className="text-sm font-medium text-gray-800">{customer.contact_name}</p>
          {customer.phone && <p className="text-[11px] text-gray-400">{customer.phone}</p>}
          {customer.contact_email && <p className="text-[11px] text-gray-400 truncate">{customer.contact_email}</p>}
        </>
      ) : (
        <p className="text-sm text-gray-400">미지정</p>
      )}
    </div>
  )
}

function BasicInfoCard({ customer, contactPerson, pmName, project, customersAll, customerPersons }: {
  customer: Customer | null; contactPerson: ContactPerson | null; pmName: string | null; project: Project
  customersAll: { id: string; name: string; type: string | null }[]
  customerPersons: CustomerPersonOpt[]
}) {
  const [editingCustomer, setEditingCustomer] = useState(false)
  const [pendingCustomer, startCustomerTransition] = useTransition()
  const [draftCustomerId, setDraftCustomerId] = useState<string>('')
  const [draftCustomerName, setDraftCustomerName] = useState<string>('')

  useEffect(() => {
    if (editingCustomer) {
      setDraftCustomerId(customer?.id ?? '')
      setDraftCustomerName(customer?.name ?? '')
    }
  }, [editingCustomer, customer])

  const handleSaveCustomer = () => {
    if (!draftCustomerId || draftCustomerId === customer?.id) {
      setEditingCustomer(false)
      return
    }
    startCustomerTransition(async () => {
      await linkProjectCustomer(project.id, draftCustomerId)
      setEditingCustomer(false)
    })
  }

  return (
    <div className="bg-white border border-gray-100 rounded-xl px-4 py-3 space-y-2.5">
      <p className="text-xs font-semibold text-gray-700">📋 기본정보</p>

      <div>
        <div className="flex items-center justify-between mb-0.5">
          <p className="text-[10px] text-gray-400">고객사</p>
          {!editingCustomer && (
            <button
              onClick={() => setEditingCustomer(true)}
              className="text-[10px] text-blue-500 hover:text-blue-700"
            >
              변경
            </button>
          )}
        </div>
        {editingCustomer ? (
          <div className="space-y-1.5">
            <CustomerPicker
              value={draftCustomerId}
              selectedName={draftCustomerName}
              customers={customersAll}
              onChange={(id, name) => { setDraftCustomerId(id); setDraftCustomerName(name) }}
              placeholder="고객사 검색"
            />
            <div className="flex gap-1">
              <button
                onClick={handleSaveCustomer}
                disabled={pendingCustomer || !draftCustomerId || draftCustomerId === customer?.id}
                className="text-[10px] px-2 py-0.5 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {pendingCustomer ? '저장 중…' : '저장'}
              </button>
              <button
                onClick={() => setEditingCustomer(false)}
                disabled={pendingCustomer}
                className="text-[10px] px-2 py-0.5 text-gray-500 hover:text-gray-700"
              >
                취소
              </button>
            </div>
          </div>
        ) : customer ? (
          <>
            <p className="text-sm font-medium text-gray-800">{customer.name}</p>
            {customer.type && <p className="text-[11px] text-gray-400">{customer.type}</p>}
          </>
        ) : (
          <p className="text-sm text-gray-400">미연결</p>
        )}
      </div>

      <ContactPersonSection
        customer={customer}
        contactPerson={contactPerson}
        customerPersons={customerPersons}
        projectId={project.id}
      />


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

function FinanceCard({ finance, profitRate, receivedRate, contracts, projectId }: {
  finance: Finance; profitRate: number | null; receivedRate: number
  contracts?: Contract[]
  projectId?: string
}) {
  const router = useRouter()
  const profit = finance.revenue - finance.cost
  const contractNameMap = new Map((contracts ?? []).map(c => [c.id, c.name]))
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState<string>('')
  const [pending, startTransition] = useTransition()

  const handleSave = (saleId: string) => {
    if (!projectId) return
    const pct = Number(editValue)
    if (isNaN(pct) || pct < 0 || pct > 100) {
      alert('0~100 사이 숫자')
      return
    }
    startTransition(async () => {
      const { updateSaleProjectShareAction } = await import('@/lib/sale-projects-actions')
      const r = await updateSaleProjectShareAction({
        sale_id: saleId, project_id: projectId, revenue_share_pct: pct,
      })
      if ('error' in r) {
        alert(`수정 실패: ${r.error}`)
        return
      }
      setEditingId(null)
      router.refresh()
      if (r.total_revenue_share_pct !== 100) {
        // 합계 100% 안 맞으면 작은 알림
        setTimeout(() => alert(`⚠️ 이 계약의 분배 합계: ${r.total_revenue_share_pct}% (100%가 아님)`), 100)
      }
    })
  }

  const handleUnlink = (saleId: string, name: string) => {
    if (!projectId) return
    if (!confirm(`"${name}" 매핑을 해제하시겠어요?\n(계약·프로젝트 자체는 유지됩니다)`)) return
    startTransition(async () => {
      const { unlinkSaleProjectAction } = await import('@/lib/sale-projects-actions')
      const r = await unlinkSaleProjectAction({ sale_id: saleId, project_id: projectId })
      if ('error' in r) {
        alert(`해제 실패: ${r.error}`)
        return
      }
      router.refresh()
    })
  }
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

      {/* 분배 명세 — 2개 이상 계약 매핑 시만 표시 (1:1 케이스는 안 보임) */}
      {finance.breakdown && finance.breakdown.length > 1 && (
        <div className="pt-1 border-t border-gray-50">
          <p className="text-[10px] text-gray-400 mb-1">
            계약 매핑 명세 (N:M)
            {projectId && (
              <span className="ml-1 text-[9px] text-gray-300">
                · 빵빵이에게 "이 프로젝트에 (계약명) N% 분배 추가해줘" 자연어 입력 가능
              </span>
            )}
          </p>
          <div className="space-y-0.5">
            {finance.breakdown.map((b) => {
              const name = contractNameMap.get(b.sale_id) || b.sale_id.slice(0, 8)
              const isEditing = editingId === b.sale_id
              return (
                <div key={b.sale_id} className="flex items-center justify-between text-[10px] text-gray-500 gap-2 group">
                  <span className="truncate flex-1" title={name}>{name}</span>
                  {isEditing ? (
                    <span className="flex items-center gap-1">
                      <input
                        type="number" min={0} max={100} step={1}
                        value={editValue}
                        onChange={e => setEditValue(e.target.value)}
                        className="w-12 px-1 py-0.5 text-[10px] border border-gray-300 rounded"
                        disabled={pending}
                        autoFocus
                      />
                      <span>%</span>
                      <button
                        onClick={() => handleSave(b.sale_id)}
                        disabled={pending}
                        className="text-blue-600 hover:underline px-1"
                      >저장</button>
                      <button
                        onClick={() => setEditingId(null)}
                        disabled={pending}
                        className="text-gray-400 hover:underline px-1"
                      >취소</button>
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 whitespace-nowrap">
                      <span>{b.revenue_share_pct}% · {fmtMoney(b.revenue_attributed)}원</span>
                      {projectId && (
                        <span className="flex items-center gap-0.5 ml-1">
                          <button
                            onClick={() => { setEditingId(b.sale_id); setEditValue(String(b.revenue_share_pct)) }}
                            title="비율 수정"
                            className="text-blue-500 hover:text-blue-700 hover:bg-blue-50 text-[11px] px-1 rounded"
                          >✏️</button>
                          <button
                            onClick={() => handleUnlink(b.sale_id, name)}
                            title="매핑 해제"
                            className="text-red-400 hover:text-red-600 hover:bg-red-50 text-[11px] px-1 rounded"
                          >✕</button>
                        </span>
                      )}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

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

/* ── 1. 메모 / 유의사항 — 공용 MarkdownNoteBlock 사용 ── */
function NotesBlock({ project }: { project: Project }) {
  return (
    <MarkdownNoteBlock
      entityId={project.id}
      title="⚠ 유의사항"
      value={project.notes}
      save={updateProjectNotes}
      emptyText="특이사항·주의사항을 입력하세요"
      accentClass="border-orange-100 bg-orange-50/30"
      headerClass="text-orange-700"
      defaultCollapsed
    />
  )
}

// 메모 카드 리스트 — project_memos 테이블 기반 multiple
function WorkerEngagementsBlock({ projectId, engagements }: {
  projectId: string
  engagements: WorkerEngagementProp[]
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  void projectId

  const total = engagements.reduce((s, e) => s + (e.amount ?? 0), 0)

  const handleUnlink = (engagementId: string, workerName: string) => {
    if (!confirm(`${workerName} 참여 기록을 보류 처리할까요?\n(삭제 X — archive_status='cancelled' 이동)`)) return
    startTransition(async () => {
      const res = await fetch('/api/admin/worker-engagement-archive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ engagement_id: engagementId, archive_status: 'cancelled' }),
      })
      if (!res.ok) { alert('실패'); return }
      router.refresh()
    })
  }

  return (
    <section className="bg-white rounded-2xl border border-gray-100 p-4">
      <header className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-700">🎤 외부 인력 참여 ({engagements.length}건)</h2>
        <span className="text-xs text-gray-500">총 {(total / 10000).toFixed(0)}만원</span>
      </header>
      {engagements.length === 0 ? (
        <p className="text-xs text-gray-400">
          참여 기록 없음. 빵빵이에게: <code className="bg-gray-50 px-1 rounded">"이 프로젝트에 (강사명) N시간 (날짜) 참여 기록해줘"</code>
        </p>
      ) : (
        <div className="space-y-1.5">
          {engagements.map(e => (
            <div key={e.id} className="flex items-center justify-between text-xs bg-gray-50 rounded px-3 py-2 gap-3 group">
              <span className="font-medium text-gray-800 min-w-[80px]">{e.worker_name}</span>
              <span className="text-gray-500">{e.worker_type}</span>
              <span className="text-gray-500 truncate flex-1">{e.role ?? '—'}</span>
              <span className="text-gray-500">{e.date_start ?? '—'}</span>
              <span className="text-gray-500">
                {e.rate_type === 'per_hour' && e.hours ? `${e.hours}시간 × ${(e.rate ?? 0) / 10000}만` : `${(e.rate ?? 0) / 10000}만/${e.rate_type === 'per_session' ? '회' : '건'}`}
              </span>
              <span className="font-semibold text-gray-700">{((e.amount ?? 0) / 10000).toFixed(0)}만원</span>
              <button
                onClick={() => handleUnlink(e.id, e.worker_name)}
                disabled={pending}
                className="text-red-400 hover:text-red-600 hover:bg-red-50 text-[11px] px-1.5 py-0.5 rounded"
                title="보류 처리"
              >✕</button>
            </div>
          ))}
        </div>
      )}
      <p className="mt-2 text-[11px] text-gray-400">
        💡 빵빵이로 추가·검색·평가 가능. <a href="/workers" className="text-blue-500 hover:underline">/workers 페이지 →</a>
      </p>
    </section>
  )
}

function MemosBlock({ projectId, memos, legacyMemo }: {
  projectId: string
  memos: Memo[]
  legacyMemo: string | null
}) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [collapsed, setCollapsed] = useState(true)
  const [adding, setAdding] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newContent, setNewContent] = useState('')
  const [legacyImported, setLegacyImported] = useState(false)

  function add() {
    if (!newContent.trim() && !newTitle.trim()) return
    startTransition(async () => {
      await createProjectMemo(projectId, { title: newTitle.trim(), content: newContent.trim() })
      setNewTitle(''); setNewContent(''); setAdding(false)
      router.refresh()
    })
  }

  // 레거시 projects.memo가 있고 아직 카드로 옮겨지지 않았으면 안내 + "카드로 변환" 버튼
  async function importLegacy() {
    if (!legacyMemo) return
    startTransition(async () => {
      await createProjectMemo(projectId, { title: '메모', content: legacyMemo })
      // 레거시 필드 비우기
      await updateProjectMemo(projectId, '')
      setLegacyImported(true)
      router.refresh()
    })
  }

  return (
    <div className="bg-white border border-gray-100 rounded-xl px-5 py-3">
      <div className="flex items-center justify-between mb-1.5">
        <button
          onClick={() => setCollapsed(c => !c)}
          className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 hover:text-gray-900"
        >
          <span className="text-gray-400 text-[10px]">{collapsed ? '▶' : '▼'}</span>
          📝 메모 <span className="text-gray-400 font-normal">({memos.length})</span>
        </button>
        {!collapsed && (
          <button onClick={() => setAdding(s => !s)}
            className="text-[11px] text-gray-400 hover:text-gray-700">
            {adding ? '닫기' : '+ 새 메모'}
          </button>
        )}
      </div>

      {!collapsed && (
        <div className="space-y-2">
          {/* 레거시 memo 마이그레이션 안내 */}
          {legacyMemo && !legacyImported && (
            <div className="bg-yellow-50 border border-yellow-200 rounded p-2 text-xs">
              <p className="text-gray-700 mb-1">기존 메모 1건이 있어. 새 카드 시스템으로 변환할까?</p>
              <button onClick={importLegacy}
                className="px-2 py-1 text-xs font-semibold rounded bg-yellow-300 hover:bg-yellow-400">
                카드로 변환
              </button>
            </div>
          )}

          {/* 새 메모 추가 폼 */}
          {adding && (
            <div className="border border-yellow-200 rounded-lg p-3 space-y-2 bg-yellow-50/30">
              <input value={newTitle} onChange={e => setNewTitle(e.target.value)}
                placeholder="제목 (선택)"
                className="w-full text-sm font-semibold border border-gray-200 rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-yellow-400 bg-white" />
              <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
                <BlockNoteEditor initialMarkdown={newContent} onChangeMarkdown={setNewContent} />
              </div>
              <div className="flex gap-2">
                <button onClick={add} disabled={!newContent.trim() && !newTitle.trim()}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg hover:opacity-80 disabled:opacity-40"
                  style={{ backgroundColor: '#FFCE00', color: '#121212' }}>저장</button>
                <button onClick={() => { setAdding(false); setNewTitle(''); setNewContent('') }}
                  className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg text-gray-500">취소</button>
              </div>
            </div>
          )}

          {/* 메모 카드 리스트 */}
          {memos.length === 0 && !adding && !legacyMemo && (
            <p className="text-xs text-gray-400 italic">메모 없음. + 새 메모 클릭해서 추가.</p>
          )}
          {memos.map(m => <MemoCard key={m.id} memo={m} projectId={projectId} />)}
        </div>
      )}
    </div>
  )
}

function MemoCard({ memo, projectId }: { memo: Memo; projectId: string }) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [editing, setEditing] = useState(false)
  const [collapsed, setCollapsed] = useState(true)
  const [title, setTitle] = useState(memo.title ?? '')
  const [content, setContent] = useState(memo.content ?? '')

  function save() {
    startTransition(async () => {
      await updateProjectMemoCard(memo.id, projectId, { title, content })
      setEditing(false)
      router.refresh()
    })
  }

  function remove() {
    if (!confirm(`"${memo.title || '메모'}" 삭제할까?`)) return
    startTransition(async () => {
      await deleteProjectMemo(memo.id, projectId)
      router.refresh()
    })
  }

  return (
    <div className="border border-gray-100 rounded-lg p-3 hover:border-gray-200 transition-colors">
      <div className="flex items-start justify-between gap-2 mb-1">
        <button onClick={() => !editing && setCollapsed(c => !c)}
          className="flex-1 text-left flex items-center gap-1.5 group">
          <span className="text-gray-400 text-[10px]">{collapsed ? '▶' : '▼'}</span>
          {editing ? (
            <input value={title} onChange={e => setTitle(e.target.value)}
              placeholder="제목 (선택)"
              onClick={e => e.stopPropagation()}
              className="flex-1 text-sm font-semibold border border-gray-200 rounded px-2 py-1 bg-white" />
          ) : (
            <span className="text-sm font-semibold text-gray-800 group-hover:text-gray-900">
              {memo.title || <span className="text-gray-400 italic font-normal">제목 없음</span>}
            </span>
          )}
        </button>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className="text-[10px] text-gray-400">
            {memo.author_name ? `${memo.author_name} · ` : ''}{memo.created_at?.slice(5, 10)}
          </span>
          {!editing && !collapsed && (
            <>
              <button onClick={() => setEditing(true)} className="text-[11px] text-blue-500 hover:underline">편집</button>
              <button onClick={remove} className="text-[11px] text-red-500 hover:underline">삭제</button>
            </>
          )}
        </div>
      </div>

      {!collapsed && (editing ? (
        <div className="space-y-2 mt-2">
          <div className="border border-gray-200 rounded overflow-hidden bg-white">
            <BlockNoteEditor initialMarkdown={content} onChangeMarkdown={setContent} />
          </div>
          <div className="flex gap-2">
            <button onClick={save}
              className="px-3 py-1.5 text-xs font-semibold rounded hover:opacity-80"
              style={{ backgroundColor: '#FFCE00', color: '#121212' }}>저장</button>
            <button onClick={() => { setEditing(false); setTitle(memo.title ?? ''); setContent(memo.content ?? '') }}
              className="px-3 py-1.5 text-xs border border-gray-200 rounded text-gray-500">취소</button>
          </div>
        </div>
      ) : memo.content ? (
        <MarkdownText className="text-gray-700 mt-1">{memo.content}</MarkdownText>
      ) : (
        <p className="text-xs text-gray-400 italic mt-1">내용 없음</p>
      ))}
    </div>
  )
}

/* ── 2. 2박스: 개요(빵빵이) / 협의해야할 내용 (빵빵이) ─── */
/* 한눈에 박스 — 짧은 요약 (항상 펼침. 상단 자리) */
function ShortSummaryBox({ project }: { project: Project }) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [editing, setEditing] = useState(false)
  const [input, setInput] = useState(project.short_summary ?? '')
  const [generating, setGenerating] = useState(false)
  const [genError, setGenError] = useState<string | null>(null)
  // (Phase 9.5) 정리 프리셋 — localStorage 영속. 새로고침·탭 전환 후 유지.
  // SSR/CSR mismatch 방지 위해 초기엔 default + useEffect로 lazy load
  const PRESET_KEY = `proj-overview-preset:${project.id}`
  const [preset, setPresetState] = useState<'short' | 'standard' | 'deep'>('standard')
  useEffect(() => {
    try {
      const v = localStorage.getItem(PRESET_KEY)
      if (v === 'short' || v === 'standard' || v === 'deep') setPresetState(v)
    } catch { /* private mode 등 */ }
  }, [PRESET_KEY])
  function setPreset(p: 'short' | 'standard' | 'deep') {
    setPresetState(p)
    try { localStorage.setItem(PRESET_KEY, p) } catch { /* swallow */ }
  }

  function save() {
    startTransition(async () => {
      await updateProjectShortSummary(project.id, input)
      setEditing(false)
      router.refresh()
    })
  }

  async function generate() {
    setGenerating(true); setGenError(null)
    try {
      // (Phase 9.5) preset 전달 — 1차 payload only. LLM 프롬프트 반영은 P3
      console.log('[short_summary.generate]', { project_id: project.id, preset })
      const res = await generateAndSaveProjectShortSummary(project.id, preset)
      if ('error' in res) setGenError(res.error)
      else { setInput(res.summary); router.refresh() }
    } catch (e: any) {
      setGenError(e?.message ?? '실패')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3">
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-xs font-semibold text-yellow-800">⚡ 한눈에</p>
        <div className="flex gap-2">
          <button onClick={generate} disabled={generating} className="text-[10px] text-yellow-700 hover:text-yellow-900 disabled:opacity-40">
            {generating ? '🤖 생성 중...' : '🤖 자동 생성'}
          </button>
          {!editing && (
            <button onClick={() => { setInput(project.short_summary ?? ''); setEditing(true) }} className="text-[10px] text-gray-500 hover:text-gray-700">
              직접 수정
            </button>
          )}
        </div>
      </div>
      {/* 정리 프리셋 — 단일 선택 라디오 (Phase 9.5). localStorage 영속 + generate 호출 시 전달 */}
      <div role="radiogroup" aria-label="정리 강도" className="flex items-center gap-1.5 mb-2 flex-wrap">
        <span className="text-[10px] text-yellow-800/70 mr-1 font-medium">정리 강도</span>
        {([
          { key: 'short',    label: '짧게',  hint: '3줄 핵심' },
          { key: 'standard', label: '표준',  hint: '현황·다음·리스크' },
          { key: 'deep',     label: '깊게',  hint: '근거·담당·기한' },
        ] as { key: 'short' | 'standard' | 'deep'; label: string; hint: string }[]).map(p => {
          const active = preset === p.key
          return (
            <button
              key={p.key}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setPreset(p.key)}
              title={p.hint}
              className={`text-xs px-2.5 py-1 rounded-md border-2 font-medium transition-colors ${
                active
                  ? 'bg-yellow-300 border-yellow-500 text-yellow-900 shadow-sm'
                  : 'bg-white border-yellow-200 text-yellow-700 hover:bg-yellow-50'
              }`}
            >
              {active && <span className="mr-0.5">✓</span>}{p.label}
            </button>
          )
        })}
      </div>
      {editing ? (
        <div className="space-y-1.5">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            rows={3}
            placeholder="2-4줄 핵심 요약. 표·헤더 없이 평문."
            className="w-full text-sm border border-yellow-300 rounded px-2 py-1.5 bg-white focus:outline-none focus:border-yellow-500"
            autoFocus
          />
          <div className="flex gap-1">
            <button onClick={save} className="px-2.5 py-0.5 text-xs font-semibold rounded hover:opacity-80" style={{ backgroundColor: '#FFCE00', color: '#121212' }}>저장</button>
            <button onClick={() => { setEditing(false); setInput(project.short_summary ?? '') }} className="px-2 py-0.5 text-xs text-gray-500">취소</button>
          </div>
        </div>
      ) : project.short_summary ? (
        <div className="text-sm leading-relaxed [&_strong]:block [&_strong]:text-[10px] [&_strong]:font-bold [&_strong]:text-yellow-700 [&_strong]:uppercase [&_strong]:tracking-wide [&_strong]:mt-3 [&_strong]:mb-0.5 [&_strong:first-child]:mt-0 [&_p]:mb-1 [&_p]:text-gray-800 [&_p]:leading-relaxed">
          <MarkdownText>{project.short_summary}</MarkdownText>
        </div>
      ) : (
        <p className="text-sm text-gray-400 italic">아직 한눈에 요약이 없어. 위 [🤖 자동 생성] 또는 [직접 수정] 클릭.</p>
      )}
      {genError && <p className="text-[11px] text-red-500 mt-1">⚠ {genError}</p>}
    </div>
  )
}

function TwoBoxesBlock({ project }: { project: Project }) {
  return (
    <div className="space-y-3">
      <ShortSummaryBox project={project} />
      <PendingDiscussionBox project={project} />
    </div>
  )
}

/* 협의해야할 내용 박스 — 클라이언트 / 내부 / 외주사 3 탭 */
type DiscussionTab = 'client' | 'internal' | 'vendor'

const TAB_META: Record<DiscussionTab, { label: string; emoji: string; col: 'pending_discussion_client' | 'pending_discussion_internal' | 'pending_discussion_vendor' }> = {
  client:   { label: '클라이언트', emoji: '🧑‍💼', col: 'pending_discussion_client' },
  internal: { label: '내부',       emoji: '🏢', col: 'pending_discussion_internal' },
  vendor:   { label: '외주사',     emoji: '🤝', col: 'pending_discussion_vendor' },
}

function PendingDiscussionBox({ project }: { project: Project }) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<DiscussionTab>('client')
  const [editing, setEditing] = useState(false)
  const [input, setInput] = useState('')
  const [generating, setGenerating] = useState(false)
  const [genError, setGenError] = useState<string | null>(null)
  // (Phase 9.5) 정리 프리셋 — 한눈에와 옵션 통일(short/standard/deep) + localStorage 영속
  const PRESET_KEY = `proj-discussion-preset:${project.id}`
  const [preset, setPresetState] = useState<'short' | 'standard' | 'deep'>('standard')
  useEffect(() => {
    try {
      const v = localStorage.getItem(PRESET_KEY)
      if (v === 'short' || v === 'standard' || v === 'deep') setPresetState(v)
    } catch { /* private mode */ }
  }, [PRESET_KEY])
  function setPreset(p: 'short' | 'standard' | 'deep') {
    setPresetState(p)
    try { localStorage.setItem(PRESET_KEY, p) } catch { /* swallow */ }
  }

  const currentValue = project[TAB_META[tab].col] ?? ''
  const hasAny = !!(project.pending_discussion_client || project.pending_discussion_internal || project.pending_discussion_vendor)

  // 탭 변경 시 input 초기화
  useEffect(() => {
    setInput(currentValue)
    setEditing(false)
    setGenError(null)
  }, [tab, currentValue])

  function save() {
    startTransition(async () => {
      await updateProjectPendingDiscussion(project.id, tab, input)
      setEditing(false)
      router.refresh()
    })
  }

  async function generateAll() {
    setGenerating(true)
    setGenError(null)
    try {
      // (Phase 9.5) preset 전달 — 1차 payload only. LLM 프롬프트 반영은 P3
      console.log('[pending_discussion.generate]', { project_id: project.id, preset })
      const targets: DiscussionTab[] = ['client', 'internal', 'vendor']
      const results = await Promise.all(targets.map(t => generateAndSavePendingDiscussion(project.id, t, preset)))
      const errors = results.flatMap(r => 'error' in r ? [r.error] : [])
      if (errors.length) setGenError(errors.join(' / '))
      router.refresh()
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
          <p className="text-[10px] text-gray-400">
            클라이언트 / 내부 / 외주사 3분할 — 중계 시 체력 소모 감소
            {hasAny && ' · '}
            {project.pending_discussion_client && <span className="text-blue-600">클</span>}
            {project.pending_discussion_internal && <span className="text-purple-600">내</span>}
            {project.pending_discussion_vendor && <span className="text-orange-600">외</span>}
          </p>
        </div>
        <span className="text-gray-300 text-xs">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="border-t border-gray-50">
          {/* 통합 분석 버튼 (3분류 동시 분석) */}
          <div className="px-4 py-2.5 border-b border-gray-50 flex items-center justify-between gap-2 bg-yellow-50/40 flex-wrap">
            <p className="text-[11px] text-gray-500">한 번에 3분류 모두 분석</p>
            <button
              onClick={generateAll}
              disabled={generating}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg hover:opacity-80 disabled:opacity-40"
              style={{ backgroundColor: '#FFCE00', color: '#121212' }}
            >
              {generating ? '🤖 분석 중...' : hasAny ? '🤖 빵빵이로 다시 분석' : '🤖 빵빵이로 분석'}
            </button>
          </div>

          {/* 정리 프리셋 — 단일 선택 라디오 (Phase 9.5). 한눈에와 옵션 통일 + localStorage 영속 */}
          <div role="radiogroup" aria-label="정리 강도" className="px-4 py-2 border-b border-gray-50 flex items-center gap-1.5 flex-wrap bg-white">
            <span className="text-[10px] text-gray-600 mr-1 font-medium">정리 강도</span>
            {([
              { key: 'short',    label: '짧게',  hint: '핵심만' },
              { key: 'standard', label: '표준',  hint: '4섹션 정리' },
              { key: 'deep',     label: '깊게',  hint: '근거·담당·기한' },
            ] as { key: 'short' | 'standard' | 'deep'; label: string; hint: string }[]).map(p => {
              const active = preset === p.key
              return (
                <button
                  key={p.key}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setPreset(p.key)}
                  title={p.hint}
                  className={`text-xs px-2.5 py-1 rounded-md border-2 font-medium transition-colors ${
                    active
                      ? 'bg-blue-100 border-blue-500 text-blue-800 shadow-sm'
                      : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {active && <span className="mr-0.5">✓</span>}{p.label}
                </button>
              )
            })}
            <span className="text-[9px] text-gray-400 ml-auto">재생성 시 강도 반영 예정 (1차 payload OK)</span>
          </div>

          {/* 탭 헤더 */}
          <div className="flex border-b border-gray-100 bg-gray-50">
            {(Object.keys(TAB_META) as DiscussionTab[]).map(t => {
              const m = TAB_META[t]
              const filled = !!project[m.col]
              return (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`flex-1 px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
                    tab === t
                      ? 'bg-white text-gray-900 border-yellow-400'
                      : 'text-gray-500 border-transparent hover:text-gray-700'
                  }`}
                >
                  {m.emoji} {m.label}
                  {filled && <span className="ml-1 text-[8px] text-green-500">●</span>}
                </button>
              )
            })}
          </div>

          {/* 탭 콘텐츠 */}
          <div className="px-4 py-3 space-y-2">
            {editing ? (
              <>
                <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
                  <BlockNoteEditor initialMarkdown={input} onChangeMarkdown={setInput} />
                </div>
                <div className="flex gap-2">
                  <button onClick={save}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg hover:opacity-80"
                    style={{ backgroundColor: '#FFCE00', color: '#121212' }}>저장</button>
                  <button onClick={() => { setEditing(false); setInput(currentValue) }}
                    className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg text-gray-500">취소</button>
                </div>
              </>
            ) : currentValue ? (
              <>
                <div className="text-sm leading-relaxed [&_h1]:text-base [&_h1]:font-bold [&_h1]:mt-2 [&_h1]:mb-1 [&_h2]:text-sm [&_h2]:font-bold [&_h2]:mt-2 [&_h2]:mb-1 [&_h3]:font-semibold [&_h3]:text-gray-700 [&_h3]:mt-1.5 [&_strong]:text-gray-900 [&_p]:mb-1.5 [&_ul]:my-1 [&_li]:my-0.5 [&_table]:my-2 [&_table]:text-xs">
                  <MarkdownText>{currentValue}</MarkdownText>
                </div>
                <div className="flex gap-2 pt-1 border-t border-gray-50">
                  <button onClick={() => { setInput(currentValue); setEditing(true) }}
                    className="text-[11px] text-gray-400 hover:text-gray-700">직접 수정</button>
                </div>
              </>
            ) : (
              <>
                <p className="text-[11px] text-gray-400 italic">아직 {TAB_META[tab].label} 협의 분석이 없어. 위 버튼으로 일괄 생성하거나, 이 분류만 직접 작성.</p>
                <div className="flex gap-2">
                  <button onClick={() => { setInput(''); setEditing(true) }}
                    className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg text-gray-500">직접 작성</button>
                </div>
              </>
            )}
            {genError && (
              <p className="text-[11px] text-red-500">⚠ {genError}</p>
            )}
            {/* legacy pending_discussion 표시 (있는 경우) */}
            {tab === 'client' && project.pending_discussion && !project.pending_discussion_client && (
              <details className="text-[10px] text-gray-400 mt-2 pt-2 border-t border-dashed border-gray-200">
                <summary className="cursor-pointer hover:text-gray-600">📦 옛 협의 데이터 보기 (legacy, 분류 전)</summary>
                <div className="mt-1 text-xs text-gray-500">
                  <MarkdownText>{project.pending_discussion}</MarkdownText>
                </div>
              </details>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/* ── 2-A. 빵빵이 자동 개요 박스 ─────────────────────────── */
function OverviewSummaryBox({ project }: { project: Project }) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [open, setOpen] = useState(false)
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
          <p className="text-xs font-semibold text-gray-700">📑 자세한 개요 (PM 정독용)</p>
          <p className="text-[10px] text-gray-400">전체 데이터 기반 자동 생성. 짧은 요약은 위 [⚡ 한눈에] 박스 사용.</p>
        </div>
        <span className="text-gray-300 text-xs">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="px-4 py-3 border-t border-gray-50 space-y-2">
          {editing ? (
            <>
              <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
                <BlockNoteEditor initialMarkdown={input} onChangeMarkdown={setInput} />
              </div>
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
              <div className="text-sm leading-relaxed [&_h1]:text-base [&_h1]:font-bold [&_h1]:mt-3 [&_h1]:mb-1.5 [&_h2]:text-sm [&_h2]:font-bold [&_h2]:mt-3 [&_h2]:mb-1 [&_h3]:font-semibold [&_h3]:text-gray-700 [&_h3]:mt-2 [&_strong]:text-gray-900 [&_p]:mb-1.5 [&_ul]:my-1.5 [&_li]:my-0.5 [&_table]:my-2 [&_table]:text-xs [&_tr:nth-child(even)]:bg-gray-50/50">
                <MarkdownText>{project.overview_summary}</MarkdownText>
              </div>
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
  const [open, setOpen] = useState(false)
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
              <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
                <BlockNoteEditor initialMarkdown={input} onChangeMarkdown={setInput} />
              </div>
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
              <MarkdownText className="text-gray-700">{value}</MarkdownText>
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
type TaskSortKey = 'due_date' | 'priority' | 'status' | 'created'

const TASK_PRIORITY_ORDER: Record<string, number> = { 긴급: 0, 높음: 1, 보통: 2, 낮음: 3 }
const TASK_STATUS_ORDER: Record<string, number> = { 진행중: 0, 검토중: 1, '할 일': 2, 보류: 3, 완료: 4 }

function TasksSection({ tasks, contracts, projectId, profiles, serviceType, currentUserId }: {
  tasks: Task[]; contracts: Contract[]; projectId: string; profiles: ProfileOpt[]; serviceType: string | null
  currentUserId: string
}) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [newTitle, setNewTitle] = useState('')
  const [newAssigneeId, setNewAssigneeId] = useState('')
  const [newDue, setNewDue] = useState('')
  const [newPriority, setNewPriority] = useState('보통')
  const [showDetail, setShowDetail] = useState(false)
  const [suggesting, setSuggesting] = useState(false)
  const [suggestMsg, setSuggestMsg] = useState<string | null>(null)
  const canAdd = contracts.length > 0

  // 정렬·필터
  const [statusFilter, setStatusFilter] = useState<'진행중' | '완료' | '전체'>('진행중')
  const [assigneeFilter, setAssigneeFilter] = useState<string>('전체')   // '전체' | '미지정' | profile_id
  const [sortKey, setSortKey] = useState<TaskSortKey>('due_date')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const pendingTasks = tasks.filter(t => t.status !== '완료' && t.status !== '보류')

  // 담당자 옵션 — 실제 task에 등장한 담당자만
  const assigneeIdsInTasks = Array.from(new Set(tasks.map(t => t.assignee_id).filter(Boolean) as string[]))
  const profileById = new Map(profiles.map(p => [p.id, p.name]))
  const assigneeOptions: { value: string; label: string }[] = [
    { value: '전체', label: '전체' },
    { value: '미지정', label: '미지정' },
    ...assigneeIdsInTasks.map(id => ({ value: id, label: profileById.get(id) ?? id.slice(0, 8) })),
  ]

  const visibleTasks = tasks.filter(t => {
    if (statusFilter === '진행중') {
      if (t.status === '완료' || t.status === '보류') return false
    } else if (statusFilter === '완료') {
      if (t.status !== '완료') return false
    }
    if (assigneeFilter === '미지정' && t.assignee_id) return false
    if (assigneeFilter !== '전체' && assigneeFilter !== '미지정' && t.assignee_id !== assigneeFilter) return false
    return true
  }).slice().sort((a, b) => {
    let av: number | string | null = null
    let bv: number | string | null = null
    if (sortKey === 'due_date') { av = a.due_date; bv = b.due_date }
    else if (sortKey === 'priority') { av = TASK_PRIORITY_ORDER[a.priority ?? ''] ?? 99; bv = TASK_PRIORITY_ORDER[b.priority ?? ''] ?? 99 }
    else if (sortKey === 'status') { av = TASK_STATUS_ORDER[a.status] ?? 99; bv = TASK_STATUS_ORDER[b.status] ?? 99 }
    else { av = a.created_at ?? null; bv = b.created_at ?? null }
    if (av == null && bv == null) return 0
    if (av == null) return 1
    if (bv == null) return -1
    const cmp = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv))
    return sortDir === 'asc' ? cmp : -cmp
  })
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
      {/* 정렬·필터 바 */}
      {tasks.length > 0 && (
        <div className="px-5 py-2 border-b border-gray-50 bg-gray-50/50 flex items-center gap-2 flex-wrap text-xs">
          <span className="text-[10px] text-gray-400">상태</span>
          {(['진행중', '완료', '전체'] as const).map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-2 py-0.5 rounded-full border ${statusFilter === s ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-500 border-gray-200'}`}
            >
              {s}
            </button>
          ))}
          {assigneeOptions.length > 1 && (
            <>
              <span className="text-[10px] text-gray-400 ml-2">담당자</span>
              <select
                value={assigneeFilter}
                onChange={e => setAssigneeFilter(e.target.value)}
                className="border border-gray-200 rounded px-1.5 py-0.5 bg-white"
              >
                {assigneeOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </>
          )}
          <span className="text-[10px] text-gray-400 ml-2">정렬</span>
          <select
            value={sortKey}
            onChange={e => setSortKey(e.target.value as TaskSortKey)}
            className="border border-gray-200 rounded px-1.5 py-0.5 bg-white"
          >
            <option value="due_date">데드라인</option>
            <option value="priority">우선순위</option>
            <option value="status">상태</option>
            <option value="created">생성순</option>
          </select>
          <button
            onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')}
            title={sortDir === 'asc' ? '오름차순 (가까움→멈) — 클릭으로 토글' : '내림차순 — 클릭으로 토글'}
            className="border border-gray-200 rounded px-1.5 py-0.5 bg-white text-yellow-600"
          >
            {sortDir === 'asc' ? '↑' : '↓'}
          </button>
          <span className="ml-auto text-[10px] text-gray-400">{visibleTasks.length}건 표시</span>
        </div>
      )}

      {tasks.length === 0 ? (
        <p className="text-center py-6 text-xs text-gray-400">등록된 할일 없음</p>
      ) : visibleTasks.length === 0 ? (
        <p className="text-center py-6 text-xs text-gray-400">필터에 맞는 할일 없음</p>
      ) : (
        <ul className="divide-y divide-gray-50">
          {visibleTasks.slice(0, 30).map(t => (
            <TaskRow key={t.id} task={t} profiles={profiles} projectId={projectId} serviceType={serviceType} currentUserId={currentUserId} />
          ))}
        </ul>
      )}
      {visibleTasks.length > 30 && (
        <div className="px-5 py-2 border-t border-gray-50 text-center text-xs text-gray-400">
          +{visibleTasks.length - 30}건 더 (필터 좁히기 권장)
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

function TaskRow({ task, profiles, projectId, serviceType, currentUserId }: {
  task: Task; profiles: ProfileOpt[]; projectId: string; serviceType: string | null
  currentUserId: string
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
    // 완료 코멘트 (Phase 9.2): '완료'로 변경되는 *순간*만 prompt
    let completedNote: string | null = null
    const becameCompleted = form.status === '완료' && task.status !== '완료'
    if (becameCompleted) {
      const r = askCompletionNote(form.title.trim())
      if (r.cancelled) return
      completedNote = r.note
    }
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
    if (becameCompleted) {
      fd.set('completed_note', completedNote ?? '')
      fd.set('completed_by', currentUserId)
    }
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
    <li className={`group relative ${task.bbang_suggested ? 'bg-blue-50/40' : ''}`}>
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
      {/* 빠른 삭제 — 행 우측 호버 시 노출 (펼치기와 별도) */}
      <button
        onClick={e => {
          e.stopPropagation()
          if (!confirm(`"${task.title}" 삭제?`)) return
          startTransition(async () => {
            await deleteTask(task.id, task.project_id ?? null)
            router.refresh()
          })
        }}
        title="할일 삭제"
        className="absolute right-1 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center rounded text-gray-300 hover:text-red-500 hover:bg-red-50 md:opacity-0 md:group-hover:opacity-100 transition-opacity text-sm"
      >
        ✕
      </button>

      {/* 상세 편집 */}
      {expanded && (
        <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 space-y-2">
          {/* 완료 이력 (Phase 9.2) */}
          {task.status === '완료' && (task.completed_at || task.completed_note || task.completed_by_name) && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 text-xs text-emerald-900">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold">✓ 완료</span>
                {task.completed_at && <span className="opacity-80">{task.completed_at.slice(0, 16).replace('T', ' ')}</span>}
                {task.completed_by_name && <span className="opacity-80">· {task.completed_by_name}</span>}
              </div>
              {task.completed_note && (
                <p className="mt-1 whitespace-pre-wrap text-emerald-800 leading-snug">{task.completed_note}</p>
              )}
            </div>
          )}
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

/* ── 5. 일정 (due_date 임박 순 + 연결된 캘린더 일정) ─────── */
function ScheduleSection({ projectId, linkedEvents }: {
  tasks?: Task[]; projectId: string; linkedEvents: LinkedCalEvent[]
}) {
  // 사용자 명시 (2026-04-29): 일정은 캘린더(linked_calendar_events)에 적힌 것만 표시.
  // 할일 due_date는 [✅ 할일] 섹션에 정렬·필터로 통합 → 여기엔 X.
  const router = useRouter()
  // (Hydration safe) SSR/CSR 시간 차 mismatch 방지
  const [todayMs, setTodayMs] = useState<number | null>(null)
  useEffect(() => {
    const t = new Date(); t.setHours(0, 0, 0, 0)
    setTodayMs(t.getTime())
  }, [])

  const [showSearch, setShowSearch] = useState(false)
  const [query, setQuery] = useState('')
  const [searchLoading, setSearchLoading] = useState(false)
  const [results, setResults] = useState<{ id: string; calendarKey: string; title: string; date: string; color: string; isAllDay: boolean }[] | null>(null)
  const [localLinked, setLocalLinked] = useState<LinkedCalEvent[]>(linkedEvents)
  const [deleteTarget, setDeleteTarget] = useState<LinkedCalEvent | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  async function runSearch() {
    if (!query.trim()) return
    setSearchLoading(true)
    const r = await searchCalendarEvents(query)
    setResults('error' in r ? [] : r.results)
    setSearchLoading(false)
  }

  async function attach(ev: { id: string; calendarKey: string; title: string; date: string; color: string }) {
    await linkCalendarEvent(projectId, ev)
    setLocalLinked(prev => [...prev, ev])
    setShowSearch(false); setQuery(''); setResults(null)
    router.refresh()
  }

  async function detach(withGcal: boolean) {
    if (!deleteTarget) return
    setDeleteLoading(true)
    setLocalLinked(prev => prev.filter(e => e.id !== deleteTarget.id))
    if (withGcal) {
      await unlinkAndDeleteCalendarEvent(projectId, deleteTarget.id, deleteTarget.calendarKey)
    } else {
      await unlinkCalendarEvent(projectId, deleteTarget.id)
    }
    setDeleteTarget(null)
    setDeleteLoading(false)
    router.refresh()
  }

  const sortedLinked = [...localLinked].sort((a, b) => a.date.localeCompare(b.date))
  const isEmpty = sortedLinked.length === 0

  return (
    <div className="bg-white border border-gray-100 rounded-xl px-5 py-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-semibold text-gray-800">📅 일정</p>
        <button onClick={() => setShowSearch(s => !s)}
          className="text-[11px] text-gray-400 hover:text-gray-700 px-2 py-0.5 rounded hover:bg-gray-50">
          {showSearch ? '취소' : '🔍 기존 일정 연결'}
        </button>
      </div>

      {showSearch && (
        <div className="mb-2 p-2.5 bg-gray-50 rounded-lg border border-gray-200 space-y-1.5">
          <div className="flex gap-1.5">
            <input value={query} onChange={e => setQuery(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') runSearch() }}
              placeholder="검색어 (예: 곤지암, 미팅)"
              className="flex-1 text-xs border border-gray-200 rounded px-2 py-1 bg-white focus:outline-none focus:border-yellow-400"
              autoFocus />
            <button onClick={runSearch} disabled={searchLoading || !query.trim()}
              className="text-xs px-2.5 py-1 rounded font-medium disabled:opacity-40"
              style={{ backgroundColor: '#FFCE00', color: '#121212' }}>
              {searchLoading ? '...' : '검색'}
            </button>
          </div>
          {results && (
            results.length === 0 ? <p className="text-[11px] text-gray-400 text-center py-2">결과 없음</p> : (
              <div className="max-h-48 overflow-y-auto space-y-0.5 bg-white rounded border border-gray-100 p-1">
                {results.map(ev => {
                  const linked = localLinked.some(e => e.id === ev.id)
                  return (
                    <button key={ev.id} disabled={linked} onClick={() => attach(ev)}
                      className="w-full flex items-center gap-1.5 px-1.5 py-1 text-left hover:bg-blue-50 rounded text-xs disabled:opacity-40 disabled:bg-gray-50">
                      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: ev.color }} />
                      <span className="text-gray-500 flex-shrink-0">{ev.date}</span>
                      <span className="text-gray-800 flex-1 truncate">{ev.title}</span>
                      {linked && <span className="text-[10px] text-gray-400">연결됨</span>}
                    </button>
                  )
                })}
              </div>
            )
          )}
        </div>
      )}

      {isEmpty ? (
        <p className="text-xs text-gray-400 py-2">예정된 일정 없음</p>
      ) : (
        <ul className="space-y-1.5">
          {sortedLinked.map(ev => {
            const due = new Date(ev.date)
            due.setHours(0, 0, 0, 0)
            // todayMs null일 동안(hydrate 직전) 모든 시간 라벨은 중립(미정) — 그 후 useEffect 채움
            const diffDays = todayMs == null ? null : Math.ceil((due.getTime() - todayMs) / (1000 * 60 * 60 * 24))
            const overdue = diffDays != null && diffDays < 0
            const today0 = diffDays === 0
            const soon = diffDays != null && diffDays > 0 && diffDays <= 3
            return (
              <li key={ev.id} className="flex items-center gap-2 text-xs group">
                <span className={`px-2 py-0.5 rounded-full font-semibold flex-shrink-0 ${overdue ? 'bg-gray-100 text-gray-400' : today0 ? 'bg-red-100 text-red-700' : soon ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'}`}>
                  {diffDays == null ? '—' : overdue ? `D+${-diffDays}` : today0 ? 'D-day' : `D-${diffDays}`}
                </span>
                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: ev.color }} />
                <span className="text-gray-700 flex-1 truncate">{ev.title}</span>
                <span className="text-gray-400 flex-shrink-0">{ev.date.slice(5)}</span>
                <button onClick={() => setDeleteTarget(ev)}
                  className="text-gray-300 hover:text-red-400 md:opacity-0 md:group-hover:opacity-100 transition-opacity flex-shrink-0">✕</button>
              </li>
            )
          })}
        </ul>
      )}

      {/* 삭제 confirm 다이얼로그 */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl px-6 py-5 w-80 space-y-3">
            <p className="text-sm font-semibold text-gray-800">일정 삭제</p>
            <p className="text-xs text-gray-600 leading-relaxed">
              <span className="font-medium">{deleteTarget.title}</span><br />
              Google Calendar에서도 삭제하시겠습니까?
            </p>
            <div className="flex gap-2 pt-1">
              <button
                disabled={deleteLoading}
                onClick={() => detach(true)}
                className="flex-1 text-xs py-1.5 rounded-lg bg-red-500 text-white font-medium hover:bg-red-600 disabled:opacity-50"
              >
                Google에서도 삭제
              </button>
              <button
                disabled={deleteLoading}
                onClick={() => detach(false)}
                className="flex-1 text-xs py-1.5 rounded-lg bg-gray-100 text-gray-700 font-medium hover:bg-gray-200 disabled:opacity-50"
              >
                연결만 해제
              </button>
              <button
                disabled={deleteLoading}
                onClick={() => setDeleteTarget(null)}
                className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-50"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ── 8. 계약 관리 (사업자별 그룹화 + 자동 폴더) ─────────── */
function ContractsSection({ contracts, projectId, entities, defaultCustomerId, defaultCustomerName, customersAll }: {
  contracts: Contract[]; projectId: string; entities: BusinessEntity[]
  defaultCustomerId?: string | null; defaultCustomerName?: string | null
  customersAll: { id: string; name: string; type: string | null }[]
}) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [adding, setAdding] = useState(false)
  const [addingByPdf, setAddingByPdf] = useState(false)
  const [newName, setNewName] = useState('')
  const [newRevenue, setNewRevenue] = useState('')
  const [newStage, setNewStage] = useState('계약')
  const [splitReason, setSplitReason] = useState('')
  const [newCustomerId, setNewCustomerId] = useState(defaultCustomerId ?? '')
  const [newCustomerName, setNewCustomerName] = useState(defaultCustomerName ?? '')
  const [newClientDept, setNewClientDept] = useState('')
  const [localCustomers, setLocalCustomers] = useState(customersAll)
  const primaryEntity = entities.find(e => e.is_primary)
  const [newEntityId, setNewEntityId] = useState<string>(primaryEntity?.id ?? entities[0]?.id ?? '')

  async function add() {
    if (!newEntityId) { alert('사업자를 선택해줘'); return }
    if (!newCustomerId) { alert('기관(고객사)을 선택해줘'); return }
    startTransition(async () => {
      const r = await createSaleForProject(projectId, {
        name: newName.trim(),
        revenue: Number(newRevenue.replace(/[^0-9]/g, '')) || 0,
        contract_stage: newStage,
        contract_split_reason: splitReason.trim() || null,
        entity_id: newEntityId,
        customer_id: newCustomerId,
        client_dept: newClientDept.trim() || null,
      })
      if ('error' in r) { alert('실패: ' + r.error); return }
      setNewName(''); setNewRevenue(''); setSplitReason(''); setNewStage('계약')
      setNewCustomerId(defaultCustomerId ?? ''); setNewCustomerName(defaultCustomerName ?? '')
      setNewClientDept('')
      setNewEntityId(primaryEntity?.id ?? entities[0]?.id ?? '')
      setAdding(false)
      router.refresh()
    })
  }

  // 사업자별 그룹화
  const entityMap = Object.fromEntries(entities.map(e => [e.id, e]))
  const groups = new Map<string, Contract[]>()
  for (const c of contracts) {
    const key = c.entity_id ?? '__unassigned__'
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(c)
  }
  const isSplit = groups.size >= 2 && !groups.has('__unassigned__')
                  || groups.size > (groups.has('__unassigned__') ? 1 : 0) && groups.size >= 2
  const totalRevenue = contracts.reduce((s, c) => s + (c.revenue ?? 0), 0)

  function fmtComma(v: string) {
    const num = v.replace(/[^0-9]/g, '')
    return num ? Number(num).toLocaleString() : ''
  }

  return (
    <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-semibold text-gray-800">📜 계약 관리 ({contracts.length}건)</p>
          {isSplit && (
            <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold" style={{ backgroundColor: '#FFCE00', color: '#121212' }}>
              📐 분할 계약
            </span>
          )}
          {totalRevenue > 0 && (
            <span className="text-xs text-gray-500">총매출 <b className="text-gray-800">{fmtMoney(totalRevenue)}원</b></span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setAddingByPdf(true)}
            className="text-[11px] px-2 py-1 rounded border border-purple-200 text-purple-600 hover:bg-purple-50">
            📎 견적 PDF로 추가
          </button>
          <button onClick={() => setAdding(s => !s)} className="text-[11px] text-gray-400 hover:text-gray-700">
            {adding ? '취소' : '+ 직접 입력'}
          </button>
        </div>
      </div>
      {addingByPdf && (
        <AddContractByPdf
          projectId={projectId}
          entities={entities}
          customers={localCustomers}
          onClose={() => setAddingByPdf(false)}
          onCustomerCreated={c => setLocalCustomers(prev => [...prev, { id: c.id, name: c.name, type: c.type ?? null }])}
          onSuccess={() => { setAddingByPdf(false); router.refresh() }}
        />
      )}
      {adding && (
        <div className="px-5 py-3 bg-yellow-50 border-b border-yellow-100 space-y-2">
          <select value={newEntityId} onChange={e => setNewEntityId(e.target.value)}
            className="w-full text-sm border border-gray-200 rounded px-2.5 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-yellow-400">
            <option value="">-- 사업자 선택 (필수) --</option>
            {entities.map(e => (
              <option key={e.id} value={e.id}>
                {e.short_name ? `${e.short_name} (${e.name})` : e.name}{e.is_primary ? ' · 메인' : ''}
                {e.usage_note ? ` — ${e.usage_note}` : ''}
              </option>
            ))}
          </select>
          <input value={newName} onChange={e => setNewName(e.target.value)}
            placeholder="건명 (비우면 프로젝트명 사용)"
            className="w-full text-sm border border-gray-200 rounded px-2.5 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-yellow-400" />
          <CustomerPicker
            value={newCustomerId}
            selectedName={newCustomerName}
            customers={localCustomers}
            placeholder="🏛 계약 기관 검색 (없으면 + 새 기관 추가)"
            required
            onChange={(id, name) => { setNewCustomerId(id); setNewCustomerName(name) }}
            onCustomerCreated={c => setLocalCustomers(prev => [...prev, { id: c.id, name: c.name, type: c.type ?? null }])}
          />
          <input value={newClientDept} onChange={e => setNewClientDept(e.target.value)}
            placeholder="부서 (예: 학생지원과 — 수의계약 한도 추적용)"
            className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 bg-white" />
          <div className="flex gap-2">
            <input value={newRevenue} onChange={e => setNewRevenue(fmtComma(e.target.value))}
              placeholder="매출액 (예: 12,510,000)"
              className="flex-1 text-xs border border-gray-200 rounded px-2 py-1.5 bg-white text-right font-mono" />
            <select value={newStage} onChange={e => setNewStage(e.target.value)}
              className="text-xs border border-gray-200 rounded px-2 py-1.5 bg-white">
              {['계약', '착수', '선금', '중도금', '완수', '계산서발행', '잔금'].map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <input value={splitReason} onChange={e => setSplitReason(e.target.value)}
            placeholder="계약 분리 사유 (선택, 분할 시 권장)"
            className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 bg-white" />
          <button onClick={add} disabled={!newEntityId || !newCustomerId}
            className="w-full py-1.5 text-xs font-semibold rounded disabled:opacity-40"
            style={{ backgroundColor: '#FFCE00', color: '#121212' }}>
            계약 추가 (자동으로 Dropbox 폴더 생성)
          </button>
        </div>
      )}
      {contracts.length === 0 ? (
        <p className="text-center py-6 text-xs text-gray-400">등록된 계약 없음</p>
      ) : (
        <div className="divide-y divide-gray-50">
          {[...groups.entries()].map(([entityId, groupContracts]) => {
            const entity = entityId === '__unassigned__' ? null : entityMap[entityId]
            const groupTotal = groupContracts.reduce((s, c) => s + (c.revenue ?? 0), 0)
            const label = entity ? (entity.short_name || entity.name) : '(사업자 미지정)'
            return (
              <div key={entityId}>
                <div className="px-5 py-2 bg-gray-50/60 flex items-center justify-between">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold text-gray-700">🏢 {label}</span>
                    {entity?.is_primary && <span className="text-[10px] px-1 rounded font-semibold" style={{ backgroundColor: '#FFCE00', color: '#121212' }}>메인</span>}
                    <span className="text-[11px] text-gray-400">{groupContracts.length}건</span>
                  </div>
                  {groupTotal > 0 && <span className="text-xs font-medium text-gray-600">{fmtMoney(groupTotal)}원</span>}
                </div>
                <ul>
                  {groupContracts.map(c => (
                    <ContractRow key={c.id} contract={c} projectId={projectId} entities={entities} />
                  ))}
                </ul>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

const STAGE_OPTIONS = ['계약', '착수', '선금', '중도금', '완수', '계산서발행', '잔금'] as const

function ContractRow({ contract: c, projectId, entities }: { contract: Contract; projectId: string; entities: BusinessEntity[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const totalReceived = c.payment_schedules.filter(p => p.is_received).reduce((s, p) => s + p.amount, 0)
  const totalScheduled = c.payment_schedules.reduce((s, p) => s + p.amount, 0)
  const remainder = (c.revenue ?? 0) - totalScheduled
  // (Hydration safe) 자정 경계에서 SSR(UTC)/CSR(KST) 다른 슬라이스 → null 시작 후 useEffect로 채움
  const [todayIsoSlice, setTodayIsoSlice] = useState<string | null>(null)
  useEffect(() => {
    setTodayIsoSlice(new Date().toISOString().slice(0, 10))
  }, [])
  const overdue = todayIsoSlice == null
    ? false
    : !!c.payment_schedules.find(p => !p.is_received && p.due_date && p.due_date < todayIsoSlice)

  return (
    <li className="border-b border-gray-50 last:border-0">
      <div onClick={() => setOpen(o => !o)} role="button"
        className="flex items-center px-5 py-2.5 hover:bg-gray-50 transition-colors group cursor-pointer">
        <span className="text-gray-300 group-hover:text-gray-600 flex-shrink-0 mr-2 text-xs w-4">
          {open ? '▼' : '▶'}
        </span>
        <div className="flex-1 min-w-0 flex items-center gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-sm text-gray-800 truncate">{c.name}</p>
            {(c.client_org || c.client_dept) && (
              <p className="text-[11px] text-gray-500 truncate">
                🏛 {c.client_org || '(기관 미입력)'}{c.client_dept ? ` · ${c.client_dept}` : ''}
              </p>
            )}
            {c.contract_split_reason && <p className="text-[11px] text-gray-400 truncate">💡 {c.contract_split_reason}</p>}
          </div>
          {overdue && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 font-semibold flex-shrink-0">미입금</span>}
          {c.contract_stage && (
            <span className={`text-[10px] px-2 py-0.5 rounded-full ${CONTRACT_STAGE_BADGE[c.contract_stage] ?? 'bg-gray-100 text-gray-500'}`}>
              {c.contract_stage}
            </span>
          )}
          {c.revenue !== null && c.revenue > 0 && (
            <span className="text-xs font-medium text-gray-600">{fmtMoney(c.revenue)}원</span>
          )}
        </div>
        <ContractFolderButton contract={c} projectId={projectId} />
        <Link href={`/sales/${c.id}`} onClick={e => e.stopPropagation()} title="상세 페이지 이동"
          className="text-gray-300 hover:text-gray-700 text-xs ml-1.5 px-1.5 py-0.5">→</Link>
      </div>

      {open && (
        <div className="px-5 pb-3 pt-1 bg-gray-50/50 space-y-3">
          <ContractStageEditor sale={c} projectId={projectId} onChange={() => router.refresh()} />
          <FinalQuoteMapper sale={c} projectId={projectId} entities={entities} onChange={() => router.refresh()} />
          <ContractMoneyEditor sale={c} projectId={projectId} totalScheduled={totalScheduled} totalReceived={totalReceived} remainder={remainder} onChange={() => router.refresh()} />
          <PaymentSchedulesEditor sale={c} projectId={projectId} onChange={() => router.refresh()} />
          <CostEditButton sale={c} />
          <ContractDeleteButton sale={c} projectId={projectId} onChange={() => router.refresh()} />
        </div>
      )}
    </li>
  )
}

function ContractStageEditor({ sale, projectId, onChange }: { sale: Contract; projectId: string; onChange: () => void }) {
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(sale.progress_status || '')
  async function pickStage(stage: string) {
    if (busy || stage === sale.contract_stage) return
    setBusy(true)
    await updateContractStage(sale.id, stage, projectId)
    setBusy(false); onChange()
  }
  async function saveProgress() {
    if (busy || progress === (sale.progress_status || '')) return
    setBusy(true)
    await updateContractProgressStatus(sale.id, progress, projectId)
    setBusy(false); onChange()
  }
  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-semibold text-gray-600">단계</p>
      <div className="flex flex-wrap gap-1">
        {STAGE_OPTIONS.map(s => (
          <button key={s} onClick={() => pickStage(s)} disabled={busy}
            className={`text-[11px] px-2 py-1 rounded-full ${sale.contract_stage === s
              ? 'bg-yellow-300 text-gray-900 font-semibold'
              : 'bg-white border border-gray-200 text-gray-500 hover:border-yellow-300'
            } disabled:opacity-50`}>
            {s}
          </button>
        ))}
      </div>
      <input value={progress} onChange={e => setProgress(e.target.value)} onBlur={saveProgress}
        placeholder="진행 상태 메모 (예: 운영 진행중)"
        className="w-full text-[11px] border border-gray-200 rounded px-2 py-1 bg-white" />
    </div>
  )
}

function ContractMoneyEditor({
  sale, projectId, totalScheduled, totalReceived, remainder, onChange,
}: { sale: Contract; projectId: string; totalScheduled: number; totalReceived: number; remainder: number; onChange: () => void }) {
  const [busy, setBusy] = useState(false)
  const [revenue, setRevenue] = useState((sale.revenue ?? 0).toLocaleString())
  function formatComma(raw: string) {
    const digits = raw.replace(/\D/g, '')
    if (!digits) return ''
    return Number(digits).toLocaleString()
  }
  const currentNum = parseInt(revenue.replace(/,/g, '')) || 0
  const isDirty = currentNum !== (sale.revenue ?? 0)
  async function save(num: number) {
    if (busy) return
    setBusy(true)
    await updateContractInfo(sale.id, { revenue: num }, projectId)
    setBusy(false); onChange()
  }
  async function saveCurrent() {
    if (!isDirty) return
    await save(currentNum)
  }
  async function syncWithSchedules() {
    setRevenue(totalScheduled.toLocaleString())
    await save(totalScheduled)
  }
  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-semibold text-gray-600">매출</p>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] text-gray-400">매출액</label>
          <div className="flex gap-1">
            <input value={revenue}
              onChange={e => setRevenue(formatComma(e.target.value))}
              onBlur={saveCurrent}
              disabled={busy}
              className="flex-1 text-xs border border-gray-200 rounded px-2 py-1 bg-white text-right font-mono" />
            <button onClick={saveCurrent} disabled={busy || !isDirty}
              className={`text-[11px] px-2 rounded font-semibold disabled:opacity-30 ${
                isDirty ? 'text-gray-900' : 'text-gray-400'
              }`}
              style={isDirty ? { backgroundColor: '#FFCE00' } : { backgroundColor: '#f3f4f6' }}>
              {isDirty ? '저장' : '✓'}
            </button>
          </div>
        </div>
        <div className="text-[11px] text-gray-500 space-y-0.5 mt-2">
          <div>입금: <span className="text-green-600 font-medium">{fmtMoney(totalReceived)}원</span> / 일정 <span className="font-medium">{fmtMoney(totalScheduled)}원</span></div>
          {remainder > 0 && <div className="text-amber-600">일정 미배정 {fmtMoney(remainder)}원</div>}
          {remainder < 0 && <div className="text-red-500">일정이 매출보다 {fmtMoney(-remainder)}원 큼</div>}
          {totalScheduled > 0 && totalScheduled !== currentNum && (
            <button onClick={syncWithSchedules} disabled={busy}
              className="text-[10px] text-blue-500 hover:underline">
              ↔ 매출액을 결제 합계({fmtMoney(totalScheduled)}원)로 동기화
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function PaymentSchedulesEditor({
  sale, projectId, onChange,
}: { sale: Contract; projectId: string; onChange: () => void }) {
  const [busy, setBusy] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [newLabel, setNewLabel] = useState('잔금')
  const [newAmount, setNewAmount] = useState('')
  const [newDue, setNewDue] = useState('')

  async function toggle(scheduleId: string, isReceived: boolean) {
    setBusy(scheduleId)
    await togglePaymentReceived(scheduleId, isReceived, projectId)
    setBusy(null); onChange()
  }
  async function remove(scheduleId: string) {
    if (!confirm('이 결제 일정을 삭제할까?')) return
    setBusy(scheduleId)
    await deletePaymentSchedule(scheduleId, projectId)
    setBusy(null); onChange()
  }
  async function addNew() {
    const amount = parseInt(newAmount.replace(/,/g, '')) || 0
    if (!newLabel || !amount) return
    setBusy('__adding__')
    await addPaymentSchedule(sale.id, newLabel, amount, newDue || null, projectId)
    setNewLabel('잔금'); setNewAmount(''); setNewDue('')
    setAdding(false); setBusy(null); onChange()
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold text-gray-600">결제 일정</p>
        <button onClick={() => setAdding(a => !a)} className="text-[10px] text-gray-400 hover:text-gray-700">
          {adding ? '취소' : '+ 추가'}
        </button>
      </div>
      {sale.payment_schedules.length === 0 && !adding && (
        <p className="text-[11px] text-gray-400 italic">결제 일정 없음. + 추가로 등록.</p>
      )}
      {sale.payment_schedules.map(p => {
        const overdue = !p.is_received && p.due_date && p.due_date < new Date().toISOString().slice(0, 10)
        const folderUrl = sale.dropbox_url
        return (
          <div key={p.id} className="flex items-center gap-2 text-[11px] bg-white border border-gray-100 rounded px-2 py-1.5">
            <input type="checkbox" checked={p.is_received} onChange={e => toggle(p.id, e.target.checked)} disabled={busy === p.id}
              className="accent-green-500" />
            <span className="font-medium text-gray-700 min-w-[3rem]">{p.label}</span>
            <span className="font-mono text-gray-700">{fmtMoney(p.amount)}원</span>
            {p.due_date && (
              <span className={overdue ? 'text-red-500 font-semibold' : 'text-gray-400'}>
                {overdue ? '⚠️ ' : ''}예정 {p.due_date}
              </span>
            )}
            {p.is_received && p.received_date && <span className="text-green-500">✓ 입금 {p.received_date}</span>}
            {folderUrl && (
              <a href={folderUrl} target="_blank" rel="noopener noreferrer"
                onClick={e => e.stopPropagation()}
                title="이 계약의 Dropbox 폴더 열기"
                className="text-gray-300 hover:text-blue-500 text-[10px]">📁</a>
            )}
            <button onClick={() => remove(p.id)} disabled={busy === p.id}
              className="ml-auto text-gray-300 hover:text-red-500 text-[10px]">✕</button>
          </div>
        )
      })}
      {adding && (
        <div className="flex flex-wrap items-center gap-2 bg-yellow-50 border border-yellow-200 rounded px-2 py-2">
          <select value={newLabel} onChange={e => setNewLabel(e.target.value)}
            className="text-[11px] border border-gray-200 rounded px-1.5 py-1 bg-white">
            {['선금', '중도금', '잔금', '계산서', '기타'].map(o => <option key={o}>{o}</option>)}
          </select>
          <input value={newAmount}
            onChange={e => {
              const d = e.target.value.replace(/\D/g, '')
              setNewAmount(d ? Number(d).toLocaleString() : '')
            }}
            placeholder="금액"
            className="text-[11px] border border-gray-200 rounded px-2 py-1 bg-white text-right font-mono w-24" />
          <input type="date" value={newDue} onChange={e => setNewDue(e.target.value)}
            className="text-[11px] border border-gray-200 rounded px-1.5 py-1 bg-white" />
          <button onClick={addNew} disabled={busy === '__adding__' || !newAmount}
            className="text-[11px] px-2 py-1 rounded font-semibold disabled:opacity-50"
            style={{ backgroundColor: '#FFCE00', color: '#121212' }}>
            추가
          </button>
        </div>
      )}
    </div>
  )
}

type Analysis = {
  revenue: number | null
  client_org: string | null
  client_dept: string | null
  supplier_name: string | null
  payment_schedules: { label: string; amount: number; due_date: string | null }[]
  matched_customer_id: string | null
  matched_customer_name: string | null
  matched_entity_id: string | null
  matched_entity_name: string | null
  notes: string | null
}

function CostEditButton({ sale }: { sale: Contract }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState<any[] | null>(null)
  const [vendors, setVendors] = useState<any[]>([])
  const [pdfOpen, setPdfOpen] = useState(false)

  async function handleOpen() {
    setLoading(true)
    const supabase = createSupabaseClient()
    const [{ data: costs }, { data: vs }] = await Promise.all([
      supabase.from('sale_costs').select('*').eq('sale_id', sale.id).order('created_at'),
      supabase.from('vendors').select('id, name, type').order('name'),
    ])
    setItems(costs ?? [])
    setVendors(vs ?? [])
    setLoading(false)
    setOpen(true)
  }

  return (
    <>
      <div className="flex items-center justify-between pt-1">
        <p className="text-[11px] font-semibold text-gray-600">원가 / 외주비</p>
        <div className="flex items-center gap-3">
          <button onClick={() => setPdfOpen(true)}
            className="text-[11px] text-gray-500 hover:text-yellow-700 underline decoration-dashed underline-offset-2">
            📎 원가 폴더 분석
          </button>
          <button onClick={handleOpen} disabled={loading}
            className="text-[11px] text-gray-500 hover:text-yellow-700 underline decoration-dashed underline-offset-2 disabled:opacity-50">
            {loading ? '불러오는 중...' : '📊 세부 원가 편집'}
          </button>
        </div>
      </div>
      {open && items !== null && (
        <CostModal
          saleId={sale.id}
          saleName={sale.name}
          revenue={sale.revenue ?? 0}
          initialItems={items}
          vendors={vendors}
          onClose={() => setOpen(false)}
        />
      )}
      {pdfOpen && (
        <CostPdfImportModal saleId={sale.id} onClose={() => setPdfOpen(false)} />
      )}
    </>
  )
}

function ContractDeleteButton({ sale, projectId, onChange }: { sale: Contract; projectId: string; onChange: () => void }) {
  const [busy, setBusy] = useState(false)
  async function remove() {
    if (!confirm(`"${sale.name}" 계약을 정말 삭제할까?\n\n관련 결제 일정·원가·할일 분리/삭제됨. Dropbox 폴더는 안전하게 그대로 둠.`)) return
    setBusy(true)
    const r = await deleteContract(sale.id, projectId)
    setBusy(false)
    if ('error' in r) { alert('삭제 실패: ' + r.error); return }
    onChange()
  }
  return (
    <div className="pt-2 border-t border-gray-200 flex justify-end">
      <button onClick={remove} disabled={busy}
        className="text-[11px] text-red-400 hover:text-red-600 disabled:opacity-50">
        {busy ? '삭제 중...' : '✕ 계약 삭제'}
      </button>
    </div>
  )
}

function AddContractByPdf({
  projectId, entities, customers, onClose, onCustomerCreated, onSuccess,
}: {
  projectId: string
  entities: BusinessEntity[]
  customers: { id: string; name: string; type: string | null }[]
  onClose: () => void
  onCustomerCreated: (c: { id: string; name: string; type?: string | null }) => void
  onSuccess: () => void
}) {
  const [step, setStep] = useState<'pick' | 'analyzing' | 'review'>('pick')
  const [pdfs, setPdfs] = useState<{ name: string; path: string }[] | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [pickedPath, setPickedPath] = useState<string | null>(null)
  const [analysis, setAnalysis] = useState<Analysis | null>(null)

  // 사용자 보강 입력 (분석 결과를 기본값으로)
  const [name, setName] = useState('')
  const [revenue, setRevenue] = useState('')
  const [customerId, setCustomerId] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [entityId, setEntityId] = useState('')
  const [clientDept, setClientDept] = useState('')

  // 모달 열릴 때 PDF 리스트 자동 로드
  useEffect(() => {
    let cancelled = false
    setBusy(true)
    listProjectFolderPdfs(projectId).then(r => {
      if (cancelled) return
      setBusy(false)
      if ('error' in r) setErr(r.error)
      else setPdfs(r.pdfs)
    })
    return () => { cancelled = true }
  }, [projectId])

  async function pick(path: string) {
    setPickedPath(path)
    setStep('analyzing')
    setErr(null)
    const r = await analyzePdfByPath(path)
    if ('error' in r) { setErr(r.error); setStep('pick'); return }
    setAnalysis(r.analysis)
    setName(path.split('/').pop()?.replace(/\.pdf$/i, '') || '')
    setRevenue(r.analysis.revenue ? r.analysis.revenue.toLocaleString() : '')
    setCustomerId(r.analysis.matched_customer_id ?? '')
    setCustomerName(r.analysis.matched_customer_name ?? r.analysis.client_org ?? '')
    setEntityId(r.analysis.matched_entity_id ?? '')
    setClientDept(r.analysis.client_dept ?? '')
    setStep('review')
  }

  async function submit() {
    if (!pickedPath) return
    if (!customerId) { alert('기관(customer)을 선택해줘.'); return }
    if (!entityId) { alert('우리 사업자를 선택해줘.'); return }
    const revenueNum = parseInt(revenue.replace(/,/g, '')) || 0
    if (!revenueNum) { alert('매출액을 확인해줘.'); return }
    setBusy(true)
    const r = await createSaleFromQuote(projectId, {
      pdf_path: pickedPath,
      name: name.trim() || '(이름 없음)',
      revenue: revenueNum,
      customer_id: customerId,
      entity_id: entityId,
      client_dept: clientDept.trim() || null,
      payment_schedules: analysis?.payment_schedules ?? [],
    })
    setBusy(false)
    if ('error' in r) { alert('실패: ' + r.error); return }
    const msg = r.folder_created ? '계약 생성 + 폴더 자동 생성됨.' : '계약 생성 완료.'
    const pdfMsg = r.pdf_move_error ? `\n\n⚠️ PDF 이동 실패: ${r.pdf_move_error}` : ''
    alert(msg + pdfMsg)
    onSuccess()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div onClick={e => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <h3 className="text-sm font-semibold">📎 견적 PDF로 계약 추가</h3>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-700 text-lg leading-none">×</button>
        </div>

        {err && <div className="mx-5 mt-3 px-3 py-2 bg-red-50 border border-red-200 text-red-700 text-xs rounded">{err}</div>}

        {step === 'pick' && (
          <div className="p-5 space-y-2">
            {busy && <p className="text-[11px] text-gray-400">PDF 불러오는 중...</p>}
            {pdfs && pdfs.length === 0 && <p className="text-[11px] text-gray-400 italic">PDF 없음. Dropbox 프로젝트 폴더에 견적서 업로드 후 다시.</p>}
            {pdfs && pdfs.map(p => (
              <button key={p.path} onClick={() => pick(p.path)}
                className="w-full text-left text-[11px] px-2.5 py-1.5 rounded border border-gray-100 hover:border-yellow-300 hover:bg-yellow-50">
                📄 {p.name}
              </button>
            ))}
          </div>
        )}

        {step === 'analyzing' && (
          <div className="p-8 text-center text-sm text-purple-600">
            🤖 PDF 분석 중...
          </div>
        )}

        {step === 'review' && analysis && (
          <div className="p-5 space-y-3 text-[11px]">
            <p className="text-purple-700 font-semibold">🤖 분석 결과 — 검토 후 추가</p>

            <div>
              <label className="block text-[10px] font-semibold text-gray-600 mb-1">건명</label>
              <input value={name} onChange={e => setName(e.target.value)}
                className="w-full text-[11px] border border-gray-200 rounded px-2 py-1 bg-white" />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-semibold text-gray-600 mb-1">매출액 (원)</label>
                <input value={revenue}
                  onChange={e => {
                    const d = e.target.value.replace(/\D/g, '')
                    setRevenue(d ? Number(d).toLocaleString() : '')
                  }}
                  className="w-full text-[11px] border border-gray-200 rounded px-2 py-1 bg-white text-right font-mono" />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-gray-600 mb-1">우리 사업자</label>
                <select value={entityId} onChange={e => setEntityId(e.target.value)}
                  className="w-full text-[11px] border border-gray-200 rounded px-1.5 py-1 bg-white">
                  <option value="">-- 선택 --</option>
                  {entities.map(e => (
                    <option key={e.id} value={e.id}>
                      {e.short_name ? `${e.short_name} (${e.name})` : e.name}{e.is_primary ? ' · 메인' : ''}
                    </option>
                  ))}
                </select>
                {analysis.matched_entity_id && <p className="text-[9px] text-green-600 mt-0.5">✓ 자동 매칭</p>}
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-gray-600 mb-1">기관 (customer)</label>
              <CustomerPicker
                value={customerId}
                selectedName={customerName}
                customers={customers.map(c => ({ id: c.id, name: c.name, type: c.type ?? null }))}
                onChange={(id, n) => { setCustomerId(id); setCustomerName(n) }}
                onCustomerCreated={onCustomerCreated}
                placeholder="기관 검색·선택"
                required
              />
              {analysis.matched_customer_id && <p className="text-[9px] text-green-600 mt-0.5">✓ 자동 매칭: {analysis.matched_customer_name}</p>}
              {!analysis.matched_customer_id && analysis.client_org && <p className="text-[9px] text-amber-600 mt-0.5">⚠️ 추출된 이름 &quot;{analysis.client_org}&quot;을 검색해보거나 신규 등록.</p>}
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-gray-600 mb-1">부서 (수의계약 한도용)</label>
              <input value={clientDept} onChange={e => setClientDept(e.target.value)}
                className="w-full text-[11px] border border-gray-200 rounded px-2 py-1 bg-white" />
            </div>

            {analysis.payment_schedules.length > 0 && (
              <div className="bg-gray-50 rounded px-2 py-1.5">
                <p className="text-[10px] font-semibold text-gray-600 mb-1">결제 일정 (자동 추가)</p>
                {analysis.payment_schedules.map((p, i) => (
                  <div key={i} className="text-[10px] text-gray-600">{p.label} {fmtMoney(p.amount)}원{p.due_date ? ` (${p.due_date})` : ''}</div>
                ))}
              </div>
            )}
          </div>
        )}

        {step === 'review' && (
          <div className="px-5 py-3 border-t border-gray-100 flex gap-2 justify-end">
            <button type="button" onClick={() => setStep('pick')}
              className="px-3 py-1.5 text-[11px] border border-gray-200 rounded text-gray-500 hover:bg-gray-50">
              ← 다른 PDF
            </button>
            <button type="button" onClick={submit} disabled={busy || !customerId || !entityId}
              className="px-4 py-1.5 text-[11px] font-semibold rounded disabled:opacity-50"
              style={{ backgroundColor: '#FFCE00', color: '#121212' }}>
              {busy ? '추가 중...' : '✓ 계약 추가'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function FinalQuoteMapper({ sale, projectId, entities, onChange }: { sale: Contract; projectId: string; entities: BusinessEntity[]; onChange: () => void }) {
  const [busy, setBusy] = useState(false)
  const [showPicker, setShowPicker] = useState(false)
  const [pdfs, setPdfs] = useState<{ name: string; path: string }[] | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [manualEntityId, setManualEntityId] = useState<string>('')

  const currentName = sale.final_quote_dropbox_path?.split('/').pop() || null

  async function openPicker() {
    setShowPicker(true); setErr(null); setPdfs(null)
    setBusy(true)
    const r = await listSaleFolderPdfs(sale.id)
    setBusy(false)
    if ('error' in r) { setErr(r.error); return }
    setPdfs(r.pdfs)
  }
  async function pick(path: string) {
    setBusy(true)
    await setSaleFinalQuote(sale.id, path, projectId)
    setBusy(false); setShowPicker(false)
    // 매핑 직후 자동 분석 트리거
    onChange()
    runAnalysis(path)
  }
  async function clear() {
    if (!confirm('최종 견적 매핑 해제할까?')) return
    setBusy(true)
    await setSaleFinalQuote(sale.id, null, projectId)
    setBusy(false); onChange()
  }
  async function runAnalysis(_path?: string) {
    setAnalyzing(true); setErr(null)
    const r = await analyzeFinalQuotePdf(sale.id)
    setAnalyzing(false)
    if ('error' in r) { setErr(r.error); return }
    setAnalysis(r.analysis)
  }
  async function applyAll() {
    if (!analysis) return
    setBusy(true)
    const finalEntityId = analysis.matched_entity_id || manualEntityId || null
    const r = await applyQuoteAnalysis(sale.id, {
      revenue: analysis.revenue,
      client_org: analysis.client_org,
      client_dept: analysis.client_dept,
      customer_id: analysis.matched_customer_id,
      entity_id: finalEntityId,
      payment_schedules: analysis.payment_schedules,
      replace_schedules: false,
    }, projectId)
    setBusy(false)
    if ('error' in r) { alert('적용 실패: ' + r.error); return }
    const msgs: string[] = ['적용 완료.']
    if ('folder_created' in r && r.folder_created) msgs.push('계약 폴더 자동 생성됨.')
    if ('folder_error' in r && r.folder_error) msgs.push(`⚠️ 폴더 생성 실패: ${r.folder_error}`)
    alert(msgs.join('\n'))
    setAnalysis(null); setManualEntityId(''); onChange()
  }

  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-semibold text-gray-600">최종 견적 PDF</p>
      {currentName ? (
        <div className="flex items-center gap-2 text-[11px] bg-white border border-gray-100 rounded px-2 py-1.5">
          <span>📎</span>
          <span className="text-gray-700 truncate flex-1" title={sale.final_quote_dropbox_path ?? ''}>{currentName}</span>
          <button onClick={() => runAnalysis()} disabled={busy || analyzing} className="text-purple-500 hover:underline">
            {analyzing ? '분석중...' : '🤖 분석'}
          </button>
          <button onClick={openPicker} disabled={busy} className="text-blue-500 hover:underline">다시 매핑</button>
          <button onClick={clear} disabled={busy} className="text-gray-400 hover:text-red-500">해제</button>
        </div>
      ) : (
        <button onClick={openPicker} disabled={busy}
          className="w-full text-[11px] py-1.5 border border-dashed border-gray-300 rounded text-gray-500 hover:border-yellow-400 hover:text-gray-700 disabled:opacity-50">
          📎 최종 견적 PDF 매핑하기
        </button>
      )}
      {analyzing && <p className="text-[11px] text-purple-500">📄 PDF 분석 중...</p>}
      {analysis && (
        <div className="border border-purple-200 bg-purple-50/50 rounded p-2 space-y-1.5 text-[11px]">
          <div className="flex items-center justify-between">
            <p className="font-semibold text-purple-700">🤖 PDF 분석 결과</p>
            <button onClick={() => setAnalysis(null)} className="text-gray-400 hover:text-gray-700">닫기</button>
          </div>
          <table className="w-full text-[11px]">
            <tbody>
              <tr><td className="text-gray-500 pr-2 align-top">매출액</td><td className="font-mono text-gray-800">{analysis.revenue ? fmtMoney(analysis.revenue) + '원' : '미추출'}</td></tr>
              <tr><td className="text-gray-500 pr-2 align-top">우리 사업자</td><td className="text-gray-800">
                <div>{analysis.supplier_name || '미추출'}
                  {analysis.matched_entity_id
                    ? <span className="ml-2 text-green-600">✓ 시스템 매칭: {analysis.matched_entity_name}</span>
                    : analysis.supplier_name && <span className="ml-2 text-amber-600">⚠️ 자동 매칭 안 됨 — 직접 선택</span>
                  }
                </div>
                {!analysis.matched_entity_id && (
                  <select value={manualEntityId} onChange={e => setManualEntityId(e.target.value)}
                    className="mt-1 text-[11px] border border-gray-200 rounded px-1.5 py-0.5 bg-white">
                    <option value="">-- 사업자 직접 선택 --</option>
                    {entities.map(e => (
                      <option key={e.id} value={e.id}>
                        {e.short_name ? `${e.short_name} (${e.name})` : e.name}{e.is_primary ? ' · 메인' : ''}
                      </option>
                    ))}
                  </select>
                )}
              </td></tr>
              <tr><td className="text-gray-500 pr-2 align-top">기관</td><td className="text-gray-800">
                {analysis.client_org || '미추출'}
                {analysis.matched_customer_id
                  ? <span className="ml-2 text-green-600">✓ 시스템 매칭: {analysis.matched_customer_name}</span>
                  : analysis.client_org && <span className="ml-2 text-amber-600">⚠️ DB에 없음 (매핑 안 됨)</span>
                }
              </td></tr>
              <tr><td className="text-gray-500 pr-2 align-top">부서</td><td className="text-gray-800">{analysis.client_dept || '미추출'} <span className="text-[10px] text-gray-400">(수의계약 한도용)</span></td></tr>
              {analysis.payment_schedules.length > 0 && (
                <tr><td className="text-gray-500 pr-2 align-top">결제 일정</td><td className="text-gray-800">
                  {analysis.payment_schedules.map((p, i) => (
                    <div key={i}>{p.label} {fmtMoney(p.amount)}원{p.due_date ? ` (${p.due_date})` : ''}</div>
                  ))}
                </td></tr>
              )}
              {analysis.notes && <tr><td className="text-gray-500 pr-2 align-top">메모</td><td className="text-gray-600 italic">{analysis.notes}</td></tr>}
            </tbody>
          </table>
          <div className="flex gap-2 pt-1">
            <button onClick={applyAll} disabled={busy}
              className="flex-1 py-1 text-[11px] font-semibold rounded disabled:opacity-50"
              style={{ backgroundColor: '#FFCE00', color: '#121212' }}>
              ✓ 계약에 적용
            </button>
            <button onClick={() => setAnalysis(null)} disabled={busy}
              className="px-3 py-1 text-[11px] border border-gray-200 rounded text-gray-500 hover:bg-white">
              취소
            </button>
          </div>
          {!analysis.matched_customer_id && analysis.client_org && (
            <p className="text-[10px] text-amber-700">
              ⚠️ 적용 시 client_org 텍스트만 들어가고 customer_id는 비어 있어. 빵빵이로 [{analysis.client_org}] customer 등록 후 다시 매핑 권장.
            </p>
          )}
        </div>
      )}
      {showPicker && (
        <div className="border border-gray-200 rounded bg-white p-2 space-y-1.5">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold text-gray-600">PDF 선택</p>
            <button onClick={() => setShowPicker(false)} className="text-gray-300 hover:text-gray-600 text-[11px]">취소</button>
          </div>
          {busy && !pdfs && <p className="text-[11px] text-gray-400">불러오는 중...</p>}
          {err && <p className="text-[11px] text-red-500">{err}</p>}
          {pdfs && pdfs.length === 0 && <p className="text-[11px] text-gray-400 italic">PDF 없음. Dropbox에 업로드 후 다시.</p>}
          {pdfs && pdfs.map(p => (
            <button key={p.path} onClick={() => pick(p.path)} disabled={busy}
              className={`w-full text-left text-[11px] px-2 py-1 rounded hover:bg-yellow-50 ${
                p.path === sale.final_quote_dropbox_path ? 'bg-yellow-100' : ''
              }`}>
              📄 {p.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function ContractFolderButton({ contract, projectId }: { contract: Contract; projectId: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  if (contract.dropbox_url) {
    return (
      <a href={contract.dropbox_url} target="_blank" rel="noopener noreferrer"
        onClick={e => e.stopPropagation()}
        className="ml-2 text-[11px] text-blue-500 hover:underline flex-shrink-0">📁</a>
    )
  }
  if (!contract.entity_id) {
    return <span className="ml-2 text-[10px] text-gray-300 flex-shrink-0" title="사업자 지정 후 폴더 생성 가능">📁</span>
  }
  return (
    <button onClick={async (e) => {
      e.preventDefault(); e.stopPropagation()
      setBusy(true)
      const r = await ensureContractFolder(contract.id)
      setBusy(false)
      if ('error' in r) alert('폴더 생성 실패: ' + r.error)
      else router.refresh()
    }} disabled={busy}
      className="ml-2 text-[11px] text-yellow-600 hover:underline flex-shrink-0 disabled:opacity-50"
      title="Dropbox 폴더 생성">
      {busy ? '...' : '📁 생성'}
    </button>
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
  const [showDetails, setShowDetails] = useState(false)
  const [newWhen, setNewWhen] = useState(() => new Date().toISOString().slice(0, 16))
  const [newLocation, setNewLocation] = useState('')
  const [newParticipants, setNewParticipants] = useState('')
  const [newOutcome, setNewOutcome] = useState('')

  function submitNew() {
    if (!newContent.trim()) return
    const category = ['내부회의', '메모'].includes(newType) ? '내부' : '외부'
    const participants = newParticipants.trim()
      ? newParticipants.split(',').map(s => s.trim()).filter(Boolean)
      : undefined
    startTransition(async () => {
      await createProjectLog(
        projectId,
        newContent.trim(),
        newType,
        category,
        showDetails ? new Date(newWhen).toISOString() : undefined,
        showDetails ? newLocation.trim() || undefined : undefined,
        participants,
        showDetails ? newOutcome.trim() || undefined : undefined,
      )
      setNewContent(''); setNewLocation(''); setNewParticipants(''); setNewOutcome('')
      setShowDetails(false)
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
              {adding ? '닫기' : '+ 상세 추가'}
            </button>
          </div>
        </div>
        {/* Flow UX 1차: 한 줄 퀵 입력 (상세는 [+ 상세 추가]로) */}
        {!adding && <QuickLogInput mode="project" projectId={projectId} />}

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
            <div className="border border-yellow-200 rounded-lg overflow-hidden bg-white">
              <BlockNoteEditor initialMarkdown={newContent} onChangeMarkdown={setNewContent} />
            </div>

            {/* 상세 필드 (회의록용) */}
            {showDetails && (
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div className="col-span-2">
                  <label className="text-[10px] text-gray-500">일시</label>
                  <input type="datetime-local" value={newWhen} onChange={e => setNewWhen(e.target.value)}
                    className="w-full text-xs border border-yellow-200 rounded px-2 py-1 focus:outline-none focus:border-yellow-400" />
                </div>
                <div>
                  <label className="text-[10px] text-gray-500">장소</label>
                  <input value={newLocation} onChange={e => setNewLocation(e.target.value)} placeholder="예: 곤지암리조트"
                    className="w-full text-xs border border-yellow-200 rounded px-2 py-1 focus:outline-none focus:border-yellow-400" />
                </div>
                <div>
                  <label className="text-[10px] text-gray-500">참석자 (콤마)</label>
                  <input value={newParticipants} onChange={e => setNewParticipants(e.target.value)} placeholder="조민현, 방준영"
                    className="w-full text-xs border border-yellow-200 rounded px-2 py-1 focus:outline-none focus:border-yellow-400" />
                </div>
                <div className="col-span-2">
                  <label className="text-[10px] text-gray-500">결정/결과</label>
                  <input value={newOutcome} onChange={e => setNewOutcome(e.target.value)} placeholder="합의 또는 결정사항"
                    className="w-full text-xs border border-yellow-200 rounded px-2 py-1 focus:outline-none focus:border-yellow-400" />
                </div>
              </div>
            )}

            <div className="flex gap-2 items-center">
              <button onClick={submitNew} disabled={!newContent.trim()}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg hover:opacity-80 disabled:opacity-40"
                style={{ backgroundColor: '#FFCE00', color: '#121212' }}>저장 (⌘+Enter)</button>
              <button onClick={() => { setAdding(false); setNewContent(''); setShowDetails(false) }}
                className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg text-gray-500">취소</button>
              <button onClick={() => setShowDetails(s => !s)}
                className="ml-auto text-[11px] text-gray-500 hover:text-gray-700 underline">
                {showDetails ? '상세 접기' : '+ 상세 (회의록)'}
              </button>
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
          {filteredLogs.slice(0, 50).map(l => (
            <LogRow key={l.id} log={l} contractName={l.sale_id ? contractNameMap[l.sale_id] : null}
              projectId={projectId} onChanged={() => router.refresh()} />
          ))}
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

function LogRow({ log, contractName, projectId, onChanged }: {
  log: Log; contractName: string | null; projectId: string; onChanged: () => void
}) {
  const [, startTransition] = useTransition()
  const [expanded, setExpanded] = useState(false)
  const [busy, setBusy] = useState(false)
  const dateStr = (log.contacted_at ?? log.created_at).slice(0, 16).replace('T', ' ')
  const icon = LOG_ICON[log.log_type] ?? '·'
  const color = LOG_COLOR[log.log_type] ?? 'bg-gray-50 text-gray-600 border-gray-100'
  const long = (log.content ?? '').length > 100

  function handleDelete() {
    if (!confirm('이 소통 기록을 삭제할까요?')) return
    setBusy(true)
    startTransition(async () => {
      await deleteProjectLog(log.id, projectId)
      setBusy(false)
      onChanged()
    })
  }

  return (
    <li className="px-5 py-3 hover:bg-gray-50/50 group">
      <div className="flex items-start gap-3">
        <div className={`text-xs px-2 py-1 rounded-full border font-medium flex-shrink-0 ${color}`}>
          <span className="mr-0.5">{icon}</span>{log.log_type}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-xs text-gray-400">{dateStr}</span>
            {log.author_name && <span className="text-xs text-gray-500">· {log.author_name}</span>}
            {contractName && <span className="text-[10px] text-purple-500 bg-purple-50 px-1.5 py-0.5 rounded">계약: {contractName.slice(0, 14)}</span>}
            <button onClick={handleDelete} disabled={busy}
              className="ml-auto text-xs text-gray-300 hover:text-red-400 md:opacity-0 md:group-hover:opacity-100 transition-opacity disabled:opacity-30">
              {busy ? '...' : '✕ 삭제'}
            </button>
          </div>
          <p className={`text-sm text-gray-700 whitespace-pre-line ${!expanded && long ? 'line-clamp-3' : ''}`}>{log.content}</p>
          {long && (
            <button onClick={() => setExpanded(v => !v)} className="mt-1 text-xs text-gray-400 hover:text-gray-600">
              {expanded ? '▲ 접기' : '▼ 전체 보기'}
            </button>
          )}
          {(log.location || (log.participants && log.participants.length > 0)) && (
            <p className="text-[11px] text-gray-400 mt-1">
              {log.location && <span>📍 {log.location}</span>}
              {log.location && log.participants && log.participants.length > 0 && <span> · </span>}
              {log.participants && log.participants.length > 0 && <span>참석: {log.participants.join(', ')}</span>}
            </p>
          )}
          {log.outcome && (
            <p className="text-[11px] text-blue-600 mt-1 bg-blue-50 px-2 py-1 rounded">→ {log.outcome}</p>
          )}
        </div>
      </div>
    </li>
  )
}

function DropboxEmptyCard({ projectId, serviceType }: { projectId: string; serviceType: string | null }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function handleCreate() {
    if (busy) return
    setBusy(true); setErr(null)
    const r = await createProjectDropboxFolder(projectId)
    setBusy(false)
    if ('error' in r) { setErr(r.error); return }
    router.refresh()
  }

  return (
    <div className="bg-white border border-gray-100 rounded-xl p-3">
      <p className="text-xs font-semibold text-gray-700 mb-2">📁 Dropbox</p>
      {serviceType ? (
        <>
          <p className="text-[11px] text-gray-500 mb-2">아직 폴더가 없어. 누르면 자동 생성 + brief.md 함께 만들어.</p>
          <button type="button" onClick={handleCreate} disabled={busy}
            className="w-full text-xs font-semibold rounded-lg py-2 hover:opacity-80 disabled:opacity-50"
            style={{ backgroundColor: '#FFCE00', color: '#121212' }}>
            {busy ? '생성 중...' : '📁 폴더 + brief 생성'}
          </button>
          {err && <p className="text-[11px] text-red-500 mt-1.5">{err}</p>}
        </>
      ) : (
        <p className="text-[11px] text-gray-500">서비스 종류 먼저 지정해 (설정 톱니).</p>
      )}
    </div>
  )
}

function DropboxFilesCard({ dropboxUrl, projectId }: { dropboxUrl: string; projectId: string }) {
  type Item = { name: string; path: string; type: 'file' | 'folder' }
  const [files, setFiles] = useState<Item[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [collapsed, setCollapsed] = useState(true)
  const [briefMsg, setBriefMsg] = useState<string | null>(null)
  const [briefLoading, setBriefLoading] = useState(false)
  const [briefContent, setBriefContent] = useState<string | null>(null)
  const [briefViewLoading, setBriefViewLoading] = useState(false)
  const [briefCopied, setBriefCopied] = useState(false)

  async function load() {
    setLoading(true)
    const result = await listProjectDropboxFiles(dropboxUrl)
    setFiles(result)
    setLoading(false)
  }

  async function regenBrief() {
    setBriefLoading(true)
    setBriefMsg(null)
    const result = await regenerateProjectBrief(projectId)
    setBriefMsg('error' in result ? `❌ ${result.error}` : `✅ ${result.filename}`)
    setBriefLoading(false)
    if ('ok' in result) {
      load()
      // 미리보기 박스 열려있으면 새 내용 다시 불러오기
      if (briefContent !== null) viewBrief()
    }
  }

  async function viewBrief() {
    if (briefContent !== null) {
      // 토글로 닫기
      setBriefContent(null)
      return
    }
    setBriefViewLoading(true)
    setBriefMsg(null)
    const result = await getProjectBriefContent(projectId)
    if ('error' in result) {
      setBriefMsg(`❌ ${result.error}`)
    } else {
      setBriefContent(result.content)
    }
    setBriefViewLoading(false)
  }

  async function copyBrief() {
    if (!briefContent) return
    try {
      await navigator.clipboard.writeText(briefContent)
      setBriefCopied(true)
      setTimeout(() => setBriefCopied(false), 1500)
    } catch {
      setBriefMsg('❌ 복사 실패')
    }
  }

  return (
    <div className="bg-white border border-gray-100 rounded-xl px-4 py-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <button onClick={() => setCollapsed(c => !c)} className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 hover:text-gray-900">
          <span className="text-gray-400 text-[10px]">{collapsed ? '▶' : '▼'}</span>
          📁 Dropbox 폴더
        </button>
        <div className="flex items-center gap-2">
          <button onClick={viewBrief} disabled={briefViewLoading}
            className="text-[11px] text-blue-500 hover:underline disabled:opacity-50">
            {briefViewLoading ? '...' : briefContent !== null ? '📕 닫기' : '📖 Brief 보기'}
          </button>
          <button onClick={regenBrief} disabled={briefLoading}
            className="text-[11px] text-blue-500 hover:underline disabled:opacity-50">
            {briefLoading ? '갱신중...' : '📄 Brief 갱신'}
          </button>
          <a href={dropboxUrl} target="_blank" rel="noopener noreferrer"
            className="text-[11px] text-blue-500 hover:underline">열기 ↗</a>
        </div>
      </div>
      {briefMsg && <p className="text-[11px] text-gray-500">{briefMsg}</p>}
      {briefContent !== null && (
        <div className="border border-gray-100 rounded-lg bg-gray-50 mt-1">
          <div className="flex items-center justify-between px-3 py-1.5 border-b border-gray-100">
            <span className="text-[11px] text-gray-500">brief 본문 (Claude Code에 붙여넣기용)</span>
            <button onClick={copyBrief}
              className={`text-[11px] px-2 py-0.5 rounded font-medium ${briefCopied ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700 hover:bg-blue-200'}`}>
              {briefCopied ? '✓ 복사됨' : '📋 전체 복사'}
            </button>
          </div>
          <pre className="px-3 py-2 text-[11px] text-gray-700 whitespace-pre-wrap max-h-80 overflow-y-auto font-mono leading-relaxed">{briefContent}</pre>
        </div>
      )}
      {!collapsed && (
        <>
          {files === null ? (
            <button onClick={load} disabled={loading}
              className="text-xs text-gray-500 hover:text-gray-800 underline disabled:opacity-50">
              {loading ? '불러오는 중...' : '파일 목록 불러오기'}
            </button>
          ) : files.length === 0 ? (
            <p className="text-xs text-gray-400">파일/폴더 없음</p>
          ) : (
            <>
              <ul className="space-y-0.5 max-h-60 overflow-y-auto">
                {files.map(f => (
                  <li key={f.path} className="text-xs text-gray-600 flex items-center gap-1.5">
                    <span>{f.type === 'folder' ? '📁' : '📄'}</span>
                    <span className="truncate">{f.name}</span>
                  </li>
                ))}
              </ul>
              <button onClick={load} disabled={loading}
                className="text-[11px] text-blue-500 hover:underline disabled:opacity-50">
                {loading ? '...' : '🔄 새로고침'}
              </button>
            </>
          )}
        </>
      )}
    </div>
  )
}
