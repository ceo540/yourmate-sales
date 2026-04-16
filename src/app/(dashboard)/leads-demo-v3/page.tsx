'use client'
import { useState } from 'react'

// ============================================================
// 리드 관리 데모 v3 — 클린 & 모던
// 넓은 여백, 카드형 레이아웃, 타임라인 소통 내역
// ============================================================

const MOCK_LEADS = [
  {
    id: '1',
    lead_id: 'LEAD20260416-0001',
    status: '미팅',
    contact_name: '김지수',
    client_org: '서울시교육청',
    phone: '010-1234-5678',
    service_type: 'SOS',
    project_name: '2026 진로체험 페스티벌',
    inflow_date: '2026-04-10',
    remind_date: '2026-04-18',
    channel: '이메일',
    assignee_name: '정태영',
    logs: [
      { id: 'l1', content: '이메일로 문의 접수. 5월 행사 관련 견적 요청.', contacted_at: '2026-04-10T10:00:00Z', author_name: '정태영' },
      { id: 'l2', content: '전화 통화. 예산 500만원 내외. 학생 200명 규모.', contacted_at: '2026-04-12T14:30:00Z', author_name: '정태영' },
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
    service_type: '002크리에이티브',
    project_name: null,
    inflow_date: '2026-04-14',
    remind_date: null,
    channel: '인스타그램',
    assignee_name: '조민현',
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
    service_type: '렌탈',
    project_name: '청소년 음악캠프 장비 렌탈',
    inflow_date: '2026-04-08',
    remind_date: '2026-04-20',
    channel: '홈페이지',
    assignee_name: '유제민',
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
    service_type: 'SOS',
    project_name: '청렴 캠페인 행사',
    inflow_date: '2026-03-20',
    remind_date: null,
    channel: '지인소개',
    assignee_name: '정태영',
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
    service_type: '002크리에이티브',
    project_name: '교육감 취임식 영상',
    inflow_date: '2026-03-15',
    remind_date: null,
    channel: '이메일',
    assignee_name: '조민현',
    logs: [
      { id: 'l8', content: '계약 체결 완료. 착수금 수령.', contacted_at: '2026-03-25T10:00:00Z', author_name: '조민현' },
    ],
  },
]

const STATUS_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  '유입':  { label: '유입',  color: 'bg-gray-100 text-gray-600',   dot: 'bg-gray-400' },
  '미팅':  { label: '미팅',  color: 'bg-blue-100 text-blue-700',   dot: 'bg-blue-500' },
  '견적':  { label: '견적',  color: 'bg-violet-100 text-violet-700', dot: 'bg-violet-500' },
  '협상':  { label: '협상',  color: 'bg-orange-100 text-orange-700', dot: 'bg-orange-500' },
  '완료':  { label: '완료',  color: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
  '취소':  { label: '취소',  color: 'bg-red-100 text-red-400',     dot: 'bg-red-400' },
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const d = Math.floor(diff / 86400000)
  if (d === 0) return '오늘'
  if (d === 1) return '어제'
  if (d < 7) return `${d}일 전`
  return new Date(iso).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
}

function formatDate(str: string) {
  return new Date(str).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })
}

export default function LeadsDemoV3() {
  const [selectedId, setSelectedId] = useState<string | null>('1')
  const [filter, setFilter] = useState<string>('전체')
  const [showClosed, setShowClosed] = useState(false)

  const statuses = ['전체', '유입', '미팅', '견적', '협상']

  const filtered = MOCK_LEADS.filter(l => {
    if (!showClosed && (l.status === '완료' || l.status === '취소')) return false
    if (filter !== '전체' && l.status !== filter) return false
    return true
  })

  const selected = MOCK_LEADS.find(l => l.id === selectedId)

  const counts = MOCK_LEADS.reduce((acc, l) => {
    acc[l.status] = (acc[l.status] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">리드 관리</h1>
            <p className="text-sm text-gray-400 mt-0.5">총 {MOCK_LEADS.filter(l => !['완료','취소'].includes(l.status)).length}건 활성</p>
          </div>
          <button className="bg-yellow-400 hover:bg-yellow-500 text-gray-900 text-sm font-semibold px-4 py-2 rounded-xl transition-colors">
            + 새 리드
          </button>
        </div>

        {/* 필터 탭 */}
        <div className="flex items-center gap-1 mt-4">
          {statuses.map(s => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                filter === s
                  ? 'bg-gray-900 text-white'
                  : 'text-gray-500 hover:bg-gray-100'
              }`}
            >
              {s}
              {s !== '전체' && counts[s] ? (
                <span className="ml-1.5 text-xs opacity-70">{counts[s]}</span>
              ) : null}
            </button>
          ))}
          <div className="flex-1" />
          <button
            onClick={() => setShowClosed(!showClosed)}
            className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          >
            {showClosed ? '완료/취소 숨기기' : '완료/취소 보기'}
          </button>
        </div>
      </div>

      {/* 메인 레이아웃 */}
      <div className="flex h-[calc(100vh-130px)]">
        {/* 리드 목록 */}
        <div className="w-96 border-r border-gray-200 bg-white overflow-y-auto">
          <div className="p-3 space-y-1">
            {filtered.map(lead => {
              const cfg = STATUS_CONFIG[lead.status] || STATUS_CONFIG['유입']
              const isSelected = lead.id === selectedId
              const isRemind = lead.remind_date && new Date(lead.remind_date) <= new Date(Date.now() + 2 * 86400000)

              return (
                <button
                  key={lead.id}
                  onClick={() => setSelectedId(lead.id)}
                  className={`w-full text-left p-3 rounded-xl transition-all ${
                    isSelected
                      ? 'bg-yellow-50 border border-yellow-200'
                      : 'hover:bg-gray-50 border border-transparent'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${cfg.dot}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-gray-900 truncate">
                          {lead.contact_name}
                        </span>
                        <span className={`flex-shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${cfg.color}`}>
                          {lead.status}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5 truncate">{lead.client_org}</p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="text-xs text-gray-400">{lead.service_type}</span>
                        {isRemind && (
                          <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded-md">리마인드</span>
                        )}
                        <span className="text-xs text-gray-300 ml-auto">{timeAgo(lead.inflow_date + 'T00:00:00Z')}</span>
                      </div>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* 상세 패널 */}
        {selected ? (
          <div className="flex-1 overflow-y-auto bg-white">
            <div className="max-w-2xl mx-auto px-8 py-6">
              {/* 상단 */}
              <div className="flex items-start justify-between mb-6">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${STATUS_CONFIG[selected.status]?.color || ''}`}>
                      {selected.status}
                    </span>
                    <span className="text-xs text-gray-400">{selected.lead_id}</span>
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900">{selected.contact_name}</h2>
                  <p className="text-gray-500 mt-0.5">{selected.client_org}</p>
                </div>
                <div className="flex gap-2">
                  <button className="text-sm border border-gray-200 hover:border-gray-300 text-gray-600 px-3 py-1.5 rounded-lg transition-colors">
                    수정
                  </button>
                  <button className="text-sm bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-semibold px-3 py-1.5 rounded-lg transition-colors">
                    계약 전환
                  </button>
                </div>
              </div>

              {/* 정보 카드 */}
              <div className="grid grid-cols-2 gap-3 mb-6">
                <InfoCard label="서비스" value={selected.service_type || '—'} />
                <InfoCard label="담당자" value={selected.assignee_name} />
                <InfoCard label="유입 채널" value={selected.channel || '—'} />
                <InfoCard label="유입일" value={formatDate(selected.inflow_date)} />
                {selected.phone && (
                  <InfoCard label="연락처" value={selected.phone} highlight />
                )}
                {selected.remind_date && (
                  <InfoCard label="리마인드" value={formatDate(selected.remind_date)} warn />
                )}
              </div>

              {selected.project_name && (
                <div className="bg-gray-50 rounded-xl p-4 mb-6">
                  <p className="text-xs text-gray-400 mb-1">프로젝트명</p>
                  <p className="text-sm font-medium text-gray-800">{selected.project_name}</p>
                </div>
              )}

              {/* 소통 내역 타임라인 */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-gray-700">소통 내역</h3>
                  <button className="text-xs text-yellow-600 hover:text-yellow-700 font-medium">+ 추가</button>
                </div>

                <div className="space-y-0">
                  {selected.logs.slice().reverse().map((log, i) => (
                    <div key={log.id} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div className="w-2 h-2 rounded-full bg-yellow-400 mt-1.5 flex-shrink-0" />
                        {i < selected.logs.length - 1 && (
                          <div className="w-px flex-1 bg-gray-200 my-1" />
                        )}
                      </div>
                      <div className="pb-4 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-medium text-gray-600">{log.author_name}</span>
                          <span className="text-xs text-gray-400">{timeAgo(log.contacted_at)}</span>
                        </div>
                        <p className="text-sm text-gray-700 leading-relaxed">{log.content}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* 새 소통 입력 */}
                <div className="mt-2 border border-gray-200 rounded-xl p-3">
                  <textarea
                    placeholder="소통 내용을 입력하세요..."
                    className="w-full text-sm text-gray-700 resize-none outline-none placeholder-gray-300 min-h-[60px]"
                  />
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100">
                    <button className="text-xs text-gray-400 hover:text-gray-600">현재 시간 입력</button>
                    <button className="text-xs bg-gray-900 text-white px-3 py-1.5 rounded-lg hover:bg-gray-700 transition-colors">
                      저장
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400">
            <p className="text-sm">리드를 선택하세요</p>
          </div>
        )}
      </div>
    </div>
  )
}

function InfoCard({ label, value, highlight, warn }: { label: string; value: string; highlight?: boolean; warn?: boolean }) {
  return (
    <div className="bg-gray-50 rounded-xl p-3">
      <p className="text-xs text-gray-400 mb-0.5">{label}</p>
      <p className={`text-sm font-medium ${highlight ? 'text-blue-600' : warn ? 'text-orange-600' : 'text-gray-800'}`}>
        {value}
      </p>
    </div>
  )
}
