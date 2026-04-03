'use client'
import { useState, useRef, useTransition } from 'react'
import {
  AttendanceRecord, Holiday, WorkSchedule,
  getAttendanceByMonth, saveAttendanceRecords,
  getHolidays, addHoliday, deleteHoliday,
  getWorkSchedules, upsertWorkSchedule,
} from './actions'

/* ── 상수 ── */
const DEFAULT_START = 9 * 60   // 09:00
const DEFAULT_END   = 18 * 60  // 18:00
const DAY_KR = ['일', '월', '화', '수', '목', '금', '토']

/* ── 유틸 ── */
function timeToMinutes(t: string) {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}
function minutesToHHMM(mins: number) {
  if (mins < 0) return '-'
  return `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`
}
function avgTime(times: string[]) {
  if (!times.length) return null
  return minutesToHHMM(Math.round(times.reduce((s, t) => s + timeToMinutes(t), 0) / times.length))
}

/* ── 직원별 집계 ── */
interface Summary {
  name: string; workDays: number; absentDays: number
  lateTimes: number; earlyLeaveTimes: number
  avgCheckIn: string | null; avgCheckOut: string | null; avgWorkHours: string | null
}
function buildSummaries(records: AttendanceRecord[]): Summary[] {
  const map = new Map<string, AttendanceRecord[]>()
  records.forEach(r => { if (!map.has(r.employee_name)) map.set(r.employee_name, []); map.get(r.employee_name)!.push(r) })
  return Array.from(map.entries()).map(([name, recs]) => {
    const worked = recs.filter(r => !r.is_absent)
    const absent = recs.filter(r => r.is_absent)
    const workMins = worked.filter(r => r.work_minutes).map(r => r.work_minutes!)
    return {
      name,
      workDays: worked.length,
      absentDays: absent.length,
      lateTimes: worked.filter(r => r.late_minutes > 0).length,
      earlyLeaveTimes: worked.filter(r => r.early_leave_minutes > 0 && r.check_out).length,
      avgCheckIn: avgTime(worked.filter(r => r.check_in).map(r => r.check_in!)),
      avgCheckOut: avgTime(worked.filter(r => r.check_out).map(r => r.check_out!)),
      avgWorkHours: workMins.length ? minutesToHHMM(Math.round(workMins.reduce((a, b) => a + b, 0) / workMins.length)) : null,
    }
  })
}

/* ── XLS 파서 ── */
async function parseXLS(
  file: File,
  holidaySet: Set<string>,
  scheduleMap: Map<string, { start: number; end: number }>
): Promise<AttendanceRecord[]> {
  const XLSX = await import('xlsx')
  const buffer = await file.arrayBuffer()
  const wb = XLSX.read(new Uint8Array(buffer), { type: 'array', cellText: true, raw: false })

  const ws = wb.Sheets['근태기록']
  if (!ws) throw new Error('근태기록 시트를 찾을 수 없어요')

  const rows: string[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' }) as string[][]

  const dateStr = rows[2]?.[2] || ''
  const match = dateStr.match(/(\d{4})\/(\d{2})\/(\d{2})/)
  if (!match) throw new Error(`날짜 파싱 실패: "${dateStr}"`)
  const year = match[1], month = match[2]
  const yearMonth = `${year}-${month}`
  const daysInMonth = new Date(parseInt(year), parseInt(month), 0).getDate()

  const records: AttendanceRecord[] = []

  for (let r = 4; r < rows.length - 1; r += 2) {
    const hdr = rows[r]
    const dat = rows[r + 1]
    if (!hdr || hdr[0] !== 'ID No:') break

    const employeeNo = parseInt(hdr[2]) || null
    const name = hdr[10]?.trim()
    if (!name) continue

    const sched = scheduleMap.get(name) ?? { start: DEFAULT_START, end: DEFAULT_END }

    for (let d = 0; d < daysInMonth; d++) {
      const day = d + 1
      const workDate = `${yearMonth}-${String(day).padStart(2, '0')}`
      const dow = new Date(workDate).getDay()

      if (dow === 0 || dow === 6) continue       // 주말
      if (holidaySet.has(workDate)) continue      // 공휴일 — 결근으로 기록 안 함

      const raw = (dat[d] || '').trim()

      if (!raw) {
        records.push({
          employee_name: name, employee_no: employeeNo, work_date: workDate,
          check_in: null, check_out: null, work_minutes: null,
          late_minutes: 0, early_leave_minutes: 0, is_absent: true, year_month: yearMonth,
        })
      } else {
        const times = raw.split('\n').map((t: string) => t.trim()).filter((t: string) => /^\d{2}:\d{2}$/.test(t))
        const checkIn = times[0] || null
        const checkOut = times.length > 1 ? times[times.length - 1] : null
        const lateMinutes = checkIn ? Math.max(0, timeToMinutes(checkIn) - sched.start) : 0
        const earlyLeaveMins = checkOut ? Math.max(0, sched.end - timeToMinutes(checkOut)) : 0
        const workMinutes = (checkIn && checkOut) ? timeToMinutes(checkOut) - timeToMinutes(checkIn) : null

        records.push({
          employee_name: name, employee_no: employeeNo, work_date: workDate,
          check_in: checkIn, check_out: checkOut, work_minutes: workMinutes,
          late_minutes: lateMinutes, early_leave_minutes: earlyLeaveMins,
          is_absent: false, year_month: yearMonth,
        })
      }
    }
  }
  return records
}

/* ── 월별 전체 일정 생성 (기록 + 공휴일 통합) ── */
function buildDayList(yearMonth: string, records: AttendanceRecord[], holidayMap: Map<string, string>) {
  const [y, m] = yearMonth.split('-').map(Number)
  const daysInMonth = new Date(y, m, 0).getDate()
  const recMap = new Map(records.map(r => [r.work_date, r]))
  const days: { date: string; dow: number; type: 'holiday' | 'record' | 'absent'; record?: AttendanceRecord; holidayName?: string }[] = []

  for (let d = 1; d <= daysInMonth; d++) {
    const date = `${yearMonth}-${String(d).padStart(2, '0')}`
    const dow = new Date(date).getDay()
    if (dow === 0 || dow === 6) continue

    if (holidayMap.has(date)) {
      days.push({ date, dow, type: 'holiday', holidayName: holidayMap.get(date) })
    } else if (recMap.has(date)) {
      days.push({ date, dow, type: recMap.get(date)!.is_absent ? 'absent' : 'record', record: recMap.get(date) })
    } else {
      // DB에 없는 평일 = 아직 업로드 전
    }
  }
  return days
}

/* ── Props ── */
interface Props {
  months: string[]; initialRecords: AttendanceRecord[]; initialMonth: string | null
  isAdmin: boolean; myName: string; holidays: Holiday[]; schedules: WorkSchedule[]
}

export default function AttendanceClient({ months, initialRecords, initialMonth, isAdmin, myName, holidays: initHolidays, schedules: initSchedules }: Props) {
  const [tab, setTab] = useState<'records' | 'settings'>('records')
  const [selectedMonth, setSelectedMonth] = useState(initialMonth)
  const [records, setRecords] = useState<AttendanceRecord[]>(initialRecords)
  const [allMonths, setAllMonths] = useState(months)
  const [selectedEmployee, setSelectedEmployee] = useState<string | null>(null)
  const [previewRecords, setPreviewRecords] = useState<AttendanceRecord[] | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [holidays, setHolidays] = useState<Holiday[]>(initHolidays)
  const [schedules, setSchedules] = useState<WorkSchedule[]>(initSchedules)
  // 설정 탭 상태
  const [editingSchedules, setEditingSchedules] = useState<Record<string, { start: string; end: string }>>({})
  const [newHolidayDate, setNewHolidayDate] = useState('')
  const [newHolidayName, setNewHolidayName] = useState('')
  const [isPending, startTransition] = useTransition()
  const fileRef = useRef<HTMLInputElement>(null)

  /* 파생 데이터 */
  const holidayMap = new Map(holidays.map(h => [h.holiday_date, h.name]))
  const scheduleMap = new Map(schedules.map(s => [s.employee_name, { start: timeToMinutes(s.work_start), end: timeToMinutes(s.work_end) }]))

  /* 직원 이름 목록 (records에서 추출 + schedules) */
  const employeeNames = [...new Set([
    ...records.map(r => r.employee_name),
    ...schedules.map(s => s.employee_name),
  ])].sort()

  /* 월 전환 */
  async function handleMonthChange(ym: string) {
    setSelectedMonth(ym); setSelectedEmployee(null)
    const data = await getAttendanceByMonth(ym)
    setRecords(data)
  }

  /* 파일 선택 → 파싱 */
  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    setUploadError(null)
    try {
      const parsed = await parseXLS(file, new Set(holidays.map(h => h.holiday_date)), scheduleMap)
      setPreviewRecords(parsed)
    } catch (err) { setUploadError(err instanceof Error ? err.message : '파싱 오류') }
    e.target.value = ''
  }

  /* 저장 확정 */
  function handleConfirm() {
    if (!previewRecords) return
    startTransition(async () => {
      await saveAttendanceRecords(previewRecords)
      const ym = previewRecords[0]?.year_month
      if (ym && !allMonths.includes(ym)) setAllMonths(prev => [ym, ...prev].sort((a, b) => b.localeCompare(a)))
      setSelectedMonth(ym)
      const fresh = await getAttendanceByMonth(ym)
      setRecords(fresh); setPreviewRecords(null); setSelectedEmployee(null)
    })
  }

  /* 공휴일 추가/삭제 */
  function handleAddHoliday() {
    if (!newHolidayDate || !newHolidayName) return
    startTransition(async () => {
      await addHoliday(newHolidayDate, newHolidayName)
      const fresh = await getHolidays()
      setHolidays(fresh); setNewHolidayDate(''); setNewHolidayName('')
    })
  }
  function handleDeleteHoliday(id: string) {
    startTransition(async () => {
      await deleteHoliday(id)
      setHolidays(prev => prev.filter(h => h.id !== id))
    })
  }

  /* 근무시간 저장 */
  function handleSaveSchedule(name: string) {
    const edit = editingSchedules[name]
    if (!edit) return
    startTransition(async () => {
      await upsertWorkSchedule({ employee_name: name, work_start: edit.start, work_end: edit.end })
      const fresh = await getWorkSchedules()
      setSchedules(fresh)
      setEditingSchedules(prev => { const n = { ...prev }; delete n[name]; return n })
    })
  }

  const summaries = buildSummaries(records)
  const totalWork = summaries.reduce((s, e) => s + e.workDays, 0)
  const totalAbsent = summaries.reduce((s, e) => s + e.absentDays, 0)
  const totalLate = summaries.reduce((s, e) => s + e.lateTimes, 0)
  const totalEarly = summaries.reduce((s, e) => s + e.earlyLeaveTimes, 0)

  const detailDays = selectedEmployee && selectedMonth
    ? buildDayList(selectedMonth, records.filter(r => r.employee_name === selectedEmployee), holidayMap)
    : []

  const inp = 'border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-300 bg-white'

  /* ── 렌더 ── */
  return (
    <div className="max-w-5xl mx-auto space-y-5">
      {/* 헤더 */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">근태 관리</h1>
          <p className="text-sm text-gray-400 mt-0.5">기기에서 다운받은 엑셀 파일을 업로드해 관리해요</p>
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            <input ref={fileRef} type="file" accept=".xls,.xlsx" className="hidden" onChange={handleFileChange} />
            <button onClick={() => fileRef.current?.click()}
              className="px-4 py-2 text-sm font-semibold rounded-lg"
              style={{ backgroundColor: '#FFCE00', color: '#121212' }}>
              + 엑셀 업로드
            </button>
          </div>
        )}
      </div>

      {uploadError && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-600">{uploadError}</div>
      )}

      {/* 탭 (근태 기록 / 설정) */}
      {isAdmin && (
        <div className="flex gap-1 border-b border-gray-200">
          {([['records', '📋 근태 기록'], ['settings', '⚙️ 설정']] as const).map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                tab === key ? 'border-yellow-400 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}>{label}</button>
          ))}
        </div>
      )}

      {/* ── 근태 기록 탭 ── */}
      {tab === 'records' && (
        <>
          {allMonths.length === 0 && !previewRecords && (
            <div className="bg-white border border-gray-200 rounded-xl p-16 text-center">
              <p className="text-4xl mb-3">📋</p>
              <p className="text-base font-semibold text-gray-700 mb-1">아직 업로드된 근태 데이터가 없어요</p>
              <p className="text-sm text-gray-400">기기에서 엑셀을 다운받아 "+ 엑셀 업로드" 버튼으로 올려주세요</p>
            </div>
          )}

          {/* 월 탭 */}
          {allMonths.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {allMonths.map(ym => {
                const [y, m] = ym.split('-')
                return (
                  <button key={ym} onClick={() => handleMonthChange(ym)}
                    className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                      selectedMonth === ym ? 'text-gray-900' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    }`}
                    style={selectedMonth === ym ? { backgroundColor: '#FFCE00' } : {}}>
                    {y}년 {parseInt(m)}월
                  </button>
                )
              })}
            </div>
          )}

          {/* 요약 카드 */}
          {isAdmin && records.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: '총 출근일', value: `${totalWork}일`, color: 'text-gray-800', bg: 'bg-white' },
                { label: '총 결근일', value: `${totalAbsent}일`, color: totalAbsent > 0 ? 'text-red-500' : 'text-gray-400', bg: totalAbsent > 0 ? 'bg-red-50' : 'bg-white' },
                { label: '지각 횟수', value: `${totalLate}회`, color: totalLate > 0 ? 'text-orange-600' : 'text-gray-400', bg: totalLate > 0 ? 'bg-orange-50' : 'bg-white' },
                { label: '조퇴 횟수', value: `${totalEarly}회`, color: totalEarly > 0 ? 'text-yellow-700' : 'text-gray-400', bg: totalEarly > 0 ? 'bg-yellow-50' : 'bg-white' },
              ].map(s => (
                <div key={s.label} className={`${s.bg} border border-gray-200 rounded-xl px-4 py-3`}>
                  <p className="text-xs text-gray-400 mb-1">{s.label}</p>
                  <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                </div>
              ))}
            </div>
          )}

          {/* 스플릿 뷰 */}
          {records.length > 0 && (
            <div className={`flex flex-col md:flex-row gap-4 ${selectedEmployee ? 'md:h-[calc(100vh-340px)] md:min-h-[480px]' : ''}`}>
              {/* 직원 요약 테이블 */}
              <div className={`${selectedEmployee ? 'hidden md:flex md:w-[44%]' : 'flex'} flex-col bg-white border border-gray-200 rounded-xl overflow-hidden`}>
                <div className="px-5 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between flex-shrink-0">
                  <h2 className="text-sm font-semibold text-gray-700">
                    {selectedMonth?.replace('-', '년 ').replace(/(\d+)$/, m => `${parseInt(m)}월`)} 근태 현황
                  </h2>
                  <span className="text-xs text-gray-400">{summaries.length}명</span>
                </div>
                <div className="overflow-auto flex-1">
                  <table className="w-full min-w-[480px]">
                    <thead className="sticky top-0 bg-gray-50 z-10">
                      <tr className="border-b border-gray-100">
                        <th className="text-left text-xs font-semibold text-gray-400 px-4 py-2.5">직원</th>
                        <th className="text-center text-xs font-semibold text-gray-400 px-3 py-2.5">출근</th>
                        <th className="text-center text-xs font-semibold text-gray-400 px-3 py-2.5">결근</th>
                        <th className="text-center text-xs font-semibold text-gray-400 px-3 py-2.5">지각</th>
                        <th className="text-center text-xs font-semibold text-gray-400 px-3 py-2.5">조퇴</th>
                        <th className="text-center text-xs font-semibold text-gray-400 px-3 py-2.5 hidden sm:table-cell">평균출근</th>
                        <th className="text-center text-xs font-semibold text-gray-400 px-3 py-2.5 hidden sm:table-cell">평균퇴근</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {summaries.map(s => (
                        <tr key={s.name}
                          onClick={() => setSelectedEmployee(s.name === selectedEmployee ? null : s.name)}
                          className={`cursor-pointer transition-colors ${selectedEmployee === s.name ? 'bg-yellow-50' : 'hover:bg-gray-50'}`}>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-600 flex-shrink-0">{s.name[0]}</div>
                              <span className="text-sm font-medium text-gray-900">{s.name}</span>
                            </div>
                          </td>
                          <td className="px-3 py-3 text-center text-sm font-semibold text-green-600">{s.workDays}</td>
                          <td className="px-3 py-3 text-center"><span className={`text-sm font-semibold ${s.absentDays > 0 ? 'text-red-500' : 'text-gray-300'}`}>{s.absentDays}</span></td>
                          <td className="px-3 py-3 text-center">
                            {s.lateTimes > 0 ? <span className="text-xs px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 font-semibold">{s.lateTimes}회</span> : <span className="text-gray-300 text-sm">-</span>}
                          </td>
                          <td className="px-3 py-3 text-center">
                            {s.earlyLeaveTimes > 0 ? <span className="text-xs px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-700 font-semibold">{s.earlyLeaveTimes}회</span> : <span className="text-gray-300 text-sm">-</span>}
                          </td>
                          <td className="px-3 py-3 text-center text-xs text-gray-500 hidden sm:table-cell">{s.avgCheckIn || '-'}</td>
                          <td className="px-3 py-3 text-center text-xs text-gray-500 hidden sm:table-cell">{s.avgCheckOut || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 상세: 일별 기록 */}
              {selectedEmployee && (
                <div className="flex flex-col flex-1 bg-white border border-gray-200 rounded-xl overflow-hidden min-h-[400px] md:min-h-0">
                  <div className="px-5 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between flex-shrink-0">
                    <div className="flex items-center gap-2">
                      <button onClick={() => setSelectedEmployee(null)} className="md:hidden text-gray-400 hover:text-gray-600 mr-1">← 목록</button>
                      <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-600">{selectedEmployee[0]}</div>
                      <span className="text-sm font-semibold text-gray-800">{selectedEmployee}</span>
                      {(() => {
                        const sched = schedules.find(s => s.employee_name === selectedEmployee)
                        return sched ? (
                          <span className="text-xs text-gray-400 hidden sm:inline">{sched.work_start} ~ {sched.work_end}</span>
                        ) : null
                      })()}
                    </div>
                    {(() => {
                      const s = summaries.find(x => x.name === selectedEmployee)!
                      return (
                        <div className="flex gap-1.5 text-xs">
                          <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded font-medium">출근 {s.workDays}일</span>
                          {s.absentDays > 0 && <span className="bg-red-100 text-red-600 px-2 py-0.5 rounded font-medium">결근 {s.absentDays}일</span>}
                          {s.lateTimes > 0 && <span className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded font-medium">지각 {s.lateTimes}회</span>}
                        </div>
                      )
                    })()}
                  </div>
                  <div className="overflow-auto flex-1">
                    <table className="w-full min-w-[360px]">
                      <thead className="sticky top-0 bg-gray-50 z-10">
                        <tr className="border-b border-gray-100">
                          <th className="text-left text-xs font-semibold text-gray-400 px-4 py-2.5">날짜</th>
                          <th className="text-center text-xs font-semibold text-gray-400 px-3 py-2.5">출근</th>
                          <th className="text-center text-xs font-semibold text-gray-400 px-3 py-2.5">퇴근</th>
                          <th className="text-center text-xs font-semibold text-gray-400 px-3 py-2.5">근무</th>
                          <th className="text-left text-xs font-semibold text-gray-400 px-3 py-2.5">비고</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {detailDays.map(day => {
                          const isSun = day.dow === 0, isSat = day.dow === 6
                          const r = day.record
                          return (
                            <tr key={day.date} className={
                              day.type === 'holiday' ? 'bg-blue-50/40' :
                              day.type === 'absent' ? 'bg-red-50/40' : 'hover:bg-gray-50'
                            }>
                              <td className="px-4 py-2.5">
                                <span className={`text-sm font-medium ${isSun ? 'text-red-500' : isSat ? 'text-blue-400' : 'text-gray-800'}`}>
                                  {day.date.slice(5)} ({DAY_KR[day.dow]})
                                </span>
                              </td>
                              <td className="px-3 py-2.5 text-center">
                                {day.type === 'holiday' ? <span className="text-xs text-blue-500">공휴일</span> :
                                 day.type === 'absent' ? <span className="text-xs text-red-400">결근</span> :
                                 <span className={`text-sm ${r?.late_minutes && r.late_minutes > 0 ? 'text-orange-600 font-semibold' : 'text-gray-700'}`}>{r?.check_in || '-'}</span>}
                              </td>
                              <td className="px-3 py-2.5 text-center">
                                {day.type !== 'record' ? '-' :
                                 <span className={`text-sm ${r?.early_leave_minutes && r.early_leave_minutes > 0 ? 'text-yellow-600 font-semibold' : 'text-gray-700'}`}>{r?.check_out || '-'}</span>}
                              </td>
                              <td className="px-3 py-2.5 text-center text-sm text-gray-500">
                                {r?.work_minutes ? minutesToHHMM(r.work_minutes) : '-'}
                              </td>
                              <td className="px-3 py-2.5">
                                <div className="flex gap-1 flex-wrap">
                                  {day.type === 'holiday' && <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-600 font-medium">{day.holidayName}</span>}
                                  {r?.late_minutes && r.late_minutes > 0 ? <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 font-medium">지각 {r.late_minutes}분</span> : null}
                                  {r?.early_leave_minutes && r.early_leave_minutes > 0 && r.check_out ? <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-700 font-medium">조퇴 {r.early_leave_minutes}분</span> : null}
                                  {day.type === 'record' && !r?.check_out && <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">퇴근기록 없음</span>}
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ── 설정 탭 ── */}
      {tab === 'settings' && isAdmin && (
        <div className="space-y-6">
          {/* 직원별 근무시간 */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
              <h2 className="text-sm font-semibold text-gray-700">직원별 근무시간</h2>
              <p className="text-xs text-gray-400 mt-0.5">지각/조퇴 판단 기준 시간 — 미설정 시 09:00~18:00 적용</p>
            </div>
            <div className="divide-y divide-gray-50">
              {employeeNames.length === 0 && (
                <p className="px-5 py-6 text-sm text-gray-400 text-center">엑셀 업로드 후 직원 목록이 표시됩니다</p>
              )}
              {employeeNames.map(name => {
                const sched = schedules.find(s => s.employee_name === name)
                const editing = editingSchedules[name]
                const displayStart = editing ? editing.start : (sched?.work_start ?? '09:00')
                const displayEnd = editing ? editing.end : (sched?.work_end ?? '18:00')
                return (
                  <div key={name} className="flex items-center gap-3 px-5 py-3 flex-wrap">
                    <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-600 flex-shrink-0">{name[0]}</div>
                    <span className="text-sm font-medium text-gray-800 w-20">{name}</span>
                    <div className="flex items-center gap-2 flex-1">
                      <input type="time" value={displayStart}
                        onChange={e => setEditingSchedules(prev => ({ ...prev, [name]: { start: e.target.value, end: editing?.end ?? displayEnd } }))}
                        className={`${inp} w-32`} />
                      <span className="text-gray-400 text-sm">~</span>
                      <input type="time" value={displayEnd}
                        onChange={e => setEditingSchedules(prev => ({ ...prev, [name]: { start: editing?.start ?? displayStart, end: e.target.value } }))}
                        className={`${inp} w-32`} />
                    </div>
                    {editing ? (
                      <div className="flex gap-1.5">
                        <button onClick={() => handleSaveSchedule(name)} disabled={isPending}
                          className="px-3 py-1.5 text-xs font-semibold rounded-lg text-gray-900 disabled:opacity-50"
                          style={{ backgroundColor: '#FFCE00' }}>저장</button>
                        <button onClick={() => setEditingSchedules(prev => { const n = { ...prev }; delete n[name]; return n })}
                          className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50">취소</button>
                      </div>
                    ) : (
                      <button onClick={() => setEditingSchedules(prev => ({ ...prev, [name]: { start: displayStart, end: displayEnd } }))}
                        className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50">
                        수정
                      </button>
                    )}
                    {sched && !editing && <span className="text-[10px] text-green-600 bg-green-50 px-1.5 py-0.5 rounded">설정됨</span>}
                  </div>
                )
              })}
            </div>
          </div>

          {/* 공휴일 관리 */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-gray-700">공휴일 관리</h2>
                <p className="text-xs text-gray-400 mt-0.5">공휴일은 결근으로 집계되지 않아요</p>
              </div>
              <span className="text-xs text-gray-400">{holidays.length}일 등록</span>
            </div>
            {/* 추가 폼 */}
            <div className="px-5 py-3 border-b border-gray-100 flex gap-2 flex-wrap">
              <input type="date" value={newHolidayDate} onChange={e => setNewHolidayDate(e.target.value)}
                className={inp} style={{ appearance: 'auto' } as React.CSSProperties} />
              <input type="text" value={newHolidayName} onChange={e => setNewHolidayName(e.target.value)}
                placeholder="공휴일 이름 (예: 추석)" className={`${inp} flex-1 min-w-[120px]`} />
              <button onClick={handleAddHoliday} disabled={isPending || !newHolidayDate || !newHolidayName}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg text-gray-900 disabled:opacity-40"
                style={{ backgroundColor: '#FFCE00' }}>추가</button>
            </div>
            {/* 목록 */}
            <div className="overflow-auto max-h-80">
              <table className="w-full">
                <thead className="sticky top-0 bg-gray-50">
                  <tr className="border-b border-gray-100">
                    <th className="text-left text-xs font-semibold text-gray-400 px-5 py-2.5">날짜</th>
                    <th className="text-left text-xs font-semibold text-gray-400 px-4 py-2.5">공휴일명</th>
                    <th className="text-left text-xs font-semibold text-gray-400 px-4 py-2.5 hidden sm:table-cell">요일</th>
                    <th className="px-4 py-2.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {holidays.map(h => {
                    const d = new Date(h.holiday_date)
                    const dow = d.getDay()
                    return (
                      <tr key={h.id} className="hover:bg-gray-50">
                        <td className="px-5 py-2.5 text-sm text-gray-700">{h.holiday_date}</td>
                        <td className="px-4 py-2.5 text-sm text-gray-700">{h.name}</td>
                        <td className={`px-4 py-2.5 text-xs hidden sm:table-cell ${dow === 0 ? 'text-red-500' : dow === 6 ? 'text-blue-400' : 'text-gray-400'}`}>
                          {DAY_KR[dow]}요일
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <button onClick={() => handleDeleteHoliday(h.id)} className="text-xs text-red-400 hover:text-red-600">삭제</button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── 미리보기 모달 ── */}
      {previewRecords && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setPreviewRecords(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-1">업로드 미리보기</h2>
            <p className="text-xs text-gray-400 mb-4">
              {previewRecords[0]?.year_month?.replace('-', '년 ').replace(/(\d+)$/, m => `${parseInt(m)}월`)} — 총 {previewRecords.length}건
              {holidayMap.size > 0 && <span className="ml-1 text-blue-500">(공휴일 제외 적용됨)</span>}
            </p>
            <div className="bg-gray-50 rounded-xl overflow-hidden mb-5">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left text-xs font-semibold text-gray-400 px-4 py-2">직원</th>
                    <th className="text-center text-xs font-semibold text-gray-400 px-3 py-2">근무일</th>
                    <th className="text-center text-xs font-semibold text-gray-400 px-3 py-2">출근</th>
                    <th className="text-center text-xs font-semibold text-gray-400 px-3 py-2">결근</th>
                    <th className="text-center text-xs font-semibold text-gray-400 px-3 py-2">지각</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {buildSummaries(previewRecords).map(s => (
                    <tr key={s.name}>
                      <td className="px-4 py-2 text-sm font-medium text-gray-800">{s.name}</td>
                      <td className="px-3 py-2 text-center text-sm text-gray-600">{s.workDays + s.absentDays}일</td>
                      <td className="px-3 py-2 text-center text-sm text-green-600 font-semibold">{s.workDays}</td>
                      <td className="px-3 py-2 text-center text-sm"><span className={s.absentDays > 0 ? 'text-red-500 font-semibold' : 'text-gray-300'}>{s.absentDays}</span></td>
                      <td className="px-3 py-2 text-center text-sm"><span className={s.lateTimes > 0 ? 'text-orange-600 font-semibold' : 'text-gray-300'}>{s.lateTimes}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-gray-400 mb-4">⚠️ 같은 월 기존 데이터가 있으면 덮어씌워집니다.</p>
            <div className="flex gap-2">
              <button onClick={() => setPreviewRecords(null)}
                className="flex-1 px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600">취소</button>
              <button onClick={handleConfirm} disabled={isPending}
                className="flex-1 px-4 py-2 text-sm font-semibold rounded-lg disabled:opacity-50"
                style={{ backgroundColor: '#FFCE00', color: '#121212' }}>
                {isPending ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
