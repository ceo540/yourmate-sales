'use client'
import { useState } from 'react'

const MEMBERS = [
  { id: '1', name: '방준영', role: '대표' },
  { id: '2', name: '조민현', role: '팀장' },
  { id: '3', name: '유제민', role: '팀원' },
  { id: '4', name: '임지영', role: '팀원' },
]

type Status = '출근' | '외근' | '재택' | '연차' | '미출근'
const STATUS_STYLE: Record<Status, string> = {
  출근:  'bg-green-100 text-green-700',
  외근:  'bg-blue-100 text-blue-700',
  재택:  'bg-purple-100 text-purple-700',
  연차:  'bg-yellow-100 text-yellow-700',
  미출근:'bg-gray-100 text-gray-400',
}

const TODAY_STATUS: Record<string, { status: Status; checkIn: string; checkOut: string }> = {
  '1': { status: '출근',  checkIn: '09:02', checkOut: '' },
  '2': { status: '재택',  checkIn: '08:55', checkOut: '' },
  '3': { status: '외근',  checkIn: '10:15', checkOut: '' },
  '4': { status: '연차',  checkIn: '-',     checkOut: '-' },
}

interface Log { date: string; checkIn: string; checkOut: string; status: Status; hours: string }
const MY_LOGS: Log[] = [
  { date: '2026-04-03', checkIn: '09:02', checkOut: '', status: '출근', hours: '-' },
  { date: '2026-04-02', checkIn: '09:10', checkOut: '18:45', status: '출근', hours: '9h 35m' },
  { date: '2026-04-01', checkIn: '08:58', checkOut: '18:30', status: '출근', hours: '9h 32m' },
  { date: '2026-03-31', checkIn: '-', checkOut: '-', status: '연차', hours: '-' },
  { date: '2026-03-28', checkIn: '09:05', checkOut: '19:10', status: '출근', hours: '10h 5m' },
  { date: '2026-03-27', checkIn: '10:00', checkOut: '18:00', status: '재택', hours: '8h 0m' },
  { date: '2026-03-26', checkIn: '09:00', checkOut: '18:30', status: '출근', hours: '9h 30m' },
  { date: '2026-03-25', checkIn: '09:15', checkOut: '18:20', status: '출근', hours: '9h 5m' },
]

export default function AttendanceDemoPage() {
  const [view, setView] = useState<'내 근태' | '전체 현황'>('내 근태')
  const [checkedIn, setCheckedIn] = useState(true)
  const [workType, setWorkType] = useState<'출근' | '재택' | '외근'>('출근')
  const checkInTime = '09:02'

  return (
    <div className="max-w-4xl mx-auto">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">근태 관리</h1>
          <p className="text-gray-500 text-sm mt-1">출퇴근 기록 · 근무 유형 관리</p>
        </div>
        <span className="text-xs bg-orange-100 text-orange-600 px-2 py-1 rounded-full font-medium">데모</span>
      </div>

      {/* 탭 */}
      <div className="flex gap-2 mb-6">
        {(['내 근태', '전체 현황'] as const).map(t => (
          <button key={t} onClick={() => setView(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${view === t ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
            {t}
          </button>
        ))}
      </div>

      {view === '내 근태' && (
        <div className="space-y-4">
          {/* 오늘 출퇴근 카드 */}
          <div className="bg-white border border-gray-200 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-xs text-gray-400">오늘</p>
                <p className="font-semibold text-gray-800">2026년 4월 3일 금요일</p>
              </div>
              <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_STYLE[workType]}`}>{workType}</span>
            </div>

            {/* 근무 유형 선택 */}
            <div className="flex gap-2 mb-5">
              {(['출근', '재택', '외근'] as const).map(t => (
                <button key={t} onClick={() => setWorkType(t)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${workType === t ? 'bg-gray-900 text-white border-gray-900' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                  {t}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-4 mb-5">
              <div className="bg-gray-50 rounded-xl p-4 text-center">
                <p className="text-xs text-gray-400 mb-1">출근</p>
                <p className="text-2xl font-bold text-gray-800">{checkedIn ? checkInTime : '--:--'}</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-4 text-center">
                <p className="text-xs text-gray-400 mb-1">퇴근</p>
                <p className="text-2xl font-bold text-gray-400">--:--</p>
              </div>
            </div>

            <button
              onClick={() => setCheckedIn(!checkedIn)}
              className={`w-full py-3 rounded-xl font-semibold text-sm transition-colors ${checkedIn ? 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100' : 'bg-gray-900 text-white hover:bg-gray-800'}`}>
              {checkedIn ? '퇴근 기록' : '출근 기록'}
            </button>
          </div>

          {/* 이번 달 통계 */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: '출근일', value: '18일', color: 'text-green-600' },
              { label: '총 근무', value: '167h', color: 'text-blue-600' },
              { label: '평균 퇴근', value: '18:42', color: 'text-purple-600' },
            ].map(s => (
              <div key={s.label} className="bg-white border border-gray-200 rounded-xl p-4 text-center">
                <p className="text-xs text-gray-400 mb-1">{s.label}</p>
                <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* 출퇴근 기록 */}
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <p className="font-semibold text-gray-800">이번 달 기록</p>
            </div>
            <div className="divide-y divide-gray-50">
              {MY_LOGS.map(log => (
                <div key={log.date} className="flex items-center px-5 py-3 hover:bg-gray-50">
                  <div className="w-28 text-sm text-gray-500">{log.date.slice(5)}</div>
                  <span className={`text-xs px-2 py-0.5 rounded-full mr-3 ${STATUS_STYLE[log.status]}`}>{log.status}</span>
                  <div className="flex-1 flex items-center gap-4 text-sm text-gray-700">
                    <span>출근 {log.checkIn}</span>
                    <span className="text-gray-300">→</span>
                    <span>퇴근 {log.checkOut || '--:--'}</span>
                  </div>
                  <span className="text-xs text-gray-400">{log.hours}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {view === '전체 현황' && (
        <div className="space-y-4">
          {/* 오늘 팀 현황 */}
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <p className="font-semibold text-gray-800">오늘 팀 현황 <span className="text-sm font-normal text-gray-400">2026-04-03</span></p>
            </div>
            <div className="divide-y divide-gray-50">
              {MEMBERS.map(m => {
                const s = TODAY_STATUS[m.id]
                return (
                  <div key={m.id} className="flex items-center px-5 py-4">
                    <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-sm font-medium text-gray-600 mr-3">
                      {m.name[0]}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-800">{m.name}</p>
                      <p className="text-xs text-gray-400">{m.role}</p>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full mr-4 ${STATUS_STYLE[s.status]}`}>{s.status}</span>
                    <div className="text-right text-xs text-gray-400">
                      <div>출근 {s.checkIn}</div>
                      {s.checkOut && <div>퇴근 {s.checkOut}</div>}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* 이번 달 요약 */}
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <p className="font-semibold text-gray-800">이번 달 팀원별 요약</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr className="text-xs text-gray-500">
                    <th className="px-5 py-3 text-left">이름</th>
                    <th className="px-4 py-3 text-center">출근일</th>
                    <th className="px-4 py-3 text-center">재택</th>
                    <th className="px-4 py-3 text-center">외근</th>
                    <th className="px-4 py-3 text-center">연차</th>
                    <th className="px-4 py-3 text-center">총 근무</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {[
                    { name: '방준영', 출근: 16, 재택: 2, 외근: 1, 연차: 0, 총: '152h' },
                    { name: '조민현', 출근: 14, 재택: 4, 외근: 0, 연차: 1, 총: '148h' },
                    { name: '유제민', 출근: 15, 재택: 0, 외근: 3, 연차: 0, 총: '162h' },
                    { name: '임지영', 출근: 13, 재택: 2, 외근: 0, 연차: 2, 총: '139h' },
                  ].map(r => (
                    <tr key={r.name} className="hover:bg-gray-50">
                      <td className="px-5 py-3 font-medium text-gray-800">{r.name}</td>
                      <td className="px-4 py-3 text-center text-green-600">{r.출근}</td>
                      <td className="px-4 py-3 text-center text-purple-600">{r.재택}</td>
                      <td className="px-4 py-3 text-center text-blue-600">{r.외근}</td>
                      <td className="px-4 py-3 text-center text-yellow-600">{r.연차}</td>
                      <td className="px-4 py-3 text-center text-gray-600 font-medium">{r.총}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
