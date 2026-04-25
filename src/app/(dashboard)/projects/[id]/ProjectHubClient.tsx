'use client'

import { useState, useTransition, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  createProjectLog, deleteProjectLog, getProjectLogs,
  updateProjectMemo, updateProjectNotes, updateProjectStatus,
  linkProjectCustomer, createAndLinkCustomer, updateProjectDropbox,
  updateProjectName, updateCustomerContact, addProjectMember, removeProjectMember, linkSaleToProject,
  createTaskForProject, deleteProject, listProjectDropboxFiles,
  linkCalendarEvent, unlinkCalendarEvent, createAndLinkCalendarEvent, unlinkAndDeleteCalendarEvent,
} from './project-actions'
import { syncProjectName, type ProjectSyncResult } from './sync-project-name-action'
const CALENDAR_LABELS: Record<string, string> = {
  main: '개인/전체', sos: '사운드오브스쿨', rental: '렌탈일정', artqium: '아트키움',
}
import ProjectClaudeChat from '@/components/ProjectClaudeChat'
import { updateTaskStatus, deleteTask, updateTask } from '../../sales/tasks/actions'
import LogForm from './components/LogForm'
import Avatar from './components/Avatar'
import AssigneePicker from './components/AssigneePicker'
import ContractCard from './components/ContractCard'
import RelatedServices from './components/RelatedServices'

// ── 상수 ──────────────────────────────────────────────────────────────────────
const LOG_TYPE_STYLE: Record<string, { badge: string; bar: string; label: string }> = {
  통화:     { badge: 'bg-blue-50 text-blue-700 border-blue-100',        bar: 'bg-blue-300',    label: '📞 통화' },
  이메일:   { badge: 'bg-violet-50 text-violet-700 border-violet-100',  bar: 'bg-violet-300',  label: '✉ 이메일' },
  방문:     { badge: 'bg-green-50 text-green-700 border-green-100',     bar: 'bg-green-300',   label: '🏢 방문' },
  미팅:     { badge: 'bg-teal-50 text-teal-700 border-teal-100',        bar: 'bg-teal-300',    label: '🤝 미팅' },
  출장:     { badge: 'bg-cyan-50 text-cyan-700 border-cyan-100',        bar: 'bg-cyan-300',    label: '🚗 출장' },
  내부회의: { badge: 'bg-orange-50 text-orange-700 border-orange-100',  bar: 'bg-orange-300',  label: '💬 내부회의' },
  메모:     { badge: 'bg-yellow-50 text-yellow-700 border-yellow-100',  bar: 'bg-yellow-300',  label: '📝 메모' },
  기타:     { badge: 'bg-gray-50 text-gray-600 border-gray-100',        bar: 'bg-gray-300',    label: '· 기타' },
}
import { TASK_STATUS_STYLE as STATUS_STYLE, PRIORITY_DOT } from '@/lib/constants'
const PIPELINE = ['유입', '협의중', '견적발송', '계약', '진행중', '완료']

// ── 유틸 ──────────────────────────────────────────────────────────────────────
function fmtMoney(n: number) {
  if (n >= 100000000) return `${(n / 100000000).toFixed(1)}억`
  if (n >= 10000000)  return `${Math.round(n / 10000000) * 10}백만`
  if (n >= 10000)     return `${Math.round(n / 10000)}만`
  return n.toLocaleString()
}
function fmtDate(s: string | null) {
  if (!s) return ''
  return new Date(s).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
}
function fmtDatetime(s: string | null) {
  if (!s) return ''
  return new Date(s).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}
// ── 인터페이스 ────────────────────────────────────────────────────────────────
interface Profile { id: string; name: string }
interface Person { id: string; name: string; phone: string | null; email: string | null }
interface Customer { id: string; name: string; type: string | null; contact_name: string | null; phone: string | null; contact_email: string | null }
interface Member { profile_id: string; role: string; name: string }
interface PaymentSchedule { id: string; label: string; amount: number; is_received: boolean; due_date: string | null }
interface Contract {
  id: string; name: string; revenue: number | null; contract_stage: string | null
  progress_status: string | null; inflow_date: string | null; payment_date: string | null
  client_org: string | null; contract_split_reason: string | null; dropbox_url: string | null
  payment_schedules: PaymentSchedule[]
  assignee_name: string | null; entity_name: string | null; assignee_id: string | null; entity_id: string | null
}
interface Task {
  id: string; title: string; status: string; priority: string | null
  due_date: string | null; assignee: { id: string; name: string } | null
  project_id: string | null; description: string | null
}
interface Log {
  id: string; content: string; log_type: string; log_category: string | null
  contacted_at: string | null; created_at: string; author: { name: string } | null
  location?: string | null; participants?: string[] | null; outcome?: string | null
  sale_id?: string | null; lead_id?: string | null
}
interface CostItem { id: string; item: string; amount: number; category: string; sale_id: string }
interface LinkedCalEvent { id: string; calendarKey: string; title: string; date: string; color: string }
interface Project {
  id: string; name: string; service_type: string | null; department: string | null
  status: string; dropbox_url: string | null; memo: string | null; notes: string | null
  customer_id: string | null; pm_id: string | null
  linked_calendar_events?: LinkedCalEvent[]
}
interface Lead {
  id: string; lead_id: string; project_name: string | null
  status: string | null; inflow_date: string | null; assignee_name: string | null
}
interface SaleOption { id: string; name: string; revenue: number | null }
interface Entity { id: string; name: string }
interface RelatedRental {
  id: string; sale_id: string | null; customer_name: string
  status: string; rental_start: string | null; rental_end: string | null
}
interface Props {
  project: Project; members: Member[]; contracts: Contract[]
  tasks: Task[]; logs: Log[]; costs: CostItem[]
  profiles: Profile[]; customers: Customer[]; customer: Customer | null
  leads: Lead[]; salesOptions: SaleOption[]; entities: Entity[]
  persons: Person[]; rentals?: RelatedRental[]
  isAdmin: boolean; currentUserId: string
}

// ── 메인 컴포넌트 ─────────────────────────────────────────────────────────────
export default function ProjectHubClient({
  project, members, contracts: initialContracts, tasks: initialTasks, logs: initialLogs,
  costs: initialCosts, profiles, customers, customer, leads, salesOptions, entities, persons,
  rentals = [], isAdmin, currentUserId,
}: Props) {
  const router = useRouter()
  const [localContracts, setLocalContracts] = useState(initialContracts)
  const [localCosts, setLocalCosts] = useState<CostItem[]>(initialCosts)
  const [tasks, setTasks] = useState(initialTasks)
  const [localLogs, setLocalLogs] = useState(initialLogs)
  const [localMembers, setLocalMembers] = useState(members)
  const [localCustomer, setLocalCustomer] = useState(customer)
  const [isPending, startTransition] = useTransition()

  const [localName, setLocalName] = useState(project.name)

  // 캘린더 피커용 타입
  type GCalItem = { id: string; title: string; date: string; calendarKey: string; color: string }
  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState(project.name)
  const [confirmDelete, setConfirmDelete] = useState(false)

  // 드롭박스 파일 목록
  type DropboxItem = { name: string; path: string; type: 'file' | 'folder' }
  const [dbxFiles, setDbxFiles] = useState<DropboxItem[] | null>(null)
  const [dbxLoading, setDbxLoading] = useState(false)

  // 캘린더 연결 상태
  const [localLinkedEvents, setLocalLinkedEvents] = useState<LinkedCalEvent[]>(project.linked_calendar_events ?? [])
  const [showCalCreate, setShowCalCreate] = useState(false)
  const [showCalPicker, setShowCalPicker] = useState(false)
  const [allCalEvents, setAllCalEvents] = useState<GCalItem[]>([])
  const [calPickerLoading, setCalPickerLoading] = useState(false)
  const [calCreateKey, setCalCreateKey] = useState('main')
  const [calCreateTitle, setCalCreateTitle] = useState('')
  const [calCreateDate, setCalCreateDate] = useState('')
  const [calCreateStart, setCalCreateStart] = useState('')
  const [calCreateEnd, setCalCreateEnd] = useState('')
  const [calCreateAllDay, setCalCreateAllDay] = useState(false)
  const [calCreateDesc, setCalCreateDesc] = useState('')
  const [calCreateLoading, setCalCreateLoading] = useState(false)

  // 탭
  const [activeTab, setActiveTab] = useState<'work' | 'contract'>('work')

  // 업무 탭 상태
  const [logFilter, setLogFilter] = useState('전체')
  const [taskFilter, setTaskFilter] = useState<'pending' | 'all'>('pending')
  const [showTaskForm, setShowTaskForm] = useState(false)
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [newTaskDesc, setNewTaskDesc] = useState('')
  const [newTaskAssignee, setNewTaskAssignee] = useState('')
  const [newTaskDue, setNewTaskDue] = useState('')
  const [newTaskPriority, setNewTaskPriority] = useState('보통')
  const [newTaskContractId, setNewTaskContractId] = useState(initialContracts[0]?.id ?? '')
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null)
  const [editingTask, setEditingTask] = useState<Task | null>(null)

  // 메모 & 유의사항
  const [memo, setMemo] = useState(project.memo ?? '')
  const [memoEditing, setMemoEditing] = useState(false)
  const [localNotes, setLocalNotes] = useState(project.notes ?? '')
  const [editingNotes, setEditingNotes] = useState(false)

  // 상태 메뉴
  const [localStatus, setLocalStatus] = useState(project.status)
  useEffect(() => { setLocalStatus(project.status) }, [project.status])
  const [showStatusMenu, setShowStatusMenu] = useState(false)
  const statusMenuRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const h = (e: MouseEvent) => { if (statusMenuRef.current && !statusMenuRef.current.contains(e.target as Node)) setShowStatusMenu(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  // 고객 연결
  const [linkingCustomer, setLinkingCustomer] = useState(false)
  const [changingCustomer, setChangingCustomer] = useState(false)
  const [selectedCustomerId, setSelectedCustomerId] = useState('')
  const [customerSearch, setCustomerSearch] = useState('')
  const [addingNewCustomer, setAddingNewCustomer] = useState(false)
  const [newCustomerName, setNewCustomerName] = useState('')
  const [newCustomerType, setNewCustomerType] = useState('기타')
  const [newCustomerContact, setNewCustomerContact] = useState('')
  const [newCustomerPhone, setNewCustomerPhone] = useState('')
  const [newCustomerEmail, setNewCustomerEmail] = useState('')
  const [editingContact, setEditingContact] = useState(false)
  const [personSearch, setPersonSearch] = useState('')
  const [personDropdownOpen, setPersonDropdownOpen] = useState(false)
  const [contactName, setContactName] = useState(customer?.contact_name ?? '')
  const [contactPhone, setContactPhone] = useState(customer?.phone ?? '')
  const [contactEmail, setContactEmail] = useState(customer?.contact_email ?? '')

  // 계약 탭 상태
  const [showLeads, setShowLeads] = useState(false)
  const [showCustomerDetail, setShowCustomerDetail] = useState(false)
  const [editingDropbox, setEditingDropbox] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<ProjectSyncResult | null>(null)
  const [dropboxUrl, setDropboxUrl] = useState(project.dropbox_url ?? '')
  const [linkingSale, setLinkingSale] = useState(false)
  const [selectedSaleId, setSelectedSaleId] = useState('')

  // KPI
  const totalRevenue  = localContracts.reduce((s, c) => s + (c.revenue ?? 0), 0)
  const totalCost     = localCosts.reduce((s, c) => s + c.amount, 0)
  const totalReceived = localContracts.flatMap(c => c.payment_schedules).filter(p => p.is_received).reduce((s, p) => s + p.amount, 0)
  const profit = totalRevenue - totalCost
  const margin = totalRevenue > 0 ? Math.round((profit / totalRevenue) * 100) : 0
  const pendingTasks = tasks.filter(t => t.status !== '완료' && t.status !== '보류')
  const shownTasks = taskFilter === 'pending' ? pendingTasks : tasks
  const filteredLogs = localLogs.filter(l => {
    if (logFilter === '전체') return true
    if (logFilter === '공통') return !l.sale_id
    return l.sale_id === logFilter
  })

  const pm = localMembers.find(m => m.role === 'PM')
  const teamMembers = localMembers.filter(m => m.role !== 'PM')
  const pmProfiles = pm ? [{ id: pm.profile_id, name: pm.name }] : []
  const memberProfiles = teamMembers.map(m => ({ id: m.profile_id, name: m.name }))

  // 계약 콜백
  function handleContractChange(contractId: string, patch: Partial<Contract>) {
    setLocalContracts(prev => prev.map(c => c.id === contractId ? { ...c, ...patch } : c))
  }

  function handleSaveName() {
    if (!nameInput.trim() || nameInput === localName) { setEditingName(false); return }
    startTransition(async () => {
      const res = await updateProjectName(project.id, nameInput.trim())
      setLocalName(nameInput.trim())
      if (res.newDropboxUrl) setDropboxUrl(res.newDropboxUrl)
      setEditingName(false)
    })
  }

  function handlePmChange(added: Profile | null, removed: Profile | null) {
    startTransition(async () => {
      if (removed) { await removeProjectMember(project.id, removed.id); setLocalMembers(prev => prev.filter(m => m.profile_id !== removed.id)) }
      if (added) { await addProjectMember(project.id, added.id, 'PM'); setLocalMembers(prev => [...prev.filter(m => m.role !== 'PM'), { profile_id: added.id, role: 'PM', name: added.name }]) }
    })
  }
  function handleMemberChange(added: Profile | null, removed: Profile | null) {
    startTransition(async () => {
      if (removed) { await removeProjectMember(project.id, removed.id); setLocalMembers(prev => prev.filter(m => m.profile_id !== removed.id)) }
      if (added) { await addProjectMember(project.id, added.id, '담당자'); setLocalMembers(prev => [...prev, { profile_id: added.id, role: '담당자', name: added.name }]) }
    })
  }

  const pipelineIdx = PIPELINE.indexOf(localStatus ?? '진행중')
  async function handleStatusChange(stage: string) {
    setLocalStatus(stage); setShowStatusMenu(false)
    const res = await updateProjectStatus(project.id, stage)
    if (stage === '취소' && res?.cancelMsg) alert(`취소 처리 결과:\n\n${res.cancelMsg}`)
    startTransition(() => router.refresh())
  }

  function handleAddLog(type: string, category: string, content: string, contactedAt: string, location: string, participants: string[], outcome: string, saleId: string | null) {
    startTransition(async () => {
      await createProjectLog(project.id, content, type, category, new Date(contactedAt).toISOString(), location, participants, outcome, saleId)
      const updated = await getProjectLogs(project.id)
      setLocalLogs(updated)
    })
  }
  function handleDeleteLog(logId: string) {
    startTransition(async () => { await deleteProjectLog(logId, project.id); setLocalLogs(prev => prev.filter(l => l.id !== logId)) })
  }

  function handleAddTask() {
    if (!newTaskTitle.trim() || !newTaskContractId) return
    startTransition(async () => {
      const result = await createTaskForProject(newTaskContractId, newTaskTitle, newTaskAssignee || null, newTaskDue || null, newTaskPriority, newTaskDesc || null)
      if (result) setTasks(prev => [...prev, result])
      setNewTaskTitle(''); setNewTaskDesc(''); setNewTaskAssignee(''); setNewTaskDue(''); setNewTaskPriority('보통')
      setShowTaskForm(false)
    })
  }
  function handleSaveTaskEdit(task: Task) {
    const fd = new FormData()
    fd.set('id', task.id); fd.set('title', task.title); fd.set('status', task.status)
    fd.set('priority', task.priority ?? '보통'); fd.set('description', task.description ?? '')
    if (task.assignee) fd.set('assignee_id', task.assignee.id)
    if (task.due_date) fd.set('due_date', task.due_date)
    if (task.project_id) fd.set('project_id', task.project_id)
    startTransition(async () => {
      await updateTask(fd)
      setTasks(prev => prev.map(t => t.id === task.id ? task : t))
      setEditingTask(null); setExpandedTaskId(null)
    })
  }
  function handleTaskToggle(taskId: string, currentStatus: string) {
    const nextStatus = currentStatus === '완료' ? '할 일' : '완료'
    startTransition(async () => {
      await updateTaskStatus(taskId, nextStatus, null)
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: nextStatus } : t))
    })
  }

  // 고객 연결 UI (기존 연결 + 새로 추가 공통)
  function renderCustomerLinkUI(onCancel: () => void) {
    return (
      <div className="space-y-2">
        <div className="flex gap-0.5 bg-gray-100 rounded-lg p-0.5">
          {(['기존 연결', '새로 추가'] as const).map(mode => (
            <button key={mode} onClick={() => { setAddingNewCustomer(mode === '새로 추가'); setCustomerSearch(''); setSelectedCustomerId('') }}
              className={`flex-1 text-xs py-1 rounded-md transition-all font-medium ${(mode === '새로 추가') === addingNewCustomer ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400'}`}>
              {mode}
            </button>
          ))}
        </div>
        {addingNewCustomer ? (
          <div className="space-y-2 pt-1">
            <input autoFocus value={newCustomerName} onChange={e => setNewCustomerName(e.target.value)} placeholder="기관/회사명 *"
              className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-2 focus:outline-none focus:border-yellow-400" />
            <select value={newCustomerType} onChange={e => setNewCustomerType(e.target.value)}
              className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-2 bg-white focus:outline-none focus:border-yellow-400">
              {['공공기관', '국공립학교', '사립학교', '기업', '비영리', '개인', '기타'].map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <input value={newCustomerContact} onChange={e => setNewCustomerContact(e.target.value)} placeholder="담당자명"
              className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-2 focus:outline-none focus:border-yellow-400" />
            <input value={newCustomerPhone} onChange={e => setNewCustomerPhone(e.target.value)} placeholder="연락처"
              className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-2 focus:outline-none focus:border-yellow-400" />
            <input value={newCustomerEmail} onChange={e => setNewCustomerEmail(e.target.value)} placeholder="이메일"
              className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-2 focus:outline-none focus:border-yellow-400" />
            <div className="flex gap-2 pt-1">
              <button disabled={!newCustomerName.trim() || isPending}
                onClick={() => startTransition(async () => {
                  const res = await createAndLinkCustomer(project.id, { name: newCustomerName, type: newCustomerType, contact_name: newCustomerContact, phone: newCustomerPhone, contact_email: newCustomerEmail })
                  if (!res.error) {
                    setLocalCustomer({ id: res.id ?? '', name: newCustomerName, type: newCustomerType, contact_name: newCustomerContact || null, phone: newCustomerPhone || null, contact_email: newCustomerEmail || null })
                    setNewCustomerName(''); setNewCustomerContact(''); setNewCustomerPhone(''); setNewCustomerEmail('')
                    setLinkingCustomer(false); setChangingCustomer(false)
                  }
                })}
                className="flex-1 py-1.5 text-xs font-semibold rounded-lg hover:opacity-80 disabled:opacity-40" style={{ backgroundColor: '#FFCE00', color: '#121212' }}>
                추가 &amp; 연결
              </button>
              <button onClick={onCancel} className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg text-gray-500">취소</button>
            </div>
          </div>
        ) : (
          <div className="space-y-2 pt-1">
            <input autoFocus value={customerSearch} onChange={e => { setCustomerSearch(e.target.value); setSelectedCustomerId('') }}
              placeholder="기관명 검색..."
              className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-2 focus:outline-none focus:border-yellow-400" />
            <div className="max-h-44 overflow-y-auto border border-gray-100 rounded-lg divide-y divide-gray-50">
              {customers.filter(c => !customerSearch || c.name.toLowerCase().includes(customerSearch.toLowerCase())).slice(0, 12).map(c => (
                <button key={c.id} type="button" onClick={() => setSelectedCustomerId(c.id)}
                  className={`w-full text-left px-3 py-2 hover:bg-gray-50 flex items-center justify-between gap-2 ${selectedCustomerId === c.id ? 'bg-yellow-50' : ''}`}>
                  <span className={`text-xs font-medium ${selectedCustomerId === c.id ? 'text-gray-900' : 'text-gray-700'}`}>{c.name}</span>
                  {c.type && <span className="text-xs text-gray-400 flex-shrink-0">{c.type}</span>}
                </button>
              ))}
              {customers.filter(c => !customerSearch || c.name.toLowerCase().includes(customerSearch.toLowerCase())).length === 0 && (
                <p className="px-3 py-3 text-xs text-gray-400 text-center">검색 결과 없음</p>
              )}
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={() => startTransition(async () => {
                if (selectedCustomerId) {
                  await linkProjectCustomer(project.id, selectedCustomerId)
                  const newCust = customers.find(c => c.id === selectedCustomerId)
                  if (newCust) setLocalCustomer(newCust)
                  setLinkingCustomer(false); setChangingCustomer(false); setSelectedCustomerId('')
                }
              })} disabled={!selectedCustomerId || isPending}
                className="flex-1 py-1.5 text-xs font-semibold rounded-lg hover:opacity-80 disabled:opacity-40" style={{ backgroundColor: '#FFCE00', color: '#121212' }}>연결</button>
              <button onClick={onCancel} className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg text-gray-500">취소</button>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F5F5F3] -mx-4 md:-mx-8 -mt-4">

      {/* ── 헤더 ── */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                {project.service_type && <span className="text-xs bg-purple-50 text-purple-600 px-2 py-0.5 rounded-full">{project.service_type}</span>}
                {project.department && <span className="text-xs text-gray-400">{project.department}</span>}
              </div>
              {editingName ? (
                <div className="flex items-center gap-2">
                  <input value={nameInput} onChange={e => setNameInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleSaveName(); if (e.key === 'Escape') { setEditingName(false); setNameInput(localName) } }}
                    className="text-xl font-bold text-gray-900 border-b-2 border-yellow-400 bg-transparent focus:outline-none leading-tight min-w-0 w-full"
                    autoFocus />
                  <button onClick={handleSaveName} disabled={isPending}
                    className="text-xs px-2 py-1 rounded font-medium flex-shrink-0 disabled:opacity-40" style={{ backgroundColor: '#FFCE00', color: '#121212' }}>저장</button>
                  <button onClick={() => { setEditingName(false); setNameInput(localName) }}
                    className="text-xs px-2 py-1 rounded border border-gray-200 text-gray-500 flex-shrink-0">취소</button>
                </div>
              ) : (
                <div className="flex items-center gap-2 group">
                  <h1 className="text-xl font-bold text-gray-900 leading-tight">{localName}</h1>
                  <button onClick={() => { setEditingName(true); setNameInput(localName) }}
                    className="text-gray-300 hover:text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity text-sm flex-shrink-0">✏</button>
                </div>
              )}
              <div className="flex items-center gap-5 mt-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400 w-8">PM</span>
                  <AssigneePicker label="PM 지정" value={pmProfiles} multi={false} profiles={profiles} onChange={handlePmChange} />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400 w-14">관련 인원</span>
                  <AssigneePicker label="인원 추가" value={memberProfiles} multi profiles={profiles} onChange={handleMemberChange} />
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {(isAdmin || members.some(m => m.profile_id === currentUserId && m.role === 'PM')) && (
                confirmDelete ? (
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-red-500">정말 삭제?</span>
                    <button onClick={() => startTransition(async () => {
                      const res = await deleteProject(project.id)
                      if (res.error) { alert(`삭제 실패: ${res.error}`); return }
                      router.push('/projects')
                    })} disabled={isPending}
                      className="text-xs px-2 py-1 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-40">삭제</button>
                    <button onClick={() => setConfirmDelete(false)} className="text-xs px-2 py-1 border border-gray-200 rounded-lg text-gray-500">취소</button>
                  </div>
                ) : (
                  <button onClick={() => setConfirmDelete(true)}
                    className="text-xs px-2 py-1 border border-red-200 text-red-400 rounded-lg hover:bg-red-50 transition-colors">삭제</button>
                )
              )}
              <div className="relative" ref={statusMenuRef}>
              <button onClick={() => setShowStatusMenu(s => !s)}
                className={`text-sm px-3 py-1.5 rounded-full font-medium cursor-pointer hover:opacity-80 transition-opacity ${
                  localStatus === '완료' ? 'bg-green-100 text-green-700' : localStatus === '보류' ? 'bg-red-100 text-red-500' : 'bg-blue-100 text-blue-700'
                }`}>{localStatus} ▾</button>
              {showStatusMenu && (
                <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-30 py-1 min-w-32">
                  {[...PIPELINE, '보류', '취소'].map(s => (
                    <button key={s} onClick={() => handleStatusChange(s)}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 ${localStatus === s ? 'font-semibold text-gray-900' : 'text-gray-600'}`}>
                      {localStatus === s && '✓ '}{s}
                    </button>
                  ))}
                </div>
              )}
              </div>
            </div>
          </div>
          <div className="flex items-center mt-3">
            {PIPELINE.map((stage, i) => (
              <div key={stage} className="flex items-center">
                <button onClick={() => handleStatusChange(stage)}
                  className={`flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-medium transition-all hover:opacity-80 ${
                    i < pipelineIdx ? 'text-gray-400 hover:bg-gray-100' : i === pipelineIdx ? 'bg-yellow-400 text-gray-900 shadow-sm' : 'text-gray-300 hover:bg-gray-100'
                  }`}>
                  {i < pipelineIdx && <span className="text-green-500">✓</span>}
                  {stage}
                </button>
                {i < PIPELINE.length - 1 && <span className="text-gray-200 text-xs mx-0.5">›</span>}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── 본문 ── */}
      <div className="max-w-7xl mx-auto px-6 py-5 flex flex-col md:flex-row gap-5 items-start">

        {/* ─── 좌측 ─────────────────────────────────────── */}
        <div className="flex-1 min-w-0 space-y-4">

          {/* KPI */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: '계약 금액', value: fmtMoney(totalRevenue) + '원', sub: `계약 ${localContracts.length}건`, color: 'text-gray-900' },
              { label: `마진 ${margin}%`, value: fmtMoney(profit) + '원', sub: `원가 ${fmtMoney(totalCost)}원`, color: profit >= 0 ? 'text-green-600' : 'text-red-500' },
              { label: '수령 완료', value: fmtMoney(totalReceived) + '원', sub: `${totalRevenue > 0 ? Math.round(totalReceived / totalRevenue * 100) : 0}% 입금`, color: 'text-blue-600' },
              { label: '진행 업무', value: `${pendingTasks.length}건`, sub: `전체 ${tasks.length}건`, color: pendingTasks.length > 0 ? 'text-blue-600' : 'text-green-600' },
            ].map(c => (
              <div key={c.label} className="bg-white rounded-xl border border-gray-100 px-4 py-3">
                <p className="text-xs text-gray-400">{c.label}</p>
                <p className={`text-base font-bold mt-0.5 ${c.color}`}>{c.value}</p>
                <p className="text-xs text-gray-400 mt-0.5">{c.sub}</p>
              </div>
            ))}
          </div>

          {/* 탭 전환 */}
          <div className="flex bg-white border border-gray-100 rounded-xl p-1">
            {([['work', '업무'] as const, ['contract', '계약 관리'] as const]).map(([id, label]) => (
              <button key={id} onClick={() => setActiveTab(id)}
                className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${activeTab === id ? 'bg-yellow-400 text-gray-900' : 'text-gray-400 hover:text-gray-600'}`}>
                {label}
              </button>
            ))}
          </div>

          {/* ── 업무 탭 ── */}
          {activeTab === 'work' && (
            <>
              {/* 관련 서비스 페이지 */}
              <RelatedServices serviceType={project.service_type ?? null} rentals={rentals} />

              {/* 유의사항 */}
              <div className={`border rounded-xl px-4 py-3 ${localNotes || editingNotes ? 'bg-orange-50 border-orange-200' : 'bg-white border-gray-100'}`}>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-semibold text-orange-700">⚠ 유의사항</p>
                  {!editingNotes && (
                    <button onClick={() => setEditingNotes(true)} className="text-xs text-orange-400 hover:text-orange-700">{localNotes ? '편집' : '+ 추가'}</button>
                  )}
                </div>
                {editingNotes ? (
                  <div className="space-y-2">
                    <textarea value={localNotes} onChange={e => setLocalNotes(e.target.value)} rows={3} autoFocus
                      placeholder="특이사항, 주의사항을 입력하세요..."
                      className="w-full text-sm border border-orange-300 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-orange-400 bg-white" />
                    <div className="flex gap-2">
                      <button onClick={() => startTransition(async () => { await updateProjectNotes(project.id, localNotes); setEditingNotes(false) })}
                        disabled={isPending} className="px-3 py-1.5 bg-orange-400 text-white text-xs font-medium rounded-lg hover:bg-orange-500">저장</button>
                      <button onClick={() => { setLocalNotes(project.notes ?? ''); setEditingNotes(false) }}
                        className="px-3 py-1.5 border border-orange-200 text-orange-600 text-xs rounded-lg hover:bg-orange-50">취소</button>
                    </div>
                  </div>
                ) : localNotes ? (
                  <p className="text-sm text-orange-800 leading-relaxed">{localNotes}</p>
                ) : (
                  <p className="text-xs text-orange-300">클릭해서 특이사항을 추가하세요</p>
                )}
              </div>

              {/* 업무 */}
              <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
                  <div className="flex items-center gap-3">
                    <h2 className="text-sm font-semibold text-gray-800">업무</h2>
                    <div className="flex gap-0.5 bg-gray-100 rounded-full p-0.5">
                      {(['pending', 'all'] as const).map(f => (
                        <button key={f} onClick={() => setTaskFilter(f)}
                          className={`text-xs px-2.5 py-0.5 rounded-full transition-all ${taskFilter === f ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400'}`}>
                          {f === 'pending' ? `진행중 ${pendingTasks.length}` : `전체 ${tasks.length}`}
                        </button>
                      ))}
                    </div>
                  </div>
                  <button onClick={() => setShowTaskForm(s => !s)} className="text-xs text-gray-400 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-50">+ 추가</button>
                </div>

                {showTaskForm && (
                  <div className="px-4 py-3 bg-yellow-50 border-b border-yellow-100 space-y-2">
                    <input autoFocus value={newTaskTitle} onChange={e => setNewTaskTitle(e.target.value)} placeholder="업무명 *"
                      className="w-full text-sm bg-white border border-yellow-200 rounded-lg px-3 py-2 focus:outline-none focus:border-yellow-400" />
                    <textarea value={newTaskDesc} onChange={e => setNewTaskDesc(e.target.value)} placeholder="상세 내용 (선택)" rows={2}
                      className="w-full text-sm bg-white border border-yellow-200 rounded-lg px-3 py-2 focus:outline-none focus:border-yellow-400 resize-none" />
                    <div className="flex gap-2 flex-wrap">
                      {localContracts.length > 1 && (
                        <select value={newTaskContractId} onChange={e => setNewTaskContractId(e.target.value)}
                          className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white min-w-[120px]">
                          <option value="">계약 미연결</option>
                          {localContracts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                      )}
                      <select value={newTaskAssignee} onChange={e => setNewTaskAssignee(e.target.value)}
                        className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white min-w-[100px]">
                        <option value="">담당자</option>
                        {profiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                      <select value={newTaskPriority} onChange={e => setNewTaskPriority(e.target.value)}
                        className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white">
                        {['긴급', '높음', '보통', '낮음'].map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                      <input type="date" value={newTaskDue} onChange={e => setNewTaskDue(e.target.value)}
                        className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 min-w-[110px]" />
                      <button onClick={handleAddTask} disabled={isPending || !newTaskTitle.trim()}
                        className="px-3 py-1.5 text-xs font-semibold rounded-lg hover:opacity-80 disabled:opacity-40"
                        style={{ backgroundColor: '#FFCE00', color: '#121212' }}>추가</button>
                      <button onClick={() => setShowTaskForm(false)}
                        className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg text-gray-500">취소</button>
                    </div>
                  </div>
                )}

                <div className="divide-y divide-gray-50">
                  {shownTasks.length === 0
                    ? <p className="text-center py-8 text-sm text-gray-400">업무가 없습니다</p>
                    : shownTasks.map(t => {
                      const linkedContract = localContracts.find(c => c.id === t.project_id)
                      const isExpanded = expandedTaskId === t.id
                      const isEditing = editingTask?.id === t.id
                      return (
                        <div key={t.id}>
                          <div className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 group cursor-pointer"
                            onClick={() => { setExpandedTaskId(isExpanded ? null : t.id); setEditingTask(null) }}>
                            <button onClick={e => { e.stopPropagation(); handleTaskToggle(t.id, t.status) }}
                              className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all ${t.status === '완료' ? 'border-green-400 bg-green-400' : 'border-gray-300 hover:border-gray-500'}`}>
                              {t.status === '완료' && <span className="text-white text-xs leading-none">✓</span>}
                            </button>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className={`text-sm ${t.status === '완료' ? 'line-through text-gray-300' : 'text-gray-800'}`}>{t.title}</p>
                                {linkedContract && localContracts.length > 1 && (
                                  <span className="text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">
                                    {linkedContract.name.length > 12 ? linkedContract.name.slice(0, 12) + '…' : linkedContract.name}
                                  </span>
                                )}
                              </div>
                              {!isExpanded && t.description && <p className="text-xs text-gray-400 truncate mt-0.5">{t.description}</p>}
                              {(t.assignee || t.due_date) && (
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  {t.assignee && <><Avatar name={t.assignee.name} size="sm" /><span className="text-xs text-gray-400">{t.assignee.name}</span></>}
                                  {t.due_date && <span className="text-xs text-gray-400">· {fmtDate(t.due_date)}</span>}
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              {t.priority && <span className={`w-1.5 h-1.5 rounded-full ${PRIORITY_DOT[t.priority] ?? 'bg-gray-200'}`} />}
                              <span className={`text-xs px-1.5 py-0.5 rounded-full ${STATUS_STYLE[t.status] ?? 'bg-gray-100 text-gray-500'}`}>{t.status}</span>
                              <button onClick={e => { e.stopPropagation(); startTransition(async () => { await deleteTask(t.id, null); setTasks(prev => prev.filter(x => x.id !== t.id)) }) }}
                                className="text-gray-300 hover:text-red-400 text-xs">✕</button>
                            </div>
                          </div>
                          {isExpanded && (
                            <div className="px-4 pb-3 bg-gray-50 border-t border-gray-100">
                              {isEditing ? (
                                <div className="pt-3 space-y-2">
                                  <input value={editingTask!.title} onChange={e => setEditingTask(prev => prev ? { ...prev, title: e.target.value } : null)}
                                    className="w-full text-sm border border-yellow-300 rounded-lg px-3 py-2 focus:outline-none focus:border-yellow-400 bg-white" />
                                  <textarea value={editingTask!.description ?? ''} onChange={e => setEditingTask(prev => prev ? { ...prev, description: e.target.value } : null)}
                                    placeholder="상세 내용..." rows={3}
                                    className="w-full text-sm border border-yellow-300 rounded-lg px-3 py-2 focus:outline-none focus:border-yellow-400 bg-white resize-none" />
                                  <div className="flex gap-2 flex-wrap">
                                    <select value={editingTask!.status} onChange={e => setEditingTask(prev => prev ? { ...prev, status: e.target.value } : null)}
                                      className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white">
                                      {['할 일', '진행중', '검토중', '보류', '완료'].map(s => <option key={s}>{s}</option>)}
                                    </select>
                                    <select value={editingTask!.priority ?? '보통'} onChange={e => setEditingTask(prev => prev ? { ...prev, priority: e.target.value } : null)}
                                      className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white">
                                      {['긴급', '높음', '보통', '낮음'].map(p => <option key={p}>{p}</option>)}
                                    </select>
                                    <input type="date" value={editingTask!.due_date ?? ''} onChange={e => setEditingTask(prev => prev ? { ...prev, due_date: e.target.value } : null)}
                                      className="text-xs border border-gray-200 rounded-lg px-2 py-1.5" />
                                    <select value={editingTask!.assignee?.id ?? ''} onChange={e => {
                                      const p = profiles.find(x => x.id === e.target.value)
                                      setEditingTask(prev => prev ? { ...prev, assignee: p ? { id: p.id, name: p.name } : null } : null)
                                    }} className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white">
                                      <option value="">담당자</option>
                                      {profiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                    </select>
                                  </div>
                                  <div className="flex gap-2">
                                    <button onClick={() => handleSaveTaskEdit(editingTask!)} disabled={isPending}
                                      className="px-3 py-1.5 text-xs font-semibold rounded-lg hover:opacity-80" style={{ backgroundColor: '#FFCE00', color: '#121212' }}>저장</button>
                                    <button onClick={() => setEditingTask(null)} className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg text-gray-500">취소</button>
                                  </div>
                                </div>
                              ) : (
                                <div className="pt-3">
                                  {t.description ? <p className="text-sm text-gray-600 whitespace-pre-wrap leading-relaxed mb-2">{t.description}</p> : <p className="text-xs text-gray-300 mb-2">상세 내용 없음</p>}
                                  <button onClick={e => { e.stopPropagation(); setEditingTask({ ...t }) }}
                                    className="text-xs text-gray-400 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-100">✏ 편집</button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })
                  }
                </div>
              </div>

              {/* 소통 내역 */}
              <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-sm font-semibold text-gray-800">소통 내역</h2>
                    <div className="flex gap-1 flex-wrap">
                      {(['전체', '공통', ...localContracts.map(c => c.id)]).map(f => {
                        const c = localContracts.find(x => x.id === f)
                        const label = f === '전체' ? '전체' : f === '공통' ? '공통' : (c ? (c.name.length > 6 ? c.name.slice(0, 6) + '…' : c.name) : f)
                        return (
                          <button key={f} onClick={() => setLogFilter(f)}
                            className={`text-xs px-2 py-0.5 rounded-full border transition-all ${logFilter === f ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-200 text-gray-500 hover:border-gray-400'}`}>
                            {label}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                  <span className="text-xs text-gray-400 flex-shrink-0">{filteredLogs.length}건</span>
                </div>
                <LogForm contracts={localContracts} onSubmit={handleAddLog} isPending={isPending} />
                <div className="divide-y divide-gray-50">
                  {filteredLogs.length === 0
                    ? <p className="text-center py-8 text-sm text-gray-400">소통 내역이 없습니다</p>
                    : filteredLogs.map(l => {
                      const style = LOG_TYPE_STYLE[l.log_type] ?? { badge: 'bg-gray-100 text-gray-500 border-gray-100', bar: 'bg-gray-300', label: l.log_type }
                      const linkedContract = l.sale_id ? localContracts.find(c => c.id === l.sale_id) : null
                      return (
                        <div key={l.id} className="px-4 py-3 group hover:bg-gray-50">
                          <div className="flex items-start gap-3">
                            <div className={`w-0.5 self-stretch rounded-full mt-1 flex-shrink-0 ${style.bar}`} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1 flex-wrap">
                                <span className={`text-xs px-1.5 py-0.5 rounded border ${style.badge}`}>{style.label}</span>
                                <span className="text-xs text-gray-400">{fmtDatetime(l.contacted_at ?? l.created_at)}</span>
                                {l.author && <div className="flex items-center gap-1"><Avatar name={l.author.name} size="sm" /><span className="text-xs text-gray-400">{l.author.name}</span></div>}
                                {/* 리드 소통내역 출처 배지 — 계약 전 히스토리 */}
                                {l.lead_id
                                  ? <span className="ml-auto text-xs bg-purple-50 text-purple-500 px-2 py-0.5 rounded-full border border-purple-100">리드</span>
                                  : linkedContract
                                    ? <span className="ml-auto text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">{linkedContract.name.length > 10 ? linkedContract.name.slice(0, 10) + '…' : linkedContract.name}</span>
                                    : <span className="ml-auto text-xs bg-gray-50 text-gray-400 px-2 py-0.5 rounded-full">공통</span>
                                }
                                {/* 리드 소통내역은 리드 페이지에서만 삭제 가능 */}
                                {!l.lead_id && (
                                  <button onClick={() => handleDeleteLog(l.id)} className="text-gray-300 hover:text-red-400 text-xs opacity-0 group-hover:opacity-100">✕</button>
                                )}
                              </div>
                              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{l.content}</p>
                              {(l.location || (l.participants && l.participants.length > 0)) && (
                                <div className="flex flex-wrap gap-3 mt-1.5">
                                  {l.location && <span className="text-xs text-gray-400">📍 {l.location}</span>}
                                  {l.participants && l.participants.length > 0 && <span className="text-xs text-gray-400">👥 {l.participants.join(', ')}</span>}
                                </div>
                              )}
                              {l.outcome && (
                                <div className="mt-2 px-2.5 py-1.5 bg-yellow-50 border border-yellow-100 rounded-lg">
                                  <p className="text-xs text-yellow-800"><span className="font-semibold">결정: </span>{l.outcome}</p>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })
                  }
                </div>
              </div>

              {/* 캘린더 일정 */}
              <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
                  <h2 className="text-sm font-semibold text-gray-800">캘린더 일정</h2>
                  <div className="flex items-center gap-2">
                    <a href="/calendar" className="text-xs text-gray-400 hover:text-gray-700">캘린더 →</a>
                    <button onClick={() => { setShowCalCreate(s => !s); setShowCalPicker(false) }}
                      className="text-xs px-2 py-1 rounded hover:bg-gray-50 text-gray-400 hover:text-gray-700">+ 생성</button>
                    <button onClick={async () => {
                      setShowCalPicker(s => !s); setShowCalCreate(false)
                      if (!showCalPicker && allCalEvents.length === 0) {
                        setCalPickerLoading(true)
                        const now = new Date(); const y = now.getFullYear(); const m = now.getMonth()
                        const [a, b] = await Promise.all([
                          fetch(`/api/calendar/events?year=${y}&month=${m}`).then(r => r.json()),
                          fetch(`/api/calendar/events?year=${m === 11 ? y + 1 : y}&month=${m === 11 ? 0 : m + 1}`).then(r => r.json()),
                        ])
                        const today = now.toISOString().slice(0, 10)
                        setAllCalEvents([...(a.events ?? []), ...(b.events ?? [])].filter((e: GCalItem) => e.date >= today).sort((a: GCalItem, b: GCalItem) => a.date.localeCompare(b.date)))
                        setCalPickerLoading(false)
                      }
                    }} className="text-xs px-2 py-1 rounded hover:bg-gray-50 text-gray-400 hover:text-gray-700">연결</button>
                  </div>
                </div>

                {/* 생성 폼 */}
                {showCalCreate && (
                  <div className="px-4 py-3 bg-yellow-50 border-b border-yellow-100 space-y-2">
                    <div className="flex gap-2">
                      <select value={calCreateKey} onChange={e => setCalCreateKey(e.target.value)}
                        className="text-xs border border-yellow-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none">
                        {Object.entries(CALENDAR_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                      <input value={calCreateTitle} onChange={e => setCalCreateTitle(e.target.value)}
                        placeholder="일정 제목 *" autoFocus
                        className="flex-1 text-sm border border-yellow-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:border-yellow-400" />
                    </div>
                    <div className="flex gap-2 items-center flex-wrap">
                      <input type="date" value={calCreateDate} onChange={e => setCalCreateDate(e.target.value)}
                        className="text-xs border border-yellow-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none" />
                      <label className="flex items-center gap-1 text-xs text-gray-500">
                        <input type="checkbox" checked={calCreateAllDay} onChange={e => setCalCreateAllDay(e.target.checked)} />
                        종일
                      </label>
                      {!calCreateAllDay && <>
                        <input type="time" value={calCreateStart} onChange={e => setCalCreateStart(e.target.value)}
                          className="text-xs border border-yellow-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none" />
                        <span className="text-xs text-gray-400">~</span>
                        <input type="time" value={calCreateEnd} onChange={e => setCalCreateEnd(e.target.value)}
                          className="text-xs border border-yellow-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none" />
                      </>}
                    </div>
                    <textarea value={calCreateDesc} onChange={e => setCalCreateDesc(e.target.value)}
                      placeholder="메모 (선택)"
                      rows={2}
                      className="w-full text-xs border border-yellow-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:border-yellow-400 resize-none" />
                    <div className="flex gap-2">
                      <button onClick={async () => {
                        if (!calCreateTitle.trim() || !calCreateDate) return
                        setCalCreateLoading(true)
                        const res = await createAndLinkCalendarEvent(project.id, calCreateKey, {
                          title: calCreateTitle.trim(), date: calCreateDate,
                          startTime: calCreateAllDay ? undefined : calCreateStart || undefined,
                          endTime: calCreateAllDay ? undefined : calCreateEnd || undefined,
                          isAllDay: calCreateAllDay,
                          description: calCreateDesc.trim() || undefined,
                        })
                        setCalCreateLoading(false)
                        if (res.error) { alert('생성 실패: ' + res.error); return }
                        setLocalLinkedEvents(prev => [...prev, {
                          id: `tmp-${Date.now()}`, calendarKey: calCreateKey,
                          title: calCreateTitle.trim(), date: calCreateDate,
                          color: '#3B82F6',
                        }])
                        setCalCreateTitle(''); setCalCreateDate(''); setCalCreateStart(''); setCalCreateEnd(''); setCalCreateDesc(''); setCalCreateAllDay(false)
                        setShowCalCreate(false)
                      }} disabled={calCreateLoading || !calCreateTitle.trim() || !calCreateDate}
                        className="px-3 py-1.5 text-xs font-semibold rounded-lg hover:opacity-80 disabled:opacity-40"
                        style={{ backgroundColor: '#FFCE00', color: '#121212' }}>
                        {calCreateLoading ? '생성 중...' : '생성'}
                      </button>
                      <button onClick={() => setShowCalCreate(false)} className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg text-gray-500">취소</button>
                    </div>
                  </div>
                )}

                {/* 기존 일정 연결 피커 */}
                {showCalPicker && (
                  <div className="border-b border-gray-100 max-h-52 overflow-y-auto">
                    {calPickerLoading ? (
                      <p className="text-xs text-gray-400 px-4 py-3 text-center">불러오는 중...</p>
                    ) : allCalEvents.length === 0 ? (
                      <p className="text-xs text-gray-400 px-4 py-3 text-center">이달·다음달 일정 없음</p>
                    ) : allCalEvents.map(ev => {
                      const linked = localLinkedEvents.find(e => e.id === ev.id)
                      return (
                        <div key={ev.id} className="flex items-center gap-3 px-4 py-2 hover:bg-gray-50">
                          <div className="w-1 h-5 rounded-full flex-shrink-0" style={{ backgroundColor: ev.color }} />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-gray-700 truncate">{ev.title}</p>
                            <p className="text-xs text-gray-400">{ev.date.slice(5).replace('-', '/')}</p>
                          </div>
                          <button onClick={() => {
                            if (linked) {
                              startTransition(() => unlinkCalendarEvent(project.id, ev.id))
                              setLocalLinkedEvents(prev => prev.filter(e => e.id !== ev.id))
                            } else {
                              const newEv: LinkedCalEvent = { id: ev.id, calendarKey: ev.calendarKey, title: ev.title, date: ev.date, color: ev.color }
                              startTransition(() => linkCalendarEvent(project.id, newEv))
                              setLocalLinkedEvents(prev => [...prev, newEv])
                            }
                          }} className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 transition-colors ${linked ? 'bg-yellow-100 text-yellow-700' : 'border border-gray-200 text-gray-400 hover:border-gray-400'}`}>
                            {linked ? '연결됨' : '+ 연결'}
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* 연결된 일정 목록 */}
                {localLinkedEvents.length === 0 ? (
                  <p className="text-xs text-gray-400 px-4 py-4 text-center">연결된 일정 없음 — 위 버튼으로 생성하거나 연결하세요</p>
                ) : (
                  <div className="divide-y divide-gray-50">
                    {[...localLinkedEvents].sort((a, b) => a.date.localeCompare(b.date)).map(ev => (
                      <div key={ev.id} className="flex items-center gap-3 px-4 py-2.5 group">
                        <div className="w-1 h-6 rounded-full flex-shrink-0" style={{ backgroundColor: ev.color }} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-800 truncate">{ev.title}</p>
                        </div>
                        <span className="text-xs text-gray-400 flex-shrink-0">{ev.date.slice(5).replace('-', '/')}</span>
                        <button onClick={async () => {
                          const alsoDelete = confirm(
                            '이 일정을 어떻게 처리할까요?\n\n[확인] Google Calendar에서도 완전 삭제\n[취소] 프로젝트 연결만 해제 (Google Calendar에 그대로 남김)'
                          )
                          setLocalLinkedEvents(prev => prev.filter(e => e.id !== ev.id))
                          if (alsoDelete) {
                            const res = await unlinkAndDeleteCalendarEvent(project.id, ev.id, ev.calendarKey)
                            if (res.error) alert('Google Calendar 삭제 실패: ' + res.error)
                          } else {
                            startTransition(() => unlinkCalendarEvent(project.id, ev.id))
                          }
                        }} className="text-gray-200 hover:text-red-400 text-xs opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">✕</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 관련 파일 (드롭박스) */}
              {dropboxUrl && (
                <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm font-semibold text-gray-800">관련 파일</h2>
                      <a href={dropboxUrl} target="_blank" rel="noreferrer"
                        className="text-xs text-blue-400 hover:text-blue-600">드롭박스 열기 →</a>
                    </div>
                    <button
                      onClick={async () => {
                        setDbxLoading(true)
                        const files = await listProjectDropboxFiles(dropboxUrl)
                        setDbxFiles(files)
                        setDbxLoading(false)
                      }}
                      disabled={dbxLoading}
                      className="text-xs text-gray-400 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-50 disabled:opacity-40">
                      {dbxLoading ? '로딩...' : dbxFiles === null ? '불러오기' : '새로고침'}
                    </button>
                  </div>
                  {dbxFiles === null ? (
                    <p className="text-xs text-gray-400 px-4 py-4 text-center">위 버튼을 눌러 파일 목록을 불러오세요</p>
                  ) : dbxFiles.length === 0 ? (
                    <p className="text-xs text-gray-400 px-4 py-4 text-center">폴더가 비어 있습니다</p>
                  ) : (
                    <div className="divide-y divide-gray-50">
                      {dbxFiles.map(f => {
                        const isFolder = f.type === 'folder'
                        const ext = f.name.split('.').pop()?.toLowerCase() ?? ''
                        const icon = isFolder ? '📁' : ['pdf'].includes(ext) ? '📄' : ['jpg','jpeg','png','gif','webp'].includes(ext) ? '🖼' : ['xlsx','xls','csv'].includes(ext) ? '📊' : ['docx','doc'].includes(ext) ? '📝' : '📎'
                        return (
                          <div key={f.path} className="flex items-center gap-2.5 px-4 py-2.5 hover:bg-gray-50">
                            <span className="text-sm flex-shrink-0">{icon}</span>
                            <span className="text-sm text-gray-700 truncate flex-1">{f.name}</span>
                            {isFolder && <span className="text-xs text-gray-400 flex-shrink-0">폴더</span>}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* AI 협업 창구 */}
              <ProjectClaudeChat
                saleId={localContracts[0]?.id}
                projectId={project.id}
                serviceType={project.service_type}
                projectName={localName}
                dropboxUrl={dropboxUrl || null}
                onProjectStatusChange={(s) => setLocalStatus(s)}
              />

            </>
          )}

          {/* ── 계약 관리 탭 ── */}
          {activeTab === 'contract' && (
            <>
              {/* 계약 목록 */}
              <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-semibold text-gray-800">계약 목록</h2>
                    <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">{localContracts.length}건</span>
                    <span className="text-xs text-gray-400">합계 {fmtMoney(totalRevenue)}원</span>
                  </div>
                  <button onClick={() => setLinkingSale(s => !s)} className="text-xs text-gray-400 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-50">+ 매출 연결</button>
                </div>

                {linkingSale && (
                  <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
                    <div className="flex gap-2">
                      <select value={selectedSaleId} onChange={e => setSelectedSaleId(e.target.value)}
                        className="flex-1 text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:border-yellow-400">
                        <option value="">매출 건 선택...</option>
                        {salesOptions.map(s => <option key={s.id} value={s.id}>{s.name}{s.revenue ? ` (${fmtMoney(s.revenue)}원)` : ''}</option>)}
                      </select>
                      <button onClick={() => startTransition(async () => {
                        if (selectedSaleId) {
                          await linkSaleToProject(project.id, selectedSaleId)
                          // 연결된 매출 건을 localContracts에 낙관적 추가 (리로드 없이 즉시 반영)
                          const newSale = salesOptions.find(s => s.id === selectedSaleId)
                          if (newSale) {
                            setLocalContracts(prev => [...prev, {
                              id: newSale.id, name: newSale.name, revenue: newSale.revenue,
                              contract_stage: null, progress_status: null, inflow_date: null,
                              payment_date: null, client_org: null, contract_split_reason: null,
                              dropbox_url: null, payment_schedules: [],
                              assignee_name: null, entity_name: null, assignee_id: null, entity_id: null,
                            }])
                          }
                          setLinkingSale(false); setSelectedSaleId('')
                        }
                      })}
                        disabled={!selectedSaleId || isPending}
                        className="px-3 py-1.5 text-xs font-semibold rounded-lg hover:opacity-80 disabled:opacity-40" style={{ backgroundColor: '#FFCE00', color: '#121212' }}>연결</button>
                      <button onClick={() => { setLinkingSale(false); setSelectedSaleId('') }}
                        className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg text-gray-500">취소</button>
                    </div>
                  </div>
                )}

                <div className="p-3 space-y-2">
                  {localContracts.length === 0
                    ? <p className="text-center py-6 text-sm text-gray-400">연결된 계약이 없습니다</p>
                    : localContracts.map((c, i) => (
                      <ContractCard key={c.id} contract={c} index={i} tasks={tasks} costs={localCosts}
                        projectId={project.id} entities={entities} profiles={profiles}
                        onContractChange={handleContractChange}
                        onCostAdd={cost => setLocalCosts(prev => [...prev, cost])}
                        onCostDelete={costId => setLocalCosts(prev => prev.filter(c => c.id !== costId))}
                      />
                    ))
                  }
                </div>

                {localContracts.length > 0 && (
                  <div className="px-4 py-3 border-t border-gray-100 bg-gray-50">
                    <div className="grid grid-cols-4 gap-3 text-center text-xs">
                      {[
                        { label: '총 매출', value: fmtMoney(totalRevenue) + '원', cls: 'text-gray-900' },
                        { label: '총 원가', value: fmtMoney(totalCost) + '원', cls: 'text-gray-700' },
                        { label: '수령 완료', value: fmtMoney(totalReceived) + '원', cls: 'text-green-600' },
                        { label: `총 이익 (${margin}%)`, value: fmtMoney(profit) + '원', cls: profit >= 0 ? 'text-green-600' : 'text-red-500' },
                      ].map(r => (
                        <div key={r.label}><p className="text-gray-400 mb-0.5">{r.label}</p><p className={`font-bold ${r.cls}`}>{r.value}</p></div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* 연결된 리드 */}
              <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
                <button onClick={() => setShowLeads(s => !s)} className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50">
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-semibold text-gray-800">연결된 리드</h2>
                    <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">{leads.length}건</span>
                    <span className="text-xs text-gray-400">이 프로젝트로 병합된 리드</span>
                  </div>
                  <span className="text-gray-300 text-xs">{showLeads ? '▲' : '▼'}</span>
                </button>
                {showLeads && (
                  <div className="border-t border-gray-50 divide-y divide-gray-50">
                    {leads.length === 0 ? (
                      <div className="px-4 py-4 text-center">
                        <p className="text-xs text-gray-400">연결된 리드가 없습니다</p>
                        <a href="/leads" className="text-xs text-blue-400 hover:text-blue-600 mt-1 inline-block">리드 페이지에서 프로젝트 연결 →</a>
                      </div>
                    ) : leads.map((l, i) => (
                      <div key={l.id} className="px-4 py-3 flex items-start gap-3">
                        <div className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${i === 0 ? 'bg-yellow-400' : 'bg-gray-300'}`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-sm font-medium text-gray-800">{l.project_name ?? l.lead_id}</span>
                            {i === 0 && <span className="text-xs bg-yellow-50 text-yellow-700 px-1.5 py-0.5 rounded-full">최초 리드</span>}
                            <span className="text-xs font-mono text-gray-400">{l.lead_id}</span>
                          </div>
                          <p className="text-xs text-gray-400">{l.assignee_name && `${l.assignee_name} · `}유입 {l.inflow_date}</p>
                        </div>
                        {l.status && <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full flex-shrink-0">{l.status}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 프로젝트 메모 */}
              <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-semibold text-gray-800">프로젝트 메모</h2>
                    <span className="text-xs text-gray-400">기획·결정 등 핵심 정보</span>
                  </div>
                  {!memoEditing && <button onClick={() => setMemoEditing(true)} className="text-xs text-gray-400 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-50">편집</button>}
                </div>
                <div className="px-4 py-3">
                  {memoEditing ? (
                    <div className="space-y-2">
                      <textarea value={memo} onChange={e => setMemo(e.target.value)} rows={5} autoFocus
                        className="w-full text-sm border border-yellow-300 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-yellow-400" />
                      <div className="flex gap-2">
                        <button onClick={() => startTransition(async () => { await updateProjectMemo(project.id, memo); setMemoEditing(false) })}
                          disabled={isPending} className="px-3 py-1.5 bg-yellow-400 text-gray-900 text-xs font-medium rounded-lg hover:bg-yellow-300">저장</button>
                        <button onClick={() => { setMemo(project.memo ?? ''); setMemoEditing(false) }}
                          className="px-3 py-1.5 border border-gray-200 text-gray-500 text-xs rounded-lg hover:bg-gray-50">취소</button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                      {memo || <span className="text-gray-300 cursor-pointer" onClick={() => setMemoEditing(true)}>클릭해서 메모를 입력하세요...</span>}
                    </p>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* ─── 우측 사이드바 ─────────────────────────────── */}
        <div className="w-full md:w-72 flex-shrink-0 md:sticky md:top-[120px] space-y-4">

          {/* 고객 카드 */}
          {localCustomer && !changingCustomer ? (
            <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 bg-green-400 rounded-full" />
                  <h2 className="text-sm font-semibold text-gray-800">고객 카드</h2>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => {
                    setEditingContact(e => !e)
                    setContactName(localCustomer.contact_name ?? '')
                    setContactPhone(localCustomer.phone ?? '')
                    setContactEmail(localCustomer.contact_email ?? '')
                  }} className="text-xs text-gray-400 hover:text-gray-700">{editingContact ? '취소' : '담당자 편집'}</button>
                  <button onClick={() => { setChangingCustomer(true); setAddingNewCustomer(false); setCustomerSearch(''); setSelectedCustomerId('') }}
                    className="text-xs text-gray-400 hover:text-gray-700">기관 변경</button>
                </div>
              </div>
              <div className="px-4 py-3">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center text-sm font-bold text-blue-600 flex-shrink-0">{localCustomer.name[0]}</div>
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{localCustomer.name}</p>
                    <p className="text-xs text-gray-400">{localCustomer.type}</p>
                  </div>
                </div>
                <div className="text-xs mb-3">
                  <div className="flex justify-between">
                    <span className="text-gray-400">이 프로젝트</span>
                    <span className="text-gray-700 font-medium">{localContracts.length}개 계약 · {fmtMoney(totalRevenue)}원</span>
                  </div>
                </div>
                {editingContact ? (
                  <div className="space-y-2 mb-2">
                    <div className="relative">
                      <input value={personSearch}
                        onChange={e => { setPersonSearch(e.target.value); setPersonDropdownOpen(true) }}
                        onFocus={() => setPersonDropdownOpen(true)}
                        placeholder="기존 담당자 검색..."
                        className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-yellow-400" />
                      {personDropdownOpen && personSearch && (
                        <div className="absolute left-0 top-full mt-0.5 bg-white border border-gray-200 rounded-xl shadow-lg z-30 w-full max-h-36 overflow-y-auto py-1">
                          {persons.filter(p => p.name.toLowerCase().includes(personSearch.toLowerCase())).slice(0, 8).map(p => (
                            <button key={p.id} type="button"
                              onClick={() => {
                                setContactName(p.name)
                                setContactPhone(p.phone ?? '')
                                setContactEmail(p.email ?? '')
                                setPersonSearch('')
                                setPersonDropdownOpen(false)
                              }}
                              className="w-full text-left px-3 py-2 hover:bg-gray-50 flex items-center gap-2">
                              <span className="text-xs font-medium text-gray-700">{p.name}</span>
                              {p.phone && <span className="text-xs text-gray-400">{p.phone}</span>}
                            </button>
                          ))}
                          {persons.filter(p => p.name.toLowerCase().includes(personSearch.toLowerCase())).length === 0 && (
                            <p className="px-3 py-2 text-xs text-gray-400">검색 결과 없음</p>
                          )}
                        </div>
                      )}
                    </div>
                    <input value={contactName} onChange={e => setContactName(e.target.value)} placeholder="담당자명"
                      className="w-full text-xs border border-yellow-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-yellow-400" />
                    <input value={contactPhone} onChange={e => setContactPhone(e.target.value)} placeholder="연락처"
                      className="w-full text-xs border border-yellow-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-yellow-400" />
                    <input value={contactEmail} onChange={e => setContactEmail(e.target.value)} placeholder="이메일"
                      className="w-full text-xs border border-yellow-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-yellow-400" />
                    <button onClick={() => startTransition(async () => {
                      await updateCustomerContact(localCustomer.id, project.id, contactName, contactPhone, contactEmail)
                      setLocalCustomer(prev => prev ? { ...prev, contact_name: contactName || null, phone: contactPhone || null, contact_email: contactEmail || null } : null)
                      setEditingContact(false)
                    })} disabled={isPending}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg hover:opacity-80" style={{ backgroundColor: '#FFCE00', color: '#121212' }}>저장</button>
                  </div>
                ) : (
                  <>
                    {(localCustomer.contact_name || localCustomer.phone) ? (
                      <div className="flex items-center justify-between text-xs mb-2">
                        <div className="flex items-center gap-1.5">
                          {localCustomer.contact_name && (
                            <><div className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 text-xs">{localCustomer.contact_name[0]}</div>
                            <span className="text-gray-700">{localCustomer.contact_name}</span></>
                          )}
                        </div>
                        {localCustomer.phone && <span className="text-blue-500">{localCustomer.phone}</span>}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-300 mb-2">담당자 미등록</p>
                    )}
                    {showCustomerDetail && localCustomer.contact_email && <p className="text-xs text-gray-400 mt-1">{localCustomer.contact_email}</p>}
                    {localCustomer.contact_email && (
                      <button onClick={() => setShowCustomerDetail(s => !s)} className="text-xs text-gray-300 hover:text-gray-500 mt-1">
                        {showCustomerDetail ? '이메일 숨기기' : `이메일 보기`}
                      </button>
                    )}
                  </>
                )}
                <a href="/customers" className="mt-2 block text-xs text-blue-500 hover:underline">고객 DB 보기 →</a>
              </div>
            </div>
          ) : (
            <div className="bg-white border border-dashed border-gray-200 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-50">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-700">{changingCustomer ? '기관 변경' : '고객 카드 미연결'}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{changingCustomer ? `현재: ${localCustomer?.name}` : '고객 DB에 연결하면 담당자 정보를 바로 볼 수 있어요.'}</p>
                  </div>
                  {changingCustomer && (
                    <button onClick={() => setChangingCustomer(false)} className="text-xs text-gray-400 hover:text-gray-700">취소</button>
                  )}
                </div>
              </div>
              <div className="px-4 py-3">
                {linkingCustomer || changingCustomer ? (
                  renderCustomerLinkUI(() => { setLinkingCustomer(false); setChangingCustomer(false) })
                ) : (
                  <button onClick={() => setLinkingCustomer(true)}
                    className="w-full py-2 text-xs font-medium text-gray-500 border border-gray-200 rounded-lg hover:border-yellow-400 hover:text-gray-800 transition-colors">
                    + 고객 연결
                  </button>
                )}
              </div>
            </div>
          )}

          {/* 재무 요약 */}
          <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-50">
              <h2 className="text-sm font-semibold text-gray-800">프로젝트 재무 요약</h2>
              <p className="text-xs text-gray-400 mt-0.5">{localContracts.length}개 계약 합산</p>
            </div>
            <div className="px-4 py-3 space-y-3">
              {localContracts.map((c, i) => (
                <div key={c.id}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs text-gray-500 truncate flex-1 mr-2">계약 {i + 1} · {c.name.length > 10 ? c.name.slice(0, 10) + '…' : c.name}</span>
                    <span className="text-xs font-medium text-gray-800 flex-shrink-0">{fmtMoney(c.revenue ?? 0)}</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-300 rounded-full" style={{ width: totalRevenue > 0 ? `${Math.round((c.revenue ?? 0) / totalRevenue * 100)}%` : '0%' }} />
                  </div>
                </div>
              ))}
              {localContracts.length > 0 && (
                <div className="pt-2 border-t border-gray-100 space-y-1.5 text-xs">
                  {[
                    { label: '총 매출', value: fmtMoney(totalRevenue) + '원', cls: 'font-bold text-gray-900' },
                    { label: '수령 완료', value: fmtMoney(totalReceived) + '원', cls: 'font-bold text-green-600' },
                    { label: '미수령', value: fmtMoney(totalRevenue - totalReceived) + '원', cls: 'font-bold text-orange-500' },
                    { label: `총 이익 (${margin}%)`, value: fmtMoney(profit) + '원', cls: `font-bold ${profit >= 0 ? 'text-green-600' : 'text-red-500'}` },
                  ].map(r => (
                    <div key={r.label} className="flex justify-between">
                      <span className="text-gray-500">{r.label}</span>
                      <span className={r.cls}>{r.value}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 기본 정보 */}
          <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-50"><h2 className="text-sm font-semibold text-gray-800">기본 정보</h2></div>
            <div className="px-4 py-3 space-y-2 text-xs">
              {project.service_type && <div className="flex justify-between gap-2"><span className="text-gray-400">서비스</span><span className="text-gray-700">{project.service_type}</span></div>}
              {project.department && <div className="flex justify-between gap-2"><span className="text-gray-400">사업부</span><span className="text-gray-700">{project.department}</span></div>}
              <div className="flex items-start justify-between gap-2">
                <span className="text-gray-400 flex-shrink-0 pt-0.5">Dropbox</span>
                <div className="flex-1 min-w-0 text-right">
                  {editingDropbox ? (
                    <div className="space-y-1.5">
                      <input value={dropboxUrl} onChange={e => setDropboxUrl(e.target.value)} placeholder="Dropbox URL 입력"
                        className="w-full text-xs border border-yellow-300 rounded-lg px-2 py-1.5 focus:outline-none focus:border-yellow-400 text-left" />
                      <div className="flex gap-1 justify-end">
                        <button onClick={() => startTransition(async () => { await updateProjectDropbox(project.id, dropboxUrl); setEditingDropbox(false) })}
                          disabled={isPending} className="px-2 py-1 text-xs font-medium rounded hover:opacity-80" style={{ backgroundColor: '#FFCE00', color: '#121212' }}>저장</button>
                        <button onClick={() => { setEditingDropbox(false); setDropboxUrl(project.dropbox_url ?? '') }}
                          className="px-2 py-1 text-xs border border-gray-200 rounded text-gray-500">취소</button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-end gap-1">
                      <div className="flex items-center gap-1.5">
                        {dropboxUrl ? <a href={dropboxUrl} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">연결됨 ↗</a> : <span className="text-gray-300">미연결</span>}
                        <button onClick={() => setEditingDropbox(true)} className="text-xs text-blue-500 hover:text-blue-700 ml-1 underline">편집</button>
                        {dropboxUrl && (
                          <button
                            onClick={async () => {
                              setSyncing(true); setSyncResult(null)
                              const result = await syncProjectName(project.id)
                              setSyncResult(result); setSyncing(false)
                              if (result.success) startTransition(() => router.refresh())
                            }}
                            disabled={syncing}
                            className="text-xs text-blue-500 hover:text-blue-700 underline disabled:opacity-50"
                            title="프로젝트명과 Dropbox 폴더명을 맞춥니다"
                          >{syncing ? '동기화중...' : '🔄 동기화'}</button>
                        )}
                      </div>
                      {syncResult && (
                        <p className={`text-[10px] ${syncResult.success ? 'text-green-600' : 'text-red-500'}`}>
                          {syncResult.message}
                        </p>
                      )}
                      {!dropboxUrl && localContracts.some(c => c.dropbox_url) && (
                        <button
                          onClick={() => startTransition(async () => {
                            const contractUrl = localContracts.find(c => c.dropbox_url)?.dropbox_url ?? ''
                            await updateProjectDropbox(project.id, contractUrl)
                            setDropboxUrl(contractUrl)
                          })}
                          disabled={isPending}
                          className="text-[10px] text-blue-400 hover:text-blue-600 underline">
                          계약 Dropbox 가져오기
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
