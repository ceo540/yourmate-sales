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

export default function HrClient({ members, initialLeaves, initialDocRequests, initialBalances, currentUserId, isAdmin }: Props) {
  const [tab, setTab] = useState<'overview' | 'requests' | 'docs'>('overview')
  const [leaves, setLeaves] = useState<Leave[]>(initialLeaves)
  const [docRequests, setDocRequests] = useState<DocRequest[]>(initialDocRequests)
  const [showForm, setShowForm] = useState(false)
  const [showDocForm, setShowDocForm] = useState(false)
  const [docForm, setDocForm] = useState({ doc_type: '재직증명서', purpose: '' })
  const [form, setForm] = useState({ member_id: currentUserId, type: '연차' as LeaveType, start_date: '', end_date: '', reason: '' })
  const [, startTransition] = useTransition()

  const memberMap = Object.fromEntries(members.map(m => [m.id, m]))

  // 사람별 사용 연차 (초기 잔액 + 승인된 신청)
  function usedDays(memberId: string) {
    const fromRequests = leaves
      .filter(l => l.member_id === memberId && l.director_approval === '승인' && l.ceo_approval === '승인')
      .reduce((s, l) => s + (l.days ?? 0), 0)
    return fromRequests + (initialBalances[memberId] ?? 0)
  }

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

  const visibleLeaves = isAdmin
    ? leaves
    : leaves.filter(l => l.member_id === currentUserId)

  return (
    <div className="space-y-4">
      {/* 탭 + 신청 버튼 */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex gap-2">
          {([['overview','연차 현황'],['requests','신청 목록'],['docs','서류 신청']] as const).map(([t, label]) => (
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
            // 관리자: 전체 팀원 현황
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr className="text-xs text-gray-500">
                  <th className="px-5 py-3 text-left">이름</th>
                  <th className="px-4 py-3 text-left">입사일</th>
                  <th className="px-4 py-3 text-center">발생</th>
                  <th className="px-4 py-3 text-center">사용</th>
                  <th className="px-4 py-3 text-center">잔여</th>
                  <th className="px-4 py-3 text-center">소진율</th>
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
                      <td className="px-5 py-3 font-medium text-gray-800">{m.name}</td>
                      <td className="px-4 py-3 text-gray-500">{m.joinDate ?? <span className="text-red-400 text-xs">미입력</span>}</td>
                      <td className="px-4 py-3 text-center font-semibold text-gray-800">{total > 0 ? `${total}일` : '-'}</td>
                      <td className="px-4 py-3 text-center text-yellow-600 font-medium">{used > 0 ? `${used}일` : '0일'}</td>
                      <td className={`px-4 py-3 text-center font-semibold ${remaining <= 3 ? 'text-red-500' : 'text-green-600'}`}>
                        {total > 0 ? `${remaining}일` : '-'}
                      </td>
                      <td className="px-4 py-3">
                        {total > 0 ? (
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-gray-100 rounded-full h-2">
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
          ) : (
            // 팀원: 본인 카드만
            (() => {
              const me = memberMap[currentUserId]
              const used = usedDays(currentUserId)
              const total = me?.annualLeave ?? 0
              const remaining = total - used
              return (
                <div className="p-6 space-y-4">
                  {!me?.joinDate && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 text-sm text-yellow-700">
                      입사일이 등록되지 않았어요. 관리자에게 문의하세요.
                    </div>
                  )}
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: '발생 연차', value: total > 0 ? `${total}일` : '-', color: 'text-gray-800' },
                      { label: '사용', value: `${used}일`, color: 'text-yellow-600' },
                      { label: '잔여', value: total > 0 ? `${remaining}일` : '-', color: remaining <= 3 ? 'text-red-500' : 'text-green-600' },
                    ].map(s => (
                      <div key={s.label} className="bg-gray-50 rounded-xl p-4 text-center">
                        <p className="text-xs text-gray-400 mb-1">{s.label}</p>
                        <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                      </div>
                    ))}
                  </div>
                  {total > 0 && (
                    <div>
                      <div className="flex justify-between text-xs text-gray-400 mb-1">
                        <span>소진율</span><span>{Math.round(used / total * 100)}%</span>
                      </div>
                      <div className="bg-gray-100 rounded-full h-3">
                        <div className={`h-3 rounded-full transition-all ${used/total >= 0.8 ? 'bg-red-400' : used/total >= 0.6 ? 'bg-yellow-400' : 'bg-green-400'}`}
                          style={{ width: `${Math.round(used / total * 100)}%` }} />
                      </div>
                    </div>
                  )}
                  <div>
                    <p className="text-xs text-gray-400 mb-1">입사일</p>
                    <p className="text-sm font-medium text-gray-700">{me?.joinDate ?? '미입력'}</p>
                  </div>
                </div>
              )
            })()
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

                    {/* 승인 버튼 (관리자만) */}
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
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-gray-900">연차 신청</h3>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
            </div>
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
