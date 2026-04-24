'use client'

import { useState, useTransition, useEffect } from 'react'
import { updateTask } from '../tasks/actions'
import TiptapEditor from './TiptapEditor'
import { TASK_STATUS_STYLE as STATUS_STYLE, PRIORITY_BADGE as PRIORITY_STYLE } from '@/lib/constants'

interface ChecklistItem { id: string; text: string; done: boolean }
interface Profile { id: string; name: string }

interface Task {
  id: string
  title: string
  status: string
  priority: string | null
  due_date: string | null
  description: string | null
  checklist: ChecklistItem[] | null
  assignee: { id: string; name: string } | null
  project_id: string | null
}

interface Props {
  task: Task
  profiles: Profile[]
  onClose: () => void
  onSaved?: () => void
}

const STATUSES = ['할 일', '진행중', '검토중', '완료', '보류']
const PRIORITIES = ['낮음', '보통', '높음', '긴급']

export default function TaskDetailPanel({ task, profiles, onClose, onSaved }: Props) {
  const [title, setTitle] = useState(task.title)
  const [status, setStatus] = useState(task.status)
  const [priority, setPriority] = useState(task.priority ?? '보통')
  const [assigneeId, setAssigneeId] = useState(task.assignee?.id ?? '')
  const [dueDate, setDueDate] = useState(task.due_date ?? '')
  const [description, setDescription] = useState(task.description ?? '')
  const [checklist, setChecklist] = useState<ChecklistItem[]>(task.checklist ?? [])
  const [newCheckItem, setNewCheckItem] = useState('')
  const [saved, setSaved] = useState(false)
  const [isPending, startTransition] = useTransition()

  // 닫기 단축키
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  function addCheckItem() {
    if (!newCheckItem.trim()) return
    setChecklist(prev => [...prev, { id: Date.now().toString(), text: newCheckItem.trim(), done: false }])
    setNewCheckItem('')
  }

  function toggleCheckItem(id: string) {
    setChecklist(prev => prev.map(c => c.id === id ? { ...c, done: !c.done } : c))
  }

  function removeCheckItem(id: string) {
    setChecklist(prev => prev.filter(c => c.id !== id))
  }

  function handleSave() {
    const fd = new FormData()
    fd.set('id', task.id)
    fd.set('title', title)
    fd.set('status', status)
    fd.set('priority', priority)
    fd.set('assignee_id', assigneeId)
    fd.set('due_date', dueDate)
    fd.set('description', description)
    fd.set('checklist', JSON.stringify(checklist))
    if (task.project_id) fd.set('project_id', task.project_id)

    startTransition(async () => {
      await updateTask(fd)
      setSaved(true)
      setTimeout(() => { setSaved(false); onSaved?.() }, 1200)
    })
  }

  const checkDone = checklist.filter(c => c.done).length

  return (
    <>
      {/* 배경 오버레이 */}
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />

      {/* 패널 (우측 슬라이드인 or 모바일 풀스크린) */}
      <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-[480px] bg-white shadow-2xl flex flex-col overflow-hidden">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLE[status]}`}>{status}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PRIORITY_STYLE[priority]}`}>{priority}</span>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none px-1">×</button>
        </div>

        {/* 본문 스크롤 */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* 제목 */}
          <textarea
            value={title}
            onChange={e => setTitle(e.target.value)}
            rows={2}
            className="w-full text-xl font-bold text-gray-900 resize-none border-none outline-none focus:ring-0 leading-snug"
            placeholder="업무명"
          />

          {/* 속성 그리드 */}
          <div className="grid grid-cols-2 gap-3 bg-gray-50 rounded-xl p-4">
            <div>
              <p className="text-[11px] font-semibold text-gray-400 uppercase mb-1">상태</p>
              <select value={status} onChange={e => setStatus(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:border-yellow-400">
                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <p className="text-[11px] font-semibold text-gray-400 uppercase mb-1">중요도</p>
              <select value={priority} onChange={e => setPriority(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:border-yellow-400">
                {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <p className="text-[11px] font-semibold text-gray-400 uppercase mb-1">담당자</p>
              <select value={assigneeId} onChange={e => setAssigneeId(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:border-yellow-400">
                <option value="">미지정</option>
                {profiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <p className="text-[11px] font-semibold text-gray-400 uppercase mb-1">마감일</p>
              <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:border-yellow-400"
                style={{ appearance: 'auto' } as React.CSSProperties} />
            </div>
          </div>

          {/* 업무 내용 */}
          <div>
            <p className="text-xs font-semibold text-gray-500 mb-2">업무 내용</p>
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <TiptapEditor
                content={description || '<p></p>'}
                onChange={setDescription}
                placeholder="업무 배경, 요구사항, 참고사항 등 자유롭게 기록하세요"
                minimal={true}
              />
            </div>
          </div>

          {/* 체크리스트 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-gray-500">체크리스트</p>
              {checklist.length > 0 && (
                <span className="text-xs text-gray-400">{checkDone}/{checklist.length} 완료</span>
              )}
            </div>

            {/* 진행 바 */}
            {checklist.length > 0 && (
              <div className="w-full h-1.5 bg-gray-100 rounded-full mb-3 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${(checkDone / checklist.length) * 100}%`, backgroundColor: '#FFCE00' }}
                />
              </div>
            )}

            <div className="space-y-1.5">
              {checklist.map(item => (
                <div key={item.id} className="flex items-start gap-2.5 group">
                  <button
                    onClick={() => toggleCheckItem(item.id)}
                    className={`mt-0.5 w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center transition-all ${
                      item.done ? 'bg-green-400 border-green-400' : 'border-gray-300 hover:border-green-400'
                    }`}
                  >
                    {item.done && <span className="text-[10px] text-white font-bold">✓</span>}
                  </button>
                  <span className={`flex-1 text-sm leading-snug ${item.done ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                    {item.text}
                  </span>
                  <button
                    onClick={() => removeCheckItem(item.id)}
                    className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 text-xs transition-all"
                  >✕</button>
                </div>
              ))}
            </div>

            {/* 항목 추가 */}
            <div className="flex gap-2 mt-2">
              <input
                value={newCheckItem}
                onChange={e => setNewCheckItem(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addCheckItem()}
                placeholder="+ 항목 추가"
                className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-yellow-400"
              />
              {newCheckItem && (
                <button onClick={addCheckItem}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg"
                  style={{ backgroundColor: '#FFCE00', color: '#121212' }}>추가</button>
              )}
            </div>
          </div>
        </div>

        {/* 저장 버튼 */}
        <div className="px-5 py-4 border-t border-gray-100">
          <button
            onClick={handleSave}
            disabled={isPending}
            className="w-full py-2.5 text-sm font-semibold rounded-xl hover:opacity-80 disabled:opacity-50 transition-all"
            style={{ backgroundColor: '#FFCE00', color: '#121212' }}
          >
            {saved ? '✓ 저장됨' : isPending ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    </>
  )
}
