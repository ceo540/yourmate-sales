'use client'
import { useState, useTransition } from 'react'
import { createLeaveRequest, approveLeave, requestDocument } from './actions'

type LeaveType = '연차' | '반차(오전)' | '반차(오후)' | '병가' | '공가' | '경조사'
type ApprovalStatus = '대기' | '승인' | '반려'

interface Member { id: string; name: string; role: string; joinDate: string | null; annualLeave: number | null }
interface Leave {
  id: string; member_id: string; type: string
  start_date: string; end_date: string; days: number; reason: string
  director_approval: ApprovalStatus; ceo_approval: ApprovalStatus; created_at: string
}
interface DocRequest {
  id: string; member_id: string; doc_type: string
  purpose: string | null; status: string; created_at: string
}
interface Props {
  members: Member[]; initialLeaves: Leave[]
  initialDocRequests: DocRequest[]
  initialBalances: Record<string, number>
  currentUserId: string; isAdmin: boolean
}

const DOC_TYPES = ['재직증명서', '경력증명서', '근로소득원천징수영수증', '급여명세서', '기타']
const DOC_STATUS_BADGE: Record<string, string> = {
  요청: 'bg-yellow-100 text-yellow-700',
  처리중: 'bg-blue-100 text-blue-700',
  발급완료: 'bg-green-100 text-green-700',
}
const STATUS_BADGE: Record<string, string> = {
  대기: 'bg-yellow-100 text-yellow-700',
  승인: 'bg-green-100 text-green-700',
  반려: 'bg-red-100 text-red-500',
  진행중: 'bg-blue-100 text-blue-700',
}
const TYPE_BADGE: Record<string, string> = {
  연차: 'bg-blue-50 text-blue-700',
  '반차(오전)': 'bg-purple-50 text-purple-700',
  '반차(오후)': 'bg-purple-50 text-purple-700',
  병가: 'bg-orange-50 text-orange-700',
  공가: 'bg-gray-100 text-gray-600',
  경조사: 'bg-pink-50 text-pink-700',
}
const LEAVE_TYPES: LeaveType[] = ['연차', '반차(오전)', '반차(오후)', '병가', '공가', '경조사']

function overallStatus(l: Leave): string {
  if (l.director_approval === '반려' || l.ceo_approval === '반려') return '반려'
  if (l.director_approval === '승인' && l.ceo_approval === '승인') return '승인'
  if (l.director_approval === '승인') return '진행중'
  return '대기'
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

function calcTenure(joinDate: string): string {
  const join = new Date(joinDate)
  const today = new Date()
  const totalMonths = (today.getFullYear() - join.getFullYear()) * 12 + (today.getMonth() - join.getMonth())
  if (totalMonths < 12) return `${totalMonths}개월`
  const y = Math.floor(totalMonths / 12)
  const m = totalMonths % 12
  return m > 0 ? `${y}년 ${m}개월` : `${y}년`
}

export default function HrClient({ members, initialLeaves, initialDocRequests, initialBalances, currentUserId, isAdmin }: Props) {
  const today = new Date()
  const [tab, setTab] = useState<'overview' | 'requests' | 'docs' | 'calendar'>('overview')
  const [leaves, setLeaves] = useState<Leave[]>(initialLeaves)
  const [docRequests, setDocRequests] = useState<DocRequest[]>(initialDocRequests)
  const [showForm, setShowForm] = useState(false)
  const [showDocForm, setShowDocForm] = useState(false)
  const [docForm, setDocForm] = useState({ doc_type: '재직증명서', purpose: '' })
  const [form, setForm] = useState({ member_id: currentUserId, type: '연차' as LeaveType, start_date: '', end_date: '', reason: '' })
  const [calYear, setCalYear] = useState(today.getFullYear())
  const [calMonth, setCalMonth] = useState(today.getMonth())
  const [, startTransition] = useTransition()

  const memberMap = Object.fromEntries(members.map(m => [m.id, m]))
  const year = today.getFullYear()
  const monthStr = `${year}-${String(today.getMonth() + 1).padStart(2, '0')}`

  function usedDays(memberId: string) {
    const fromRequests = leaves
      .filter(l => l.member_id === memberId && l.director_approval === '승인' && l.ceo_approval === '승인')
      .reduce((s, l) => s + (l.days ?? 0), 0)
    return fromRequests + (initialBalances[memberId] ?? 0)
  }

  const visibleLeaves = isAdmin ? leaves : leaves.filter(l => l.member_id === currentUserId)
  const pendingCount = visibleLeaves.filter(l => { const s = overallStatus(l); return s === '대기' || s === '진행중' }).length
  const thisMonthApproved = leaves.filter(l => overallStatus(l) === '승인' && l.start_date.startsWith(monthStr)).length
  const yearTotal = leaves.filter(l => overallStatus(l) === '승인' && l.start_date.startsWith(String(year))).reduce((s, l) => s + (l.days ?? 0), 0)

  const me = memberMap[currentUserId]
  const myUsed = usedDays(currentUserId)
  const myTotal = me?.annualLeave ?? 0
  const myRemaining = myTotal - myUsed

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const fd = new FormData()
    Object.entries(form).forEach(([k, v]) => fd.set(k, v))
    await createLeaveRequest(fd)
    setShowForm(false)
    startTransition(() => { window.location.reload() })
  }

  async function handleApprove(id: string, level: 'director' | 'ceo', status: '승인' | '반려') {
    await approveLeave(id, level, status)
    setLeaves(prev => prev.map(l => {
      if (l.id !== id) return l
      return level === 'director'
        ? { ...l, director_approval: status }
        : { ...l, ceo_approval: status }
    }))
  }

  // 달력 관련
  const calDays = getCalendarDays(calYear, calMonth)
  const approvedLeaves = visibleLeaves.filter(l => overallStatus(l) === '승인')
  function getLeavesOnDay(day: number) {
    const ds = dateStr(calYear, calMonth, day)
    return approvedLeaves.filter(l => l.start_date <= ds && l.end_date >= ds)
  }
  function prevMonth() { if (calMonth === 0) { setCalYear(y => y - 1); setCalMonth(11) } else setCalMonth(m => m - 1) }
  function nextMonth() { if (calMonth === 11) { setCalYear(y => y + 1); setCalMonth(0) } else setCalMonth(m => m + 1) }

  return (
    <div className="space-y-4">

      {/* 요약 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {isAdmin ? (
          <>
            <div className="bg-white border border-gray-200 rounded-xl px-4 py-3">
              <p className="text-xs text-gray-400 mb-1">팀원 수</p>
              <p className="text-2xl font-bold text-gray-800">{members.length}명</p>
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
        ) : (
          <>
            <div className="bg-white border border-gray-200 rounded-xl px-4 py-3">
              <p className="text-xs text-gray-400 mb-1">발생 연차</p>
              <p className="text-2xl font-bold text-gray-800">{myTotal > 0 ? `${myTotal}일` : '-'}</p>
            </div>
            <div className="bg-blue-50 border border-gray-200 rounded-xl px-4 py-3">
              <p className="text-xs text-gray-400 mb-1">사용 연차</p>
              <p className="text-2xl font-bold text-blue-600">{myUsed}일</p>
            </div>
            <div className={`border border-gray-200 rounded-xl px-4 py-3 ${myRemaining <= 3 && myTotal > 0 ? 'bg-red-50' : 'bg-green-50'}`}>
              <p className="text-xs text-gray-400 mb-1">잔여 연차</p>
              <p className={`text-2xl font-bold ${myTotal > 0 ? (myRemaining <= 3 ? 'text-red-500' : 'text-green-600') : 'text-gray-400'}`}>
                {myTotal > 0 ? `${myRemaining}일` : '-'}
              </p>
            </div>
            <div className={`border border-gray-200 rounded-xl px-4 py-3 ${pendingCount > 0 ? 'bg-yellow-50' : 'bg-white'}`}>
              <p className="text-xs text-gray-400 mb-1">대기 중</p>
              <p className={`text-2xl font-bold ${pendingCount > 0 ? 'text-yellow-700' : 'text-gray-400'}`}>{pendingCount}건</p>
            </div>
          </>
        )}
      </div>

      {/* 탭 + 신청 버튼 */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex gap-2 flex-wrap">
          {([
            ['overview', '연차 현황'],
            ['requests', `신청 목록${pendingCount > 0 ? ` (${pendingCount})` : ''}`],
            ['docs', '서류 신청'],
            ['calendar', '달력'],
          ] as const).map(([t, label]) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
              {label}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          {tab === 'docs' && (
            <button onClick={() => setShowDocForm(true)}
              className="bg-white border border-gray-200 text-gray-700 text-sm px-4 py-2 rounded-lg hover:bg-gray-50">
              + 서류 신청
            </button>
          )}
          <button onClick={() => setShowForm(true)}
            className="bg-gray-900 text-white text-sm px-4 py-2 rounded-lg hover:bg-gray-800">
            + 연차 신청
          </button>
        </div>
      </div>

      {/* 연차 현황 탭 */}
      {tab === 'overview' && (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          {isAdmin ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead className="bg-gray-50">
                  <tr className="text-xs text-gray-500">
                    <th className="px-5 py-3 text-left">이름</th>
                    <th className="px-4 py-3 text-left">입사일</th>
                    <th className="px-4 py-3 text-center">근속</th>
                    <th className="px-4 py-3 text-center">발생</th>
                    <th className="px-4 py-3 text-center">사용</th>
                    <th className="px-4 py-3 text-center">잔여</th>
                    <th className="px-4 py-3 text-center hidden sm:table-cell">소진율</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {members.map(m => {
                    const used = usedDays(m.id)
                    const total = m.annualLeave ?? 0
                    const remaining = total - used
                    const pct = total > 0 ? Math.round(used / total * 100) : 0
                    return (
                      <tr key={m.id} className="hover:bg-gray-50">
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-600 shrink-0">
                              {m.name?.[0] ?? '?'}
                            </div>
                            <div>
                              <p className="font-medium text-gray-800">{m.name}</p>
                              <p className="text-xs text-gray-400">{m.role}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs">{m.joinDate ?? <span className="text-red-400">미입력</span>}</td>
                        <td className="px-4 py-3 text-center text-xs text-gray-600">{m.joinDate ? calcTenure(m.joinDate) : '-'}</td>
                        <td className="px-4 py-3 text-center font-semibold text-gray-800">{total > 0 ? `${total}일` : '-'}</td>
                        <td className="px-4 py-3 text-center text-blue-600 font-medium">{used > 0 ? `${used}일` : '0일'}</td>
                        <td className={`px-4 py-3 text-center font-bold ${total > 0 ? (remaining <= 3 ? 'text-red-500' : remaining <= 7 ? 'text-yellow-600' : 'text-green-600') : 'text-gray-300'}`}>
                          {total > 0 ? `${remaining}일` : '-'}
                        </td>
                        <td className="px-4 py-3 hidden sm:table-cell">
                          {total > 0 ? (
                            <div className="flex items-center gap-2">
                              <div className="flex-1 bg-gray-100 rounded-full h-2 min-w-[60px]">
                                <div className={`h-2 rounded-full ${pct >= 80 ? 'bg-red-400' : pct >= 60 ? 'bg-yellow-400' : 'bg-green-400'}`}
                                  style={{ width: `${pct}%` }} />
                              </div>
                              <span className="text-xs text-gray-400 w-8 text-right">{pct}%</span>
                            </div>
                          ) : <span className="text-xs text-gray-300">-</span>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-6 space-y-4">
              {!me?.joinDate && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 text-sm text-yellow-700">
                  입사일이 등록되지 않았어요. 관리자에게 문의하세요.
                </div>
              )}
              {me && (
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-base font-bold text-gray-600">
                    {me.name?.[0] ?? '?'}
                  </div>
                  <div>
                    <p className="text-base font-bold text-gray-900">{me.name}</p>
                    {me.joinDate && <p className="text-xs text-gray-400">입사 {me.joinDate} · 근속 {calcTenure(me.joinDate)}</p>}
                  </div>
                </div>
              )}
              {myTotal > 0 && (
                <div>
                  <div className="flex justify-between text-xs text-gray-400 mb-1">
                    <span>소진율</span><span>{Math.round(myUsed / myTotal * 100)}%</span>
                  </div>
                  <div className="bg-gray-100 rounded-full h-3">
                    <div className={`h-3 rounded-full transition-all ${myUsed/myTotal >= 0.8 ? 'bg-red-400' : myUsed/myTotal >= 0.6 ? 'bg-yellow-400' : 'bg-green-400'}`}
                      style={{ width: `${Math.round(myUsed / myTotal * 100)}%` }} />
                  </div>
                </div>
              )}
              {/* 최근 신청 내역 */}
              {visibleLeaves.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-2">최근 신청 내역</p>
                  <div className="space-y-2">
                    {visibleLeaves.slice(0, 3).map(l => {
                      const os = overallStatus(l)
                      return (
                        <div key={l.id} className="flex items-center justify-between text-xs bg-gray-50 rounded-lg px-3 py-2">
                          <div className="flex items-center gap-2">
                            <span className={`px-1.5 py-0.5 rounded font-medium ${TYPE_BADGE[l.type] ?? ''}`}>{l.type}</span>
                            <span className="text-gray-500">{l.start_date === l.end_date ? l.start_date : `${l.start_date} ~ ${l.end_date}`}</span>
                          </div>
                          <span className={`px-1.5 py-0.5 rounded font-medium ${STATUS_BADGE[os]}`}>{os}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 신청 목록 탭 */}
      {tab === 'requests' && (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <div className="divide-y divide-gray-50">
            {visibleLeaves.length === 0 ? (
              <div className="py-12 text-center text-gray-400 text-sm">신청 내역이 없어요.</div>
            ) : visibleLeaves.map(l => {
              const overall = overallStatus(l)
              const member = memberMap[l.member_id]
              return (
                <div key={l.id} className="px-5 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        {isAdmin && <span className="text-xs font-medium text-gray-700">{member?.name}</span>}
                        <span className={`text-xs px-2 py-0.5 rounded-full ${TYPE_BADGE[l.type] ?? ''}`}>{l.type}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_BADGE[overall]}`}>{overall}</span>
                        <span className="text-xs text-gray-400">{l.days}일</span>
                      </div>
                      <p className="text-sm text-gray-800">{l.start_date} {l.start_date !== l.end_date ? `~ ${l.end_date}` : ''}</p>
                      {l.reason && <p className="text-xs text-gray-400 mt-0.5">{l.reason}</p>}
                    </div>
                    {isAdmin && (
                      <div className="text-right space-y-1.5 shrink-0">
                        {l.director_approval === '대기' && (
                          <div className="flex gap-1">
                            <span className="text-[11px] text-gray-400 self-center">이사</span>
                            <button onClick={() => handleApprove(l.id, 'director', '승인')} className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded hover:bg-green-200">승인</button>
                            <button onClick={() => handleApprove(l.id, 'director', '반려')} className="text-xs px-2 py-0.5 bg-red-100 text-red-500 rounded hover:bg-red-200">반려</button>
                          </div>
                        )}
                        {l.director_approval === '승인' && l.ceo_approval === '대기' && (
                          <div className="flex gap-1">
                            <span className="text-[11px] text-gray-400 self-center">대표</span>
                            <button onClick={() => handleApprove(l.id, 'ceo', '승인')} className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded hover:bg-green-200">승인</button>
                            <button onClick={() => handleApprove(l.id, 'ceo', '반려')} className="text-xs px-2 py-0.5 bg-red-100 text-red-500 rounded hover:bg-red-200">반려</button>
                          </div>
                        )}
                        {(l.director_approval !== '대기' || l.ceo_approval !== '대기') && (
                          <div className="text-[11px] text-gray-300">
                            이사 {l.director_approval} · 대표 {l.ceo_approval}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* 서류 신청 탭 */}
      {tab === 'docs' && (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <div className="divide-y divide-gray-50">
            {(isAdmin ? docRequests : docRequests.filter(d => d.member_id === currentUserId)).length === 0 ? (
              <div className="py-12 text-center text-gray-400 text-sm">서류 신청 내역이 없어요.</div>
            ) : (isAdmin ? docRequests : docRequests.filter(d => d.member_id === currentUserId)).map(d => {
              const member = members.find(m => m.id === d.member_id)
              return (
                <div key={d.id} className="flex items-center px-5 py-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      {isAdmin && <span className="text-xs font-medium text-gray-700">{member?.name}</span>}
                      <span className="text-sm font-medium text-gray-800">{d.doc_type}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${DOC_STATUS_BADGE[d.status] ?? ''}`}>{d.status}</span>
                    </div>
                    <p className="text-xs text-gray-400">{d.created_at.slice(0,10)}{d.purpose ? ` · ${d.purpose}` : ''}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* 달력 탭 */}
      {tab === 'calendar' && (
        <div className="bg-white border border-gray-200 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 text-lg">←</button>
            <h2 className="text-base font-bold text-gray-900">{calYear}년 {calMonth + 1}월</h2>
            <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 text-lg">→</button>
          </div>
          {!isAdmin && (
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
              const dayLeaves = getLeavesOnDay(day)
              const ds = dateStr(calYear, calMonth, day)
              const isToday = ds === today.toISOString().slice(0, 10)
              const isSun = (i % 7 === 0), isSat = (i % 7 === 6)
              return (
                <div key={i} className={`min-h-[60px] p-1 rounded-lg border ${isToday ? 'border-yellow-400 bg-yellow-50' : 'border-gray-100'}`}>
                  <div className={`text-xs font-medium mb-1 ${isToday ? 'text-yellow-700' : isSun ? 'text-red-400' : isSat ? 'text-blue-400' : 'text-gray-600'}`}>{day}</div>
                  <div className="space-y-0.5">
                    {dayLeaves.slice(0, 2).map(l => {
                      const name = isAdmin ? (memberMap[l.member_id]?.name ?? '?') : l.type
                      return (
                        <div key={l.id} className="text-[10px] px-1 py-0.5 rounded truncate font-medium bg-gray-900 text-white">
                          {name}
                        </div>
                      )
                    })}
                    {dayLeaves.length > 2 && <div className="text-[10px] text-gray-400 px-1">+{dayLeaves.length - 2}명</div>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* 서류 신청 모달 */}
      {showDocForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-gray-900">서류 신청</h3>
              <button onClick={() => setShowDocForm(false)} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">서류 종류</label>
                <select value={docForm.doc_type} onChange={e => setDocForm(f => ({...f, doc_type: e.target.value}))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                  {DOC_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">제출 용도 <span className="text-gray-300">(선택)</span></label>
                <input value={docForm.purpose} onChange={e => setDocForm(f => ({...f, purpose: e.target.value}))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="예: 은행 제출, 관공서 제출" />
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setShowDocForm(false)}
                className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600">취소</button>
              <button onClick={async () => {
                await requestDocument(currentUserId, docForm.doc_type, docForm.purpose)
                setDocRequests(prev => [{ id: Date.now().toString(), member_id: currentUserId, doc_type: docForm.doc_type, purpose: docForm.purpose || null, status: '요청', created_at: new Date().toISOString() }, ...prev])
                setDocForm({ doc_type: '재직증명서', purpose: '' })
                setShowDocForm(false)
                setTab('docs')
              }} className="flex-1 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-semibold">신청</button>
            </div>
          </div>
        </div>
      )}

      {/* 연차 신청 모달 */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-lg font-bold text-gray-900">연차 신청</h3>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
            </div>
            <p className="text-xs text-gray-400 mb-4">이사 → 대표 순으로 결재가 진행됩니다.</p>
            <form onSubmit={handleSubmit} className="space-y-3">
              {isAdmin && (
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">신청자</label>
                  <select value={form.member_id} onChange={e => setForm(f => ({ ...f, member_id: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                    {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">구분</label>
                <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as LeaveType }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                  {LEAVE_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">시작일</label>
                  <input type="date" required value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value, end_date: f.end_date || e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">종료일</label>
                  <input type="date" required value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">사유</label>
                <input value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="선택 입력" />
              </div>
              {/* 잔여 연차 미리보기 */}
              {(() => {
                const targetId = isAdmin ? form.member_id : currentUserId
                const target = memberMap[targetId]
                const remaining = (target?.annualLeave ?? 0) - usedDays(targetId)
                return target?.annualLeave ? (
                  <div className="bg-gray-50 rounded-lg px-3 py-2 text-xs text-gray-500 flex justify-between">
                    <span>{target.name} 잔여 연차</span>
                    <span className={`font-semibold ${remaining <= 3 ? 'text-red-500' : 'text-gray-700'}`}>{remaining}일</span>
                  </div>
                ) : null
              })()}
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowForm(false)}
                  className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">취소</button>
                <button type="submit"
                  className="flex-1 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-semibold hover:bg-gray-800">신청</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
