'use client'
import { useState, useRef } from 'react'

// ============================================================
// 리드 관리 데모 v5 — 인터랙티브 (작성/수정/소통 저장 가능)
// ============================================================

type Log = { id: string; content: string; contacted_at: string; author_name: string }
type Lead = {
  id: string; lead_id: string; status: string
  contact_name: string; client_org: string
  phone: string; email: string; office_phone: string
  service_type: string; project_name: string
  inflow_date: string; remind_date: string
  channel: string; assignee_name: string; notes: string
  logs: Log[]
  // 고객 카드
  customer_region: string; customer_type: string
  contact_title: string; contact_dept: string
}

const STATUSES   = ['유입', '미팅', '견적', '협상', '완료', '취소']
const SERVICES   = ['SOS', '002크리에이티브', '렌탈', 'CS', '학교상점']
const CHANNELS   = ['이메일', '인스타그램', '홈페이지', '지인소개', '전화', '기타']
const ASSIGNEES  = ['정태영', '조민현', '유제민', '임지영', '김수아']
const REGIONS    = ['서울', '경기', '인천', '부산', '대구', '광주', '대전', '세종', '기타']
const CUST_TYPES = ['공공기관', '학교', '기업', '개인', '비영리', '기타']

const INIT_LEADS: Lead[] = [
  {
    id: '1', lead_id: 'LEAD20260416-0001', status: '미팅',
    contact_name: '김지수', client_org: '서울시교육청',
    phone: '010-1234-5678', email: 'jisu.kim@seoul.go.kr', office_phone: '02-3456-0000',
    service_type: 'SOS', project_name: '2026 진로체험 페스티벌',
    inflow_date: '2026-04-10', remind_date: '2026-04-18',
    channel: '이메일', assignee_name: '정태영', notes: '예산 500만원, 학생 200명',
    customer_region: '서울', customer_type: '공공기관', contact_title: '팀장', contact_dept: '진로교육팀',
    logs: [
      { id: 'l1', content: '이메일로 문의 접수. 5월 행사 견적 요청.', contacted_at: '2026-04-10T10:00:00Z', author_name: '정태영' },
      { id: 'l2', content: '전화 통화. 예산 500만원, 학생 200명 확인.', contacted_at: '2026-04-12T14:30:00Z', author_name: '정태영' },
      { id: 'l3', content: `[전사록 4/13 14:32]\n정태영: 견적서 검토 어떠셨어요?\n김지수: 음향 장비 쪽이 좀 오버되더라고요. PA 기본으로 조정 가능할까요?\n정태영: 470만원으로 맞출 수 있습니다.\n김지수: 좋아요, 수정 견적 다시 보내주세요. 5/23 행사, 5/22 셋업 예정.`, contacted_at: '2026-04-13T14:37:00Z', author_name: '정태영' },
      { id: 'l4', content: '수정 견적 470만원 발송. 내부 결재 후 회신 예정.', contacted_at: '2026-04-13T17:00:00Z', author_name: '정태영' },
      { id: 'l5', content: '미팅 확정. 4/18 오전 10시. 담당 홍민준 010-2345-6789.', contacted_at: '2026-04-15T09:00:00Z', author_name: '정태영' },
    ],
  },
  {
    id: '2', lead_id: 'LEAD20260416-0002', status: '유입',
    contact_name: '박현우', client_org: '경기도문화재단',
    phone: '010-9876-5432', email: '', office_phone: '',
    service_type: '002크리에이티브', project_name: '',
    inflow_date: '2026-04-14', remind_date: '',
    channel: '인스타그램', assignee_name: '조민현', notes: '',
    customer_region: '경기', customer_type: '공공기관', contact_title: '', contact_dept: '',
    logs: [
      { id: 'l6', content: 'SNS DM으로 홍보 영상 제작 문의. 예산/일정 미확인.', contacted_at: '2026-04-14T16:00:00Z', author_name: '조민현' },
    ],
  },
  {
    id: '3', lead_id: 'LEAD20260416-0003', status: '견적',
    contact_name: '이수진', client_org: '한국청소년활동진흥원',
    phone: '02-3456-7890', email: 'sujin.lee@kywa.or.kr', office_phone: '',
    service_type: '렌탈', project_name: '청소년 음악캠프 장비 렌탈',
    inflow_date: '2026-04-08', remind_date: '2026-04-20',
    channel: '홈페이지', assignee_name: '유제민', notes: '드럼 2조, 앰프 4개 / 6월 중',
    customer_region: '서울', customer_type: '비영리', contact_title: '담당자', contact_dept: '사업팀',
    logs: [
      { id: 'l7', content: '홈페이지 폼 문의. 드럼 세트 2조, 앰프 4개 6월 렌탈.', contacted_at: '2026-04-08T11:00:00Z', author_name: '유제민' },
      { id: 'l8', content: '견적서 발송 완료. 검토 후 회신 요청.', contacted_at: '2026-04-11T10:00:00Z', author_name: '유제민' },
    ],
  },
]

// ── 상수 ──────────────────────────────────────────────────────────
const STATUS_CFG: Record<string, { dot: string; badge: string }> = {
  '유입': { dot: 'bg-gray-400',    badge: 'bg-gray-100 text-gray-500' },
  '미팅': { dot: 'bg-blue-400',    badge: 'bg-blue-100 text-blue-700' },
  '견적': { dot: 'bg-violet-400',  badge: 'bg-violet-100 text-violet-700' },
  '협상': { dot: 'bg-orange-400',  badge: 'bg-orange-100 text-orange-700' },
  '완료': { dot: 'bg-emerald-400', badge: 'bg-emerald-100 text-emerald-700' },
  '취소': { dot: 'bg-red-300',     badge: 'bg-red-100 text-red-400' },
}
const SVC_CLR: Record<string, string> = {
  'SOS':           'text-yellow-700 bg-yellow-50 border-yellow-200',
  '002크리에이티브': 'text-purple-700 bg-purple-50 border-purple-200',
  '렌탈':          'text-blue-700 bg-blue-50 border-blue-200',
  'CS':            'text-green-700 bg-green-50 border-green-200',
  '학교상점':       'text-pink-700 bg-pink-50 border-pink-200',
}

// ── 유틸 ──────────────────────────────────────────────────────────
function getDday(dateStr: string): number | null {
  if (!dateStr) return null
  const today = new Date(); today.setHours(0,0,0,0)
  const target = new Date(dateStr); target.setHours(0,0,0,0)
  return Math.round((target.getTime() - today.getTime()) / 86400000)
}
function DdayBadge({ d }: { d: number }) {
  if (d === 0) return <span className="font-extrabold text-sm text-white bg-red-500 px-2.5 py-1 rounded-lg">D-DAY</span>
  if (d < 0)   return <span className="font-extrabold text-sm text-red-600 bg-red-100 px-2.5 py-1 rounded-lg">D+{Math.abs(d)}</span>
  if (d <= 3)  return <span className="font-extrabold text-sm text-orange-600 bg-orange-100 px-2.5 py-1 rounded-lg">D-{d}</span>
  if (d <= 7)  return <span className="font-extrabold text-sm text-yellow-700 bg-yellow-100 px-2.5 py-1 rounded-lg">D-{d}</span>
  return <span className="font-bold text-sm text-gray-500 bg-gray-100 px-2.5 py-1 rounded-lg">D-{d}</span>
}
function timeAgo(iso: string) {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
  if (d === 0) return '오늘'
  if (d === 1) return '어제'
  if (d < 7)  return `${d}일 전`
  return new Date(iso).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
}
function uid() { return Math.random().toString(36).slice(2) }

// ── 폼 기본값 ────────────────────────────────────────────────────
const BLANK_LEAD: Omit<Lead, 'id' | 'lead_id' | 'logs'> = {
  status: '유입', contact_name: '', client_org: '', phone: '', email: '',
  office_phone: '', service_type: 'SOS', project_name: '',
  inflow_date: new Date().toISOString().slice(0, 10), remind_date: '',
  channel: '이메일', assignee_name: '정태영', notes: '',
  customer_region: '', customer_type: '', contact_title: '', contact_dept: '',
}

// ── 긴 소통 내역 접기 ────────────────────────────────────────────
function LogItem({ log, onDelete }: { log: Log; onDelete: () => void }) {
  const long = log.content.length > 80
  const [exp, setExp] = useState(!long)
  return (
    <div className="flex gap-3 group">
      <div className="flex flex-col items-center flex-shrink-0">
        <div className="w-2 h-2 rounded-full bg-yellow-400 mt-1.5" />
        <div className="w-px flex-1 bg-gray-100 my-1.5" />
      </div>
      <div className="pb-4 flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-semibold text-gray-600">{log.author_name}</span>
          <span className="text-xs text-gray-400">{timeAgo(log.contacted_at)}</span>
          <button onClick={onDelete} className="ml-auto text-xs text-gray-300 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">삭제</button>
        </div>
        <p className={`text-sm text-gray-700 leading-relaxed whitespace-pre-line ${!exp ? 'line-clamp-2' : ''}`}>
          {log.content}
        </p>
        {long && (
          <button onClick={() => setExp(v => !v)} className="mt-1 text-xs text-gray-400 hover:text-gray-600">
            {exp ? '▲ 접기' : '▼ 전체 보기'}
          </button>
        )}
      </div>
    </div>
  )
}

// ── 인풋 공통 ────────────────────────────────────────────────────
const LBL = 'block text-xs font-medium text-gray-500 mb-1'
const INP = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-300'
const SEL = INP + ' bg-white'

// ── 메인 ─────────────────────────────────────────────────────────
export default function LeadsDemoV5() {
  const [leads, setLeads] = useState<Lead[]>(INIT_LEADS)
  const [selectedId, setSelectedId] = useState<string | null>('1')
  const [tab, setTab] = useState<'info' | 'logs' | 'customer'>('info')
  const [filter, setFilter] = useState('전체')
  const [showClosed, setShowClosed] = useState(false)
  const [showNewForm, setShowNewForm] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [form, setForm] = useState<Omit<Lead, 'id' | 'lead_id' | 'logs'>>(BLANK_LEAD)
  const [logInput, setLogInput] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [showAi, setShowAi] = useState(false)
  const logRef = useRef<HTMLTextAreaElement>(null)

  const filtered = leads.filter(l => {
    if (!showClosed && (l.status === '완료' || l.status === '취소')) return false
    if (filter !== '전체' && l.status !== filter) return false
    return true
  })
  const selected = leads.find(l => l.id === selectedId) ?? null
  const counts = leads.reduce((a, l) => { a[l.status] = (a[l.status] || 0) + 1; return a }, {} as Record<string, number>)
  const activeCount = leads.filter(l => !['완료', '취소'].includes(l.status)).length
  const remindCount = leads.filter(l => {
    const d = getDday(l.remind_date)
    return d !== null && d <= 3 && !['완료', '취소'].includes(l.status)
  }).length

  // ── 저장 ──
  function saveLead() {
    if (editMode && selected) {
      setLeads(ls => ls.map(l => l.id === selected.id ? { ...l, ...form } : l))
      setEditMode(false)
    } else {
      const newId = uid()
      const newLead: Lead = {
        ...form, id: newId,
        lead_id: `LEAD${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${String(leads.length+1).padStart(4,'0')}`,
        logs: [],
      }
      setLeads(ls => [newLead, ...ls])
      setSelectedId(newId)
      setShowNewForm(false)
      setTab('info')
    }
  }

  function openNew() {
    setForm(BLANK_LEAD)
    setShowNewForm(true)
    setEditMode(false)
  }
  function openEdit() {
    if (!selected) return
    setForm({
      status: selected.status, contact_name: selected.contact_name,
      client_org: selected.client_org, phone: selected.phone, email: selected.email,
      office_phone: selected.office_phone, service_type: selected.service_type,
      project_name: selected.project_name, inflow_date: selected.inflow_date,
      remind_date: selected.remind_date, channel: selected.channel,
      assignee_name: selected.assignee_name, notes: selected.notes,
      customer_region: selected.customer_region, customer_type: selected.customer_type,
      contact_title: selected.contact_title, contact_dept: selected.contact_dept,
    })
    setEditMode(true)
    setShowNewForm(true)
  }

  function addLog() {
    if (!logInput.trim() || !selected) return
    const newLog: Log = {
      id: uid(), content: logInput.trim(),
      contacted_at: new Date().toISOString(), author_name: '나 (데모)',
    }
    setLeads(ls => ls.map(l => l.id === selected.id ? { ...l, logs: [...l.logs, newLog] } : l))
    setLogInput('')
    setShowAi(false)
  }
  function deleteLog(logId: string) {
    if (!selected) return
    setLeads(ls => ls.map(l => l.id === selected.id ? { ...l, logs: l.logs.filter(g => g.id !== logId) } : l))
  }

  function handleAi() {
    if (showAi) { setShowAi(false); return }
    setAiLoading(true)
    setTimeout(() => { setAiLoading(false); setShowAi(true) }, 1100)
  }

  const AI_SUMMARIES: Record<string, string> = {
    '1': '예산 500만 → 470만으로 조정 협의. 5/23 행사 · 5/22 셋업. 수정 견적 발송 후 내부 결재 대기. 4/18 오전 미팅 예정.',
    '3': '드럼 2조 · 앰프 4개 6월 렌탈 견적 발송. 회신 대기. 4/20 리마인드.',
  }

  // ── 폼 패널 (신규/수정 공통) ──────────────────────────────────
  function setF<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm(f => ({ ...f, [k]: v }))
  }

  return (
    <div className="h-screen bg-gray-50 flex flex-col overflow-hidden">

      {/* 헤더 */}
      <div className="bg-white border-b border-gray-200 px-6 py-3.5 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-bold text-gray-900">리드 관리</h1>
            <div className="flex items-center gap-1.5 text-xs">
              <span className="bg-gray-800 text-white rounded-full px-2 py-0.5 font-semibold">{activeCount}</span>
              <span className="text-gray-400">활성</span>
              {remindCount > 0 && <>
                <span className="text-gray-300 mx-0.5">·</span>
                <span className="bg-red-500 text-white rounded-full px-2 py-0.5 font-semibold">{remindCount}</span>
                <span className="text-gray-400">리마인드</span>
              </>}
            </div>
          </div>
          <button onClick={openNew} className="bg-yellow-400 hover:bg-yellow-500 text-gray-900 text-sm font-semibold px-4 py-2 rounded-xl transition-colors">
            + 새 리드
          </button>
        </div>
        <div className="flex items-center gap-1 mt-3">
          {['전체', '유입', '미팅', '견적', '협상'].map(s => (
            <button key={s} onClick={() => setFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${filter === s ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-100'}`}>
              {s}{s !== '전체' && counts[s] ? <span className="ml-1 opacity-60 text-xs">{counts[s]}</span> : null}
            </button>
          ))}
          <div className="flex-1" />
          <button onClick={() => setShowClosed(v => !v)} className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1.5 rounded-lg hover:bg-gray-100">
            {showClosed ? '완료/취소 숨기기' : '완료/취소 보기'}
          </button>
        </div>
      </div>

      {/* 바디 */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── 왼쪽 목록 ── */}
        <div className="w-[380px] flex-shrink-0 border-r border-gray-200 bg-white overflow-y-auto">
          <div className="p-2 space-y-1.5">
            {filtered.map(lead => {
              const cfg = STATUS_CFG[lead.status] || STATUS_CFG['유입']
              const dday = getDday(lead.remind_date)
              const isSelected = lead.id === selectedId
              const lastLog = lead.logs[lead.logs.length - 1]

              return (
                <button key={lead.id} onClick={() => { setSelectedId(lead.id); setTab('info'); setShowAi(false) }}
                  className={`w-full text-left px-4 py-3.5 rounded-xl transition-all ${isSelected ? 'bg-yellow-50 border border-yellow-200' : 'hover:bg-gray-50 border border-transparent'}`}>

                  {/* 행 1: D-day + 상태 + 서비스 */}
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      {dday !== null ? <DdayBadge d={dday} /> : <span className="text-xs text-gray-300">—</span>}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.badge}`}>{lead.status}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded border font-medium ${SVC_CLR[lead.service_type] || 'bg-gray-50 text-gray-400 border-gray-200'}`}>
                        {lead.service_type}
                      </span>
                    </div>
                  </div>

                  {/* 행 2: 프로젝트명 (메인 식별자) */}
                  <p className="text-sm font-bold text-gray-900 mb-0.5 truncate">
                    {lead.project_name || '(프로젝트명 없음)'}
                  </p>

                  {/* 행 3: 담당자명 · 기관 */}
                  <div className="flex items-center gap-1.5 mb-2">
                    <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dot}`} />
                    <span className="text-xs text-gray-600 font-medium">{lead.contact_name}</span>
                    {lead.client_org && <><span className="text-gray-300 text-xs">·</span>
                    <span className="text-xs text-gray-400 truncate">{lead.client_org}</span></>}
                  </div>

                  {/* 행 4: 최근 소통 미리보기 */}
                  {lastLog && (
                    <p className="text-xs text-gray-400 line-clamp-1 leading-relaxed">
                      {lastLog.content}
                    </p>
                  )}

                  {/* 행 5: 담당 · 채널 */}
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-xs text-gray-400">{lead.assignee_name}</span>
                    <span className="text-gray-200 text-xs">·</span>
                    <span className="text-xs text-gray-400">{lead.channel}</span>
                    <span className="text-gray-200 text-xs">·</span>
                    <span className="text-xs text-gray-400">{lead.inflow_date.slice(5).replace('-','/')} 유입</span>
                  </div>
                </button>
              )
            })}
            {filtered.length === 0 && (
              <p className="text-center py-12 text-sm text-gray-400">해당 조건의 리드가 없습니다.</p>
            )}
          </div>
        </div>

        {/* ── 오른쪽 상세 ── */}
        {selected ? (
          <div className="flex-1 overflow-y-auto bg-white">
            <div className="max-w-2xl mx-auto px-8 py-6">

              {/* 타이틀 */}
              <div className="flex items-start justify-between gap-4 mb-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-1.5">
                    {(() => { const d = getDday(selected.remind_date); return d !== null ? <DdayBadge d={d} /> : null })()}
                    <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${STATUS_CFG[selected.status]?.badge}`}>{selected.status}</span>
                    <span className={`text-xs px-2 py-1 rounded border font-medium ${SVC_CLR[selected.service_type] || 'bg-gray-50 text-gray-400 border-gray-200'}`}>{selected.service_type}</span>
                    <span className="text-xs text-gray-300 font-mono ml-1">{selected.lead_id}</span>
                  </div>
                  <h2 className="text-xl font-bold text-gray-900 leading-tight">
                    {selected.project_name || '(프로젝트명 없음)'}
                  </h2>
                  <p className="text-gray-500 text-sm mt-0.5">{selected.contact_name} · {selected.client_org}</p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button onClick={openEdit} className="text-sm border border-gray-200 hover:border-gray-300 text-gray-600 px-3 py-1.5 rounded-xl transition-colors">수정</button>
                  <button className="text-sm bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-semibold px-3 py-1.5 rounded-xl transition-colors">계약 전환</button>
                </div>
              </div>

              {/* 탭 */}
              <div className="flex gap-0 border-b border-gray-200 mb-5 mt-4">
                {(['info','logs','customer'] as const).map(t => (
                  <button key={t} onClick={() => setTab(t)}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${tab === t ? 'border-yellow-400 text-gray-900' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
                    {t === 'info' ? '기본 정보' : t === 'logs' ? `소통 내역 ${selected.logs.length}` : '고객 카드'}
                  </button>
                ))}
              </div>

              {/* ── 탭: 기본 정보 ── */}
              {tab === 'info' && (
                <div className="bg-white rounded-2xl border border-gray-200 p-5">
                  <div className="grid grid-cols-2 gap-x-8 gap-y-3.5">
                    <InfoRow label="담당자"    value={selected.assignee_name} />
                    <InfoRow label="유입 채널" value={selected.channel} />
                    <InfoRow label="전화"      value={selected.phone || '—'} highlight />
                    <InfoRow label="이메일"    value={selected.email || '—'} />
                    {selected.office_phone && <InfoRow label="사무실" value={selected.office_phone} />}
                    <InfoRow label="유입일"    value={selected.inflow_date} />
                    {selected.remind_date && <InfoRow label="리마인드" value={selected.remind_date} warn />}
                    {selected.notes && (
                      <div className="col-span-2 pt-3 border-t border-gray-100">
                        <InfoRow label="메모" value={selected.notes} />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ── 탭: 소통 내역 ── */}
              {tab === 'logs' && (
                <div className="bg-white rounded-2xl border border-gray-200 p-5">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-sm font-semibold text-gray-700">소통 내역 <span className="text-gray-400 font-normal">{selected.logs.length}건</span></span>
                    {selected.logs.length >= 2 && (
                      <button onClick={handleAi} disabled={aiLoading}
                        className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors ${showAi ? 'bg-violet-50 border-violet-200 text-violet-700' : 'bg-gray-50 border-gray-200 text-gray-500 hover:border-gray-300'} disabled:opacity-50`}>
                        {aiLoading ? <><span className="animate-spin inline-block">⏳</span> 요약 중...</> : showAi ? '✦ AI 요약 닫기' : '✦ AI로 요약'}
                      </button>
                    )}
                  </div>

                  {showAi && AI_SUMMARIES[selected.id] && (
                    <div className="mb-4 bg-violet-50 border border-violet-200 rounded-xl p-3.5">
                      <p className="text-xs font-semibold text-violet-700 mb-1">✦ AI 요약</p>
                      <p className="text-sm text-violet-900 leading-relaxed">{AI_SUMMARIES[selected.id]}</p>
                    </div>
                  )}

                  <div className="space-y-0 mb-4">
                    {selected.logs.length === 0 && (
                      <p className="text-sm text-gray-400 text-center py-6">소통 내역이 없습니다.</p>
                    )}
                    {[...selected.logs].reverse().map(log => (
                      <LogItem key={log.id} log={log} onDelete={() => deleteLog(log.id)} />
                    ))}
                  </div>

                  {/* 소통 입력 */}
                  <div className="border border-gray-200 rounded-xl p-3.5 bg-gray-50">
                    <textarea ref={logRef} value={logInput} onChange={e => setLogInput(e.target.value)}
                      placeholder="소통 내용, 통화 전사록, 메모 등 자유롭게 입력..."
                      className="w-full text-sm text-gray-700 bg-transparent resize-none outline-none placeholder-gray-300 min-h-[64px]" />
                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-200">
                      <button
                        onClick={() => setLogInput(v => (v ? v + '\n' : '') + new Date().toLocaleTimeString('ko-KR', {hour:'2-digit', minute:'2-digit'}) + ' ')}
                        className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
                        현재 시간 입력
                      </button>
                      <button onClick={addLog} className="text-xs bg-gray-900 text-white px-3 py-1.5 rounded-lg hover:bg-gray-700 transition-colors">
                        저장
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* ── 탭: 고객 카드 ── */}
              {tab === 'customer' && (
                <div className="space-y-3">
                  {/* 기관 카드 */}
                  <div className="bg-white rounded-2xl border border-gray-200 p-5">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">기관 정보</p>
                    <div className="grid grid-cols-2 gap-x-8 gap-y-3">
                      <InfoRow label="기관명"   value={selected.client_org || '—'} />
                      <InfoRow label="지역"     value={selected.customer_region || '—'} />
                      <InfoRow label="기관 유형" value={selected.customer_type || '—'} />
                    </div>
                  </div>

                  {/* 담당자 카드 */}
                  <div className="bg-white rounded-2xl border border-gray-200 p-5">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">담당자</p>
                    <div className="grid grid-cols-2 gap-x-8 gap-y-3">
                      <InfoRow label="이름"   value={selected.contact_name || '—'} />
                      <InfoRow label="직급"   value={selected.contact_title || '—'} />
                      <InfoRow label="부서"   value={selected.contact_dept || '—'} />
                      <InfoRow label="전화"   value={selected.phone || '—'} highlight />
                      <InfoRow label="이메일" value={selected.email || '—'} />
                    </div>
                  </div>

                  {/* 다른 리드 연결 안내 */}
                  <div className="bg-gray-50 rounded-xl p-4 text-center">
                    <p className="text-xs text-gray-400">이 고객과 연결된 다른 리드 · 계약이 있으면 여기에 표시됩니다.</p>
                  </div>
                </div>
              )}

            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-white">
            <p className="text-sm text-gray-400">왼쪽에서 리드를 선택하세요</p>
          </div>
        )}
      </div>

      {/* ── 신규/수정 폼 (슬라이드 오버레이) ── */}
      {showNewForm && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/30" onClick={() => { setShowNewForm(false); setEditMode(false) }} />
          <div className="w-[480px] bg-white shadow-2xl overflow-y-auto flex flex-col">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
              <h2 className="text-base font-bold text-gray-900">{editMode ? '리드 수정' : '새 리드 추가'}</h2>
              <button onClick={() => { setShowNewForm(false); setEditMode(false) }} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
            </div>

            <div className="flex-1 px-6 py-5 space-y-4 overflow-y-auto">

              {/* 프로젝트명 */}
              <div>
                <label className={LBL}>프로젝트명</label>
                <input type="text" className={INP} placeholder="ex) 2026 진로체험 페스티벌"
                  value={form.project_name} onChange={e => setF('project_name', e.target.value)} />
              </div>

              {/* 담당자 이름 + 기관 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LBL}>담당자 이름 *</label>
                  <input type="text" className={INP} placeholder="홍길동"
                    value={form.contact_name} onChange={e => setF('contact_name', e.target.value)} />
                </div>
                <div>
                  <label className={LBL}>기관명</label>
                  <input type="text" className={INP} placeholder="서울시교육청"
                    value={form.client_org} onChange={e => setF('client_org', e.target.value)} />
                </div>
              </div>

              {/* 전화 + 이메일 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LBL}>전화번호</label>
                  <input type="text" className={INP} placeholder="010-0000-0000"
                    value={form.phone} onChange={e => setF('phone', e.target.value)} />
                </div>
                <div>
                  <label className={LBL}>이메일</label>
                  <input type="text" className={INP} placeholder="email@example.com"
                    value={form.email} onChange={e => setF('email', e.target.value)} />
                </div>
              </div>

              {/* 서비스 + 채널 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LBL}>서비스 유형</label>
                  <select className={SEL} value={form.service_type} onChange={e => setF('service_type', e.target.value)}>
                    {SERVICES.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className={LBL}>유입 채널</label>
                  <select className={SEL} value={form.channel} onChange={e => setF('channel', e.target.value)}>
                    {CHANNELS.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              {/* 상태 + 담당 직원 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LBL}>상태</label>
                  <select className={SEL} value={form.status} onChange={e => setF('status', e.target.value)}>
                    {STATUSES.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className={LBL}>담당 직원</label>
                  <select className={SEL} value={form.assignee_name} onChange={e => setF('assignee_name', e.target.value)}>
                    {ASSIGNEES.map(a => <option key={a}>{a}</option>)}
                  </select>
                </div>
              </div>

              {/* 유입일 + 리마인드 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LBL}>유입일</label>
                  <input type="date" className={INP}
                    value={form.inflow_date} onChange={e => setF('inflow_date', e.target.value)} />
                </div>
                <div>
                  <label className={LBL}>리마인드 날짜</label>
                  <input type="date" className={INP}
                    value={form.remind_date} onChange={e => setF('remind_date', e.target.value)} />
                </div>
              </div>

              {/* 메모 */}
              <div>
                <label className={LBL}>메모</label>
                <textarea className={INP + ' resize-none'} rows={2} placeholder="예산, 규모, 특이사항 등"
                  value={form.notes} onChange={e => setF('notes', e.target.value)} />
              </div>

              <hr className="border-gray-100" />
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">고객 카드</p>

              {/* 지역 + 기관 유형 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LBL}>지역</label>
                  <select className={SEL} value={form.customer_region} onChange={e => setF('customer_region', e.target.value)}>
                    <option value="">선택 안함</option>
                    {REGIONS.map(r => <option key={r}>{r}</option>)}
                  </select>
                </div>
                <div>
                  <label className={LBL}>기관 유형</label>
                  <select className={SEL} value={form.customer_type} onChange={e => setF('customer_type', e.target.value)}>
                    <option value="">선택 안함</option>
                    {CUST_TYPES.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
              </div>

              {/* 직급 + 부서 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LBL}>직급</label>
                  <input type="text" className={INP} placeholder="팀장, 담당자 등"
                    value={form.contact_title} onChange={e => setF('contact_title', e.target.value)} />
                </div>
                <div>
                  <label className={LBL}>부서</label>
                  <input type="text" className={INP} placeholder="진로교육팀 등"
                    value={form.contact_dept} onChange={e => setF('contact_dept', e.target.value)} />
                </div>
              </div>

            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex gap-3 flex-shrink-0">
              <button onClick={() => { setShowNewForm(false); setEditMode(false) }}
                className="flex-1 border border-gray-200 text-gray-600 text-sm py-2.5 rounded-xl hover:bg-gray-50 transition-colors">
                취소
              </button>
              <button onClick={saveLead}
                className="flex-1 bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-semibold text-sm py-2.5 rounded-xl transition-colors">
                {editMode ? '저장' : '리드 추가'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function InfoRow({ label, value, highlight, warn }: { label: string; value: string; highlight?: boolean; warn?: boolean }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-xs text-gray-400 w-20 flex-shrink-0">{label}</span>
      <span className={`text-sm font-medium break-all ${highlight ? 'text-blue-600' : warn ? 'text-orange-600' : 'text-gray-800'}`}>{value}</span>
    </div>
  )
}
