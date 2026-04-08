'use client'

import { useState, useTransition } from 'react'
import { createConcert, updateConcert, updateConcertStatus, deleteConcert } from './actions'

// ─── 타입 ─────────────────────────────────────────────────────────
interface Concert {
  id: string
  year: number
  concert_date: string | null
  school: string | null
  concept: string | null
  artists: string | null
  notes: string | null
  status: string
  created_at: string
}

// ─── 상태 ─────────────────────────────────────────────────────────
const STATUSES = ['예정', '완료', '취소'] as const
type ConcertStatus = typeof STATUSES[number]

const STATUS_BADGE: Record<string, string> = {
  예정: 'bg-yellow-100 text-yellow-700',
  완료: 'bg-green-100 text-green-700',
  취소: 'bg-red-100 text-red-400',
}

// ─── 빈 폼 ────────────────────────────────────────────────────────
const EMPTY_FORM = { year: new Date().getFullYear(), concert_date: '', school: '', concept: '', artists: '', notes: '', status: '예정' }

// ─── 폼 모달 ──────────────────────────────────────────────────────
function ConcertModal({
  concert, onClose, defaultYear,
}: {
  concert?: Concert
  onClose: () => void
  defaultYear: number
}) {
  const [pending, startTransition] = useTransition()
  const isEdit = !!concert

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      if (isEdit) await updateConcert(concert.id, fd)
      else await createConcert(fd)
      onClose()
    })
  }

  const inputCls = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400'
  const labelCls = 'block text-xs font-medium text-gray-500 mb-1'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="font-bold text-gray-800">{isEdit ? '공연 수정' : '새 공연 추가'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>연도</label>
              <select name="year" defaultValue={concert?.year ?? defaultYear} className={inputCls}>
                <option value={2025}>2025</option>
                <option value={2026}>2026</option>
                <option value={2027}>2027</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>상태</label>
              <select name="status" defaultValue={concert?.status ?? '예정'} className={inputCls}>
                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className={labelCls}>날짜</label>
            <input name="concert_date" type="text" defaultValue={concert?.concert_date ?? ''} placeholder="예: 7월 3일(목)" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>학교</label>
            <input name="school" type="text" defaultValue={concert?.school ?? ''} placeholder="학교명" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>컨셉</label>
            <input name="concept" type="text" defaultValue={concert?.concept ?? ''} placeholder="예: 사연기반" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>아티스트</label>
            <input name="artists" type="text" defaultValue={concert?.artists ?? ''} placeholder="출연 아티스트 (쉼표 구분)" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>비고</label>
            <input name="notes" type="text" defaultValue={concert?.notes ?? ''} placeholder="비고 사항" className={inputCls} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-gray-200 hover:bg-gray-50">취소</button>
            <button type="submit" disabled={pending} className="px-5 py-2 text-sm rounded-lg bg-yellow-400 font-semibold hover:bg-yellow-500 disabled:opacity-60">
              {pending ? '저장 중...' : isEdit ? '수정' : '추가'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── 메인 ─────────────────────────────────────────────────────────
export default function SosClient({ concerts, isAdmin }: { concerts: Concert[], isAdmin: boolean }) {
  const currentYear = new Date().getFullYear()
  const years = Array.from(new Set(concerts.map(c => c.year))).sort((a, b) => b - a)
  if (!years.includes(currentYear)) years.unshift(currentYear)

  const [selectedYear, setSelectedYear] = useState(currentYear)
  const [statusFilter, setStatusFilter] = useState<string>('전체')
  const [modal, setModal] = useState<{ open: boolean; concert?: Concert }>({ open: false })
  const [pending, startTransition] = useTransition()
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const yearConcerts = concerts.filter(c => c.year === selectedYear)
  const filtered = statusFilter === '전체' ? yearConcerts : yearConcerts.filter(c => c.status === statusFilter)

  const totalCount = yearConcerts.length
  const completedCount = yearConcerts.filter(c => c.status === '완료').length
  const scheduledCount = yearConcerts.filter(c => c.status === '예정').length

  function handleDelete(id: string) {
    if (!confirm('이 공연을 삭제할까요?')) return
    setDeletingId(id)
    startTransition(async () => {
      await deleteConcert(id)
      setDeletingId(null)
    })
  }

  function handleStatusCycle(concert: Concert) {
    const idx = STATUSES.indexOf(concert.status as ConcertStatus)
    const next = STATUSES[(idx + 1) % STATUSES.length]
    startTransition(() => updateConcertStatus(concert.id, next))
  }

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">🎵 SOS 공연 관리</h1>
          <p className="text-sm text-gray-400 mt-0.5">Sound OF School 공연 일정 및 현황</p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setModal({ open: true })}
            className="flex items-center gap-1.5 px-4 py-2 bg-yellow-400 rounded-xl font-semibold text-sm hover:bg-yellow-500"
          >
            <span className="text-lg leading-none">+</span> 공연 추가
          </button>
        )}
      </div>

      {/* 연도 탭 */}
      <div className="flex gap-2 mb-5">
        {years.map(y => (
          <button
            key={y}
            onClick={() => setSelectedYear(y)}
            className={`px-5 py-2 rounded-xl text-sm font-semibold transition-colors ${
              selectedYear === y
                ? 'bg-gray-800 text-white'
                : 'bg-white border border-gray-200 text-gray-500 hover:border-gray-400'
            }`}
          >
            {y}년
          </button>
        ))}
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        {[
          { label: '전체', value: totalCount, color: 'bg-white' },
          { label: '예정', value: scheduledCount, color: 'bg-yellow-50' },
          { label: '완료', value: completedCount, color: 'bg-green-50' },
        ].map(card => (
          <div key={card.label} className={`${card.color} border border-gray-100 rounded-xl p-4 text-center`}>
            <div className="text-2xl font-bold text-gray-800">{card.value}</div>
            <div className="text-xs text-gray-500 mt-0.5">{card.label}</div>
          </div>
        ))}
      </div>

      {/* 상태 필터 */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {['전체', ...STATUSES].map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              statusFilter === s
                ? 'bg-gray-800 text-white'
                : 'bg-white border border-gray-200 text-gray-500 hover:border-gray-400'
            }`}
          >
            {s}
            {s !== '전체' && (
              <span className="ml-1 opacity-60">
                {yearConcerts.filter(c => c.status === s).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* 테이블 */}
      <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
        {filtered.length === 0 ? (
          <div className="py-16 text-center text-gray-400">
            <div className="text-3xl mb-2">🎵</div>
            <div className="text-sm">{selectedYear}년 공연이 없습니다</div>
            {isAdmin && (
              <button
                onClick={() => setModal({ open: true })}
                className="mt-3 text-xs text-yellow-600 underline"
              >
                공연 추가하기
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 w-28">날짜</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 w-36">학교</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 w-24">컨셉</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400">아티스트</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400">비고</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-400 w-20">상태</th>
                  {isAdmin && <th className="w-16" />}
                </tr>
              </thead>
              <tbody>
                {filtered.map((concert, idx) => (
                  <tr
                    key={concert.id}
                    className={`border-b border-gray-50 last:border-0 hover:bg-gray-50/60 transition-colors ${
                      deletingId === concert.id ? 'opacity-40' : ''
                    }`}
                  >
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{concert.concert_date || '—'}</td>
                    <td className="px-4 py-3 font-medium text-gray-800">{concert.school || <span className="text-gray-300">미입력</span>}</td>
                    <td className="px-4 py-3 text-gray-500">{concert.concept || '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{concert.artists || '—'}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{concert.notes || '—'}</td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => isAdmin && handleStatusCycle(concert)}
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                          STATUS_BADGE[concert.status] ?? 'bg-gray-100 text-gray-500'
                        } ${isAdmin ? 'cursor-pointer hover:opacity-80' : 'cursor-default'}`}
                      >
                        {concert.status}
                      </button>
                    </td>
                    {isAdmin && (
                      <td className="px-3 py-3">
                        <div className="flex gap-1 justify-end">
                          <button
                            onClick={() => setModal({ open: true, concert })}
                            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600"
                            title="수정"
                          >
                            ✏️
                          </button>
                          <button
                            onClick={() => handleDelete(concert.id)}
                            className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500"
                            title="삭제"
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-xs text-gray-400 mt-3 text-right">{filtered.length}건</p>

      {/* 모달 */}
      {modal.open && (
        <ConcertModal
          concert={modal.concert}
          defaultYear={selectedYear}
          onClose={() => setModal({ open: false })}
        />
      )}
    </div>
  )
}
