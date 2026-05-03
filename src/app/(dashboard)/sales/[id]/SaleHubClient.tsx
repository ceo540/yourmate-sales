'use client'

import { useState, useTransition, useEffect } from 'react'
import { createLog, deleteLog, getSaleLogs } from './log-actions'
// useRouter intentionally removed — using getSaleLogs for log refresh to avoid startTransition rollback
import { createTask, updateTaskStatus, deleteTask } from '../tasks/actions'
import { generateShareToken, revokeShareToken } from './share-action'
import { LOG_TYPE_COLORS } from '@/lib/constants'
import TaskDetailPanel from './TaskDetailPanel'
import NotesTab from './components/NotesTab'
import ContractTab from './components/ContractTab'
import OverviewTab from './components/OverviewTab'
import SaleClassificationCard from './SaleClassificationCard'
import CostSheetEditor from '../CostSheetEditor'
import CostPdfImportModal from './CostPdfImportModal'
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
  // 운영 분류 (Phase 4)
  main_type?: string | null
  expansion_tags?: string[] | null
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
  const [showCostPdfImport, setShowCostPdfImport] = useState(false)

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
          <SaleClassificationCard
            saleId={sale.id}
            saleName={sale.name}
            serviceType={sale.service_type}
            initialMainType={sale.main_type ?? null}
            initialExpansionTags={sale.expansion_tags ?? null}
          />
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
        <>
          <div className="flex justify-end mb-2">
            <button
              onClick={() => setShowCostPdfImport(true)}
              className="text-xs px-3 py-1.5 bg-gray-50 text-gray-600 rounded-lg hover:bg-yellow-50 hover:text-gray-800 border border-gray-200"
            >
              📎 원가 폴더 분석
            </button>
          </div>
          <CostSheetEditor
            saleId={sale.id}
            revenue={sale.revenue ?? 0}
            initialItems={localCosts}
            vendors={vendors}
            showInternalCosts={showInternalCosts}
            onItemsChange={items => setLocalCosts(items as CostItem[])}
          />
        </>
      )}

      {showCostPdfImport && (
        <CostPdfImportModal saleId={sale.id} onClose={() => setShowCostPdfImport(false)} />
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
