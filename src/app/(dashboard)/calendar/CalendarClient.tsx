'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

export type CalEvent = {
  id: string
  title: string
  date: string
  type: 'rental_delivery' | 'rental_pickup' | 'sos' | 'project'
  color: string
  href: string
}

type GEvent = {
  id: string
  googleEventId: string
  calendarKey: string
  title: string
  date: string
  endDate: string
  startTime?: string
  endTime?: string
  isAllDay: boolean
  description: string
  color: string
}

type FormData = {
  calendarKey: string
  title: string
  date: string
  endDate: string
  isAllDay: boolean
  startTime: string
  endTime: string
  description: string
}

const CALENDAR_OPTIONS = [
  { key: 'main',    label: '개인/전체',      color: '#3B82F6' },
  { key: 'sos',     label: '사운드오브스쿨', color: '#7C3AED' },
  { key: 'rental',  label: '렌탈일정',       color: '#D97706' },
  { key: 'artqium', label: '아트키움',        color: '#10B981' },
]

const DB_LEGEND = [
  { color: '#D97706', label: '렌탈 배송 (DB)' },
  { color: '#EF4444', label: '렌탈 수거 (DB)' },
  { color: '#7C3AED', label: 'SOS 공연 (DB)' },
]

const DAYS_KO = ['일', '월', '화', '수', '목', '금', '토']

const EMPTY_FORM: FormData = {
  calendarKey: 'main',
  title: '',
  date: '',
  endDate: '',
  isAllDay: true,
  startTime: '',
  endTime: '',
  description: '',
}

export default function CalendarClient({ events, today }: { events: CalEvent[]; today: string }) {
  const todayDate = new Date(today)
  const [year, setYear] = useState(todayDate.getFullYear())
  const [month, setMonth] = useState(todayDate.getMonth())
  const [gEvents, setGEvents] = useState<GEvent[]>([])
  const [gLoading, setGLoading] = useState(false)

  const [createModal, setCreateModal] = useState<{ date: string } | null>(null)
  const [editModal, setEditModal] = useState<GEvent | null>(null)
  const [form, setForm] = useState<FormData>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const fetchGEvents = useCallback(async (y: number, m: number) => {
    setGLoading(true)
    try {
      const res = await fetch(`/api/calendar/events?year=${y}&month=${m}`)
      const data = await res.json()
      if (data.events) setGEvents(data.events)
    } catch { /* ignore */ }
    setGLoading(false)
  }, [])

  useEffect(() => { fetchGEvents(year, month) }, [year, month, fetchGEvents])

  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: (number | null)[] = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)

  const byDay: Record<number, { db: CalEvent[]; g: GEvent[] }> = {}
  for (const e of events) {
    const d = new Date(e.date + 'T00:00:00')
    if (d.getFullYear() === year && d.getMonth() === month) {
      const day = d.getDate()
      if (!byDay[day]) byDay[day] = { db: [], g: [] }
      byDay[day].db.push(e)
    }
  }
  for (const e of gEvents) {
    const d = new Date(e.date + 'T00:00:00')
    if (d.getFullYear() === year && d.getMonth() === month) {
      const day = d.getDate()
      if (!byDay[day]) byDay[day] = { db: [], g: [] }
      byDay[day].g.push(e)
    }
  }

  const prevMonth = () => {
    if (month === 0) { setYear(y => y - 1); setMonth(11) }
    else setMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (month === 11) { setYear(y => y + 1); setMonth(0) }
    else setMonth(m => m + 1)
  }

  const upcomingDB = events.filter(e => e.date >= today).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 5)
  const upcomingG = gEvents.filter(e => e.date >= today).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 5)

  function openCreate(dateStr: string) {
    setForm({ ...EMPTY_FORM, date: dateStr, endDate: dateStr })
    setCreateModal({ date: dateStr })
    setEditModal(null)
  }

  function openEdit(e: GEvent) {
    setForm({
      calendarKey: e.calendarKey,
      title: e.title,
      date: e.date,
      endDate: e.endDate ?? e.date,
      isAllDay: e.isAllDay,
      startTime: e.startTime ?? '',
      endTime: e.endTime ?? '',
      description: e.description ?? '',
    })
    setEditModal(e)
    setCreateModal(null)
  }

  async function handleCreate() {
    if (!form.title || !form.date) return
    setSaving(true)
    try {
      await fetch('/api/calendar/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      setCreateModal(null)
      await fetchGEvents(year, month)
    } catch { /* ignore */ }
    setSaving(false)
  }

  async function handleUpdate() {
    if (!editModal || !form.title) return
    setSaving(true)
    try {
      await fetch(`/api/calendar/events/${editModal.googleEventId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      setEditModal(null)
      await fetchGEvents(year, month)
    } catch { /* ignore */ }
    setSaving(false)
  }

  async function handleDelete() {
    if (!editModal) return
    if (!confirm('이 일정을 삭제할까?')) return
    setDeleting(true)
    try {
      await fetch(`/api/calendar/events/${editModal.googleEventId}?calendarKey=${editModal.calendarKey}`, {
        method: 'DELETE',
      })
      setEditModal(null)
      await fetchGEvents(year, month)
    } catch { /* ignore */ }
    setDeleting(false)
  }

  const modalOpen = !!createModal || !!editModal

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      {/* 캘린더 메인 */}
      <div className="lg:col-span-3 bg-white rounded-xl p-6" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-1">
            <button onClick={prevMonth} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 text-lg leading-none">‹</button>
            <span className="text-lg font-bold text-gray-900 px-2">{year}년 {month + 1}월</span>
            <button onClick={nextMonth} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 text-lg leading-none">›</button>
          </div>
          <div className="flex items-center gap-2">
            {gLoading && <span className="text-xs text-gray-400">동기화 중...</span>}
            <button
              onClick={() => { setYear(todayDate.getFullYear()); setMonth(todayDate.getMonth()) }}
              className="text-xs px-3 py-1.5 rounded-lg border border-blue-200 bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
            >오늘</button>
            <button
              onClick={() => openCreate(`${year}-${String(month + 1).padStart(2, '0')}-${String(todayDate.getDate()).padStart(2, '0')}`)}
              className="text-xs px-3 py-1.5 rounded-lg border border-yellow-300 text-gray-800 hover:bg-yellow-50 transition-colors"
              style={{ backgroundColor: '#FFCE00' }}
            >+ 일정 추가</button>
          </div>
        </div>

        {/* 요일 헤더 */}
        <div className="grid grid-cols-7 mb-1">
          {DAYS_KO.map((d, i) => (
            <div key={d} className={`text-center text-xs font-semibold py-2 ${i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-gray-400'}`}>{d}</div>
          ))}
        </div>

        {/* 날짜 그리드 */}
        <div className="grid grid-cols-7 gap-px bg-gray-100 rounded-xl overflow-hidden border border-gray-100">
          {cells.map((day, idx) => {
            const dayData = day ? (byDay[day] ?? { db: [], g: [] }) : { db: [], g: [] }
            const allEvents = [...dayData.db, ...dayData.g]
            const isToday = day !== null && year === todayDate.getFullYear() && month === todayDate.getMonth() && day === todayDate.getDate()
            const isWeekend = idx % 7 === 0 || idx % 7 === 6
            const dateStr = day ? `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}` : ''
            return (
              <div
                key={idx}
                onClick={() => day && openCreate(dateStr)}
                className={`group relative min-h-[80px] p-1.5 bg-white transition-all ${day ? 'cursor-pointer hover:bg-yellow-50 hover:ring-2 hover:ring-yellow-300 hover:z-10' : 'bg-gray-50/60 cursor-default'}`}
                title={day ? '클릭하여 일정 추가' : ''}
              >
                {day && (
                  <>
                    <div className={`text-xs font-medium mb-1 w-6 h-6 flex items-center justify-center rounded-full mx-auto ${
                      isToday ? 'font-bold text-gray-900' :
                      isWeekend ? (idx % 7 === 0 ? 'text-red-400' : 'text-blue-400') : 'text-gray-600'
                    }`} style={isToday ? { backgroundColor: '#FFCE00' } : {}}>
                      {day}
                    </div>
                    <div className="space-y-0.5">
                      {dayData.db.slice(0, 1).map(e => (
                        <Link key={e.id} href={e.href}
                          onClick={ev => ev.stopPropagation()}
                          className="block text-[10px] px-1 py-0.5 rounded truncate font-medium leading-tight"
                          style={{ background: e.color + '20', color: e.color }}>
                          {e.title}
                        </Link>
                      ))}
                      {dayData.g.slice(0, allEvents.length > 2 ? 1 : 2).map(e => (
                        <button key={e.id}
                          onClick={ev => { ev.stopPropagation(); openEdit(e) }}
                          className="block w-full text-left text-[10px] px-1 py-0.5 rounded truncate font-medium leading-tight"
                          style={{ background: e.color + '20', color: e.color }}>
                          {e.startTime ? `${e.startTime} ` : ''}{e.title}
                        </button>
                      ))}
                      {allEvents.length > 2 && (
                        <div className="text-[10px] font-medium text-blue-500 px-1 group-hover:text-blue-700">+{allEvents.length - 2}개 (셀 클릭)</div>
                      )}
                    </div>
                  </>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* 우측 패널 */}
      <div className="space-y-4">
        {/* 범례 */}
        <div className="bg-white rounded-xl p-5" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <h3 className="text-sm font-bold text-gray-900 mb-3">구글 캘린더</h3>
          {CALENDAR_OPTIONS.map(c => (
            <div key={c.key} className="flex items-center gap-2.5 mb-2">
              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: c.color }} />
              <span className="text-xs text-gray-600">{c.label}</span>
            </div>
          ))}
          <div className="mt-3 pt-3 border-t border-gray-100">
            <p className="text-[10px] text-gray-400 font-medium mb-1.5">시스템 DB</p>
            {DB_LEGEND.map(l => (
              <div key={l.label} className="flex items-center gap-2.5 mb-1.5">
                <div className="w-2 h-2 rounded-full flex-shrink-0 opacity-60" style={{ background: l.color }} />
                <span className="text-[10px] text-gray-400">{l.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 다가오는 일정 */}
        <div className="bg-white rounded-xl p-5" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <h3 className="text-sm font-bold text-gray-900 mb-3">다가오는 일정</h3>
          {upcomingG.length === 0 && upcomingDB.length === 0 ? (
            <p className="text-xs text-gray-400">예정된 일정 없음</p>
          ) : (
            <div className="space-y-0">
              {[...upcomingDB.map(e => ({ id: e.id, title: e.title, date: e.date, color: e.color, href: e.href, isGoogle: false })),
                ...upcomingG.map(e => ({ id: e.id, title: e.title, date: e.date, color: e.color, href: undefined, isGoogle: true, raw: e }))]
                .sort((a, b) => a.date.localeCompare(b.date)).slice(0, 8)
                .map(e => e.isGoogle && (e as any).raw ? (
                  <button key={e.id} onClick={() => openEdit((e as any).raw)}
                    className="flex items-center gap-2 py-2 border-b border-gray-50 hover:bg-gray-50 -mx-2 px-2 rounded transition-colors w-full text-left">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: e.color }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-800 truncate">{e.title}</p>
                      <p className="text-[11px] text-gray-400">{e.date}</p>
                    </div>
                  </button>
                ) : (
                  <Link key={e.id} href={(e as any).href}
                    className="flex items-center gap-2 py-2 border-b border-gray-50 hover:bg-gray-50 -mx-2 px-2 rounded transition-colors">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: e.color }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-800 truncate">{e.title}</p>
                      <p className="text-[11px] text-gray-400">{e.date}</p>
                    </div>
                  </Link>
                ))
              }
            </div>
          )}
        </div>
      </div>

      {/* 일정 생성/수정 모달 */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-bold text-gray-900">{editModal ? '일정 수정' : '일정 추가'}</h2>
              <button onClick={() => { setCreateModal(null); setEditModal(null) }} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
            </div>

            <div className="space-y-3">
              {/* 캘린더 선택 */}
              <div>
                <label className="text-xs text-gray-500 font-medium block mb-1">캘린더</label>
                <div className="flex flex-wrap gap-1.5">
                  {CALENDAR_OPTIONS.map(c => (
                    <button key={c.key}
                      onClick={() => setForm(f => ({ ...f, calendarKey: c.key }))}
                      className={`text-xs px-2.5 py-1.5 rounded-lg border transition-colors ${form.calendarKey === c.key ? 'text-white border-transparent' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}
                      style={form.calendarKey === c.key ? { backgroundColor: c.color } : {}}
                    >{c.label}</button>
                  ))}
                </div>
              </div>

              {/* 제목 */}
              <div>
                <label className="text-xs text-gray-500 font-medium block mb-1">제목 *</label>
                <input
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="일정 제목"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-yellow-400"
                />
              </div>

              {/* 날짜 */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-gray-500 font-medium block mb-1">시작일 *</label>
                  <input type="date" value={form.date}
                    onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-yellow-400"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 font-medium block mb-1">종료일</label>
                  <input type="date" value={form.endDate}
                    onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-yellow-400"
                  />
                </div>
              </div>

              {/* 종일 여부 */}
              <div className="flex items-center gap-2">
                <input type="checkbox" id="allday" checked={form.isAllDay}
                  onChange={e => setForm(f => ({ ...f, isAllDay: e.target.checked }))}
                  className="w-4 h-4 rounded"
                />
                <label htmlFor="allday" className="text-xs text-gray-600">종일</label>
              </div>

              {/* 시간 (종일 아닐 때) */}
              {!form.isAllDay && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-gray-500 font-medium block mb-1">시작 시간</label>
                    <input type="time" value={form.startTime}
                      onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-yellow-400"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 font-medium block mb-1">종료 시간</label>
                    <input type="time" value={form.endTime}
                      onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-yellow-400"
                    />
                  </div>
                </div>
              )}

              {/* 설명 */}
              <div>
                <label className="text-xs text-gray-500 font-medium block mb-1">설명</label>
                <textarea value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  rows={2}
                  placeholder="메모 (선택)"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-yellow-400 resize-none"
                />
              </div>
            </div>

            <div className="flex gap-2 mt-5">
              {editModal && (
                <button onClick={handleDelete} disabled={deleting}
                  className="px-4 py-2 rounded-xl text-sm text-red-500 border border-red-200 hover:bg-red-50 disabled:opacity-50 transition-colors">
                  {deleting ? '삭제 중...' : '삭제'}
                </button>
              )}
              <button onClick={() => { setCreateModal(null); setEditModal(null) }}
                className="flex-1 px-4 py-2 rounded-xl text-sm border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors">
                취소
              </button>
              <button
                onClick={editModal ? handleUpdate : handleCreate}
                disabled={saving || !form.title || !form.date}
                className="flex-1 px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-40 transition-all hover:opacity-80"
                style={{ backgroundColor: '#FFCE00', color: '#121212' }}
              >
                {saving ? '저장 중...' : editModal ? '수정' : '추가'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
