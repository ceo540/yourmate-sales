'use client'
import { useState } from 'react'

// ============================================================
// 리드 관리 데모 v4 — 컴팩트 & 효율
// 왼쪽 상태 컬러 바, 정보 밀도 높음, 인라인 소통 추가
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
    notes: '예산 500만원, 학생 200명',
    logs: [
      { id: 'l1', content: '이메일로 문의 접수. 5월 행사 견적 요청.', contacted_at: '2026-04-10T10:00:00Z', author_name: '정태영' },
      { id: 'l2', content: '전화 통화. 예산 500만원, 학생 200명 규모.', contacted_at: '2026-04-12T14:30:00Z', author_name: '정태영' },
      { id: 'l3', content: '미팅 일정 조율. 4/18 오전 방문 예정.', contacted_at: '2026-04-15T09:00:00Z', author_name: '정태영' },
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
    notes: '드럼 2조, 앰프 4개 6월 렌탈',
    logs: [
      { id: 'l5', content: '홈페이지 폼 문의. 드럼 세트 2조, 앰프 4개 6월 중 렌탈 희망.', contacted_at: '2026-04-08T11:00:00Z', author_name: '유제민' },
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
    project_name: '교육감 취임식 영상',
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

const STATUS_CONFIG: Record<string, { bar: string; badge: string; text: string }> = {
  '유입':  { bar: 'bg-gray-300',     badge: 'bg-gray-100 text-gray-600',        text: '유입' },
  '미팅':  { bar: 'bg-blue-400',     badge: 'bg-blue-100 text-blue-700',        text: '미팅' },
  '견적':  { bar: 'bg-violet-400',   badge: 'bg-violet-100 text-violet-700',    text: '견적' },
  '협상':  { bar: 'bg-orange-400',   badge: 'bg-orange-100 text-orange-700',    text: '협상' },
  '완료':  { bar: 'bg-emerald-400',  badge: 'bg-emerald-100 text-emerald-700',  text: '완료' },
  '취소':  { bar: 'bg-red-300',      badge: 'bg-red-100 text-red-400',          text: '취소' },
}

const SERVICE_COLORS: Record<string, string> = {
  'SOS': 'text-yellow-700 bg-yellow-50',
  '002크리에이티브': 'text-purple-700 bg-purple-50',
  '렌탈': 'text-blue-700 bg-blue-50',
  'CS': 'text-green-700 bg-green-50',
  '학교상점': 'text-pink-700 bg-pink-50',
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const d = Math.floor(diff / 86400000)
  if (d === 0) return '오늘'
  if (d === 1) return '어제'
  if (d < 7) return `${d}일 전`
  return new Date(iso).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' }) + '일'
}

function toMMDD(str: string) {
  const d = new Date(str)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

export default function LeadsDemoV4() {
  const [expandedId, setExpandedId] = useState<string | null>('1')
  const [filter, setFilter] = useState('전체')
  const [showClosed, setShowClosed] = useState(false)
  const [newLog, setNewLog] = useState<Record<string, string>>({})

  const statuses = ['전체', '유입', '미팅', '견적', '협상']
  const counts = MOCK_LEADS.reduce((acc, l) => { acc[l.status] = (acc[l.status] || 0) + 1; return acc }, {} as Record<string, number>)

  const filtered = MOCK_LEADS.filter(l => {
    if (!showClosed && (l.status === '완료' || l.status === '취소')) return false
    if (filter !== '전체' && l.status !== filter) return false
    return true
  })

  const activeCount = MOCK_LEADS.filter(l => !['완료', '취소'].includes(l.status)).length
  const reminds = MOCK_LEADS.filter(l => l.remind_date && new Date(l.remind_date) <= new Date(Date.now() + 2 * 86400000) && !['완료', '취소'].includes(l.status))

  return (
    <div className="min-h-screen bg-gray-100 font-sans">
      {/* 헤더 */}
      <div className="bg-white border-b border-gray-200 px-5 py-3.5 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <h1 className="text-base font-bold text-gray-900">리드 관리</h1>
          <div className="flex items-center gap-1 text-xs text-gray-400">
            <span className="bg-gray-900 text-white rounded-full px-2 py-0.5 font-semibold">{activeCount}</span>
            <span>활성</span>
            {reminds.length > 0 && (
              <>
                <span className="mx-1">·</span>
                <span className="bg-red-500 text-white rounded-full px-2 py-0.5 font-semibold">{reminds.length}</span>
                <span>리마인드</span>
              </>
            )}
          </div>
        </div>
        <button className="bg-yellow-400 hover:bg-yellow-500 text-gray-900 text-xs font-bold px-3 py-1.5 rounded-lg transition-colors">
          + 새 리드
        </button>
      </div>

      {/* 서브 헤더 */}
      <div className="bg-white border-b border-gray-200 px-5 py-2 flex items-center gap-1">
        {statuses.map(s => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`text-xs px-2.5 py-1 rounded-md font-medium transition-colors ${
              filter === s ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-100'
            }`}
          >
            {s}{s !== '전체' && counts[s] ? ` ${counts[s]}` : ''}
          </button>
        ))}
        <div className="flex-1" />
        <button onClick={() => setShowClosed(!showClosed)} className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1">
          {showClosed ? '▲ 완료/취소 숨기기' : '▼ 완료/취소 보기'}
        </button>
      </div>

      {/* 리드 목록 */}
      <div className="px-4 py-3 space-y-1.5 max-w-3xl mx-auto">
        {filtered.map(lead => {
          const cfg = STATUS_CONFIG[lead.status] || STATUS_CONFIG['유입']
          const isExpanded = expandedId === lead.id
          const isRemind = lead.remind_date && new Date(lead.remind_date) <= new Date(Date.now() + 2 * 86400000)

          return (
            <div key={lead.id} className={`bg-white rounded-xl overflow-hidden border transition-shadow ${isExpanded ? 'border-gray-300 shadow-sm' : 'border-gray-200 hover:border-gray-300'}`}>
              {/* 리드 행 */}
              <button
                className="w-full text-left flex items-stretch"
                onClick={() => setExpandedId(isExpanded ? null : lead.id)}
              >
                {/* 왼쪽 컬러 바 */}
                <div className={`w-1 flex-shrink-0 ${cfg.bar}`} />

                {/* 본문 */}
                <div className="flex-1 px-4 py-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm font-semibold text-gray-900">{lead.contact_name}</span>
                      <span className="text-xs text-gray-400 truncate hidden sm:inline">{lead.client_org}</span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {isRemind && (
                        <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-medium">📅 {toMMDD(lead.remind_date!)}</span>
                      )}
                      <span className={`text-xs px-2 py-0.5 rounded-md font-medium ${cfg.badge}`}>{lead.status}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${SERVICE_COLORS[lead.service_type] || 'bg-gray-50 text-gray-500'}`}>
                        {lead.service_type}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-xs text-gray-500 sm:hidden truncate">{lead.client_org}</span>
                    <span className="text-xs text-gray-400 hidden sm:inline">{lead.assignee_name}</span>
                    <span className="text-xs text-gray-300">·</span>
                    <span className="text-xs text-gray-400">{lead.channel}</span>
                    <span className="text-xs text-gray-300">·</span>
                    <span className="text-xs text-gray-400">{toMMDD(lead.inflow_date)} 유입</span>
                    {lead.logs.length > 0 && (
                      <>
                        <span className="text-xs text-gray-300">·</span>
                        <span className="text-xs text-gray-400">소통 {lead.logs.length}건</span>
                      </>
                    )}
                  </div>
                </div>

                {/* 토글 아이콘 */}
                <div className="flex items-center px-3 text-gray-300">
                  <span className="text-xs">{isExpanded ? '▲' : '▼'}</span>
                </div>
              </button>

              {/* 확장 패널 */}
              {isExpanded && (
                <div className="border-t border-gray-100 bg-gray-50">
                  {/* 상세 정보 + 액션 */}
                  <div className="px-4 py-3 flex items-start justify-between gap-4">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-1.5 text-xs flex-1">
                      {lead.phone && (
                        <div>
                          <span className="text-gray-400">전화 </span>
                          <span className="text-gray-700 font-medium">{lead.phone}</span>
                        </div>
                      )}
                      {lead.email && (
                        <div>
                          <span className="text-gray-400">이메일 </span>
                          <span className="text-gray-700 font-medium">{lead.email}</span>
                        </div>
                      )}
                      {lead.project_name && (
                        <div className="col-span-2">
                          <span className="text-gray-400">프로젝트 </span>
                          <span className="text-gray-700 font-medium">{lead.project_name}</span>
                        </div>
                      )}
                      {lead.notes && (
                        <div className="col-span-2 sm:col-span-3">
                          <span className="text-gray-400">메모 </span>
                          <span className="text-gray-600">{lead.notes}</span>
                        </div>
                      )}
                      <div>
                        <span className="text-gray-400">담당 </span>
                        <span className="text-gray-700 font-medium">{lead.assignee_name}</span>
                      </div>
                      <div>
                        <span className="text-gray-400">ID </span>
                        <span className="text-gray-400 font-mono">{lead.lead_id}</span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5 flex-shrink-0">
                      <button className="text-xs bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-semibold px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap">
                        계약 전환
                      </button>
                      <button className="text-xs border border-gray-200 hover:border-gray-300 text-gray-600 px-3 py-1.5 rounded-lg transition-colors">
                        수정
                      </button>
                    </div>
                  </div>

                  {/* 소통 내역 */}
                  <div className="border-t border-gray-200 px-4 py-3">
                    <p className="text-xs font-semibold text-gray-500 mb-2">소통 내역</p>
                    <div className="space-y-1.5 mb-3">
                      {lead.logs.slice().reverse().map(log => (
                        <div key={log.id} className="flex gap-2 text-xs">
                          <span className="text-gray-300 flex-shrink-0 w-14 text-right">{timeAgo(log.contacted_at)}</span>
                          <span className="text-gray-400 flex-shrink-0">{log.author_name}</span>
                          <span className="text-gray-600 flex-1">{log.content}</span>
                        </div>
                      ))}
                    </div>

                    {/* 인라인 소통 추가 */}
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newLog[lead.id] || ''}
                        onChange={e => setNewLog(prev => ({ ...prev, [lead.id]: e.target.value }))}
                        placeholder="소통 내용 입력..."
                        className="flex-1 text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-yellow-300 bg-white"
                      />
                      <button
                        className="text-xs text-gray-400 hover:text-gray-600 border border-gray-200 rounded-lg px-2 py-1.5 hover:border-gray-300 transition-colors whitespace-nowrap"
                        onClick={() => setNewLog(prev => ({
                          ...prev,
                          [lead.id]: (prev[lead.id] ? prev[lead.id] + ' ' : '') + new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
                        }))}
                      >
                        현재 시간
                      </button>
                      <button className="text-xs bg-gray-800 text-white rounded-lg px-3 py-1.5 hover:bg-gray-700 transition-colors">
                        저장
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })}

        {filtered.length === 0 && (
          <div className="text-center py-12 text-gray-400 text-sm">
            해당 조건의 리드가 없습니다.
          </div>
        )}
      </div>
    </div>
  )
}
