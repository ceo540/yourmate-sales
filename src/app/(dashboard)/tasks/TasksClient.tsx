'use client'
import { useState, useTransition } from 'react'
import { createTask, updateTaskStatus, deleteTask, updateTask } from '../sales/tasks/actions'
import { createProfileMap } from '@/lib/utils'
import { TASK_STATUS_STYLE as STATUS_STYLE, PRIORITY_DOT, PRIORITY_TEXT as PRIORITY_STYLE } from '@/lib/constants'
import { askCompletionNote } from '@/lib/task-completion-prompt'

const STATUSES = ['할 일', '진행중', '검토중', '완료', '보류'] as const
const PRIORITIES = ['낮음', '보통', '높음'] as const

interface Profile { id: string; name: string }
interface Sale { id: string; name: string; department?: string | null }
interface Task {
  id: string
  project_id: string | null
  title: string
  status: string
  priority: string
  assignee_id: string | null
  due_date: string | null
  description: string | null
  assignee: { id: string; name: string } | null
  sale: { id: string; name: string; department?: string | null } | null
}

interface Props {
  tasks: Task[]
  profiles: Profile[]
  sales: Sale[]
  isAdmin: boolean
  currentUserId: string
  alert?: 'missing_assignee' | 'missing_due' | 'overdue_3plus' | null
}

function formatDate(d: string | null) {
  if (!d) return null
  const date = new Date(d)
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const diff = Math.ceil((date.getTime() - today.getTime()) / 86400000)
  const str = `${date.getMonth() + 1}/${date.getDate()}`
  if (diff < 0) return { str, color: 'text-red-500 font-semibold', badge: `${Math.abs(diff)}일 초과`, overdue: true }
  if (diff === 0) return { str, color: 'text-orange-500 font-semibold', badge: '오늘', overdue: false }
  if (diff <= 3) return { str, color: 'text-yellow-600', badge: `D-${diff}`, overdue: false }
  return { str, color: 'text-gray-400', badge: `D-${diff}`, overdue: false }
}

export default function TasksClient({ tasks: initialTasks, profiles, sales, isAdmin, currentUserId, alert = null }: Props) {
  const [tasks, setTasks] = useState(initialTasks)
  // alert 진입 시 active 필터 자동 (Flow UX)
  const [filterStatus, setFilterStatus] = useState<string>('active')
  const [viewMode, setViewMode] = useState<'project' | 'list'>('project')
  const [myTasksOnly, setMyTasksOnly] = useState(false)
  const [filterAssignee, setFilterAssignee] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  let filtered = tasks
  if (myTasksOnly) filtered = filtered.filter(t => t.assignee_id === currentUserId)
  if (filterAssignee) filtered = filtered.filter(t => t.assignee_id === filterAssignee)
  if (filterStatus === 'active') filtered = filtered.filter(t => t.status !== '완료' && t.status !== '보류')
  else if (filterStatus !== 'all') filtered = filtered.filter(t => t.status === filterStatus)
  // alert 자동 필터 (Flow UX 1차)
  if (alert) {
    filtered = filtered.filter(t => t.status !== '완료' && t.status !== '보류')
    if (alert === 'missing_assignee') {
      filtered = filtered.filter(t => !t.assignee_id)
    } else if (alert === 'missing_due') {
      filtered = filtered.filter(t => !t.due_date)
    } else if (alert === 'overdue_3plus') {
      const cutoff = new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10)
      filtered = filtered.filter(t => t.due_date && t.due_date < cutoff)
    }
  }

  const counts: Record<string, number> = {
    active: tasks.filter(t => t.status !== '완료' && t.status !== '보류').length,
    mine: tasks.filter(t => t.assignee_id === currentUserId && t.status !== '완료' && t.status !== '보류').length,
    all: tasks.length,
    ...Object.fromEntries(STATUSES.map(s => [s, tasks.filter(t => t.status === s).length])),
  }

  function handleStatusChange(taskId: string, saleId: string | null, status: string) {
    let completedNote: string | null = null
    // (Phase 9.2) 완료로 *처음* 변경되는 순간만 prompt
    const target = tasks.find(t => t.id === taskId)
    if (status === '완료' && target?.status !== '완료') {
      const r = askCompletionNote(target?.title ?? '업무')
      if (r.cancelled) return
      completedNote = r.note
    }
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status } : t))
    startTransition(() => updateTaskStatus(taskId, status, saleId, { completedNote, completedBy: currentUserId }))
  }

  function handleDelete(taskId: string, saleId: string | null) {
    if (!confirm('업무를 삭제할까요?')) return
    setTasks(prev => prev.filter(t => t.id !== taskId))
    startTransition(() => deleteTask(taskId, saleId))
  }

  // 프로젝트별 그룹화
  const grouped = filtered.reduce((acc, t) => {
    const key = t.project_id ?? '__internal__'
    if (!acc[key]) acc[key] = { sale: t.sale, tasks: [] }
    acc[key].tasks.push(t)
    return acc
  }, {} as Record<string, { sale: Sale | null; tasks: Task[] }>)

  const sortedGroups = Object.entries(grouped).sort((a, b) => {
    const na = a[1].sale?.name ?? ''
    const nb = b[1].sale?.name ?? ''
    return na.localeCompare(nb)
  })

  return (
    <div>
      {/* 상단 컨트롤 */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          {/* 내 업무 토글 */}
          <button
            onClick={() => { setMyTasksOnly(v => !v); setFilterAssignee('') }}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors border ${
              myTasksOnly ? 'bg-gray-900 text-white border-gray-900' : 'bg-white border-gray-100 text-gray-500 hover:border-gray-300'
            }`}
          >
            내 업무 <span className="ml-0.5 text-xs opacity-70">{counts.mine}</span>
          </button>

          {/* 상태 필터 */}
          {[
            { key: 'active', label: '진행 중' },
            { key: 'all',    label: '전체' },
            ...STATUSES.map(s => ({ key: s, label: s })),
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilterStatus(key)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                filterStatus === key
                  ? key === 'active' || key === 'all'
                    ? 'bg-gray-900 text-white'
                    : `${STATUS_STYLE[key]} ring-2 ring-offset-1 ring-current`
                  : key === 'active' || key === 'all'
                    ? 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    : `${STATUS_STYLE[key]} opacity-50 hover:opacity-100`
              }`}
            >
              {label} <span className="ml-0.5 text-xs opacity-70">{counts[key] ?? 0}</span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {/* 담당자 필터 */}
          {isAdmin && (
            <select
              value={filterAssignee}
              onChange={e => { setFilterAssignee(e.target.value); setMyTasksOnly(false) }}
              className="text-xs border border-gray-100 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:border-yellow-400"
            >
              <option value="">전체 담당자</option>
              {profiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          )}

          {/* 뷰 전환 */}
          <div className="flex rounded-lg border border-gray-100 overflow-hidden">
            <button
              onClick={() => setViewMode('project')}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${viewMode === 'project' ? 'bg-gray-900 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
            >
              프로젝트별
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${viewMode === 'list' ? 'bg-gray-900 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
            >
              목록
            </button>
          </div>

          {isAdmin && (
            <button
              onClick={() => setShowAddForm(v => !v)}
              className="px-4 py-1.5 bg-yellow-400 text-yellow-900 rounded-lg text-sm font-semibold hover:bg-yellow-500 transition-colors"
            >
              + 업무 추가
            </button>
          )}
        </div>
      </div>

      {/* 업무 추가 폼 */}
      {isAdmin && showAddForm && (
        <AddTaskForm
          profiles={profiles}
          sales={sales}
          currentUserId={currentUserId}
          onCreated={(newTask) => {
            setTasks(prev => [newTask, ...prev])
            setShowAddForm(false)
          }}
          onCancel={() => setShowAddForm(false)}
        />
      )}

      {/* 빈 상태 */}
      {filtered.length === 0 && (
        <div className="text-center py-16 text-gray-400 text-sm bg-white rounded-xl border border-gray-100">
          {myTasksOnly ? '내 진행 중 업무가 없어요' : filterStatus === 'active' ? '진행 중인 업무가 없어요' : `"${filterStatus}" 상태의 업무가 없어요`}
        </div>
      )}

      {/* 프로젝트별 뷰 */}
      {viewMode === 'project' && filtered.length > 0 && (
        <div className="space-y-4">
          {sortedGroups.map(([saleId, { sale, tasks: groupTasks }]) => (
            <ProjectGroup
              key={saleId}
              saleId={saleId}
              sale={sale}
              tasks={groupTasks}
              profiles={profiles}
              isAdmin={isAdmin}
              currentUserId={currentUserId}
              editingId={editingId}
              isPending={isPending}
              onStatusChange={handleStatusChange}
              onDelete={handleDelete}
              onEditStart={setEditingId}
              onEditDone={() => setEditingId(null)}
              onTaskUpdated={(updated) => setTasks(prev => prev.map(t => t.id === updated.id ? updated : t))}
            />
          ))}
        </div>
      )}

      {/* 목록 뷰 */}
      {viewMode === 'list' && filtered.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 overflow-x-auto">
          <table className="w-full min-w-[600px]">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3">업무</th>
                <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3">프로젝트</th>
                {isAdmin && <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3">담당자</th>}
                <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3">중요도</th>
                <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3">마감일</th>
                <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3">상태</th>
                <th className="w-20" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(task => {
                const dateInfo = formatDate(task.due_date)
                const rowBg = dateInfo?.overdue ? 'bg-red-50/40' : ''
                // 인라인 편집 행 (Phase 9.2 + F2)
                if (editingId === task.id) {
                  const cols = isAdmin ? 7 : 6
                  return (
                    <tr key={task.id}>
                      <td colSpan={cols} className="p-0">
                        <EditTaskRow
                          task={task}
                          profiles={profiles}
                          currentUserId={currentUserId}
                          onSave={(updated) => { setTasks(prev => prev.map(t => t.id === updated.id ? updated : t)); setEditingId(null) }}
                          onCancel={() => setEditingId(null)}
                        />
                      </td>
                    </tr>
                  )
                }
                return (
                  <tr key={task.id} className={`hover:bg-gray-50 transition-colors ${task.status === '완료' ? 'opacity-50' : ''} ${rowBg}`}>
                    <td className="px-4 py-3">
                      <span className={`text-sm ${task.status === '완료' ? 'line-through text-gray-400' : 'text-gray-800 font-medium'}`}>
                        {task.title}
                      </span>
                      {task.description && <p className="text-xs text-gray-400 mt-0.5 truncate max-w-[200px]">{task.description}</p>}
                    </td>
                    <td className="px-4 py-3">
                      {task.sale ? (
                        <a
                          href={task.sale.department ? `/departments/${task.sale.department}/${task.project_id}` : `/sales/${task.project_id}`}
                          className="text-xs text-blue-600 hover:underline truncate max-w-[150px] block"
                        >
                          {task.sale.name}
                        </a>
                      ) : <span className="text-xs text-gray-300">-</span>}
                    </td>
                    {isAdmin && (
                      <td className="px-4 py-3">
                        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{task.assignee?.name ?? '-'}</span>
                      </td>
                    )}
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium ${PRIORITY_STYLE[task.priority] ?? ''}`}>{task.priority}</span>
                    </td>
                    <td className="px-4 py-3">
                      {dateInfo
                        ? <span className={`text-xs ${dateInfo.color}`}>{dateInfo.str} <span className="opacity-70">({dateInfo.badge})</span></span>
                        : <span className="text-xs text-gray-300">-</span>}
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={task.status}
                        onChange={e => handleStatusChange(task.id, task.project_id, e.target.value)}
                        disabled={isPending}
                        className={`text-xs px-2 py-1 rounded-full font-medium border-0 cursor-pointer focus:outline-none ${STATUS_STYLE[task.status] ?? 'bg-gray-100 text-gray-600'}`}
                      >
                        {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <button onClick={() => setEditingId(task.id)} className="text-blue-600 hover:text-blue-800 text-xs px-2 py-1 rounded border border-blue-200 bg-blue-50 hover:bg-blue-100 font-medium transition-colors">수정</button>
                        {isAdmin && (
                          <button onClick={() => handleDelete(task.id, task.project_id)} className="text-gray-300 hover:text-red-400 text-lg leading-none ml-0.5">×</button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── 프로젝트 그룹 ─────────────────────────────────────────────────────────────
interface ProjectGroupProps {
  saleId: string
  sale: Sale | null
  tasks: Task[]
  profiles: Profile[]
  isAdmin: boolean
  currentUserId: string
  editingId: string | null
  isPending: boolean
  onStatusChange: (taskId: string, saleId: string | null, status: string) => void
  onDelete: (taskId: string, saleId: string | null) => void
  onEditStart: (id: string) => void
  onEditDone: () => void
  onTaskUpdated: (task: Task) => void
}

function ProjectGroup({ saleId, sale, tasks, profiles, isAdmin, currentUserId, editingId, isPending, onStatusChange, onDelete, onEditStart, onEditDone, onTaskUpdated }: ProjectGroupProps) {
  const [collapsed, setCollapsed] = useState(false)
  const doneCount = tasks.filter(t => t.status === '완료').length
  const overdueCount = tasks.filter(t => {
    if (t.status === '완료' || t.status === '보류' || !t.due_date) return false
    return new Date(t.due_date) < new Date(new Date().setHours(0,0,0,0))
  }).length

  // 프로젝트 링크: dept 있으면 /departments/[dept]/[id], 없으면 /sales/[id]
  const projectHref = sale?.department
    ? `/departments/${sale.department}/${saleId}`
    : `/sales/${saleId}`

  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      {/* 그룹 헤더 */}
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors border-b border-gray-100"
        onClick={() => setCollapsed(v => !v)}
      >
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400 transition-transform" style={{ display: 'inline-block', transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}>▼</span>
          {saleId !== '__internal__' ? (
            <a
              href={projectHref}
              onClick={e => e.stopPropagation()}
              className="text-sm font-semibold text-gray-900 hover:text-blue-600 hover:underline"
            >
              {sale?.name ?? '(프로젝트 없음)'}
            </a>
          ) : (
            <span className="text-sm font-semibold text-gray-900">내부 업무</span>
          )}
          <span className="text-xs text-gray-400">{tasks.length}개</span>
          {overdueCount > 0 && (
            <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-red-50 text-red-500 font-semibold">
              지연 {overdueCount}
            </span>
          )}
        </div>
        {doneCount > 0 && (
          <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full">{doneCount}개 완료</span>
        )}
      </div>

      {/* 업무 목록 */}
      {!collapsed && (
        <div className="divide-y divide-gray-50">
          {tasks.map(task =>
            editingId === task.id ? (
              <EditTaskRow
                key={task.id}
                task={task}
                profiles={profiles}
                currentUserId={currentUserId}
                onSave={(updated) => { onTaskUpdated(updated); onEditDone() }}
                onCancel={onEditDone}
              />
            ) : (
              <TaskRow
                key={task.id}
                task={task}
                isAdmin={isAdmin}
                isPending={isPending}
                onStatusChange={onStatusChange}
                onDelete={onDelete}
                onEdit={() => onEditStart(task.id)}
              />
            )
          )}
        </div>
      )}
    </div>
  )
}

// ─── 업무 행 ──────────────────────────────────────────────────────────────────
interface TaskRowProps {
  task: Task
  isAdmin: boolean
  isPending: boolean
  onStatusChange: (taskId: string, saleId: string | null, status: string) => void
  onDelete: (taskId: string, saleId: string | null) => void
  onEdit: () => void
}

function TaskRow({ task, isAdmin, isPending, onStatusChange, onDelete, onEdit }: TaskRowProps) {
  const dateInfo = formatDate(task.due_date)
  const isOverdue = dateInfo?.overdue ?? false
  const isUrgent = task.priority === '긴급' || task.priority === '높음'
  const rowBg = isOverdue ? 'bg-red-50/40' : (isUrgent && task.status !== '완료' ? 'bg-orange-50/20' : '')

  return (
    <div className={`flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors ${task.status === '완료' ? 'opacity-50' : ''} ${rowBg}`}>
      <select
        value={task.status}
        onChange={e => onStatusChange(task.id, task.project_id, e.target.value)}
        disabled={isPending}
        onClick={e => e.stopPropagation()}
        className={`text-xs px-2 py-1 rounded-full font-medium border-0 cursor-pointer focus:outline-none flex-shrink-0 ${STATUS_STYLE[task.status] ?? 'bg-gray-100 text-gray-600'}`}
      >
        {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
      </select>

      <span className={`flex-1 text-sm min-w-0 ${task.status === '완료' ? 'line-through text-gray-400' : 'text-gray-800'}`}>
        {isOverdue && <span className="text-red-500 text-xs font-bold mr-1">지연</span>}
        {task.title}
      </span>

      {/* 우선순위 점 */}
      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${PRIORITY_DOT[task.priority] ?? 'bg-gray-200'}`} title={task.priority} />

      {task.assignee && (
        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full flex-shrink-0">{task.assignee.name}</span>
      )}

      {dateInfo ? (
        <span className={`text-xs flex-shrink-0 ${dateInfo.color}`}>{dateInfo.str} <span className="opacity-70">({dateInfo.badge})</span></span>
      ) : (
        <span className="text-xs text-gray-300 flex-shrink-0">마감 없음</span>
      )}

      {/* 수정은 모든 사용자 (member도 본인 담당 task 한정으로 보이므로 안전). 삭제는 admin/manager만. */}
      <div className="flex items-center gap-1 flex-shrink-0">
        <button onClick={onEdit} className="text-blue-600 hover:text-blue-800 text-xs px-2 py-1 rounded border border-blue-200 bg-blue-50 hover:bg-blue-100 font-medium transition-colors">수정</button>
        {isAdmin && (
          <button onClick={() => onDelete(task.id, task.project_id)} className="text-gray-300 hover:text-red-400 text-lg leading-none ml-0.5">×</button>
        )}
      </div>
    </div>
  )
}

// ─── 인라인 수정 행 ────────────────────────────────────────────────────────────
function EditTaskRow({ task, profiles, currentUserId, onSave, onCancel }: { task: Task; profiles: Profile[]; currentUserId: string; onSave: (t: Task) => void; onCancel: () => void }) {
  const [title, setTitle] = useState(task.title)
  const [status, setStatus] = useState(task.status)
  const [priority, setPriority] = useState(task.priority)
  const [assigneeId, setAssigneeId] = useState(task.assignee_id ?? '')
  const [dueDate, setDueDate] = useState(task.due_date ?? '')
  const [memo, setMemo] = useState(task.description ?? '')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!title.trim()) return
    // 완료 코멘트 일관화 (Phase 9.2): 처음 '완료'로 바꿀 때만 prompt
    let completedNote: string | null = null
    const becameCompleted = status === '완료' && task.status !== '완료'
    if (becameCompleted) {
      const r = askCompletionNote(title.trim())
      if (r.cancelled) return
      completedNote = r.note
    }
    setSaving(true)
    const fd = new FormData()
    fd.set('id', task.id)
    if (task.project_id) fd.set('project_id', task.project_id)
    fd.set('title', title)
    fd.set('status', status)
    fd.set('priority', priority)
    fd.set('assignee_id', assigneeId)
    fd.set('due_date', dueDate)
    fd.set('description', memo)
    if (becameCompleted) {
      fd.set('completed_note', completedNote ?? '')
      fd.set('completed_by', currentUserId)
    }
    await updateTask(fd)
    onSave({
      ...task,
      title,
      status,
      priority,
      assignee_id: assigneeId || null,
      due_date: dueDate || null,
      description: memo || null,
      assignee: profiles.find(p => p.id === assigneeId) ?? null,
    })
    setSaving(false)
  }

  return (
    <div className="px-4 py-3 bg-blue-50 border-l-2 border-blue-400 space-y-2">
      <input
        value={title}
        onChange={e => setTitle(e.target.value)}
        className="w-full px-3 py-1.5 border border-gray-100 rounded-lg text-sm focus:outline-none focus:border-yellow-400"
        placeholder="업무명"
      />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <select value={status} onChange={e => setStatus(e.target.value)} className="px-2 py-1.5 border border-gray-100 rounded-lg text-xs bg-white focus:outline-none focus:border-yellow-400">
          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={assigneeId} onChange={e => setAssigneeId(e.target.value)} className="px-2 py-1.5 border border-gray-100 rounded-lg text-xs bg-white focus:outline-none focus:border-yellow-400">
          <option value="">담당자 없음</option>
          {profiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="px-2 py-1.5 border border-gray-100 rounded-lg text-xs focus:outline-none focus:border-yellow-400" style={{ appearance: 'auto' } as React.CSSProperties} />
        <select value={priority} onChange={e => setPriority(e.target.value)} className="px-2 py-1.5 border border-gray-100 rounded-lg text-xs bg-white focus:outline-none focus:border-yellow-400">
          {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>
      <input value={memo} onChange={e => setMemo(e.target.value)} placeholder="메모 (선택)" className="w-full px-3 py-1.5 border border-gray-100 rounded-lg text-xs focus:outline-none focus:border-yellow-400" />
      <div className="flex gap-2">
        <button onClick={handleSave} disabled={saving || !title.trim()} className="px-3 py-1.5 bg-yellow-400 text-yellow-900 rounded-lg text-xs font-semibold hover:bg-yellow-500 disabled:opacity-50">
          {saving ? '저장 중...' : '저장'}
        </button>
        <button onClick={onCancel} className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-xs hover:bg-gray-200">취소</button>
      </div>
    </div>
  )
}

// ─── 업무 추가 폼 ──────────────────────────────────────────────────────────────
function AddTaskForm({ profiles, sales, currentUserId, onCreated, onCancel }: {
  profiles: Profile[]
  sales: Sale[]
  currentUserId: string
  onCreated: (task: Task) => void
  onCancel: () => void
}) {
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    if (!fd.get('title')) return
    setSubmitting(true)
    await createTask(fd)
    const profileMap = createProfileMap(profiles)
    const saleMap = Object.fromEntries(sales.map(s => [s.id, s]))
    const assigneeId = fd.get('assignee_id') as string
    const saleId = (fd.get('project_id') as string) || null
    onCreated({
      id: crypto.randomUUID(),
      project_id: saleId,
      title: fd.get('title') as string,
      status: '할 일',
      priority: (fd.get('priority') as string) || '보통',
      assignee_id: assigneeId || null,
      due_date: (fd.get('due_date') as string) || null,
      description: (fd.get('memo') as string) || null,
      assignee: assigneeId ? (profileMap[assigneeId] ?? null) : null,
      sale: saleId ? (saleMap[saleId] ?? null) : null,
    })
    setSubmitting(false)
  }

  return (
    <form onSubmit={handleSubmit} className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-4 space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1">프로젝트 (매출 건)</label>
          <select name="project_id" className="w-full px-3 py-2 border border-gray-100 rounded-lg text-sm bg-white focus:outline-none focus:border-yellow-400">
            <option value="">없음 (내부 업무)</option>
            {sales.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">업무명 *</label>
          <input name="title" required placeholder="업무명" className="w-full px-3 py-2 border border-gray-100 rounded-lg text-sm focus:outline-none focus:border-yellow-400" />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1">담당자</label>
          <select name="assignee_id" className="w-full px-3 py-2 border border-gray-100 rounded-lg text-sm bg-white focus:outline-none focus:border-yellow-400">
            <option value="">선택 안함</option>
            {profiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">마감일</label>
          <input type="date" name="due_date" className="w-full px-3 py-2 border border-gray-100 rounded-lg text-sm focus:outline-none focus:border-yellow-400" style={{ appearance: 'auto' } as React.CSSProperties} />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">중요도</label>
          <select name="priority" defaultValue="보통" className="w-full px-3 py-2 border border-gray-100 rounded-lg text-sm bg-white focus:outline-none focus:border-yellow-400">
            {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
      </div>
      <input name="memo" placeholder="메모 (선택)" className="w-full px-3 py-2 border border-gray-100 rounded-lg text-sm focus:outline-none focus:border-yellow-400" />
      <div className="flex gap-2">
        <button type="submit" disabled={submitting} className="px-4 py-2 bg-yellow-400 text-yellow-900 rounded-lg text-sm font-semibold hover:bg-yellow-500 disabled:opacity-50">
          {submitting ? '추가 중...' : '추가'}
        </button>
        <button type="button" onClick={onCancel} className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm hover:bg-gray-200">취소</button>
      </div>
    </form>
  )
}
