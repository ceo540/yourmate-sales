'use client'
import { useState, useTransition } from 'react'
import { createTask, updateTaskStatus, deleteTask, applyTaskTemplate } from '../tasks/actions'
import { SERVICE_TASK_TEMPLATES } from '@/lib/task-templates'

const STATUSES = ['할 일', '진행중', '검토중', '완료', '보류'] as const
const PRIORITIES = ['낮음', '보통', '높음'] as const

const STATUS_STYLE: Record<string, string> = {
  '할 일':  'bg-gray-100 text-gray-600',
  '진행중': 'bg-blue-100 text-blue-700',
  '검토중': 'bg-yellow-100 text-yellow-700',
  '완료':   'bg-green-100 text-green-700',
  '보류':   'bg-red-100 text-red-600',
}

const PRIORITY_STYLE: Record<string, string> = {
  '낮음': 'text-gray-400',
  '보통': 'text-yellow-500',
  '높음': 'text-red-500',
}

interface Profile { id: string; name: string }
interface Task {
  id: string
  sale_id: string
  title: string
  status: string
  priority: string
  assignee_id: string | null
  due_date: string | null
  memo: string | null
  assignee?: { name: string } | null
}

interface Props {
  saleId: string
  serviceType?: string | null
  tasks: Task[]
  profiles: Profile[]
  currentUserId: string
  isAdmin: boolean
}

export default function TasksSection({ saleId, serviceType, tasks, profiles, currentUserId, isAdmin }: Props) {
  const [showForm, setShowForm] = useState(false)
  const [isPending, startTransition] = useTransition()
  const hasTemplate = serviceType ? !!SERVICE_TASK_TEMPLATES[serviceType] : false

  function handleApplyTemplate() {
    if (!serviceType) return
    if (!confirm(`'${serviceType}' 표준 업무 목록을 자동으로 추가할까요?`)) return
    startTransition(() => applyTaskTemplate(saleId, serviceType, currentUserId))
  }

  function handleStatusChange(taskId: string, status: string) {
    startTransition(() => updateTaskStatus(taskId, status, saleId))
  }

  function handleDelete(taskId: string) {
    if (!confirm('업무를 삭제할까요?')) return
    startTransition(() => deleteTask(taskId, saleId))
  }

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-bold text-gray-900">
          업무 <span className="text-gray-400 font-normal text-sm ml-1">{tasks.length}개</span>
        </h2>
        {isAdmin && (
          <div className="flex gap-2">
            {hasTemplate && tasks.length === 0 && (
              <button
                onClick={handleApplyTemplate}
                disabled={isPending}
                className="text-sm px-3 py-1.5 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 transition-colors disabled:opacity-50"
              >
                ✦ 템플릿 적용
              </button>
            )}
            <button
              onClick={() => setShowForm(v => !v)}
              className="text-sm px-3 py-1.5 bg-yellow-400 text-yellow-900 rounded-lg font-medium hover:bg-yellow-500 transition-colors"
            >
              + 업무 추가
            </button>
          </div>
        )}
      </div>

      {/* 업무 추가 폼 */}
      {isAdmin && showForm && (
        <form
          action={async (fd) => {
            await createTask(fd)
            setShowForm(false)
          }}
          className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-4 space-y-3"
        >
          <input type="hidden" name="sale_id" value={saleId} />
          <input type="hidden" name="created_by" value={currentUserId} />

          <input
            name="title"
            required
            placeholder="업무명 *"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-yellow-400"
          />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">담당자</label>
              <select name="assignee_id" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:border-yellow-400">
                <option value="">선택 안함</option>
                {profiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">마감일</label>
              <input type="date" name="due_date" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-yellow-400" style={{ appearance: 'auto' } as React.CSSProperties} />
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">중요도</label>
            <div className="flex gap-2">
              {PRIORITIES.map(p => (
                <label key={p} className="cursor-pointer">
                  <input type="radio" name="priority" value={p} defaultChecked={p === '보통'} className="sr-only peer" />
                  <span className={`px-3 py-1 rounded-full text-xs border border-gray-200 peer-checked:border-yellow-400 peer-checked:bg-yellow-50 peer-checked:font-medium cursor-pointer block ${PRIORITY_STYLE[p]}`}>{p}</span>
                </label>
              ))}
            </div>
          </div>

          <input name="memo" placeholder="메모 (선택)" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-yellow-400" />

          <div className="flex gap-2">
            <button type="submit" className="px-4 py-2 bg-yellow-400 text-yellow-900 rounded-lg text-sm font-medium hover:bg-yellow-500">추가</button>
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm hover:bg-gray-200">취소</button>
          </div>
        </form>
      )}

      {/* 업무 목록 */}
      {tasks.length === 0 ? (
        <div className="text-center py-8 text-gray-400 text-sm bg-gray-50 rounded-xl border border-gray-100">
          {hasTemplate && isAdmin
            ? <span>등록된 업무가 없어요. <button onClick={handleApplyTemplate} disabled={isPending} className="text-blue-500 hover:underline">템플릿 적용</button>으로 시작해보세요.</span>
            : '등록된 업무가 없어요'}
        </div>
      ) : (
        <div className="space-y-2">
          {tasks.map(task => (
            <div key={task.id} className={`bg-white border rounded-xl px-4 py-3 flex items-center gap-3 ${task.status === '완료' ? 'opacity-60' : 'border-gray-200'}`}>
              {/* 상태 뱃지 */}
              <select
                value={task.status}
                onChange={e => handleStatusChange(task.id, e.target.value)}
                disabled={isPending}
                className={`text-xs px-2 py-1 rounded-full font-medium border-0 cursor-pointer focus:outline-none ${STATUS_STYLE[task.status] ?? 'bg-gray-100 text-gray-600'}`}
              >
                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>

              {/* 업무명 */}
              <span className={`flex-1 text-sm ${task.status === '완료' ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                {task.title}
              </span>

              {/* 중요도 */}
              <span className={`text-xs font-medium ${PRIORITY_STYLE[task.priority] ?? ''}`}>{task.priority}</span>

              {/* 담당자 */}
              {task.assignee && (
                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{(task.assignee as any).name}</span>
              )}

              {/* 마감일 */}
              {task.due_date && (
                <span className="text-xs text-gray-400">{task.due_date}</span>
              )}

              {/* 삭제 */}
              {isAdmin && (
                <button onClick={() => handleDelete(task.id)} className="text-gray-300 hover:text-red-400 text-lg leading-none ml-1">×</button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
