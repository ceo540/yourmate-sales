'use client'
import { useState } from 'react'

/* ── 타입 ── */
type LeaveType = '연차' | '반차(오전)' | '반차(오후)' | '병가' | '공가' | '경조사'
type ApprovalStatus = '대기' | '승인' | '반려'

interface Member {
  id: string; name: string; role: string; joinDate: string
  totalDays: number; usedDays: number
}

interface Leave {
  id: string; memberId: string; memberName: string
  type: LeaveType; startDate: string; endDate: string
  days: number; reason: string
  directorApproval: ApprovalStatus
  ceoApproval: ApprovalStatus
  createdAt: string
}

/* ── 목업 데이터 ── */
const MEMBERS: Member[] = [
  { id: '1', name: '방준영', role: '대표', joinDate: '2019-03-01', usedDays: 2 },
  { id: '3', name: '조민현', role: '팀장', joinDate: '2021-06-15', usedDays: 7 },
  { id: '2', name: '정태범', role: '팀원', joinDate: '2024-07-22', usedDays: 12 },
  { id: '4', name: '유제민', role: '팀원', joinDate: '2023-01-02', usedDays: 4 },
].map(m => ({ ...m, totalDays: calcAnnualLeave(m.joinDate) }))

const INITIAL_LEAVES: Leave[] = [
  { id: '1', memberId: '2', memberName: '정태범', type: '연차', startDate: '2026-04-06', endDate: '2026-04-06', days: 1, reason: '개인 사정', directorApproval: '대기', ceoApproval: '대기', createdAt: '2026-04-03' },
  { id: '7', memberId: '3', memberName: '조민현', type: '연차', startDate: '2026-04-10', endDate: '2026-04-11', days: 2, reason: '가족 행사', directorApproval: '대기', ceoApproval: '대기', createdAt: '2026-04-02' },
  { id: '2', memberId: '2', memberName: '정태범', type: '연차', startDate: '2026-03-11', endDate: '2026-03-13', days: 3, reason: '여행', directorApproval: '승인', ceoApproval: '승인', createdAt: '2026-03-05' },
  { id: '3', memberId: '2', memberName: '정태범', type: '연차', startDate: '2026-02-05', endDate: '2026-02-06', days: 2, reason: '개인 사정', directorApproval: '승인', ceoApproval: '승인', createdAt: '2026-02-01' },
  { id: '4', memberId: '2', memberName: '정태범', type: '반차(오후)', startDate: '2025-12-29', endDate: '2025-12-29', days: 0.5, reason: '병원', directorApproval: '승인', ceoApproval: '대기', createdAt: '2025-12-28' },
  { id: '5', memberId: '2', memberName: '정태범', type: '연차', startDate: '2025-11-24', endDate: '2025-11-24', days: 1, reason: '개인 사정', directorApproval: '승인', ceoApproval: '승인', createdAt: '2025-11-20' },
  { id: '6', memberId: '2', memberName: '정태범', type: '반차(오전)', startDate: '2025-11-21', endDate: '2025-11-21', days: 0.5, reason: '관공서 방문', directorApproval: '승인', ceoApproval: '승인', createdAt: '2025-11-19' },
  { id: '8', memberId: '4', memberName: '유제민', type: '병가', startDate: '2026-03-10', endDate: '2026-03-11', days: 2, reason: '독감', directorApproval: '승인', ceoApproval: '승인', createdAt: '2026-03-10' },
]

const LEAVE_TYPES: LeaveType[] = ['연차', '반차(오전)', '반차(오후)', '병가', '공가', '경조사']
const LEAVE_DAYS: Record<LeaveType, number> = {
  '연차': 1, '반차(오전)': 0.5, '반차(오후)': 0.5, '병가': 1, '공가': 0, '경조사': 0,
}
const APPROVAL_BADGE: Record<ApprovalStatus, string> = {
  '대기': 'bg-yellow-100 text-yellow-700',
  '승인': 'bg-green-100 text-green-700',
  '반려': 'bg-red-100 text-red-500',
}
const TYPE_BADGE: Record<string, string> = {
  '연차': 'bg-blue-50 text-blue-700',
  '반차(오전)': 'bg-purple-50 text-purple-700',
  '반차(오후)': 'bg-purple-50 text-purple-700',
  '병가': 'bg-orange-50 text-orange-700',
  '공가': 'bg-gray-100 text-gray-600',
  '경조사': 'bg-pink-50 text-pink-700',
}
const ROLE_COLOR: Record<string, string> = {
  '대표': 'bg-yellow-100 text-yellow-800 border-yellow-300',
  '팀장': 'bg-blue-100 text-blue-800 border-blue-300',
  '팀원': 'bg-gray-100 text-gray-700 border-gray-300',
}

// ── 근로기준법 법정 연차 계산 ──────────────────────────────────────
// 1년 미만: 매월 개근 시 1일 (최대 11일)
// 1년 이상: min(15 + floor((근속연수 - 1) / 2), 25일)
function calcAnnualLeave(joinDate: string): number {
  const join = new Date(joinDate)
  const today = new Date(2026, 3, 3) // 기준일: 2026-04-03
  const totalMonths =
    (today.getFullYear() - join.getFullYear()) * 12 +
    (today.getMonth() - join.getMonth())
  if (totalMonths < 12) return Math.min(totalMonths, 11)
  const years = Math.floor(totalMonths / 12)
  return Math.min(15 + Math.floor((years - 1) / 2), 25)
}

function calcTenure(joinDate: string): string {
  const join = new Date(joinDate)
  const today = new Date(2026, 3, 3)
  const totalMonths = (today.getFullYear() - join.getFullYear()) * 12 + (today.getMonth() - join.getMonth())
  if (totalMonths < 12) return `${totalMonths}개월`
  const y = Math.floor(totalMonths / 12)
  const m = totalMonths % 12
  return m > 0 ? `${y}년 ${m}개월` : `${y}년`
}
function getCalendarDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const days: (number | null)[] = Array(firstDay).fill(null)
  for (let i = 1; i <= daysInMonth; i++) days.push(i)
  return days
}
function dateStr(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}
function overallStatus(l: Leave): '승인' | '반려' | '진행중' | '대기' {
  if (l.directorApproval === '반려' || l.ceoApproval === '반려') return '반려'
  if (l.directorApproval === '승인' && l.ceoApproval === '승인') return '승인'
  if (l.directorApproval === '승인') return '진행중'
  return '대기'
}

export default function HrDemoPage() {
  const [viewAs, setViewAs] = useState<string>('1') // default: 방준영(대표)
  const [tab, setTab] = useState<'overview' | 'requests' | 'calendar'>('overview')
  const [leaves, setLeaves] = useState<Leave[]>(INITIAL_LEAVES)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ memberId: '2', type: '연차' as LeaveType, startDate: '', endDate: '', reason: '' })
  const [calYear, setCalYear] = useState(2026)
  const [calMonth, setCalMonth] = useState(3)

  /* 현재 로그인 유저 */
  const viewer = MEMBERS.find(m => m.id === viewAs)!
  const isCEO = viewer.role === '대표'
  const isManager = viewer.role === '팀장'
  const isMember = viewer.role === '팀원'

  /* 역할별 보이는 데이터 — 대표만 전체, 팀장/팀원은 본인것만 */
  const visibleLeaves = isCEO
    ? leaves
    : leaves.filter(l => l.memberId === viewAs)

  /* 승인 */
  function handleApproval(id: string, level: 'director' | 'ceo', status: '승인' | '반려') {
    setLeaves(prev => prev.map(l => {
      if (l.id !== id) return l
      if (level === 'director') return { ...l, directorApproval: status }
      return { ...l, ceoApproval: status }
    }))
  }

  /* 휴가 신청 */
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const member = MEMBERS.find(m => m.id === form.memberId)!
    const days = LEAVE_DAYS[form.type] || 1
    setLeaves(prev => [{
      id: String(Date.now()),
      memberId: form.memberId,
      memberName: member.name,
      type: form.type,
      startDate: form.startDate,
      endDate: form.endDate || form.startDate,
      days,
      reason: form.reason,
      directorApproval: '대기',
      ceoApproval: '대기',
      createdAt: '2026-04-03',
    }, ...prev])
    setShowForm(false)
    setForm({ memberId: isCEO ? '2' : viewAs, type: '연차', startDate: '', endDate: '', reason: '' })
    setTab('requests')
  }

  /* 요약 (팀원은 본인 기준) */
  const pendingCount = visibleLeaves.filter(l => overallStatus(l) === '대기' || overallStatus(l) === '진행중').length
  const thisMonthApproved = visibleLeaves.filter(l => overallStatus(l) === '승인' && l.startDate.startsWith('2026-04')).length
  const yearTotal = visibleLeaves.filter(l => overallStatus(l) === '승인' && l.startDate.startsWith('2026')).reduce((s, l) => s + l.days, 0)

  const calDays = getCalendarDays(calYear, calMonth)
  const approvedLeaves = visibleLeaves.filter(l => overallStatus(l) === '승인')
  function getLeaveOnDay(day: number) {
    const ds = dateStr(calYear, calMonth, day)
    return approvedLeaves.filter(l => l.startDate <= ds && l.endDate >= ds)
  }

  const inp = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-300 bg-white'
  const lbl = 'block text-xs font-medium text-gray-500 mb-1'

  /* 팀원 본인 데이터 */
  const myData = MEMBERS.find(m => m.id === viewAs)!

  return (
    <div className="max-w-5xl mx-auto space-y-5">

      {/* ── 역할 전환 바 (데모용) ── */}
      <div className="bg-gray-900 rounded-xl px-4 py-3">
        <p className="text-xs text-gray-400 mb-2.5 font-medium">👁️ 데모 뷰 전환 — 역할별로 다른 화면을 확인해보세요</p>
        <div className="flex gap-2 flex-wrap">
          {MEMBERS.map(m => (
            <button
              key={m.id}
              onClick={() => { setViewAs(m.id); setTab('overview') }}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                viewAs === m.id
                  ? 'bg-white text-gray-900 border-white shadow'
                  : 'bg-gray-800 text-gray-300 border-gray-700 hover:bg-gray-700'
              }`}
            >
              <div className="w-5 h-5 rounded-full bg-gray-600 flex items-center justify-center text-[10px] font-bold text-white">
                {m.name[0]}
              </div>
              {m.name}
              <span className={`text-[10px] px-1.5 py-0.5 rounded border ${viewAs === m.id ? ROLE_COLOR[m.role] : 'bg-gray-700 text-gray-400 border-gray-600'}`}>
                {m.role}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* ── 헤더 ── */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-bold text-gray-900">인사 관리</h1>
            <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 font-medium">데모</span>
            {/* 현재 뷰 역할 뱃지 */}
            <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${ROLE_COLOR[viewer.role]}`}>
              {viewer.name} ({viewer.role})으로 보는 중
            </span>
          </div>
          <p className="text-sm text-gray-400">
            {isCEO ? '전체 팀원 휴가 현황 및 결재 관리' : '내 휴가 현황 및 신청'}
          </p>
        </div>
        <button onClick={() => { setShowForm(true); if (isMember) setForm(f => ({ ...f, memberId: viewAs })) }}
          className="px-4 py-2 text-sm font-semibold rounded-lg"
          style={{ backgroundColor: '#FFCE00', color: '#121212' }}>
          + 휴가 신청
        </button>
      </div>

      {/* ── 요약 카드 ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {!isCEO ? (
          // 팀장/팀원: 본인 연차 요약
          <>
            <div className="bg-white border border-gray-200 rounded-xl px-4 py-3">
              <p className="text-xs text-gray-400 mb-1">발생 연차</p>
              <p className="text-2xl font-bold text-gray-800">{myData.totalDays}일</p>
            </div>
            <div className="bg-blue-50 border border-gray-200 rounded-xl px-4 py-3">
              <p className="text-xs text-gray-400 mb-1">사용 연차</p>
              <p className="text-2xl font-bold text-blue-600">{myData.usedDays}일</p>
            </div>
            <div className={`border border-gray-200 rounded-xl px-4 py-3 ${myData.totalDays - myData.usedDays <= 3 ? 'bg-red-50' : 'bg-green-50'}`}>
              <p className="text-xs text-gray-400 mb-1">잔여 연차</p>
              <p className={`text-2xl font-bold ${myData.totalDays - myData.usedDays <= 3 ? 'text-red-500' : 'text-green-600'}`}>{myData.totalDays - myData.usedDays}일</p>
            </div>
            <div className={`border border-gray-200 rounded-xl px-4 py-3 ${pendingCount > 0 ? 'bg-yellow-50' : 'bg-white'}`}>
              <p className="text-xs text-gray-400 mb-1">대기 중</p>
              <p className={`text-2xl font-bold ${pendingCount > 0 ? 'text-yellow-700' : 'text-gray-400'}`}>{pendingCount}건</p>
            </div>
          </>
        ) : (
          // 대표/팀장: 팀 전체 요약
          <>
            <div className="bg-white border border-gray-200 rounded-xl px-4 py-3">
              <p className="text-xs text-gray-400 mb-1">팀원 수</p>
              <p className="text-2xl font-bold text-gray-800">{MEMBERS.length}명</p>
            </div>
            <div className="bg-blue-50 border border-gray-200 rounded-xl px-4 py-3">
              <p className="text-xs text-gray-400 mb-1">이번 달 승인</p>
              <p className="text-2xl font-bold text-blue-600">{thisMonthApproved}건</p>
            </div>
            <div className={`border border-gray-200 rounded-xl px-4 py-3 ${pendingCount > 0 ? 'bg-yellow-50' : 'bg-white'}`}>
              <p className="text-xs text-gray-400 mb-1">승인 대기</p>
              <p className={`text-2xl font-bold ${pendingCount > 0 ? 'text-yellow-700' : 'text-gray-400'}`}>{pendingCount}건</p>
            </div>
            <div className="bg-green-50 border border-gray-200 rounded-xl px-4 py-3">
              <p className="text-xs text-gray-400 mb-1">올해 총 사용</p>
              <p className="text-2xl font-bold text-green-600">{yearTotal}일</p>
            </div>
          </>
        )}
      </div>

      {/* ── 탭 ── */}
      <div className="flex gap-1 border-b border-gray-200">
        {([
          ['overview', isCEO ? '👥 연차 현황' : '📋 내 연차 현황'],
          ['requests', `📋 ${isCEO ? '신청 목록' : '내 신청'}${pendingCount > 0 ? ` (${pendingCount})` : ''}`],
          ['calendar', '📅 달력'],
        ] as const).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              tab === key ? 'border-yellow-400 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}>
            {label}
          </button>
        ))}
      </div>

      {/* ── 탭 1: 연차 현황 ── */}
      {tab === 'overview' && (
        <div className="space-y-4">

          {/* 팀장/팀원 뷰: 본인 카드만 */}
          {!isCEO && (
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-base font-bold text-gray-600">
                  {myData.name[0]}
                </div>
                <div>
                  <p className="text-base font-bold text-gray-900">{myData.name}</p>
                  <p className="text-xs text-gray-400">입사 {myData.joinDate} · 근속 {calcTenure(myData.joinDate)}</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3 mb-4">
                {[
                  { label: '발생 연차', value: `${myData.totalDays}일`, color: 'text-gray-800' },
                  { label: '사용 연차', value: `${myData.usedDays}일`, color: 'text-blue-600' },
                  { label: '잔여 연차', value: `${myData.totalDays - myData.usedDays}일`, color: myData.totalDays - myData.usedDays <= 3 ? 'text-red-500' : 'text-green-600' },
                ].map(s => (
                  <div key={s.label} className="bg-gray-50 rounded-lg px-3 py-3 text-center">
                    <p className="text-xs text-gray-400 mb-1">{s.label}</p>
                    <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                  </div>
                ))}
              </div>
              <div className="mb-2">
                <div className="flex justify-between text-xs text-gray-400 mb-1">
                  <span>사용률</span>
                  <span>{Math.round(myData.usedDays / myData.totalDays * 100)}%</span>
                </div>
                <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      myData.usedDays / myData.totalDays >= 0.8 ? 'bg-red-400' :
                      myData.usedDays / myData.totalDays >= 0.6 ? 'bg-yellow-400' : 'bg-green-400'
                    }`}
                    style={{ width: `${Math.round(myData.usedDays / myData.totalDays * 100)}%` }}
                  />
                </div>
              </div>
              {/* 최근 신청 */}
              <div className="mt-4">
                <p className="text-xs font-semibold text-gray-500 mb-2">최근 신청 내역</p>
                <div className="space-y-2">
                  {visibleLeaves.slice(0, 3).map(l => {
                    const os = overallStatus(l)
                    return (
                      <div key={l.id} className="flex items-center justify-between text-xs bg-gray-50 rounded-lg px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span className={`px-1.5 py-0.5 rounded font-medium ${TYPE_BADGE[l.type]}`}>{l.type}</span>
                          <span className="text-gray-500">{l.startDate === l.endDate ? l.startDate : `${l.startDate} ~ ${l.endDate}`}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-gray-400">이사</span>
                          <span className={`px-1.5 py-0.5 rounded font-medium ${APPROVAL_BADGE[l.directorApproval]}`}>{l.directorApproval}</span>
                          <span className="text-gray-400">대표</span>
                          <span className={`px-1.5 py-0.5 rounded font-medium ${APPROVAL_BADGE[l.ceoApproval]}`}>{l.ceoApproval}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {/* 대표 뷰: 전체 테이블 */}
          {isCEO && (
            <>
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
                  <h2 className="text-sm font-semibold text-gray-700">연차 휴가 현황</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[560px]">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-left text-xs font-semibold text-gray-400 px-5 py-3">이름</th>
                        <th className="text-left text-xs font-semibold text-gray-400 px-4 py-3">입사일</th>
                        <th className="text-center text-xs font-semibold text-gray-400 px-4 py-3">근속</th>
                        <th className="text-center text-xs font-semibold text-gray-400 px-4 py-3">발생</th>
                        <th className="text-center text-xs font-semibold text-gray-400 px-4 py-3">사용</th>
                        <th className="text-center text-xs font-semibold text-gray-400 px-4 py-3">잔여</th>
                        <th className="text-left text-xs font-semibold text-gray-400 px-4 py-3 hidden sm:table-cell">사용률</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {MEMBERS.map(m => {
                        const remaining = m.totalDays - m.usedDays
                        const pct = Math.round((m.usedDays / m.totalDays) * 100)
                        return (
                          <tr key={m.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-5 py-3">
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-600 flex-shrink-0">
                                  {m.name[0]}
                                </div>
                                <div>
                                  <p className="text-sm font-semibold text-gray-900">{m.name}</p>
                                  <p className="text-xs text-gray-400">{m.role}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-500">{m.joinDate}</td>
                            <td className="px-4 py-3 text-xs text-center text-gray-600">{calcTenure(m.joinDate)}</td>
                            <td className="px-4 py-3 text-sm font-semibold text-center text-gray-800">{m.totalDays}일</td>
                            <td className="px-4 py-3 text-sm text-center text-blue-600 font-medium">{m.usedDays}일</td>
                            <td className="px-4 py-3 text-center">
                              <span className={`text-sm font-bold ${remaining <= 3 ? 'text-red-500' : remaining <= 7 ? 'text-yellow-600' : 'text-green-600'}`}>{remaining}일</span>
                            </td>
                            <td className="px-4 py-3 hidden sm:table-cell">
                              <div className="flex items-center gap-2">
                                <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden min-w-[60px]">
                                  <div className={`h-full rounded-full ${pct >= 80 ? 'bg-red-400' : pct >= 60 ? 'bg-yellow-400' : 'bg-green-400'}`} style={{ width: `${pct}%` }} />
                                </div>
                                <span className="text-xs text-gray-400 w-8 text-right">{pct}%</span>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 최근 신청 미리보기 */}
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-gray-700">최근 신청 내역</h2>
                  <button onClick={() => setTab('requests')} className="text-xs text-gray-400 hover:text-gray-600">전체 보기 →</button>
                </div>
                <div className="divide-y divide-gray-50">
                  {leaves.slice(0, 4).map(l => (
                    <div key={l.id} className="flex items-center gap-3 px-5 py-3">
                      <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-xs font-semibold text-gray-600 flex-shrink-0">
                        {l.memberName[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-gray-800">{l.memberName}</span>
                          <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${TYPE_BADGE[l.type]}`}>{l.type}</span>
                          <span className="text-xs text-gray-400">{l.days}일</span>
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">{l.startDate === l.endDate ? l.startDate : `${l.startDate} ~ ${l.endDate}`}</p>
                      </div>
                      <div className="flex gap-1.5 items-center flex-shrink-0">
                        <span className="text-[10px] text-gray-400 hidden sm:inline">이사</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${APPROVAL_BADGE[l.directorApproval]}`}>{l.directorApproval}</span>
                        <span className="text-[10px] text-gray-400 hidden sm:inline">대표</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${APPROVAL_BADGE[l.ceoApproval]}`}>{l.ceoApproval}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── 탭 2: 신청 목록 ── */}
      {tab === 'requests' && (
        <div className="space-y-3">
          {/* 권한 안내 */}
          <div className={`text-xs px-3 py-2 rounded-lg ${
            isCEO ? 'bg-yellow-50 text-yellow-700' : isManager ? 'bg-blue-50 text-blue-700' : 'bg-gray-50 text-gray-500'
          }`}>
            {isCEO ? '✅ 대표: 이사 승인 완료 건에 대해 최종 결재할 수 있어요.' : '📋 내가 신청한 휴가 목록이에요. 이사 → 대표 순으로 결재가 진행됩니다.'}
          </div>

          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px]">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    {isCEO && <th className="text-left text-xs font-semibold text-gray-400 px-4 py-3">신청자</th>}
                    <th className="text-left text-xs font-semibold text-gray-400 px-4 py-3">유형</th>
                    <th className="text-left text-xs font-semibold text-gray-400 px-4 py-3">기간</th>
                    <th className="text-left text-xs font-semibold text-gray-400 px-4 py-3 hidden sm:table-cell">사유</th>
                    <th className="text-center text-xs font-semibold text-gray-400 px-3 py-3">
                      이사 승인
                    </th>
                    <th className="text-center text-xs font-semibold text-gray-400 px-3 py-3">
                      대표 승인
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {visibleLeaves.length === 0 ? (
                    <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-gray-400">신청 내역이 없어요.</td></tr>
                  ) : visibleLeaves.map(l => {
                    const directorPending = l.directorApproval === '대기'
                    const ceoPending = l.ceoApproval === '대기' && l.directorApproval === '승인'

                    // 대표만 결재 가능
                    const canDirectorApprove = false
                    const canCEOApprove = isCEO && ceoPending

                    return (
                      <tr key={l.id} className="hover:bg-gray-50 transition-colors">
                        {isCEO && (
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-xs font-semibold text-gray-600">{l.memberName[0]}</div>
                              <span className="text-sm font-medium text-gray-800">{l.memberName}</span>
                            </div>
                          </td>
                        )}
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TYPE_BADGE[l.type]}`}>{l.type}</span>
                          <span className="text-xs text-gray-400 ml-1.5">{l.days}일</span>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-600">
                          {l.startDate === l.endDate ? l.startDate : `${l.startDate} ~ ${l.endDate}`}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500 max-w-[100px] truncate hidden sm:table-cell">{l.reason || '-'}</td>

                        {/* 이사 승인 */}
                        <td className="px-3 py-3 text-center">
                          {canDirectorApprove ? (
                            <div className="flex gap-1 justify-center">
                              <button onClick={() => handleApproval(l.id, 'director', '승인')} className="px-2 py-0.5 text-xs font-semibold rounded bg-green-100 text-green-700 hover:bg-green-200">승인</button>
                              <button onClick={() => handleApproval(l.id, 'director', '반려')} className="px-2 py-0.5 text-xs font-semibold rounded bg-red-50 text-red-500 hover:bg-red-100">반려</button>
                            </div>
                          ) : (
                            <span className={`text-xs px-2 py-0.5 rounded font-medium ${APPROVAL_BADGE[l.directorApproval]}`}>{l.directorApproval}</span>
                          )}
                        </td>

                        {/* 대표 승인 */}
                        <td className="px-3 py-3 text-center">
                          {canCEOApprove ? (
                            <div className="flex gap-1 justify-center">
                              <button onClick={() => handleApproval(l.id, 'ceo', '승인')} className="px-2 py-0.5 text-xs font-semibold rounded bg-green-100 text-green-700 hover:bg-green-200">승인</button>
                              <button onClick={() => handleApproval(l.id, 'ceo', '반려')} className="px-2 py-0.5 text-xs font-semibold rounded bg-red-50 text-red-500 hover:bg-red-100">반려</button>
                            </div>
                          ) : l.directorApproval !== '승인' && isCEO ? (
                            <span className="text-xs text-gray-300">-</span>
                          ) : (
                            <span className={`text-xs px-2 py-0.5 rounded font-medium ${APPROVAL_BADGE[l.ceoApproval]}`}>{l.ceoApproval}</span>
                          )}
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

      {/* ── 탭 3: 달력 ── */}
      {tab === 'calendar' && (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <button onClick={() => { if (calMonth === 0) { setCalYear(y => y - 1); setCalMonth(11) } else setCalMonth(m => m - 1) }}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 text-lg">←</button>
            <h2 className="text-base font-bold text-gray-900">{calYear}년 {calMonth + 1}월</h2>
            <button onClick={() => { if (calMonth === 11) { setCalYear(y => y + 1); setCalMonth(0) } else setCalMonth(m => m + 1) }}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 text-lg">→</button>
          </div>
          {!isCEO && (
            <p className="text-xs text-gray-400 mb-3">내 승인된 휴가만 표시됩니다.</p>
          )}
          <div className="grid grid-cols-7 mb-2">
            {['일', '월', '화', '수', '목', '금', '토'].map((d, i) => (
              <div key={d} className={`text-center text-xs font-semibold py-2 ${i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-gray-400'}`}>{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {calDays.map((day, i) => {
              if (!day) return <div key={i} />
              const dayLeaves = getLeaveOnDay(day)
              const isToday = 2026 === calYear && 3 === calMonth && 3 === day
              const isSun = (i % 7 === 0), isSat = (i % 7 === 6)
              return (
                <div key={i} className={`min-h-[60px] p-1 rounded-lg border ${isToday ? 'border-yellow-400 bg-yellow-50' : 'border-gray-100'}`}>
                  <div className={`text-xs font-medium mb-1 ${isToday ? 'text-yellow-700' : isSun ? 'text-red-400' : isSat ? 'text-blue-400' : 'text-gray-600'}`}>{day}</div>
                  <div className="space-y-0.5">
                    {dayLeaves.slice(0, 2).map(l => (
                      <div key={l.id} className="text-[10px] px-1 py-0.5 rounded truncate font-medium" style={{ backgroundColor: '#FFCE00', color: '#121212' }}>
                        {l.memberName}
                      </div>
                    ))}
                    {dayLeaves.length > 2 && <div className="text-[10px] text-gray-400 px-1">+{dayLeaves.length - 2}명</div>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── 휴가 신청 모달 ── */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowForm(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-1">휴가 신청</h2>
            <p className="text-xs text-gray-400 mb-4">이사 → 대표 순으로 결재가 진행됩니다.</p>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* 대표만 신청자 선택, 팀장/팀원은 본인 고정 */}
              {!isCEO ? (
                <div className="bg-gray-50 rounded-lg px-3 py-2 text-sm font-medium text-gray-700">
                  신청자: {viewer.name} ({viewer.role})
                </div>
              ) : (
                <div>
                  <label className={lbl}>신청자</label>
                  <select className={inp} value={form.memberId} onChange={e => setForm(f => ({ ...f, memberId: e.target.value }))}>
                    {MEMBERS.map(m => <option key={m.id} value={m.id}>{m.name} ({m.role})</option>)}
                  </select>
                </div>
              )}
              <div>
                <label className={lbl}>휴가 유형</label>
                <select className={inp} value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as LeaveType }))}>
                  {LEAVE_TYPES.map(t => <option key={t} value={t}>{t} ({LEAVE_DAYS[t]}일)</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lbl}>시작일 *</label>
                  <input type="date" required className={inp} value={form.startDate}
                    onChange={e => setForm(f => ({ ...f, startDate: e.target.value, endDate: e.target.value }))}
                    style={{ appearance: 'auto' } as React.CSSProperties} />
                </div>
                <div>
                  <label className={lbl}>종료일</label>
                  <input type="date" className={inp} value={form.endDate}
                    onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}
                    style={{ appearance: 'auto' } as React.CSSProperties} />
                </div>
              </div>
              <div>
                <label className={lbl}>사유</label>
                <textarea className={inp} rows={2} value={form.reason}
                  onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
                  placeholder="간단한 사유를 입력해주세요." />
              </div>
              {(() => {
                const m = isMember ? myData : MEMBERS.find(m => m.id === form.memberId)!
                const remaining = m.totalDays - m.usedDays
                return (
                  <div className="bg-gray-50 rounded-lg px-3 py-2 text-xs text-gray-500 flex justify-between">
                    <span>{m.name} 잔여 연차</span>
                    <span className={`font-semibold ${remaining <= 3 ? 'text-red-500' : 'text-gray-700'}`}>{remaining}일</span>
                  </div>
                )
              })()}
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600">취소</button>
                <button type="submit" className="flex-1 px-4 py-2 text-sm font-semibold rounded-lg" style={{ backgroundColor: '#FFCE00', color: '#121212' }}>신청</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
