'use client'

import { useState, useMemo } from 'react'
import type { Prospect, ProspectActivity, ProspectStatus } from '@/types'

const STATUS_LABEL: Record<ProspectStatus, string> = {
  cold: '🆕 신규',
  contacted: '📞 접촉',
  interested: '⭐ 관심',
  lead_converted: '✅ 리드 전환',
  lost: '❌ 종료',
}

const STATUS_COLOR: Record<ProspectStatus, string> = {
  cold: 'bg-gray-100 text-gray-600',
  contacted: 'bg-blue-100 text-blue-700',
  interested: 'bg-yellow-100 text-yellow-800',
  lead_converted: 'bg-green-100 text-green-700',
  lost: 'bg-red-100 text-red-700',
}

const ACTIVITY_ICON: Record<string, string> = {
  cold_email: '✉️', cold_call: '📞', sms: '💬', visit: '🚗', event: '🎪', reply: '↩️',
}

export default function ProspectsClient({ prospects, activities }: {
  prospects: Prospect[]
  activities: ProspectActivity[]
}) {
  const [searchQ, setSearchQ] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const filtered = useMemo(() => {
    return prospects.filter(p => {
      if (searchQ) {
        const q = searchQ.toLowerCase()
        if (!p.org_name.toLowerCase().includes(q)
          && !(p.region ?? '').toLowerCase().includes(q)
          && !(p.contact_name ?? '').toLowerCase().includes(q)) return false
      }
      if (statusFilter !== 'all' && p.status !== statusFilter) return false
      return true
    })
  }, [prospects, searchQ, statusFilter])

  const activitiesByProspect = useMemo(() => {
    const map: Record<string, ProspectActivity[]> = {}
    for (const a of activities) {
      if (!map[a.prospect_id]) map[a.prospect_id] = []
      map[a.prospect_id].push(a)
    }
    return map
  }, [activities])

  // 통계
  const byStatus: Record<ProspectStatus, number> = { cold: 0, contacted: 0, interested: 0, lead_converted: 0, lost: 0 }
  for (const p of prospects) byStatus[p.status]++

  return (
    <div className="container mx-auto px-4 py-6 max-w-5xl">
      <header className="mb-4">
        <h1 className="text-2xl font-semibold mb-1">📞 영업 활동</h1>
        <p className="text-sm text-gray-500">
          잠재 고객·콜드메일·콜드콜·방문 추적. 빵빵이로 자연어 등록·기록 가능. (yourmate-spec.md §5.13)
        </p>
      </header>

      {/* 상태 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-4">
        {(Object.keys(STATUS_LABEL) as ProspectStatus[]).map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(statusFilter === s ? 'all' : s)}
            className={`p-2 rounded-xl border text-left transition-colors ${
              statusFilter === s ? 'border-yellow-400 bg-yellow-50' : 'border-gray-100 bg-white hover:border-gray-300'
            }`}
          >
            <p className="text-[10px] text-gray-500">{STATUS_LABEL[s]}</p>
            <p className="text-lg font-bold text-gray-800">{byStatus[s]}</p>
          </button>
        ))}
      </div>

      {/* 검색 */}
      <div className="flex gap-2 mb-4">
        <input
          type="text"
          value={searchQ}
          onChange={e => setSearchQ(e.target.value)}
          placeholder="기관명·지역·담당자 검색"
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm flex-1"
        />
        <span className="self-center text-sm text-gray-500">{filtered.length} / {prospects.length}건</span>
      </div>

      {prospects.length === 0 ? (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-8 text-center">
          <p className="text-base font-medium text-yellow-800 mb-2">아직 영업 후보 없음</p>
          <p className="text-sm text-yellow-700">
            빵빵이에게: <code className="bg-yellow-100 px-1 rounded">"용인 학교 콜드메일 영업 시작 — 잠재 N개 추가"</code>
          </p>
        </div>
      ) : (
        <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
          {filtered.map(p => {
            const expanded = expandedId === p.id
            const myActs = activitiesByProspect[p.id] ?? []
            return (
              <div key={p.id} className="border-t border-gray-100 first:border-t-0">
                <div
                  onClick={() => setExpandedId(expanded ? null : p.id)}
                  className="cursor-pointer hover:bg-gray-50 px-3 py-2 flex items-center gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-800">{p.org_name}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${STATUS_COLOR[p.status]}`}>
                        {STATUS_LABEL[p.status]}
                      </span>
                    </div>
                    <div className="text-[11px] text-gray-500 flex items-center gap-2 mt-0.5">
                      {p.region && <span>📍 {p.region}</span>}
                      {p.category && <span>{p.category}</span>}
                      {p.service_target && <span>· {p.service_target}</span>}
                      {p.source && <span className="text-gray-400">· {p.source}</span>}
                    </div>
                  </div>
                  <div className="text-right text-[11px] text-gray-500 flex-shrink-0">
                    {p.last_contacted_at && (
                      <p>마지막 접촉: {p.last_contacted_at.slice(0, 10)}</p>
                    )}
                    <p className="text-gray-400">{myActs.length}건</p>
                  </div>
                  <span className="text-gray-400 text-xs">{expanded ? '▲' : '▼'}</span>
                </div>
                {expanded && (
                  <div className="bg-gray-50 px-4 py-3 space-y-2">
                    {p.contact_name && (
                      <p className="text-xs text-gray-700">
                        👤 {p.contact_name} {p.contact_role && `(${p.contact_role})`}
                        {p.contact_phone && ` · 📞 ${p.contact_phone}`}
                        {p.contact_email && ` · ✉️ ${p.contact_email}`}
                      </p>
                    )}
                    {p.notes && <p className="text-xs text-gray-600 whitespace-pre-line">{p.notes}</p>}

                    <div>
                      <h4 className="text-[11px] font-semibold text-gray-700 mb-1">활동 기록 ({myActs.length})</h4>
                      {myActs.length === 0 ? (
                        <p className="text-[10px] text-gray-400">
                          빵빵이: <code>&quot;{p.org_name}에 콜드메일 보냈어, 응답 없어&quot;</code>
                        </p>
                      ) : (
                        <div className="space-y-0.5">
                          {myActs.slice(0, 10).map(a => (
                            <div key={a.id} className="text-[11px] flex items-center gap-2 bg-white rounded px-2 py-1">
                              <span>{ACTIVITY_ICON[a.activity_type] ?? '•'}</span>
                              <span className="text-gray-600">{a.activity_type}</span>
                              {a.outcome && <span className="text-gray-500">· {a.outcome}</span>}
                              {a.notes && <span className="text-gray-500 truncate flex-1" title={a.notes}>{a.notes}</span>}
                              <span className="text-gray-400 ml-auto">{a.done_at.slice(0, 10)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <p className="mt-4 text-xs text-gray-400">
        💡 빵빵이로 등록·기록·검색 다 가능. 매일 영업 시 자연어 입력 권장.
      </p>
    </div>
  )
}
