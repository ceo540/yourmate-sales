'use client'
import { useState } from 'react'

// ============================================================
// 리드 관리 데모 v5 — v3 디자인 + v4 정보구조 + AI 요약 + 긴 내용 접기
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
      {
        id: 'l1',
        content: '이메일로 문의 접수. 5월 행사 관련 견적 요청.',
        contacted_at: '2026-04-10T10:00:00Z',
        author_name: '정태영',
      },
      {
        id: 'l2',
        content: '전화 통화. 예산 500만원, 학생 200명 규모 확인.',
        contacted_at: '2026-04-12T14:30:00Z',
        author_name: '정태영',
      },
      {
        id: 'l3',
        content: `[통화 전사록] 14:32 정태영: 안녕하세요, 유어메이트 정태영입니다. 지난번에 보내주신 견적서 관련해서 연락드렸어요. 14:32 김지수: 아 네, 잘 받았어요. 근데 저희가 예산이 500만원인데 견적이 조금 오버되더라고요. 혹시 조정이 가능할까요? 14:33 정태영: 네, 항목 별로 조정 가능합니다. 어떤 부분이 제일 부담되셨나요? 14:33 김지수: 음향 장비 쪽이요. 학생 200명인데 그냥 기본 PA 시스템으로도 충분할 것 같아서요. 14:34 정태영: 맞아요, 그 정도 규모면 기본 PA로도 충분합니다. 그 부분 조정하면 470만원 선으로 맞출 수 있을 것 같아요. 14:35 김지수: 좋아요, 그럼 수정 견적서 다시 보내주시면 내부 결재 진행할게요. 14:35 정태영: 네, 오늘 중으로 보내드리겠습니다. 혹시 행사 날짜가 5월 중 언제 예정이세요? 14:36 김지수: 5월 23일 금요일입니다. 오전 10시부터 오후 5시까지예요. 14:36 정태영: 확인했습니다. 셋업은 전날인 22일에 하는 걸로 계획하면 될까요? 14:37 김지수: 네, 그렇게 해주시면 좋겠어요. 그리고 담당 선생님 연락처 따로 드릴게요. 14:37 정태영: 감사합니다. 오늘 수정 견적 보내드리겠습니다.`,
        contacted_at: '2026-04-13T14:37:00Z',
        author_name: '정태영',
      },
      {
        id: 'l4',
        content: '수정 견적서 470만원으로 발송 완료. 내부 결재 후 회신 예정.',
        contacted_at: '2026-04-13T17:00:00Z',
        author_name: '정태영',
      },
      {
        id: 'l5',
        content: '미팅 일정 조율 완료. 4/18 오전 10시 방문 예정. 담당 선생님 홍민준 010-2345-6789.',
        contacted_at: '2026-04-15T09:00:00Z',
        author_name: '정태영',
      },
    ],
    ai_summary: '예산 500만원 → 470만원으로 조정 협의 완료. 5/23 행사, 5/22 셋업. 수정 견적 발송 후 내부 결재 대기 중. 4/18 현장 미팅 예정.',
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
      { id: 'l6', content: 'SNS DM으로 홍보 영상 제작 문의. 예산/일정 미확인.', contacted_at: '2026-04-14T16:00:00Z', author_name: '조민현' },
    ],
    ai_summary: null,
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
    notes: '드럼 2조, 앰프 4개 / 6월 중',
    logs: [
      { id: 'l7', content: '홈페이지 폼 문의. 드럼 세트 2조, 앰프 4개 6월 렌탈 희망.', contacted_at: '2026-04-08T11:00:00Z', author_name: '유제민' },
      { id: 'l8', content: '견적서 발송 완료. 검토 후 회신 요청.', contacted_at: '2026-04-11T10:00:00Z', author_name: '유제민' },
    ],
    ai_summary: '드럼 2조·앰프 4개 6월 렌탈 견적 발송. 회신 대기 중. 4/20까지 리마인드 필요.',
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
      { id: 'l9', content: '예산 삭감으로 행사 전면 취소 통보. 추후 재논의 가능성 있음.', contacted_at: '2026-04-01T09:00:00Z', author_name: '정태영' },
    ],
    ai_summary: null,
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
      { id: 'l10', content: '계약 체결 완료. 착수금 수령.', contacted_at: '2026-03-25T10:00:00Z', author_name: '조민현' },
    ],
    ai_summary: null,
  },
]

const STATUS_CONFIG: Record<string, { dot: string; badge: string }> = {
  '유입': { dot: 'bg-gray-400',    badge: 'bg-gray-100 text-gray-500' },
  '미팅': { dot: 'bg-blue-400',    badge: 'bg-blue-100 text-blue-700' },
  '견적': { dot: 'bg-violet-400',  badge: 'bg-violet-100 text-violet-700' },
  '협상': { dot: 'bg-orange-400',  badge: 'bg-orange-100 text-orange-700' },
  '완료': { dot: 'bg-emerald-400', badge: 'bg-emerald-100 text-emerald-700' },
  '취소': { dot: 'bg-red-300',     badge: 'bg-red-100 text-red-400' },
}

const SERVICE_COLORS: Record<string, string> = {
  'SOS':           'text-yellow-700 bg-yellow-50 border-yellow-200',
  '002크리에이티브': 'text-purple-700 bg-purple-50 border-purple-200',
  '렌탈':          'text-blue-700 bg-blue-50 border-blue-200',
  'CS':            'text-green-700 bg-green-50 border-green-200',
  '학교상점':       'text-pink-700 bg-pink-50 border-pink-200',
}

const LOG_COLLAPSE_THRESHOLD = 80  // 이 글자 수 초과 시 기본 접힘

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

// 소통 내역 단일 항목 — 길면 접기/펼치기
function LogItem({ log }: { log: { id: string; content: string; contacted_at: string; author_name: string } }) {
  const isLong = log.content.length > LOG_COLLAPSE_THRESHOLD
  const [expanded, setExpanded] = useState(!isLong)

  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center flex-shrink-0">
        <div className="w-2 h-2 rounded-full bg-yellow-400 mt-1.5" />
        <div className="w-px flex-1 bg-gray-100 my-1.5" />
      </div>
      <div className="pb-4 flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-semibold text-gray-600">{log.author_name}</span>
          <span className="text-xs text-gray-400">{timeAgo(log.contacted_at)}</span>
        </div>
        <p className={`text-sm text-gray-700 leading-relaxed whitespace-pre-line ${!expanded ? 'line-clamp-2' : ''}`}>
          {log.content}
        </p>
        {isLong && (
          <button
            onClick={() => setExpanded(v => !v)}
            className="mt-1 text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            {expanded ? '▲ 접기' : '▼ 전체 보기'}
          </button>
        )}
      </div>
    </div>
  )
}

export default function LeadsDemoV5() {
  const [selectedId, setSelectedId] = useState<string | null>('1')
  const [filter, setFilter] = useState('전체')
  const [showClosed, setShowClosed] = useState(false)
  const [logInput, setLogInput] = useState('')
  const [showAiSummary, setShowAiSummary] = useState<Record<string, boolean>>({})
  const [loadingAi, setLoadingAi] = useState(false)

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

  function handleAiSummary(id: string) {
    if (showAiSummary[id]) {
      setShowAiSummary(v => ({ ...v, [id]: false }))
      return
    }
    setLoadingAi(true)
    setTimeout(() => {
      setLoadingAi(false)
      setShowAiSummary(v => ({ ...v, [id]: true }))
    }, 1200)
  }

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
                  <span className="text-gray-300 mx-0.5">·</span>
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

        <div className="flex items-center gap-1 mt-3">
          {statuses.map(s => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                filter === s ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-100'
              }`}
            >
              {s}
              {s !== '전체' && counts[s] ? <span className="ml-1 opacity-60 text-xs">{counts[s]}</span> : null}
            </button>
          ))}
          <div className="flex-1" />
          <button
            onClick={() => setShowClosed(!showClosed)}
            className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1.5 rounded-lg hover:bg-gray-100"
          >
            {showClosed ? '완료/취소 숨기기' : '완료/취소 보기'}
          </button>
        </div>
      </div>

      {/* 바디 */}
      <div className="flex flex-1 overflow-hidden">

        {/* 왼쪽 목록 */}
        <div className="w-[340px] flex-shrink-0 border-r border-gray-200 bg-white overflow-y-auto">
          <div className="p-2 space-y-1">
            {filtered.map(lead => {
              const cfg = STATUS_CONFIG[lead.status] || STATUS_CONFIG['유입']
              const isSelected = lead.id === selectedId
              const isRemind = lead.remind_date &&
                new Date(lead.remind_date) <= new Date(Date.now() + 2 * 86400000)
              const lastLog = lead.logs[lead.logs.length - 1]

              return (
                <button
                  key={lead.id}
                  onClick={() => setSelectedId(lead.id)}
                  className={`w-full text-left px-3.5 py-3.5 rounded-xl transition-all ${
                    isSelected
                      ? 'bg-yellow-50 border border-yellow-200'
                      : 'hover:bg-gray-50 border border-transparent'
                  }`}
                >
                  {/* 행 1: 이름 + 상태 배지 */}
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${cfg.dot}`} />
                      <span className="text-sm font-semibold text-gray-900 truncate">
                        {lead.contact_name}
                      </span>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${cfg.badge}`}>
                      {lead.status}
                    </span>
                  </div>

                  {/* 행 2: 기관명 + 서비스 태그 */}
                  <div className="flex items-center justify-between gap-2 pl-4 mb-2">
                    <span className="text-xs text-gray-500 truncate flex-1 min-w-0">
                      {lead.client_org}
                    </span>
                    <span className={`text-xs px-1.5 py-0.5 rounded border font-medium flex-shrink-0 ${
                      SERVICE_COLORS[lead.service_type] || 'text-gray-400 bg-gray-50 border-gray-200'
                    }`}>
                      {lead.service_type}
                    </span>
                  </div>

                  {/* 행 3: 최근 소통 미리보기 */}
                  <div className="pl-4">
                    {lastLog ? (
                      <p className="text-xs text-gray-400 leading-relaxed line-clamp-1">
                        {lastLog.content}
                      </p>
                    ) : (
                      <p className="text-xs text-gray-300">소통 없음</p>
                    )}
                  </div>

                  {/* 행 4: 담당자 + 날짜 + 리마인드 */}
                  <div className="flex items-center gap-2 pl-4 mt-1.5">
                    <span className="text-xs text-gray-400">{lead.assignee_name}</span>
                    <span className="text-gray-200 text-xs">·</span>
                    <span className="text-xs text-gray-400">{toMMDD(lead.inflow_date)} 유입</span>
                    {isRemind && (
                      <>
                        <span className="text-gray-200 text-xs">·</span>
                        <span className="text-xs text-red-500 font-medium">
                          📅 {toMMDD(lead.remind_date!)}
                        </span>
                      </>
                    )}
                  </div>
                </button>
              )
            })}

            {filtered.length === 0 && (
              <div className="py-12 text-center text-sm text-gray-400">
                해당 조건의 리드가 없습니다.
              </div>
            )}
          </div>
        </div>

        {/* 오른쪽 상세 패널 */}
        {selected ? (
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-2xl mx-auto px-8 py-6">

              {/* 타이틀 */}
              <div className="flex items-start justify-between gap-4 mb-5">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${
                      STATUS_CONFIG[selected.status]?.badge
                    }`}>
                      {selected.status}
                    </span>
                    <span className={`text-xs px-2 py-1 rounded border font-medium ${
                      SERVICE_COLORS[selected.service_type] || 'text-gray-400 bg-gray-50 border-gray-200'
                    }`}>
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

              {/* 정보 카드 */}
              <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-5">
                <div className="grid grid-cols-2 gap-x-8 gap-y-3.5">
                  <InfoRow label="담당자"   value={selected.assignee_name} />
                  <InfoRow label="유입 채널" value={selected.channel || '—'} />
                  <InfoRow label="전화"     value={selected.phone || '—'} highlight />
                  <InfoRow label="이메일"   value={selected.email || '—'} />
                  <InfoRow label="유입일"   value={toMMDD(selected.inflow_date) + ' 유입'} />
                  {selected.remind_date && (
                    <InfoRow label="리마인드" value={toMMDD(selected.remind_date) + ' 예정'} warn />
                  )}
                  {selected.project_name && (
                    <div className="col-span-2 pt-3 border-t border-gray-100">
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
              <div className="bg-white rounded-2xl border border-gray-200 p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-gray-700">
                    소통 내역
                    <span className="text-gray-400 font-normal ml-1.5">{selected.logs.length}건</span>
                  </h3>

                  {/* AI 요약 버튼 */}
                  {selected.logs.length >= 2 && (
                    <button
                      onClick={() => handleAiSummary(selected.id)}
                      disabled={loadingAi}
                      className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                        showAiSummary[selected.id]
                          ? 'bg-violet-50 border-violet-200 text-violet-700'
                          : 'bg-gray-50 border-gray-200 text-gray-500 hover:border-gray-300 hover:text-gray-700'
                      } disabled:opacity-50`}
                    >
                      {loadingAi ? (
                        <>
                          <span className="animate-spin">⏳</span>
                          <span>요약 중...</span>
                        </>
                      ) : showAiSummary[selected.id] ? (
                        <>✦ AI 요약 닫기</>
                      ) : (
                        <>✦ AI로 요약</>
                      )}
                    </button>
                  )}
                </div>

                {/* AI 요약 카드 */}
                {showAiSummary[selected.id] && selected.ai_summary && (
                  <div className="mb-4 bg-violet-50 border border-violet-200 rounded-xl p-3.5">
                    <div className="flex items-center gap-1.5 mb-2">
                      <span className="text-xs font-semibold text-violet-700">✦ AI 요약</span>
                    </div>
                    <p className="text-sm text-violet-900 leading-relaxed">{selected.ai_summary}</p>
                  </div>
                )}

                {/* 타임라인 */}
                <div className="space-y-0">
                  {selected.logs.slice().reverse().map(log => (
                    <LogItem key={log.id} log={log} />
                  ))}
                </div>

                {/* 소통 입력 */}
                <div className="mt-2 border border-gray-200 rounded-xl p-3.5 bg-gray-50">
                  <textarea
                    value={logInput}
                    onChange={e => setLogInput(e.target.value)}
                    placeholder="소통 내용 입력 (전사록, 메모 등 자유롭게)..."
                    className="w-full text-sm text-gray-700 bg-transparent resize-none outline-none placeholder-gray-300 min-h-[60px]"
                  />
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-200">
                    <button
                      onClick={() =>
                        setLogInput(v =>
                          (v ? v + ' ' : '') +
                          new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
                        )
                      }
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

function InfoRow({ label, value, highlight, warn }: {
  label: string; value: string; highlight?: boolean; warn?: boolean
}) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-xs text-gray-400 w-20 flex-shrink-0">{label}</span>
      <span className={`text-sm font-medium break-all ${
        highlight ? 'text-blue-600' : warn ? 'text-orange-600' : 'text-gray-800'
      }`}>
        {value}
      </span>
    </div>
  )
}
