'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface Log {
  id: string
  source: string
  action: string
  ref_type: string | null
  ref_id: string | null
  ref_name: string | null
  summary: string | null
  occurred_at: string
}

const ACTION_ICON: Record<string, string> = {
  create_log: '💬', update_log: '✏️',
  create_memo: '📝', update_memo: '✏️',
  create_task: '✅', complete_task: '🎉', update_task: '✏️',
  create_lead: '🎯', update_lead: '✏️',
  create_sale: '💼', update_sale: '✏️',
  create_engagement: '🎤', cancel_engagement: '❌',
  create_payment: '💰', mark_paid: '✅', cancel_payment: '❌',
  reply: '↩️', meeting: '🤝', visit: '🚗', cold_call: '📞', email_sent: '📧',
  create_quote: '📋', update_quote: '✏️',
  other: '•',
}

const SOURCE_LABEL: Record<string, string> = {
  yourmate: '시스템',
  channeltalk: '채널톡',
  calendar: '캘린더',
  dropbox: '드롭박스',
  gmail: '메일',
  sms: 'SMS',
  kakao: '카톡',
}

function fmtTime(iso: string) {
  const d = new Date(iso)
  return d.toLocaleString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })
}

function fmtDate(iso: string) {
  return iso.slice(0, 10)
}

export default function ActivityClient({
  logs, actorId, actorName, fromDate, toDate, profiles, isAdmin,
}: {
  logs: Log[]
  actorId: string
  actorName: string
  fromDate: string
  toDate: string
  profiles: { id: string; name: string }[]
  isAdmin: boolean
}) {
  const router = useRouter()
  const [from, setFrom] = useState(fromDate)
  const [to, setTo] = useState(toDate)
  const [selectedActor, setSelectedActor] = useState(actorId)

  const handleApply = () => {
    const params = new URLSearchParams()
    params.set('actor', selectedActor)
    params.set('from', from)
    params.set('to', to)
    router.push(`/team/activity?${params.toString()}`)
  }

  // 일자별 그룹
  const byDate: Record<string, Log[]> = {}
  for (const l of logs) {
    const d = fmtDate(l.occurred_at)
    if (!byDate[d]) byDate[d] = []
    byDate[d].push(l)
  }
  const dates = Object.keys(byDate).sort().reverse()

  // 통계
  const total = logs.length
  const bySource: Record<string, number> = {}
  for (const l of logs) {
    bySource[l.source] = (bySource[l.source] ?? 0) + 1
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-4xl">
      <header className="mb-4">
        <h1 className="text-2xl font-semibold mb-1">📋 자동 업무표 — {actorName}</h1>
        <p className="text-sm text-gray-500">
          activity_logs 자동 추출. 메모·할일·소통·외부인력·정산 등 직원 행위 종합. (yourmate-spec.md §5.4.2)
        </p>
      </header>

      {/* 필터 */}
      <div className="bg-white border border-gray-100 rounded-xl p-3 mb-4 flex items-center gap-2 flex-wrap">
        {isAdmin && (
          <select
            value={selectedActor}
            onChange={e => setSelectedActor(e.target.value)}
            className="px-2 py-1 text-sm border border-gray-200 rounded"
          >
            {profiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        )}
        <input
          type="date" value={from} onChange={e => setFrom(e.target.value)}
          className="px-2 py-1 text-sm border border-gray-200 rounded"
        />
        <span className="text-sm text-gray-400">~</span>
        <input
          type="date" value={to} onChange={e => setTo(e.target.value)}
          className="px-2 py-1 text-sm border border-gray-200 rounded"
        />
        <button
          onClick={handleApply}
          className="px-3 py-1 text-sm bg-yellow-400 hover:bg-yellow-500 text-white rounded"
        >조회</button>
        <button
          onClick={() => {
            const week = new Date(); week.setDate(week.getDate() - 6)
            setFrom(week.toISOString().slice(0, 10))
            setTo(new Date().toISOString().slice(0, 10))
          }}
          className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded"
        >최근 7일</button>
        <button
          onClick={() => {
            setFrom(new Date().toISOString().slice(0, 10))
            setTo(new Date().toISOString().slice(0, 10))
          }}
          className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded"
        >오늘</button>

        <span className="ml-auto text-xs text-gray-500">
          총 <b className="text-gray-700">{total}</b>건
          {Object.entries(bySource).length > 0 && (
            <span className="ml-2">
              ({Object.entries(bySource).map(([s, n]) => `${SOURCE_LABEL[s] ?? s} ${n}`).join(', ')})
            </span>
          )}
        </span>
      </div>

      {logs.length === 0 ? (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-8 text-center">
          <p className="text-base font-medium text-yellow-800 mb-2">활동 기록 없음</p>
          <p className="text-sm text-yellow-700">
            이 기간에 시스템에서 한 일이 없거나, 아직 activity_logs 자동 기록이 적용 안 된 영역.<br/>
            지금 자동 기록되는 것: 모바일 빠른 메모, 외부 인력 참여 기록.<br/>
            다른 영역(project_logs·tasks·세무 핸드오프 등)은 점진 적용 예정.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {dates.map(d => (
            <section key={d} className="bg-white border border-gray-100 rounded-xl p-4">
              <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center justify-between">
                <span>📅 {d}</span>
                <span className="text-xs text-gray-400 font-normal">{byDate[d].length}건</span>
              </h2>
              <div className="space-y-1">
                {byDate[d].map(l => {
                  const icon = ACTION_ICON[l.action] ?? '•'
                  const refLink = l.ref_type === 'project' && l.ref_id
                    ? `/projects/${l.ref_id}`
                    : l.ref_type === 'lead' && l.ref_id
                      ? `/leads`
                      : null
                  return (
                    <div key={l.id} className="flex items-start gap-3 py-1.5 px-2 hover:bg-gray-50 rounded -mx-2 text-sm">
                      <span className="text-gray-400 font-mono text-xs w-12 flex-shrink-0">{fmtTime(l.occurred_at)}</span>
                      <span className="flex-shrink-0">{icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-gray-700 text-xs">
                          <span className="font-medium">{l.action.replace(/_/g, ' ')}</span>
                          {l.ref_name && (
                            refLink ? (
                              <Link href={refLink} className="ml-1 text-blue-600 hover:underline">
                                — {l.ref_name}
                              </Link>
                            ) : (
                              <span className="ml-1 text-gray-500">— {l.ref_name}</span>
                            )
                          )}
                        </p>
                        {l.summary && (
                          <p className="text-[11px] text-gray-500 mt-0.5 truncate" title={l.summary}>
                            {l.summary}
                          </p>
                        )}
                      </div>
                      {l.source !== 'yourmate' && (
                        <span className="text-[9px] text-gray-400 flex-shrink-0">{SOURCE_LABEL[l.source] ?? l.source}</span>
                      )}
                    </div>
                  )
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      <div className="mt-6 text-xs text-gray-400 space-y-1">
        <p>💡 빵빵이가 매일 18시 자동 업무표 작성·알림은 다음 라운드 (cron 추가 예정).</p>
        <p>⏳ 점진 추가 영역: 채널톡 대화·구글 캘린더·드롭박스 행위·이메일 송수신 (yourmate-spec.md §5.4.2 단계 2~6)</p>
      </div>
    </div>
  )
}
