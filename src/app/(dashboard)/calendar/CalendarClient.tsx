'use client'

import { useState } from 'react'
import Link from 'next/link'

export type CalEvent = {
  id: string
  title: string
  date: string
  type: 'rental_delivery' | 'rental_pickup' | 'sos' | 'project'
  color: string
  href: string
}

const DAYS_KO = ['일', '월', '화', '수', '목', '금', '토']

const LEGEND = [
  { color: '#D97706', label: '렌탈 배송' },
  { color: '#EF4444', label: '렌탈 수거' },
  { color: '#7C3AED', label: 'SOS 공연' },
]

export default function CalendarClient({ events, today }: { events: CalEvent[]; today: string }) {
  const todayDate = new Date(today)
  const [year, setYear] = useState(todayDate.getFullYear())
  const [month, setMonth] = useState(todayDate.getMonth())

  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: (number | null)[] = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)

  const byDay: Record<number, CalEvent[]> = {}
  for (const e of events) {
    const d = new Date(e.date)
    if (d.getFullYear() === year && d.getMonth() === month) {
      const day = d.getDate()
      if (!byDay[day]) byDay[day] = []
      byDay[day].push(e)
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

  const upcoming = events
    .filter(e => e.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 10)

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
          <button
            onClick={() => { setYear(todayDate.getFullYear()); setMonth(todayDate.getMonth()) }}
            className="text-xs px-3 py-1.5 rounded-lg border border-blue-200 bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
          >
            오늘
          </button>
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
            const dayEvents = day ? (byDay[day] ?? []) : []
            const isToday = day !== null && year === todayDate.getFullYear() && month === todayDate.getMonth() && day === todayDate.getDate()
            const isWeekend = idx % 7 === 0 || idx % 7 === 6
            return (
              <div key={idx} className={`min-h-[80px] p-1.5 bg-white ${!day ? 'bg-gray-50/60' : ''}`}>
                {day && (
                  <>
                    <div className={`text-xs font-medium mb-1 w-6 h-6 flex items-center justify-center rounded-full mx-auto ${
                      isToday ? 'font-bold text-gray-900' :
                      isWeekend ? (idx % 7 === 0 ? 'text-red-400' : 'text-blue-400') : 'text-gray-600'
                    }`} style={isToday ? { backgroundColor: '#FFCE00' } : {}}>
                      {day}
                    </div>
                    <div className="space-y-0.5">
                      {dayEvents.slice(0, 2).map(e => (
                        <Link key={e.id} href={e.href}
                          className="block text-[10px] px-1 py-0.5 rounded truncate font-medium leading-tight"
                          style={{ background: e.color + '20', color: e.color }}>
                          {e.title}
                        </Link>
                      ))}
                      {dayEvents.length > 2 && (
                        <div className="text-[10px] text-gray-400 px-1">+{dayEvents.length - 2}</div>
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
          <h3 className="text-sm font-bold text-gray-900 mb-3">범례</h3>
          {LEGEND.map(l => (
            <div key={l.label} className="flex items-center gap-2.5 mb-2">
              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: l.color }} />
              <span className="text-xs text-gray-600">{l.label}</span>
            </div>
          ))}
          <div className="mt-3 pt-3 border-t border-gray-100">
            <p className="text-[11px] text-gray-400">구글 캘린더 연동 예정</p>
          </div>
        </div>

        {/* 다가오는 일정 */}
        <div className="bg-white rounded-xl p-5" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <h3 className="text-sm font-bold text-gray-900 mb-3">다가오는 일정</h3>
          {upcoming.length === 0 ? (
            <p className="text-xs text-gray-400">예정된 일정이 없습니다</p>
          ) : (
            <div className="space-y-0">
              {upcoming.map(e => (
                <Link key={e.id} href={e.href}
                  className="flex items-center gap-2 py-2 border-b border-gray-50 hover:bg-gray-50 -mx-2 px-2 rounded transition-colors">
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: e.color }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-800 truncate">{e.title}</p>
                    <p className="text-[11px] text-gray-400">{e.date}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
