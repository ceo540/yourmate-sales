'use client'
import { useState } from 'react'

// ============================================================
// 리드 관리 데모 v5 — v3 디자인 + v4 정보 구조
// 클린한 2패널 레이아웃 + 상세 정보 밀도 높음
// ============================================================

const MOCK_LEADS = [
  {
    id: '1',
    lead_id: 'LEAD20260416-0001',
    status: '미팅',
    contact_name: '김지수',
    client_org: '서울시교육청',
    phone: '010-1234-5678',
    email: 'jisu.kim@seoul.go.kr',
    service_type: 'SOS',
    project_name: '2026 진로체험 페스티벌',
    inflow_date: '2026-04-10',
    remind_date: '2026-04-18',
    channel: '이메일',
    assignee_name: '정태영',
    notes: '예산 500만원 내외, 학생 200명 규모',
    logs: [
      { id: 'l1', content: '이메일로 문의 접수. 5월 행사 관련 견적 요청.', contacted_at: '2026-04-10T10:00:00Z', author_name: '정태영' },
      { id: 'l2', content: '전화 통화. 예산 500만원, 학생 200명 규모 확인.', contacted_at: '2026-04-12T14:30:00Z', author_name: '정태영' },
      { id: 'l3', content: '미팅 일정 조율 완료. 4/18 오전 방문 예정.', contacted_at: '2026-04-15T09:00:00Z', author_name: '정태영' },
    ],
  },
  {
    id: '2',
    lead_id: 'LEAD20260416-0002',
    status: '유입',
    contact_name: '박현우',
    client_org: '경기도문화재단',
    phone: '010-9876-5432',
    email: '',
    service_type: '002크리에이티브',
    project_name: null,
    inflow_date: '2026-04-14',
    remind_date: null,
    channel: '인스타그램',
    assignee_name: '조민현',
    notes: null,
    logs: [
      { id: 'l4', content: 'SNS DM으로 홍보 영상 제작 문의.', contacted_at: '2026-04-14T16:00:00Z', author_name: '조민현' },
    ],
  },
  {
    id: '3',
    lead_id: 'LEAD20260416-0003',
    status: '견적',
    contact_name: '이수진',
    client_org: '한국청소년활동진흥원',
    phone: '02-3456-7890',
    email: 'sujin.lee@kywa.or.kr',
    service_type: '렌탈',
    project_name: '청소년 음악캠프 장비 렌탈',
    inflow_date: '2026-04-08',
    remind_date: '2026-04-20',
    channel: '홈페이지',
    assignee_name: '유제민',
    notes: '드럼 2조, 앰프 4개 / 6월 중 렌탈',
    logs: [
      { id: 'l5', content: '홈페이지 폼 문의. 드럼 세트 2조, 앰프 4개 6월 렌탈 희망.', contacted_at: '2026-04-08T11:00:00Z', author_name: '유제민' },
      { id: 'l6', content: '견적서 발송 완료.', contacted_at: '2026-04-11T10:00:00Z', author_name: '유제민' },
    ],
  },
  {
    id: '4',
    lead_id: 'LEAD20260416-0004',
    status: '취소',
    contact_name: '최영민',
    client_org: '서초구청',
    phone: '010-5555-6666',
    email: '',
    service_type: 'SOS',
    project_name: '청렴 캠페인 행사',
    inflow_date: '2026-03-20',
    remind_date: null,
    channel: '지인소개',
    assignee_name: '정태영',
    notes: '예산 삭감으로 취소',
    logs: [
      { id: 'l7', content: '예산 삭감으로 행사 취소 통보.', contacted_at: '2026-04-01T09:00:00Z', author_name: '정태영' },
    ],
  },
  {
    id: '5',
    lead_id: 'LEAD20260416-0005',
    status: '완료',
    contact_name: '강민정',
    client_org: '인천교육청',
    phone: '010-7777-8888',
    email: 'minjung.kang@ice.go.kr',
    service_type: '002크리에이티브',
    project_name: '교육감 취임식 홍보 영상',
    inflow_date: '2026-03-15',
    remind_date: null,
    channel: '이메일',
    assignee_name: '조민현',
    notes: null,
    logs: [
      { id: 'l8', content: '계약 체결 완료. 착수금 수령.', contacted_at: '2026-03-25T10:00:00Z', author_name: '조민현' },
    ],
  },
]

const STATUS_CONFIG: Record<string, { dot: string; badge: string }> = {
  '유입':  { dot: 'bg-gray-400',     badge: 'bg-gray-100 text-gray-500' },
  '미팅':  { dot: 'bg-blue-400',     badge: 'bg-blue-100 text-blue-700' },
  '견적':  { dot: 'bg-violet-400',   badge: 'bg-violet-100 text-violet-700' },
  '협상':  { dot: 'bg-orange-400',   badge: 'bg-orange-100 text-orange-700' },
  '완료':  { dot: 'bg-emerald-400',  badge: 'bg-emerald-100 text-emerald-700' },
  '취소':  { dot: 'bg-red-300',      badge: 'bg-red-100 text-red-400' },
}

const SERVICE_COLORS: Record<string, string> = {
  'SOS': 'text-yellow-700 bg-yellow-50 border-yellow-200',
  '002크리에이티브': 'text-purple-700 bg-purple-50 border-purple-200',
  '렌탈': 'text-blue-700 bg-blue-50 border-blue-200',
  'CS': 'text-green-700 bg-green-50 border-green-200',
  '학교상점': 'text-pink-700 bg-pink-50 border-pink-200',
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const d = Math.floor(diff / 86400000)
  if (d === 0) return '오늘'
  if (d === 1) return '어제'
  if (d < 7) return `${d}일 전`
  return new Date(iso).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
}

function toMMDD(str: string) {
  const d = new Date(str)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

export default function LeadsDemoV5() {
  const [selectedId, setSelectedId] = useState<string | null>('1')
  const [filter, setFilter] = useState('전체')
  const [showClosed, setShowClosed] = useState(false)
  const [logInput, setLogInput] = useState('')

  const statuses = ['전체', '유입', '미팅', '견적', '협상']
  const counts = MOCK_LEADS.reduce((acc, l) => { acc[l.status] = (acc[l.status] || 0) + 1; return acc }, {} as Record<string, number>)

  const filtered = MOCK_LEADS.filter(l => {
    if (!showClosed && (l.status === '완료' || l.status === '취소')) return false
    if (filter !== '전체' && l.status !== filter) return false
    return true
  })

  const selected = MOCK_LEADS.find(l => l.id === selectedId)
  const activeCount = MOCK_LEADS.filter(l => !['완료', '취소'].includes(l.status)).length
  const remindsCount = MOCK_LEADS.filter(l =>
    l.remind_date &&
    new Date(l.remind_date) <= new Date(Date.now() + 2 * 86400000) &&
    !['완료', '취소'].includes(l.status)
  ).length

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* 헤더 */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-bold text-gray-900">리드 관리</h1>
            <div className="flex items-center gap-1.5 text-xs">
              <span className="bg-gray-800 text-white rounded-full px-2 py-0.5 font-semibold">{activeCount}</span>
              <span className="text-gray-400">활성</span>
              {remindsCount > 0 && (
                <>
                  <span className="text-gray-300">·</span>
                  <span className="bg-red-500 text-white rounded-full px-2 py-0.5 font-semibold">{remindsCount}</span>
                  <span className="text-gray-400">리마인드</span>
                </>
              )}
            </div>
          </div>
          <button className="bg-yellow-400 hover:bg-yellow-500 text-gray-900 text-sm font-semibold px-4 py-2 rounded-xl transition-colors">
            + 새 리드
          </button>
        </div>

        {/* 필터 */}
        <div className="flex items-center gap-1 mt-3">
          {statuses.map(s => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                filter === s ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-100'
              }`}
            >
              {s}{s !== '전체' && counts[s] ? <span className="ml-1 opacity-60 text-xs">{counts[s]}</span> : null}
            </button>
          ))}
          <div className="flex-1" />
          <button onClick={() => setShowClosed(!showClosed)} className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1.5 rounded-lg hover:bg-gray-100">
            {showClosed ? '완료/취소 숨기기' : '완료/취소 보기'}
          </button>
        </div>
      </div>

      {/* 바디 */}
      <div className="flex flex-1 overflow-hidden">

        {/* 왼쪽: 리드 목록 */}
        <div className="w-80 border-r border-gray-200 bg-white overflow-y-auto flex-shrink-0">
          <div className="p-2 space-y-0.5">
            {filtered.map(lead => {
              const cfg = STATUS_CONFIG[lead.status] || STATUS_CONFIG['유입']
              const isSelected = lead.id === selectedId
              const isRemind = lead.remind_date && new Date(lead.remind_date) <= new Date(Date.now() + 2 * 86400000)
              const lastLog = lead.logs[lead.logs.length - 1]

              return (
                <button
                  key={lead.id}
                  onClick={() => setSelectedId(lead.id)}
                  className={`w-full text-left px-3 py-3 rounded-xl transition-all ${
                    isSelected ? 'bg-yellow-50 border border-yellow-200' : 'hover:bg-gray-50 border border-transparent'
                  }`}
                >
                  {/* 1행: 이름 + 상태 */}
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${cfg.dot}`} />
                      <span className="text-sm font-semibold text-gray-900 truncate">{lead.contact_name}</span>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${cfg.badge}`}>
                      {lead.status}
                    </span>
                  </div>

                  {/* 2행: 기관명 + 서비스 */}
                  <div className="flex items-center gap-2 pl-4 mb-1.5">
                    <span className="text-xs text-gray-500 truncate flex-1">{lead.client_org}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded border font-medium flex-shrink-0 ${SERVICE_COLORS[lead.service_type] || 'text-gray-400 bg-gray-50 border-gray-200'}`}>
                      {lead.service_type}
                    </span>
                  </div>

                  {/* 3행: 최근 소통 or 메타 */}
                  <div className="pl-4 flex items-center justify-between gap-2">
                    {lastLog ? (
                      <span className="text-xs text-gray-400 truncate flex-1">{lastLog.content}</span>
                    ) : (
                      <span className="text-xs text-gray-300">소통 없음</span>
                    )}
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {isRemind && (
                        <span className="text-xs text-red-500 font-medium">📅{toMMDD(lead.remind_date!)}</span>
                      )}
                      <span className="text-xs text-gray-300">{timeAgo(lead.inflow_date + 'T00:00:00Z')}</span>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* 오른쪽: 상세 패널 */}
        {selected ? (
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-2xl mx-auto px-8 py-6">

              {/* 타이틀 영역 */}
              <div className="flex items-start justify-between mb-5">
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${STATUS_CONFIG[selected.status]?.badge}`}>
                      {selected.status}
                    </span>
                    <span className={`text-xs px-2 py-1 rounded border font-medium ${SERVICE_COLORS[selected.service_type] || 'text-gray-400 bg-gray-50 border-gray-200'}`}>
                      {selected.service_type}
                    </span>
                    <span className="text-xs text-gray-300 font-mono">{selected.lead_id}</span>
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900">{selected.contact_name}</h2>
                  <p className="text-gray-500 mt-0.5">{selected.client_org}</p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button className="text-sm border border-gray-200 hover:border-gray-300 text-gray-600 px-3 py-1.5 rounded-xl transition-colors">
                    수정
                  </button>
                  <button className="text-sm bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-semibold px-3 py-1.5 rounded-xl transition-colors">
                    계약 전환
                  </button>
                </div>
              </div>

              {/* 정보 그리드 — 한눈에 보이게 */}
              <div className="bg-white rounded-2xl border border-gray-200 p-4 mb-5">
                <div className="grid grid-cols-2 gap-x-8 gap-y-3">
                  <InfoRow label="담당자" value={selected.assignee_name} />
                  <InfoRow label="유입 채널" value={selected.channel || '—'} />
                  <InfoRow label="연락처" value={selected.phone || '—'} highlight />
                  <InfoRow label="이메일" value={selected.email || '—'} />
                  <InfoRow label="유입일" value={toMMDD(selected.inflow_date) + ' 유입'} />
                  {selected.remind_date && (
                    <InfoRow label="리마인드" value={toMMDD(selected.remind_date) + ' 예정'} warn />
                  )}
                  {selected.project_name && (
                    <div className="col-span-2 pt-2 border-t border-gray-100">
                      <InfoRow label="프로젝트명" value={selected.project_name} />
                    </div>
                  )}
                  {selected.notes && (
                    <div className="col-span-2">
                      <InfoRow label="메모" value={selected.notes} />
                    </div>
                  )}
                </div>
              </div>

              {/* 소통 내역 */}
              <div className="bg-white rounded-2xl border border-gray-200 p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-gray-700">
                    소통 내역 <span className="text-gray-400 font-normal ml-1">{selected.logs.length}건</span>
                  </h3>
                </div>

                {/* 타임라인 */}
                <div className="space-y-0 mb-4">
                  {selected.logs.slice().reverse().map((log, i) => (
                    <div key={log.id} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div className="w-2 h-2 rounded-full bg-yellow-400 mt-1.5 flex-shrink-0" />
                        {i < selected.logs.length - 1 && (
                          <div className="w-px flex-1 bg-gray-100 my-1.5" />
                        )}
                      </div>
                      <div className="pb-4 flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-semibold text-gray-600">{log.author_name}</span>
                          <span className="text-xs text-gray-400">{timeAgo(log.contacted_at)}</span>
                        </div>
                        <p className="text-sm text-gray-700 leading-relaxed">{log.content}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* 소통 입력 */}
                <div className="border border-gray-200 rounded-xl p-3 bg-gray-50">
                  <textarea
                    value={logInput}
                    onChange={e => setLogInput(e.target.value)}
                    placeholder="소통 내용을 입력하세요..."
                    className="w-full text-sm text-gray-700 bg-transparent resize-none outline-none placeholder-gray-300 min-h-[56px]"
                  />
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-200">
                    <button
                      onClick={() => setLogInput(v => (v ? v + ' ' : '') + new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }))}
                      className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      현재 시간 입력
                    </button>
                    <button className="text-xs bg-gray-900 text-white px-3 py-1.5 rounded-lg hover:bg-gray-700 transition-colors">
                      저장
                    </button>
                  </div>
                </div>
              </div>

            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-sm text-gray-400">리드를 선택하세요</p>
          </div>
        )}
      </div>
    </div>
  )
}

function InfoRow({ label, value, highlight, warn }: { label: string; value: string; highlight?: boolean; warn?: boolean }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-xs text-gray-400 w-16 flex-shrink-0">{label}</span>
      <span className={`text-sm font-medium ${highlight ? 'text-blue-600' : warn ? 'text-orange-600' : 'text-gray-800'}`}>
        {value}
      </span>
    </div>
  )
}
