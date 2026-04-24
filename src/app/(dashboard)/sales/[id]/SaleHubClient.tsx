'use client'

import { useState, useTransition, useEffect, useCallback } from 'react'
import { createLog, deleteLog, getSaleLogs } from './log-actions'
// useRouter intentionally removed — using getSaleLogs for log refresh to avoid startTransition rollback
import { updateMemo } from './memo-action'
import { updateSaleDetail } from './contract-action'
import { createTask, updateTaskStatus, deleteTask } from '../tasks/actions'
import { saveNotes, saveProjectOverview, generateProjectOverview, chatInNotes, generateDocument } from './notes-action'
import { generateShareToken, revokeShareToken } from './share-action'
import { updateProgressStatus } from '../actions'
import { listSaleDropboxFiles } from './dropbox-action'
import { syncSaleName, type SyncResult } from './sync-name-action'
import dynamic from 'next/dynamic'
import { DEPARTMENT_LABELS, PROGRESS_STATUSES, ProgressStatus } from '@/types'
import { TASK_STATUS_STYLE as STATUS_COLORS, LOG_TYPE_COLORS } from '@/lib/constants'
import QuotationModal from './QuotationModal'
import TaskDetailPanel from './TaskDetailPanel'
const TiptapEditor = dynamic(() => import('./TiptapEditor'), { ssr: false, loading: () => <div className="h-32 bg-gray-50 rounded-lg animate-pulse" /> })
import CostSheetEditor from '../CostSheetEditor'
import ProjectClaudeChat from '@/components/ProjectClaudeChat'

interface Profile { id: string; name: string }
interface BusinessEntity { id: string; name: string }
interface Customer { id: string; name: string; contact_name: string | null; type: string | null }
interface CostItem { id: string; item: string; amount: number; unit_price?: number | null; quantity?: number | null; unit?: string | null; category: string; vendor_id?: string | null; memo?: string | null }
interface Vendor { id: string; name: string; type: string }
interface ChecklistItem { id: string; text: string; done: boolean }
interface Task {
  id: string; title: string; status: string; priority: string | null
  due_date: string | null; description: string | null
  checklist: ChecklistItem[] | null
  assignee: { id: string; name: string } | null
  project_id: string | null
}
interface Log {
  id: string; content: string; log_type: string; created_at: string
  contacted_at?: string | null
  author: { name: string } | null
}
interface Sale {
  id: string; name: string; memo: string | null
  contract_stage: string | null; progress_status: string | null; service_type: string | null
  department: string | null; dropbox_url: string | null
  client_org: string | null; customer_id: string | null
  revenue: number | null; inflow_date: string | null
  payment_date: string | null; contract_type: string | null
  entity_id: string | null; assignee_id: string | null
  contract_assignee_id: string | null
  notes: string | null; project_overview: string | null
  notion_page_id: string | null
  share_token: string | null
}

interface Props {
  sale: Sale
  tasks: Task[]
  logs: Log[]
  profiles: Profile[]
  entities: BusinessEntity[]
  customers: Customer[]
  costs: CostItem[]
  vendors: Vendor[]
  showInternalCosts: boolean
  viewMode: 'full' | 'project' | 'contract'
  isAdmin: boolean
  currentUserId: string
}

// 받침 있는 타입은 '으로', 없거나 ㄹ 받침은 '로'
const LOG_SAVE_PARTICLE: Record<string, string> = { 방문: '으로', 미팅: '으로' }
const CONTRACT_STAGES = ['계약', '착수', '선금', '중도금', '완수', '계산서발행', '잔금'] as const
const CONTRACT_STAGE_MAP: Record<string, number> = {
  '계약': 0, '착수': 1, '선금': 2, '중도금': 3, '완수': 4, '계산서발행': 5, '잔금': 6,
}
const PRIORITY_COLOR: Record<string, string> = {
  '긴급': 'text-red-500', '높음': 'text-orange-400', '보통': 'text-gray-300', '낮음': 'text-gray-200',
}

function formatDue(d: string | null) {
  if (!d) return null
  const date = new Date(d); const today = new Date(); today.setHours(0,0,0,0)
  const diff = Math.ceil((date.getTime() - today.getTime()) / 86400000)
  if (diff < 0) return { label: `D${diff}`, color: 'text-red-500 font-bold' }
  if (diff === 0) return { label: 'D-day', color: 'text-red-500 font-bold' }
  if (diff <= 3) return { label: `D-${diff}`, color: 'text-orange-500 font-semibold' }
  return { label: `D-${diff}`, color: 'text-gray-400' }
}

export default function SaleHubClient({ sale, tasks: initialTasks, logs, profiles, entities, customers, costs: initialCosts, vendors, showInternalCosts, viewMode, isAdmin, currentUserId }: Props) {
  const [tab, setTab] = useState<'overview' | 'tasks' | 'logs' | 'notes' | 'contract' | '원가' | 'claude'>('overview')
  const [shareToken, setShareToken] = useState<string | null>(sale.share_token)
  const [shareLoading, setShareLoading] = useState(false)
  const [tasks, setTasks] = useState(initialTasks)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [isPending, startTransition] = useTransition()

  // 태스크가 외부에서 바뀌면 동기화
  useEffect(() => { setTasks(initialTasks) }, [initialTasks])

  const [localCosts, setLocalCosts] = useState<CostItem[]>(initialCosts)

  // 업무 추가
  const [showTaskForm, setShowTaskForm] = useState(false)
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [newTaskAssignee, setNewTaskAssignee] = useState('')
  const [newTaskDue, setNewTaskDue] = useState('')
  const [newTaskPriority, setNewTaskPriority] = useState('보통')

  // 소통 내역
  const [localLogs, setLocalLogs] = useState(logs)
  const [newLog, setNewLog] = useState('')
  const [newLogType, setNewLogType] = useState('통화')
  const [logContactedAt, setLogContactedAt] = useState(() => new Date().toISOString().slice(0, 16))
  const [logError, setLogError] = useState<string | null>(null)

  useEffect(() => { setLocalLogs(logs) }, [logs])

  const pendingTasks = tasks.filter(t => t.status !== '완료' && t.status !== '보류')
  const completedTasks = tasks.filter(t => t.status === '완료')

  function handleAddTask() {
    if (!newTaskTitle.trim()) return
    const fd = new FormData()
    fd.set('title', newTaskTitle)
    fd.set('project_id', sale.id)
    fd.set('status', '할 일')
    fd.set('priority', newTaskPriority)
    if (newTaskAssignee) fd.set('assignee_id', newTaskAssignee)
    if (newTaskDue) fd.set('due_date', newTaskDue)
    // 낙관적 추가 — 서버 응답 전에 UI 즉시 반영
    const assignee = profiles.find(p => p.id === newTaskAssignee)
    const optimistic: Task = {
      id: `optimistic-${Date.now()}`,
      title: newTaskTitle, status: '할 일', priority: newTaskPriority,
      due_date: newTaskDue || null, description: null, checklist: null,
      assignee: assignee ? { id: assignee.id, name: assignee.name } : null,
      project_id: sale.id,
    }
    setTasks(prev => [...prev, optimistic])
    setNewTaskTitle(''); setNewTaskAssignee(''); setNewTaskDue('')
    setShowTaskForm(false)
    startTransition(async () => { await createTask(fd) })
  }

  function handleAddLog(type: string) {
    if (!newLog.trim()) return
    setNewLogType(type)
    setLogError(null)
    startTransition(async () => {
      try {
        await createLog(sale.id, newLog, type, logContactedAt ? new Date(logContactedAt).toISOString() : undefined)
        setNewLog('')
        setLogContactedAt(new Date().toISOString().slice(0, 16))
        const updated = await getSaleLogs(sale.id)
        setLocalLogs(updated)
      } catch (e: any) {
        setLogError('저장 실패: ' + (e?.message ?? String(e)))
      }
    })
  }

  const ALL_TABS = [
    { key: 'overview' as const, label: '개요',       modes: ['full', 'project', 'contract'] },
    { key: 'tasks'    as const, label: `업무 ${pendingTasks.length > 0 ? `(${pendingTasks.length}건 진행중)` : `(${tasks.length})`}`, modes: ['full', 'project'] },
    { key: 'logs'     as const, label: `소통 내역 (${localLogs.length})`, modes: ['full', 'project', 'contract'] },
    { key: 'notes'    as const, label: '자유 노트',  modes: ['full', 'project'] },
    { key: 'contract' as const, label: '계약 정보',  modes: ['full', 'contract'] },
    { key: '원가'      as const, label: `원가 (${localCosts.length})`, modes: ['full', 'contract'] },
    { key: 'claude'   as const, label: 'Claude',                     modes: ['full', 'project', 'contract'] },
  ]
  const TABS = ALL_TABS.filter(t => t.modes.includes(viewMode))

  return (
    <div>
      {/* 탭 바 */}
      <div className="flex gap-0 border-b border-gray-200 mb-4 overflow-x-auto">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-all -mb-px whitespace-nowrap ${
              tab === t.key ? 'border-yellow-400 text-gray-900' : 'border-transparent text-gray-400 hover:text-gray-700'
            }`}>{t.label}</button>
        ))}
      </div>

      {/* ── 개요 탭 ── */}
      {tab === 'overview' && (
        <>
          <div className="flex justify-end mb-3 gap-2">
            {shareToken ? (
              <>
                <button
                  onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/share/${shareToken}`) }}
                  className="text-xs px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 font-medium"
                >
                  🔗 링크 복사
                </button>
                <button
                  onClick={async () => { setShareLoading(true); await revokeShareToken(sale.id); setShareToken(null); setShareLoading(false) }}
                  disabled={shareLoading}
                  className="text-xs px-3 py-1.5 bg-gray-50 text-gray-400 rounded-lg hover:bg-red-50 hover:text-red-500 disabled:opacity-40"
                >
                  공유 취소
                </button>
              </>
            ) : (
              <button
                onClick={async () => {
                  setShareLoading(true)
                  const token = await generateShareToken(sale.id)
                  if (token) { setShareToken(token); navigator.clipboard.writeText(`${window.location.origin}/share/${token}`) }
                  setShareLoading(false)
                }}
                disabled={shareLoading}
                className="text-xs px-3 py-1.5 bg-gray-50 text-gray-500 rounded-lg hover:bg-gray-100 disabled:opacity-40"
              >
                {shareLoading ? '생성 중...' : '🔗 외부 공유 링크'}
              </button>
            )}
          </div>
          <OverviewTab sale={sale} tasks={tasks} logs={localLogs} notes={sale.notes ?? ''} initialOverview={sale.project_overview ?? ''} costs={localCosts} showInternalCosts={showInternalCosts} />
        </>
      )}

      {/* ── 업무 탭 ── */}
      {tab === 'tasks' && (
        <div className="space-y-1">
          {pendingTasks.length === 0 && !showTaskForm ? (
            <div className="text-center py-12 bg-white border border-dashed border-gray-100 rounded-xl">
              <p className="text-2xl mb-3">📋</p>
              <p className="text-gray-500 text-sm font-medium mb-3">등록된 업무가 없어요</p>
              <button onClick={() => setShowTaskForm(true)}
                className="px-4 py-2 text-sm font-semibold rounded-lg hover:opacity-80"
                style={{ backgroundColor: '#FFCE00', color: '#121212' }}>+ 첫 업무 추가</button>
            </div>
          ) : (
            <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
              {pendingTasks.map((t, idx) => (
                <TaskRow key={t.id} t={t} idx={idx} total={pendingTasks.length} showForm={showTaskForm}
                  sale={sale} isAdmin={isAdmin} currentUserId={currentUserId}
                  startTransition={startTransition}
                  onClickTitle={() => setSelectedTask(t)}
                />
              ))}
              {showTaskForm ? (
                <div className="px-4 py-3 bg-yellow-50 border-t border-yellow-100">
                  <input autoFocus value={newTaskTitle}
                    onChange={e => setNewTaskTitle(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAddTask()}
                    placeholder="업무명 입력 후 Enter"
                    className="w-full text-sm bg-white border border-yellow-200 rounded-lg px-3 py-2 focus:outline-none focus:border-yellow-400 mb-2" />
                  <div className="flex gap-2 flex-wrap">
                    <select value={newTaskAssignee} onChange={e => setNewTaskAssignee(e.target.value)}
                      className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:border-yellow-400 min-w-[100px]">
                      <option value="">담당자</option>
                      {profiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    <input type="date" value={newTaskDue} onChange={e => setNewTaskDue(e.target.value)}
                      className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-yellow-400 min-w-[110px]" />
                    <select value={newTaskPriority} onChange={e => setNewTaskPriority(e.target.value)}
                      className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:border-yellow-400">
                      {['낮음', '보통', '높음', '긴급'].map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                    <button onClick={handleAddTask} disabled={isPending}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg hover:opacity-80"
                      style={{ backgroundColor: '#FFCE00', color: '#121212' }}>추가</button>
                    <button onClick={() => setShowTaskForm(false)}
                      className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg text-gray-500">취소</button>
                  </div>
                </div>
              ) : (
                <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50">
                  <button onClick={() => setShowTaskForm(true)} className="text-sm text-gray-400 hover:text-gray-700">+ 업무 추가</button>
                </div>
              )}
            </div>
          )}

          {completedTasks.length > 0 && (
            <div className="mt-3">
              <p className="text-xs text-gray-400 px-1 mb-1">완료 ({completedTasks.length})</p>
              <div className="bg-white border border-gray-100 rounded-xl overflow-hidden opacity-60">
                {completedTasks.map((t, idx) => (
                  <TaskRow key={t.id} t={t} idx={idx} total={completedTasks.length} showForm={false}
                    sale={sale} isAdmin={isAdmin} currentUserId={currentUserId}
                    startTransition={startTransition}
                    onClickTitle={() => setSelectedTask(t)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── 소통 내역 탭 ── */}
      {tab === 'logs' && (
        <div>
          <div className="bg-white border border-gray-100 rounded-xl p-4 mb-4">
            <textarea value={newLog} onChange={e => setNewLog(e.target.value)}
              placeholder="소통 내용을 기록하세요 (통화 내용, 이메일 요약, 방문 메모 등)"
              rows={2}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:border-yellow-400 mb-2" />
            <div className="flex items-center gap-2 mb-2">
              <label className="text-xs text-gray-400 shrink-0">소통 일시</label>
              <input type="datetime-local" value={logContactedAt}
                onChange={e => setLogContactedAt(e.target.value)}
                className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-yellow-400" />
            </div>
            <div className="flex items-center gap-2 mb-2">
              <button
                type="button"
                onClick={() => {
                  setLogContactedAt(new Date().toISOString().slice(0, 16))
                  if (newLog.trim()) handleAddLog('통화')
                }}
                disabled={isPending}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-500 text-white hover:bg-blue-600 transition-all disabled:opacity-50"
              >
                📞 지금 통화
              </button>
              <span className="text-xs text-gray-400">내용 입력 후 클릭하면 바로 저장</span>
            </div>
            {logError && (
              <p className="text-xs text-red-500 mb-2">{logError}</p>
            )}
            <div className="flex gap-2 flex-wrap">
              {['통화','이메일','방문','미팅','내부회의','메모','기타'].map(type => (
                <button key={type}
                  onClick={() => handleAddLog(type)}
                  disabled={isPending || !newLog.trim()}
                  className={`px-3 py-1.5 text-xs rounded-lg border transition-all disabled:opacity-40 ${
                    newLogType === type ? 'border-yellow-400 bg-yellow-50 text-gray-800' : 'border-gray-200 text-gray-500 hover:border-yellow-300'
                  }`}>{type}{LOG_SAVE_PARTICLE[type] ?? '로'} 저장</button>
              ))}
            </div>
          </div>
          {localLogs.length === 0 ? (
            <div className="text-center py-10 text-gray-400 text-sm">소통 내역이 없습니다</div>
          ) : (
            <div className="space-y-2">
              {localLogs.map(log => (
                <div key={log.id} className="bg-white border border-gray-100 rounded-xl px-4 py-3 group">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${LOG_TYPE_COLORS[log.log_type] ?? 'bg-gray-100 text-gray-500'}`}>{log.log_type}</span>
                    <span className="text-xs text-gray-400">{new Date(log.contacted_at || log.created_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                    <span className="text-xs text-gray-400 ml-auto">{log.author?.name ?? '-'}</span>
                    <button onClick={() => startTransition(async () => { await deleteLog(log.id, sale.id); const updated = await getSaleLogs(sale.id); setLocalLogs(updated) })}
                      className="opacity-0 group-hover:opacity-100 text-xs text-gray-300 hover:text-red-400 transition-all">✕</button>
                  </div>
                  <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{log.content}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── 자유 노트 탭 ── */}
      {tab === 'notes' && (
        <NotesTab
          saleId={sale.id}
          saleName={sale.name}
          initialNotes={sale.notes ?? ''}
          tasks={tasks}
          logs={localLogs}
        />
      )}

      {/* ── 계약 정보 탭 ── */}
      {tab === 'contract' && (
        <ContractTab sale={sale} profiles={profiles} entities={entities} customers={customers} />
      )}

      {/* ── 원가 탭 ── */}
      {/* 항상 마운트 유지 — 탭 전환 시 대화 내용 보존 */}
      <div className={tab === 'claude' ? '' : 'hidden'}>
        <ProjectClaudeChat
          saleId={sale.id}
          serviceType={sale.service_type}
          projectName={sale.name}
          dropboxUrl={sale.dropbox_url}
          defaultOpen
          onRevalidate={async () => { const updated = await getSaleLogs(sale.id); setLocalLogs(updated) }}
        />
      </div>

      {tab === '원가' && (
        <CostSheetEditor
          saleId={sale.id}
          revenue={sale.revenue ?? 0}
          initialItems={localCosts}
          vendors={vendors}
          showInternalCosts={showInternalCosts}
          onItemsChange={items => setLocalCosts(items as CostItem[])}
        />
      )}

      {/* ── 태스크 상세 패널 ── */}
      {selectedTask && (
        <TaskDetailPanel
          task={selectedTask}
          profiles={profiles}
          onClose={() => setSelectedTask(null)}
          onSaved={() => setSelectedTask(null)}
        />
      )}
    </div>
  )
}

// ── Task Row ──────────────────────────────────────────────────
function TaskRow({ t, idx, total, showForm, sale, isAdmin, currentUserId, startTransition, onClickTitle }: {
  t: Task; idx: number; total: number; showForm: boolean
  sale: Sale; isAdmin: boolean; currentUserId: string
  startTransition: (fn: () => void) => void
  onClickTitle: () => void
}) {
  const due = formatDue(t.due_date)
  const isLast = idx === total - 1 && !showForm
  const checkDone = (t.checklist ?? []).filter(c => c.done).length
  const checkTotal = (t.checklist ?? []).length

  return (
    <div className={`flex items-center gap-3 px-4 py-3 hover:bg-gray-50 group ${!isLast ? 'border-b border-gray-50' : ''}`}>
      <button
        onClick={() => startTransition(() => updateTaskStatus(t.id, t.status === '완료' ? '할 일' : '완료', sale.id))}
        className={`w-4 h-4 rounded-full flex-shrink-0 border-2 transition-all ${
          t.status === '완료' ? 'bg-green-400 border-green-400' : 'border-gray-300 hover:border-green-400'
        }`}
      />
      <div className="flex-1 min-w-0">
        <button onClick={onClickTitle} className="text-left w-full">
          <p className={`text-sm ${t.status === '완료' ? 'line-through text-gray-300' : 'text-gray-900 hover:text-blue-600'}`}>{t.title}</p>
          {checkTotal > 0 && (
            <div className="flex items-center gap-1.5 mt-1">
              <div className="w-16 h-1 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-yellow-400 rounded-full transition-all" style={{ width: `${(checkDone/checkTotal)*100}%` }} />
              </div>
              <span className="text-[10px] text-gray-400">{checkDone}/{checkTotal}</span>
            </div>
          )}
        </button>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {t.priority && t.priority !== '보통' && (
          <span className={`text-[11px] font-semibold ${PRIORITY_COLOR[t.priority] ?? 'text-gray-400'}`}>{t.priority}</span>
        )}
        {due && <span className={`text-xs ${due.color}`}>{due.label}</span>}
        {t.assignee && <span className="text-xs text-gray-400">{t.assignee.name}</span>}
        {(isAdmin || t.assignee?.id === currentUserId) && (
          <button onClick={() => startTransition(() => deleteTask(t.id, sale.id))}
            className="opacity-0 group-hover:opacity-100 text-xs text-gray-300 hover:text-red-400 transition-all">✕</button>
        )}
      </div>
    </div>
  )
}

// ── 개요 탭 (AI 자동 생성 + 사람이 수정) ─────────────────
function OverviewTab({ sale, tasks, logs, notes, initialOverview, costs, showInternalCosts }: {
  sale: Sale; tasks: Task[]; logs: Log[]; notes: string; initialOverview: string
  costs: CostItem[]; showInternalCosts: boolean
}) {
  const [overview, setOverview] = useState(initialOverview)
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savedMsg, setSavedMsg] = useState('')
  const [docTarget, setDocTarget] = useState<'client' | 'internal' | 'freelancer' | null>(null)
  const [docContent, setDocContent] = useState('')
  const [docGenerating, setDocGenerating] = useState(false)
  const [showQuotation, setShowQuotation] = useState(false)

  // 드롭박스 파일 목록
  const [dropboxFiles, setDropboxFiles] = useState<{ name: string; path: string; type: 'file' | 'folder' }[] | null>(null)
  const [loadingDropbox, setLoadingDropbox] = useState(false)

  useEffect(() => {
    if (!sale.dropbox_url) return
    setLoadingDropbox(true)
    listSaleDropboxFiles(sale.dropbox_url)
      .then(files => setDropboxFiles(files))
      .catch(() => setDropboxFiles([]))
      .finally(() => setLoadingDropbox(false))
  }, [sale.dropbox_url])

  // 개요가 없으면 탭 진입 시 자동 생성
  useEffect(() => {
    if (!initialOverview) {
      handleGenerateOverview()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const pending = tasks.filter(t => t.status !== '완료' && t.status !== '보류')
  const completed = tasks.filter(t => t.status === '완료')
  const urgent = pending.filter(t => t.priority === '긴급' || t.priority === '높음')
  const stageIdx = CONTRACT_STAGE_MAP[sale.contract_stage ?? '계약'] ?? 0
  const taskPct = tasks.length > 0 ? Math.round((completed.length / tasks.length) * 100) : 0

  async function handleGenerateOverview() {
    setGenerating(true)
    try {
      const html = await generateProjectOverview({
        sale: { name: sale.name, client_org: sale.client_org, service_type: sale.service_type, revenue: sale.revenue, contract_stage: sale.contract_stage, memo: sale.memo },
        tasks: tasks.map(t => ({ title: t.title, status: t.status, priority: t.priority, assignee: t.assignee?.name ?? null, due_date: t.due_date, description: t.description })),
        logs: logs.map(l => ({ content: l.content, log_type: l.log_type, created_at: l.created_at, author: l.author?.name ?? null })),
        notes,
      })
      setOverview(html)
    } finally {
      setGenerating(false)
    }
  }

  async function handleSaveOverview() {
    setSaving(true)
    await saveProjectOverview(sale.id, overview)
    setSaving(false)
    setSavedMsg('저장됨')
    setTimeout(() => setSavedMsg(''), 2000)
  }

  async function handleGenerateDoc(target: 'client' | 'internal' | 'freelancer') {
    setDocTarget(target)
    setDocGenerating(true)
    setDocContent('')
    try {
      const html = await generateDocument({
        target,
        sale: { name: sale.name, client_org: sale.client_org, service_type: sale.service_type, revenue: sale.revenue },
        tasks: tasks.map(t => ({ title: t.title, status: t.status, priority: t.priority, assignee: t.assignee?.name ?? null, due_date: t.due_date, description: t.description })),
        logs: logs.map(l => ({ content: l.content, log_type: l.log_type, created_at: l.created_at })),
        notes,
        overview,
      })
      setDocContent(html)
    } finally {
      setDocGenerating(false)
    }
  }

  const TARGET_LABELS = { client: '클라이언트용', internal: '내부 실무용', freelancer: '프리랜서용' }

  return (
    <div className="space-y-4">
      {/* 핵심 지표 - 한 줄 */}
      <div className="bg-white border border-gray-100 rounded-xl px-5 py-4 flex items-center gap-1 flex-wrap">
        <div className="flex items-baseline gap-1.5">
          <span className="text-2xl font-bold text-gray-900">{pending.length}</span>
          <span className="text-xs text-gray-400">건 진행중</span>
        </div>
        {tasks.length > 0 && (
          <>
            <span className="mx-3 text-gray-200 select-none">·</span>
            <div className="flex items-center gap-2">
              <div className="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all" style={{ width: `${taskPct}%`, backgroundColor: taskPct === 100 ? '#22c55e' : '#FFCE00' }} />
              </div>
              <span className="text-sm font-semibold text-gray-700">{taskPct}%</span>
              <span className="text-xs text-gray-400">({completed.length}/{tasks.length})</span>
            </div>
          </>
        )}
        <span className="mx-3 text-gray-200 select-none">·</span>
        <div className="flex items-baseline gap-1.5">
          <span className="text-2xl font-bold text-gray-900">{logs.length}</span>
          <span className="text-xs text-gray-400">소통</span>
        </div>
        {urgent.length > 0 && (
          <span className="ml-auto text-xs font-semibold text-red-500 bg-red-50 px-2.5 py-1 rounded-full">⚠ 긴급 {urgent.length}건</span>
        )}
      </div>

      {/* 긴급 업무 (있을 때만) */}
      {urgent.length > 0 && (
        <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 space-y-1.5">
          {urgent.map(t => {
            const due = formatDue(t.due_date)
            return (
              <div key={t.id} className="flex items-center gap-2 text-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0" />
                <span className="text-gray-700 flex-1 truncate">{t.title}</span>
                {t.assignee && <span className="text-gray-400">{t.assignee.name}</span>}
                {due && <span className={due.color}>{due.label}</span>}
              </div>
            )
          })}
        </div>
      )}

      {/* 수금 단계 */}
      <div className="bg-white border border-gray-100 rounded-xl p-4">
        <p className="text-xs font-semibold text-gray-600 mb-3">수금 단계</p>
        <div className="flex items-center">
          {CONTRACT_STAGES.map((status, i) => {
            const done = i < stageIdx; const current = i === stageIdx
            return (
              <div key={status} className="flex items-center flex-1 min-w-0">
                <div className="flex flex-col items-center flex-1">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold ${
                    done ? 'bg-green-500 text-white' : current ? 'text-gray-900 border-2' : 'bg-gray-100 text-gray-400'
                  }`} style={current ? { backgroundColor: '#FFCE00', borderColor: '#FFCE00' } : {}}>
                    {done ? '✓' : i + 1}
                  </div>
                  <span className={`text-[9px] mt-0.5 text-center px-0.5 ${current ? 'text-gray-900 font-semibold' : done ? 'text-green-600' : 'text-gray-400'}`}>{status}</span>
                </div>
                {i < CONTRACT_STAGES.length - 1 && <div className={`h-0.5 flex-1 -mt-3.5 mx-0.5 ${done ? 'bg-green-400' : 'bg-gray-200'}`} />}
              </div>
            )
          })}
        </div>
      </div>

      {/* 수익성 (원가 있을 때, 내부 비용 볼 수 있는 경우만) */}
      {showInternalCosts && costs.length > 0 && (() => {
        const calcAmt = (r: CostItem) => (r.unit_price && r.quantity) ? Number(r.unit_price) * Number(r.quantity) : (Number(r.amount) || 0)
        const totalCost = costs.reduce((s, r) => s + calcAmt(r), 0)
        const revenue = sale.revenue ?? 0
        const margin = revenue - totalCost
        const marginRate = revenue > 0 ? Math.round((margin / revenue) * 100) : null
        return (
          <div className="bg-white border border-gray-100 rounded-xl px-5 py-4">
            <p className="text-xs font-semibold text-gray-600 mb-3">수익성</p>
            <div className="flex gap-6 flex-wrap">
              <div>
                <p className="text-xs text-gray-400 mb-0.5">매출</p>
                <p className="text-base font-bold text-gray-700">{revenue > 0 ? `${Math.round(revenue/10000)}만원` : '-'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-0.5">원가합계</p>
                <p className="text-base font-bold text-gray-700">{Math.round(totalCost/10000)}만원</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-0.5">마진</p>
                <p className={`text-base font-bold ${margin >= 0 ? 'text-green-600' : 'text-red-500'}`}>{Math.round(margin/10000)}만원</p>
              </div>
              {marginRate !== null && (
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">마진율</p>
                  <p className={`text-base font-bold ${marginRate >= 30 ? 'text-green-600' : marginRate >= 10 ? 'text-yellow-600' : 'text-red-500'}`}>{marginRate}%</p>
                </div>
              )}
            </div>
          </div>
        )
      })()}

      {/* 프로젝트 개요 */}
      <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <p className="text-xs font-semibold text-gray-600">
            프로젝트 개요
            {generating && <span className="ml-2 text-gray-400 font-normal">AI 작성 중...</span>}
          </p>
          <div className="flex items-center gap-2">
            {savedMsg && <span className="text-xs text-green-600">{savedMsg}</span>}
            {!generating && overview && (
              <button onClick={handleSaveOverview} disabled={saving}
                className="text-xs text-gray-400 hover:text-gray-700 disabled:opacity-40 px-2 py-1 rounded hover:bg-gray-100">
                {saving ? '저장 중...' : '저장'}
              </button>
            )}
            <button onClick={handleGenerateOverview} disabled={generating}
              className="text-xs text-gray-400 hover:text-gray-700 disabled:opacity-40 px-2 py-1 rounded hover:bg-gray-100"
              title="AI로 다시 생성">
              {generating ? '...' : '↺ 재생성'}
            </button>
          </div>
        </div>
        <div className="px-4 py-3">
          {generating ? (
            <div className="space-y-2 animate-pulse py-4">
              <div className="h-3 bg-gray-100 rounded w-full" />
              <div className="h-3 bg-gray-100 rounded w-4/5" />
              <div className="h-3 bg-gray-100 rounded w-3/5" />
              <div className="h-3 bg-gray-100 rounded w-full" />
              <div className="h-3 bg-gray-100 rounded w-2/3" />
            </div>
          ) : (
            <TiptapEditor
              content={overview || '<p></p>'}
              onChange={setOverview}
              placeholder="프로젝트 개요를 직접 작성하거나 위의 &quot;AI로 생성&quot; 버튼을 눌러보세요"
            />
          )}
        </div>
      </div>

      {/* 견적서 생성 */}
      <div className="bg-white border border-gray-100 rounded-xl p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-600">견적서 생성</p>
            <p className="text-xs text-gray-400 mt-0.5">항목 입력 → 인쇄용 HTML 생성</p>
          </div>
          <button
            onClick={() => setShowQuotation(true)}
            className="px-4 py-2 text-xs font-semibold bg-yellow-400 hover:bg-yellow-500 text-gray-900 rounded-lg transition-colors"
          >
            견적서 만들기
          </button>
        </div>
      </div>

      {showQuotation && (
        <QuotationModal
          serviceType={sale.service_type}
          clientOrg={sale.client_org}
          onClose={() => setShowQuotation(false)}
        />
      )}

      {/* 문서 생성 */}
      <div className="bg-white border border-gray-100 rounded-xl p-4">
        <p className="text-xs font-semibold text-gray-600 mb-3">문서 생성</p>
        <div className="flex gap-2 flex-wrap">
          {(['client', 'internal', 'freelancer'] as const).map(target => (
            <button
              key={target}
              onClick={() => handleGenerateDoc(target)}
              disabled={docGenerating}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all disabled:opacity-50 ${
                docTarget === target ? 'border-yellow-400 bg-yellow-50 text-gray-800' : 'border-gray-200 text-gray-500 hover:border-gray-300'
              }`}
            >
              {TARGET_LABELS[target]}
            </button>
          ))}
        </div>

        {docGenerating && (
          <div className="mt-3 space-y-2 animate-pulse">
            <div className="h-3 bg-gray-100 rounded w-full" />
            <div className="h-3 bg-gray-100 rounded w-3/4" />
            <div className="h-3 bg-gray-100 rounded w-5/6" />
          </div>
        )}

        {docContent && !docGenerating && (
          <div className="mt-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-gray-500">{TARGET_LABELS[docTarget!]} 초안</p>
              <button
                onClick={() => {
                  const w = window.open('', '_blank')
                  if (!w) return
                  w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${sale.name} - ${TARGET_LABELS[docTarget!]}</title><style>body{font-family:sans-serif;max-width:800px;margin:40px auto;padding:0 20px;line-height:1.6;color:#111}h1,h2,h3{margin-top:1.5em}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ddd;padding:8px;text-align:left}@media print{body{margin:0}}</style></head><body>${docContent}</body></html>`)
                  w.document.close()
                  setTimeout(() => w.print(), 300)
                }}
                className="text-xs text-gray-400 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-100"
              >
                인쇄 / PDF
              </button>
            </div>
            <div className="border border-gray-100 rounded-xl p-4 prose prose-sm max-w-none bg-gray-50 max-h-[400px] overflow-y-auto"
              dangerouslySetInnerHTML={{ __html: docContent }}
            />
          </div>
        )}
      </div>

      {/* 드롭박스 파일 목록 */}
      {sale.dropbox_url && (
        <div className="bg-white border border-gray-100 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-gray-600">드롭박스 파일</p>
            <a href={sale.dropbox_url} target="_blank" rel="noopener noreferrer"
              className="text-xs text-blue-500 hover:text-blue-700">폴더 열기 →</a>
          </div>
          {loadingDropbox ? (
            <div className="space-y-1.5 animate-pulse">
              {[1,2,3].map(i => <div key={i} className="h-3 bg-gray-100 rounded w-3/4" />)}
            </div>
          ) : !dropboxFiles || dropboxFiles.length === 0 ? (
            <p className="text-xs text-gray-400">파일이 없거나 불러올 수 없습니다.</p>
          ) : (
            <div className="space-y-1">
              {dropboxFiles.map(f => (
                <a
                  key={f.path}
                  href={sale.dropbox_url ?? '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 transition-colors group"
                >
                  <span className="text-sm">{f.type === 'folder' ? '📁' : '📄'}</span>
                  <span className="text-xs text-gray-700 group-hover:text-blue-600 truncate">{f.name}</span>
                </a>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── 자유 노트 탭 (Tiptap + AI 대화) ─────────────────────────
function NotesTab({ saleId, saleName, initialNotes, tasks, logs }: {
  saleId: string; saleName: string; initialNotes: string
  tasks: Task[]; logs: Log[]
}) {
  const [notes, setNotes] = useState(initialNotes)
  const [saving, setSaving] = useState(false)
  const [savedMsg, setSavedMsg] = useState('')
  const [chatInput, setChatInput] = useState('')
  const [chatHistory, setChatHistory] = useState<{ role: 'user' | 'ai'; text: string }[]>([])
  const [chatLoading, setChatLoading] = useState(false)

  async function handleSave() {
    setSaving(true)
    await saveNotes(saleId, notes)
    setSaving(false)
    setSavedMsg('저장됨')
    setTimeout(() => setSavedMsg(''), 2000)
  }

  async function handleChat() {
    if (!chatInput.trim()) return
    const msg = chatInput.trim()
    setChatInput('')
    setChatHistory(prev => [...prev, { role: 'user', text: msg }])
    setChatLoading(true)
    try {
      const reply = await chatInNotes({
        message: msg,
        notes,
        saleName,
        tasks: tasks.map(t => ({ title: t.title, status: t.status })),
        logs: logs.map(l => ({ content: l.content, created_at: l.created_at })),
      })
      setChatHistory(prev => [...prev, { role: 'ai', text: reply }])
    } finally {
      setChatLoading(false)
    }
  }

  return (
    <div className="space-y-3">
      {/* 에디터 */}
      <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100">
          <p className="text-xs font-semibold text-gray-600">자유 노트</p>
          <div className="flex items-center gap-2">
            {savedMsg && <span className="text-xs text-green-600">{savedMsg}</span>}
            <button onClick={handleSave} disabled={saving}
              className="text-xs text-gray-400 hover:text-gray-700 disabled:opacity-40 px-2 py-1 rounded hover:bg-gray-100">
              {saving ? '저장 중...' : '저장'}
            </button>
          </div>
        </div>
        <div className="px-2 py-2">
          <TiptapEditor
            content={notes || '<p></p>'}
            onChange={setNotes}
            placeholder="자유롭게 기록하세요. 디자인 항목, 스펙, 수집한 자료, PM 고민 등..."
          />
        </div>
      </div>

      {/* AI 대화 */}
      <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
        <div className="px-4 py-2.5 border-b border-gray-100 flex items-center gap-2">
          <span className="text-xs font-semibold text-gray-600">AI와 대화</span>
          <span className="text-[11px] text-gray-400">노트 내용을 기반으로 정리·분석 도움</span>
        </div>

        {chatHistory.length > 0 && (
          <div className="px-4 py-3 space-y-3 max-h-[300px] overflow-y-auto">
            {chatHistory.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-xl px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap ${
                  msg.role === 'user'
                    ? 'text-gray-900 text-right'
                    : 'bg-gray-50 border border-gray-100 text-gray-700'
                }`} style={msg.role === 'user' ? { backgroundColor: '#FFCE00' } : {}}>
                  {msg.text}
                </div>
              </div>
            ))}
            {chatLoading && (
              <div className="flex justify-start">
                <div className="bg-gray-50 border border-gray-100 rounded-xl px-3 py-2">
                  <div className="flex gap-1">
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="px-4 py-3 flex gap-2 border-t border-gray-100">
          <input
            value={chatInput}
            onChange={e => setChatInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleChat()}
            placeholder="예: 이 내용으로 프리랜서 브리핑 정리해줘 / 리스크가 뭐야?"
            className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-yellow-400"
            disabled={chatLoading}
          />
          <button onClick={handleChat} disabled={chatLoading || !chatInput.trim()}
            className="px-4 py-2 text-sm font-semibold rounded-lg hover:opacity-80 disabled:opacity-40 flex-shrink-0"
            style={{ backgroundColor: '#FFCE00', color: '#121212' }}>
            전송
          </button>
        </div>
      </div>
    </div>
  )
}

// ── 계약 정보 탭 ──────────────────────────────────────────────
function ContractTab({ sale, profiles, entities, customers }: {
  sale: Sale; profiles: Profile[]; entities: BusinessEntity[]; customers: Customer[]
}) {
  const stageIdx = CONTRACT_STAGE_MAP[sale.contract_stage ?? '계약'] ?? 0
  const [saved, setSaved] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null)
  const [progressStatus, setProgressStatus] = useState<ProgressStatus>((sale.progress_status as ProgressStatus) ?? '착수전')

  function handleProgressChange(status: ProgressStatus) {
    setProgressStatus(status)
    startTransition(async () => {
      await updateProgressStatus(sale.id, status)
    })
  }
  const [customerSearch, setCustomerSearch] = useState('')
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false)
  const [selectedCustomerId, setSelectedCustomerId] = useState(sale.customer_id ?? '')
  const [clientOrgText, setClientOrgText] = useState(sale.client_org ?? '')

  const selectedCustomer = customers.find(c => c.id === selectedCustomerId)
  const filteredCustomers = customers.filter(c =>
    c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
    (c.contact_name ?? '').toLowerCase().includes(customerSearch.toLowerCase())
  )

  async function handleSubmit(formData: FormData) {
    formData.set('customer_id', selectedCustomerId)
    formData.set('client_org', selectedCustomer?.name ?? clientOrgText)
    startTransition(async () => {
      await updateSaleDetail(formData)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    })
  }

  return (
    <div className="space-y-4">
      {/* 수금 파이프라인 */}
      <div className="bg-white border border-gray-100 rounded-xl p-4">
        <p className="text-xs font-medium text-gray-500 mb-3">수금 단계</p>
        <div className="flex items-center">
          {CONTRACT_STAGES.map((status, i) => {
            const done = i < stageIdx; const current = i === stageIdx
            return (
              <div key={status} className="flex items-center flex-1 min-w-0">
                <div className="flex flex-col items-center flex-1">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    done ? 'bg-green-500 text-white' : current ? 'text-gray-900 border-2' : 'bg-gray-100 text-gray-400'
                  }`} style={current ? { backgroundColor: '#FFCE00', borderColor: '#FFCE00' } : {}}>
                    {done ? '✓' : i + 1}
                  </div>
                  <span className={`text-[10px] mt-1 text-center px-0.5 ${current ? 'text-gray-900 font-semibold' : done ? 'text-green-600' : 'text-gray-400'}`}>{status}</span>
                </div>
                {i < CONTRACT_STAGES.length - 1 && <div className={`h-0.5 flex-1 -mt-4 mx-0.5 ${done ? 'bg-green-400' : 'bg-gray-200'}`} />}
              </div>
            )
          })}
        </div>
      </div>

      {/* 운영 진행 트랙 */}
      <div className="bg-white border border-gray-100 rounded-xl p-4">
        <p className="text-xs font-medium text-gray-500 mb-3">운영 진행</p>
        <div className="flex gap-2">
          {PROGRESS_STATUSES.map(status => (
            <button key={status} type="button"
              onClick={() => handleProgressChange(status)}
              className={`flex-1 py-2 text-sm font-medium rounded-lg border transition-all ${
                progressStatus === status
                  ? status === '완수'   ? 'bg-teal-500 text-white border-teal-500'
                  : status === '착수중' ? 'bg-blue-500 text-white border-blue-500'
                  : 'bg-gray-800 text-white border-gray-800'
                  : 'bg-white text-gray-400 border-gray-200 hover:border-gray-400'
              }`}>{status}</button>
          ))}
        </div>
      </div>

      {/* 이름 동기화 */}
      {(sale.dropbox_url || sale.notion_page_id) && (
        <div className="bg-white border border-gray-100 rounded-xl p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-medium text-gray-700">이름 동기화</p>
              <p className="text-xs text-gray-400 mt-0.5 truncate">
                건명 변경 후 드롭박스 폴더{sale.notion_page_id ? ' · 노션 페이지' : ''}를 현재 이름으로 업데이트
              </p>
            </div>
            <button
              type="button"
              onClick={async () => {
                setSyncing(true)
                setSyncResult(null)
                const result = await syncSaleName(sale.id)
                setSyncResult(result)
                setSyncing(false)
              }}
              disabled={syncing}
              className="flex-shrink-0 px-3 py-1.5 text-xs font-semibold rounded-lg border border-gray-200 hover:border-gray-400 transition-all disabled:opacity-50"
            >
              {syncing ? '동기화 중...' : '🔄 동기화'}
            </button>
          </div>
          {syncResult && (
            <p className={`text-xs mt-2 ${syncResult.success ? 'text-green-600' : 'text-red-500'}`}>
              {syncResult.message}
            </p>
          )}
        </div>
      )}

      {/* 수정 폼 */}
      <div className="bg-white border border-gray-100 rounded-xl p-5">
        <form action={handleSubmit} className="space-y-4">
          <input type="hidden" name="id" value={sale.id} />

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">건명 *</label>
            <input name="name" required defaultValue={sale.name}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-yellow-400" />
          </div>

          {/* 발주처 — 고객 DB 연결 */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">발주처 (고객 DB)</label>
            <div className="relative">
              <div
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm cursor-pointer flex items-center justify-between focus:outline-none focus:border-yellow-400 bg-white"
                onClick={() => setShowCustomerDropdown(v => !v)}
              >
                <span className={selectedCustomer ? 'text-gray-900' : 'text-gray-400'}>
                  {selectedCustomer ? selectedCustomer.name : '고객 선택 또는 직접 입력'}
                </span>
                <span className="text-gray-400 text-xs">▼</span>
              </div>
              {showCustomerDropdown && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-lg overflow-hidden">
                  <div className="p-2 border-b border-gray-100">
                    <input
                      autoFocus
                      value={customerSearch}
                      onChange={e => setCustomerSearch(e.target.value)}
                      placeholder="검색..."
                      className="w-full text-sm px-2 py-1 border border-gray-200 rounded-lg focus:outline-none focus:border-yellow-400"
                    />
                  </div>
                  <div className="max-h-40 overflow-y-auto">
                    <button type="button"
                      onClick={() => { setSelectedCustomerId(''); setClientOrgText(''); setShowCustomerDropdown(false) }}
                      className="w-full text-left px-3 py-2 text-xs text-gray-400 hover:bg-gray-50">
                      선택 안함 (직접 입력)
                    </button>
                    {filteredCustomers.map(c => (
                      <button key={c.id} type="button"
                        onClick={() => { setSelectedCustomerId(c.id); setShowCustomerDropdown(false); setCustomerSearch('') }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-yellow-50 transition-colors">
                        <span className="font-medium text-gray-800">{c.name}</span>
                        {c.contact_name && <span className="text-xs text-gray-400 ml-2">{c.contact_name}</span>}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            {!selectedCustomer && (
              <input value={clientOrgText} onChange={e => setClientOrgText(e.target.value)}
                placeholder="직접 입력"
                className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-yellow-400" />
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">사업부</label>
              <select name="department" defaultValue={sale.department ?? ''}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:border-yellow-400">
                <option value="">선택 안함</option>
                {Object.entries(DEPARTMENT_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{label as string}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">업무 실무자</label>
              <select name="assignee_id" defaultValue={sale.assignee_id ?? ''}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:border-yellow-400">
                <option value="">선택 안함</option>
                {profiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">계약 실무자</label>
            <select name="contract_assignee_id" defaultValue={sale.contract_assignee_id ?? ''}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:border-yellow-400">
              <option value="">선택 안함</option>
              {profiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">매출액 (원)</label>
              <input type="number" name="revenue" defaultValue={sale.revenue ?? ''}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-yellow-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">계약 방법</label>
              <select name="contract_type" defaultValue={sale.contract_type ?? ''}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:border-yellow-400">
                <option value="">선택 안함</option>
                {['나라장터','세금계산서','카드결제','기타'].map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">유입일자</label>
              <input type="date" name="inflow_date" defaultValue={sale.inflow_date ? sale.inflow_date.split('T')[0] : ''}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-yellow-400"
                style={{ appearance: 'auto' } as React.CSSProperties} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">결제일자</label>
              <input type="date" name="payment_date" defaultValue={sale.payment_date ? sale.payment_date.split('T')[0] : ''}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-yellow-400"
                style={{ appearance: 'auto' } as React.CSSProperties} />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">계약 사업자</label>
            <select name="entity_id" defaultValue={sale.entity_id ?? ''}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:border-yellow-400">
              <option value="">선택 안함</option>
              {entities.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">계약 단계</label>
            <div className="flex gap-2 flex-wrap">
              {CONTRACT_STAGES.map(status => (
                <label key={status} className="cursor-pointer">
                  <input type="radio" name="contract_stage" value={status}
                    defaultChecked={(sale.contract_stage ?? '계약') === status} className="sr-only peer" />
                  <span className="px-3 py-1.5 rounded-full text-sm border border-gray-200 text-gray-500 peer-checked:border-yellow-400 peer-checked:bg-yellow-50 peer-checked:text-yellow-800 peer-checked:font-medium transition-all cursor-pointer block">{status}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">드롭박스 폴더 링크</label>
            <input name="dropbox_url" type="url" defaultValue={sale.dropbox_url ?? ''}
              placeholder="https://www.dropbox.com/home/..."
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-yellow-400" />
            <p className="text-[10px] text-gray-400 mt-1">Finder 우클릭 링크(/scl/fo/...)는 안 됩니다. 드롭박스 웹 → 폴더 열기 → 주소창 URL 복사</p>
          </div>

          <button type="submit" disabled={isPending}
            className="w-full py-2 text-sm font-semibold rounded-lg hover:opacity-80 disabled:opacity-50 transition-all"
            style={{ backgroundColor: '#FFCE00', color: '#121212' }}>
            {saved ? '✓ 저장됨' : isPending ? '저장 중...' : '저장'}
          </button>
        </form>
      </div>
    </div>
  )
}
