'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { MeetingRecord, Decision } from '@/types'
import {
  createMeetingAction,
  updateMeetingAction,
  archiveMeetingAction,
  recordDecisionFromMeetingAction,
} from '@/lib/meetings-actions'

const TYPE_OPTIONS: { key: string; label: string }[] = [
  { key: 'weekly', label: '정기' },
  { key: 'irregular', label: '비정기' },
  { key: 'project', label: '프로젝트' },
  { key: 'with_customer', label: '고객' },
  { key: 'with_worker', label: '외부인력' },
]

function typeLabel(t: string | null) {
  return TYPE_OPTIONS.find(o => o.key === t)?.label ?? t ?? '-'
}

function formatDate(iso: string) {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export default function MeetingsClient({
  meetings, decisions, projectMap, profileMap,
}: {
  meetings: MeetingRecord[]
  decisions: Decision[]
  projectMap: Record<string, { name: string; number: string | null }>
  profileMap: Record<string, string>
  currentUserId: string
}) {
  const router = useRouter()
  const [searchQ, setSearchQ] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [showAddForm, setShowAddForm] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [decisionForm, setDecisionForm] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const filtered = useMemo(() => {
    return meetings.filter(m => {
      if (typeFilter !== 'all' && m.type !== typeFilter) return false
      if (searchQ) {
        const q = searchQ.toLowerCase()
        const hay = [m.title, m.agenda, m.notes, m.minutes, m.location].filter(Boolean).join(' ').toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [meetings, searchQ, typeFilter])

  const decisionsByMeeting = useMemo(() => {
    const map: Record<string, Decision[]> = {}
    for (const m of meetings) {
      const ids = m.decision_ids ?? []
      const list = decisions.filter(d => ids.includes(d.id))
      if (list.length) map[m.id] = list
    }
    return map
  }, [meetings, decisions])

  const handleAdd = (form: HTMLFormElement) => {
    const fd = new FormData(form)
    const title = String(fd.get('title') ?? '').trim()
    const date = String(fd.get('date') ?? '')
    if (!title) return alert('제목 필수')
    if (!date) return alert('일시 필수')
    startTransition(async () => {
      const r = await createMeetingAction({
        title,
        type: String(fd.get('type') ?? 'irregular'),
        project_id: String(fd.get('project_id') ?? '') || null,
        date: new Date(date).toISOString(),
        duration_minutes: fd.get('duration') ? Number(fd.get('duration')) : null,
        location: String(fd.get('location') ?? '') || null,
        agenda: String(fd.get('agenda') ?? '') || null,
        notes: String(fd.get('notes') ?? '') || null,
      })
      if ('error' in r) return alert(`실패: ${r.error}`)
      form.reset()
      setShowAddForm(false)
      router.refresh()
    })
  }

  const handleSaveMinutes = (id: string, minutes: string) => {
    startTransition(async () => {
      const r = await updateMeetingAction({ id, patch: { minutes } })
      if ('error' in r) return alert(r.error)
      router.refresh()
    })
  }

  const handleArchive = (id: string) => {
    if (!confirm('회의를 보류 폴더로 이동할까요? (복원 가능)')) return
    startTransition(async () => {
      const r = await archiveMeetingAction({ id })
      if ('error' in r) return alert(r.error)
      router.refresh()
    })
  }

  const handleRecordDecision = (meetingId: string, form: HTMLFormElement) => {
    const fd = new FormData(form)
    const decision = String(fd.get('decision') ?? '').trim()
    if (!decision) return alert('결정 내용 필수')
    startTransition(async () => {
      const r = await recordDecisionFromMeetingAction({
        meeting_id: meetingId,
        decision,
        context: String(fd.get('context') ?? '') || null,
        rationale: String(fd.get('rationale') ?? '') || null,
      })
      if ('error' in r) return alert(`실패: ${r.error}`)
      form.reset()
      setDecisionForm(null)
      router.refresh()
    })
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">🗒️ 회의</h1>
          <p className="text-sm text-gray-500 mt-1">정기·비정기 회의 + 의사결정 기록 (명세 §5.9)</p>
        </div>
        <button
          onClick={() => setShowAddForm(s => !s)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          disabled={pending}
        >
          {showAddForm ? '닫기' : '+ 회의 등록'}
        </button>
      </header>

      {showAddForm && (
        <form onSubmit={(e) => { e.preventDefault(); handleAdd(e.currentTarget) }} className="mb-6 p-4 bg-gray-50 rounded-lg border space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <input name="title" placeholder="제목 *" className="border rounded px-3 py-2 col-span-2" required />
            <select name="type" className="border rounded px-3 py-2" defaultValue="irregular">
              {TYPE_OPTIONS.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
            </select>
            <input name="date" type="datetime-local" className="border rounded px-3 py-2" required />
            <select name="project_id" className="border rounded px-3 py-2 col-span-2">
              <option value="">프로젝트 선택 (선택)</option>
              {Object.entries(projectMap).map(([id, p]) => (
                <option key={id} value={id}>{p.number ? `[${p.number}] ` : ''}{p.name}</option>
              ))}
            </select>
            <input name="location" placeholder="장소" className="border rounded px-3 py-2" />
            <input name="duration" type="number" placeholder="시간 (분)" className="border rounded px-3 py-2" />
          </div>
          <textarea name="agenda" placeholder="안건" className="w-full border rounded px-3 py-2" rows={2} />
          <textarea name="notes" placeholder="비고" className="w-full border rounded px-3 py-2" rows={2} />
          <div className="flex gap-2">
            <button type="submit" disabled={pending} className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50">저장</button>
            <button type="button" onClick={() => setShowAddForm(false)} className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300">취소</button>
          </div>
        </form>
      )}

      <div className="mb-4 flex gap-2 items-center">
        <input
          type="text" placeholder="검색 (제목·안건·내용)"
          value={searchQ} onChange={(e) => setSearchQ(e.target.value)}
          className="flex-1 border rounded px-3 py-2"
        />
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="border rounded px-3 py-2">
          <option value="all">전체</option>
          {TYPE_OPTIONS.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
        </select>
      </div>

      <div className="space-y-2">
        {filtered.length === 0 && (
          <div className="text-gray-400 text-sm py-8 text-center">회의 기록 없음.</div>
        )}
        {filtered.map(m => {
          const expanded = expandedId === m.id
          const myDecisions = decisionsByMeeting[m.id] ?? []
          return (
            <div key={m.id} className="bg-white border rounded-lg p-4">
              <div
                className="flex items-start justify-between gap-3 cursor-pointer"
                onClick={() => setExpandedId(s => s === m.id ? null : m.id)}
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs px-2 py-0.5 bg-purple-50 text-purple-700 rounded">{typeLabel(m.type)}</span>
                    <span className="font-medium">{m.title}</span>
                    {m.project_id && projectMap[m.project_id] && (
                      <span className="text-xs text-blue-600">{projectMap[m.project_id].name}</span>
                    )}
                    {myDecisions.length > 0 && (
                      <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-800 rounded">결정 {myDecisions.length}</span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {formatDate(m.date)}
                    {m.location && <> · 📍 {m.location}</>}
                    {m.duration_minutes && <> · {m.duration_minutes}분</>}
                  </div>
                  {m.agenda && <div className="text-sm text-gray-600 mt-1">📋 {m.agenda}</div>}
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); handleArchive(m.id) }}
                  className="text-xs text-gray-400 hover:text-red-600"
                >보류</button>
              </div>

              {expanded && (
                <div className="mt-3 pt-3 border-t space-y-3">
                  {m.notes && <div className="text-sm"><span className="text-gray-500">비고:</span> {m.notes}</div>}

                  <details className="text-sm">
                    <summary className="cursor-pointer text-gray-600">📝 회의록 {m.minutes ? '(있음)' : '(없음)'}</summary>
                    <textarea
                      defaultValue={m.minutes ?? ''}
                      onBlur={(e) => {
                        if (e.target.value !== (m.minutes ?? '')) handleSaveMinutes(m.id, e.target.value)
                      }}
                      placeholder="회의록 작성 (포커스 잃으면 자동 저장)"
                      className="w-full mt-2 border rounded px-3 py-2 text-sm"
                      rows={6}
                    />
                  </details>

                  {myDecisions.length > 0 && (
                    <div className="bg-amber-50 rounded p-2 space-y-1 text-sm">
                      {myDecisions.map(d => (
                        <div key={d.id}>
                          <span className="font-medium">⭐ {d.decision}</span>
                          {d.rationale && <span className="text-gray-600"> — {d.rationale}</span>}
                        </div>
                      ))}
                    </div>
                  )}

                  {decisionForm === m.id ? (
                    <form onSubmit={(e) => { e.preventDefault(); handleRecordDecision(m.id, e.currentTarget) }} className="bg-amber-50 rounded p-3 space-y-2">
                      <input name="decision" placeholder="결정 내용 *" className="w-full border rounded px-2 py-1 text-sm" required />
                      <input name="context" placeholder="상황 (선택)" className="w-full border rounded px-2 py-1 text-sm" />
                      <input name="rationale" placeholder="근거 (선택)" className="w-full border rounded px-2 py-1 text-sm" />
                      <div className="flex gap-2">
                        <button type="submit" disabled={pending} className="px-3 py-1 bg-amber-600 text-white rounded text-sm hover:bg-amber-700 disabled:opacity-50">기록</button>
                        <button type="button" onClick={() => setDecisionForm(null)} className="px-3 py-1 bg-gray-200 rounded text-sm">취소</button>
                      </div>
                    </form>
                  ) : (
                    <button onClick={() => setDecisionForm(m.id)} className="text-sm text-amber-700 hover:underline">+ 결정사항 추가</button>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
