'use client'
import { useState } from 'react'

// ============================================================
// 리드 관리 데모 v5
// 탭: [요약+소통] [고객카드] [수정]
// 헤더 버튼: [드롭박스] [계약전환]
// ============================================================

type Log  = { id: string; content: string; contacted_at: string; author_name: string }
type Lead = {
  id: string; lead_id: string; status: string
  contact_name: string; client_org: string
  phone: string; email: string
  service_type: string; project_name: string
  inflow_date: string; remind_date: string
  channel: string; assignee_name: string
  notes: string; dropbox_url: string
  customer_region: string; customer_type: string
  contact_title: string; contact_dept: string
  logs: Log[]
}

// ── Mock 인물 DB (검색용) ─────────────────────────────────────
type PersonOption = { id: string; name: string; phone: string; email: string; org: string; title: string }
const MOCK_PERSONS: PersonOption[] = [
  { id: 'p1', name: '김지수',  phone: '010-1234-5678', email: 'jisu.kim@seoul.go.kr',  org: '서울시교육청',        title: '팀장' },
  { id: 'p2', name: '박현우',  phone: '010-9876-5432', email: '',                       org: '경기도문화재단',       title: '' },
  { id: 'p3', name: '이수진',  phone: '02-3456-7890',  email: 'sujin.lee@kywa.or.kr',  org: '한국청소년활동진흥원', title: '담당자' },
  { id: 'p4', name: '홍길동',  phone: '010-0000-1111', email: 'hong@example.com',       org: '인천교육청',          title: '주임' },
  { id: 'p5', name: '강민정',  phone: '010-7777-8888', email: 'minjung@ice.go.kr',      org: '인천교육청',          title: '팀장' },
]

// ── Mock 기관 DB ──────────────────────────────────────────────
const MOCK_ORGS = ['서울시교육청', '경기도문화재단', '한국청소년활동진흥원', '인천교육청', '서초구청', '경기도교육청']

const STATUSES  = ['유입','미팅','견적','협상','완료','취소']
const SERVICES  = ['SOS','002크리에이티브','렌탈','CS','학교상점']
const CHANNELS  = ['이메일','인스타그램','홈페이지','지인소개','전화','기타']
const ASSIGNEES = ['정태영','조민현','유제민','임지영','김수아']
const REGIONS   = ['서울','경기','인천','부산','대구','광주','대전','기타']
const CUST_TYPES= ['공공기관','학교','기업','개인','비영리','기타']

const INIT_LEADS: Lead[] = [
  {
    id: '1', lead_id: 'LEAD20260416-0001', status: '미팅',
    contact_name: '김지수', client_org: '서울시교육청',
    phone: '010-1234-5678', email: 'jisu.kim@seoul.go.kr',
    service_type: 'SOS', project_name: '2026 진로체험 페스티벌',
    inflow_date: '2026-04-10', remind_date: '2026-04-18',
    channel: '이메일', assignee_name: '정태영',
    notes: '예산 470만원으로 조정 완료. 5/23 행사, 5/22 셋업. 4/18 현장 미팅 예정.',
    dropbox_url: 'https://www.dropbox.com/home/★ADMIN/SOS/260410 진로체험 페스티벌',
    customer_region: '서울', customer_type: '공공기관', contact_title: '팀장', contact_dept: '진로교육팀',
    logs: [
      { id:'l1', content:'이메일로 문의 접수. 5월 행사 견적 요청.', contacted_at:'2026-04-10T10:00:00Z', author_name:'정태영' },
      { id:'l2', content:'전화 통화. 예산 500만원, 학생 200명 확인.', contacted_at:'2026-04-12T14:30:00Z', author_name:'정태영' },
      { id:'l3', content:`[전사록 4/13 14:32]\n정태영: 견적서 검토 어떠셨어요?\n김지수: 음향 장비 쪽이 오버됩니다. PA 기본으로 조정 가능할까요?\n정태영: 470만원으로 맞출 수 있습니다.\n김지수: 수정 견적 다시 보내주세요. 5/23 행사, 5/22 셋업.`, contacted_at:'2026-04-13T14:37:00Z', author_name:'정태영' },
      { id:'l4', content:'수정 견적 470만원 발송 완료.', contacted_at:'2026-04-13T17:00:00Z', author_name:'정태영' },
      { id:'l5', content:'미팅 확정. 4/18 오전 10시. 홍민준 010-2345-6789.', contacted_at:'2026-04-15T09:00:00Z', author_name:'정태영' },
    ],
  },
  {
    id:'2', lead_id:'LEAD20260416-0002', status:'유입',
    contact_name:'박현우', client_org:'경기도문화재단',
    phone:'010-9876-5432', email:'',
    service_type:'002크리에이티브', project_name:'',
    inflow_date:'2026-04-14', remind_date:'',
    channel:'인스타그램', assignee_name:'조민현',
    notes:'', dropbox_url:'',
    customer_region:'경기', customer_type:'공공기관', contact_title:'', contact_dept:'',
    logs:[
      { id:'l6', content:'SNS DM으로 홍보 영상 제작 문의. 예산/일정 미확인.', contacted_at:'2026-04-14T16:00:00Z', author_name:'조민현' },
    ],
  },
  {
    id:'3', lead_id:'LEAD20260416-0003', status:'견적',
    contact_name:'이수진', client_org:'한국청소년활동진흥원',
    phone:'02-3456-7890', email:'sujin.lee@kywa.or.kr',
    service_type:'렌탈', project_name:'청소년 음악캠프 장비 렌탈',
    inflow_date:'2026-04-08', remind_date:'2026-04-20',
    channel:'홈페이지', assignee_name:'유제민',
    notes:'드럼 2조, 앰프 4개 / 6월 중 렌탈. 견적 발송 후 회신 대기.',
    dropbox_url:'',
    customer_region:'서울', customer_type:'비영리', contact_title:'담당자', contact_dept:'사업팀',
    logs:[
      { id:'l7', content:'홈페이지 폼 문의. 드럼 세트 2조, 앰프 4개 6월 렌탈.', contacted_at:'2026-04-08T11:00:00Z', author_name:'유제민' },
      { id:'l8', content:'견적서 발송 완료. 검토 후 회신 요청.', contacted_at:'2026-04-11T10:00:00Z', author_name:'유제민' },
    ],
  },
]

// ── 상수 ─────────────────────────────────────────────────────
const STATUS_CFG: Record<string, { dot: string; badge: string }> = {
  '유입': { dot:'bg-gray-400',    badge:'bg-gray-100 text-gray-500' },
  '미팅': { dot:'bg-blue-400',    badge:'bg-blue-100 text-blue-700' },
  '견적': { dot:'bg-violet-400',  badge:'bg-violet-100 text-violet-700' },
  '협상': { dot:'bg-orange-400',  badge:'bg-orange-100 text-orange-700' },
  '완료': { dot:'bg-emerald-400', badge:'bg-emerald-100 text-emerald-700' },
  '취소': { dot:'bg-red-300',     badge:'bg-red-100 text-red-400' },
}
const SVC_CLR: Record<string, string> = {
  'SOS':           'text-yellow-700 bg-yellow-50 border-yellow-200',
  '002크리에이티브': 'text-purple-700 bg-purple-50 border-purple-200',
  '렌탈':          'text-blue-700 bg-blue-50 border-blue-200',
  'CS':            'text-green-700 bg-green-50 border-green-200',
  '학교상점':       'text-pink-700 bg-pink-50 border-pink-200',
}

// ── 유틸 ─────────────────────────────────────────────────────
function getDday(s: string): number | null {
  if (!s) return null
  const t = new Date(); t.setHours(0,0,0,0)
  const r = new Date(s); r.setHours(0,0,0,0)
  return Math.round((r.getTime() - t.getTime()) / 86400000)
}

function DdayBlock({ d, small }: { d: number; small?: boolean }) {
  const base = small ? 'text-xs font-bold px-2 py-0.5 rounded-md' : 'text-sm font-extrabold px-2.5 py-1 rounded-lg'
  if (d === 0) return <span className={`${base} bg-red-500 text-white`}>D-DAY</span>
  if (d < 0)   return <span className={`${base} bg-red-100 text-red-600`}>D+{Math.abs(d)}</span>
  if (d <= 3)  return <span className={`${base} bg-orange-100 text-orange-600`}>D-{d}</span>
  if (d <= 7)  return <span className={`${base} bg-yellow-100 text-yellow-700`}>D-{d}</span>
  return <span className={`${base} bg-gray-100 text-gray-500`}>D-{d}</span>
}

function timeAgo(iso: string) {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
  if (d === 0) return '오늘'
  if (d === 1) return '어제'
  if (d < 7)  return `${d}일 전`
  return new Date(iso).toLocaleDateString('ko-KR', { month:'short', day:'numeric' })
}
function uid() { return Math.random().toString(36).slice(2,9) }

// ── 소통 항목 ────────────────────────────────────────────────
function LogItem({ log, onDelete }: { log: Log; onDelete: () => void }) {
  const long = log.content.length > 100
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

// ── 폼 공통 ──────────────────────────────────────────────────
const LBL = 'block text-xs font-medium text-gray-500 mb-1'
const INP = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-300'
const SEL = INP + ' bg-white'

type FormState = Omit<Lead, 'id'|'lead_id'|'logs'> & { personId: string }
const BLANK: FormState = {
  status:'유입', contact_name:'', client_org:'', phone:'', email:'',
  service_type:'SOS', project_name:'', inflow_date:new Date().toISOString().slice(0,10),
  remind_date:'', channel:'이메일', assignee_name:'정태영', notes:'', dropbox_url:'',
  customer_region:'', customer_type:'', contact_title:'', contact_dept:'', personId:'',
}

// ── 담당자 검색 컴포넌트 ──────────────────────────────────────
function PersonSearch({
  form, setForm, persons, setPersons
}: {
  form: FormState
  setForm: React.Dispatch<React.SetStateAction<FormState>>
  persons: PersonOption[]
  setPersons: React.Dispatch<React.SetStateAction<PersonOption[]>>
}) {
  const [query, setQuery] = useState(form.contact_name)
  const [open, setOpen] = useState(false)
  const [addMode, setAddMode] = useState(false)
  const [newPhone, setNewPhone] = useState('')
  const [newEmail, setNewEmail] = useState('')

  const matched = persons.filter(p =>
    !query || p.name.includes(query) || p.org.includes(query)
  ).slice(0, 6)

  const selected = form.personId ? persons.find(p => p.id === form.personId) : null

  function pick(p: PersonOption) {
    setForm(f => ({ ...f, personId:p.id, contact_name:p.name, phone:f.phone||p.phone, email:f.email||p.email, client_org:f.client_org||p.org }))
    setQuery(p.name); setOpen(false); setAddMode(false)
  }
  function clear() {
    setForm(f => ({ ...f, personId:'', contact_name:'', phone:'', email:'' }))
    setQuery(''); setAddMode(false)
  }
  function addNew() {
    if (!query.trim()) return
    const np: PersonOption = { id:uid(), name:query.trim(), phone:newPhone, email:newEmail, org:form.client_org, title:'' }
    setPersons(ps => [...ps, np]); pick(np); setNewPhone(''); setNewEmail('')
  }

  if (selected) return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2.5 flex items-start justify-between">
      <div>
        <p className="text-sm font-semibold text-gray-900">{selected.name}
          {selected.title && <span className="ml-1 text-xs text-gray-500">· {selected.title}</span>}
        </p>
        {selected.org && <p className="text-xs text-gray-500 mt-0.5">{selected.org}</p>}
        {selected.phone && <p className="text-xs text-gray-400 mt-0.5">{selected.phone}</p>}
      </div>
      <button onClick={clear} className="text-xs text-gray-400 hover:text-red-400 ml-2">✕</button>
    </div>
  )

  return (
    <div className="relative">
      <input
        type="text" value={query}
        onChange={e => { setQuery(e.target.value); setOpen(true); setAddMode(false) }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        className={INP} placeholder="이름 또는 기관으로 검색..."
      />
      {open && (
        <div className="absolute z-10 left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
          {matched.map(p => (
            <button key={p.id} type="button" onMouseDown={() => pick(p)}
              className="w-full text-left px-3 py-2.5 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0">
              <p className="text-sm font-medium text-gray-800">{p.name}
                {p.title && <span className="text-gray-400 text-xs ml-1">· {p.title}</span>}
              </p>
              <p className="text-xs text-gray-400">{p.org || '소속 없음'}{p.phone ? ` · ${p.phone}` : ''}</p>
            </button>
          ))}
          {!addMode ? (
            <button type="button" onMouseDown={() => setAddMode(true)}
              className="w-full text-left px-3 py-2.5 text-sm text-yellow-700 font-semibold hover:bg-yellow-50 transition-colors">
              + "{query || '새 담당자'}" 추가
            </button>
          ) : (
            <div className="px-3 py-2.5 space-y-2 border-t border-gray-100">
              <p className="text-xs font-semibold text-gray-600">새 담당자: {query}</p>
              <input type="text" value={newPhone} onChange={e => setNewPhone(e.target.value)}
                placeholder="전화번호" className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-yellow-300" />
              <input type="text" value={newEmail} onChange={e => setNewEmail(e.target.value)}
                placeholder="이메일" className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-yellow-300" />
              <button type="button" onMouseDown={addNew}
                className="w-full text-xs bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-semibold py-1.5 rounded-lg transition-colors">
                추가
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── 기관 검색 컴포넌트 ────────────────────────────────────────
function OrgSearch({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false)
  const [orgs, setOrgs] = useState(MOCK_ORGS)
  const matched = orgs.filter(o => !value || o.includes(value)).slice(0, 6)

  return (
    <div className="relative">
      <input
        type="text" value={value}
        onChange={e => { onChange(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        className={INP} placeholder="기관명 검색 또는 직접 입력"
      />
      {open && (value || matched.length > 0) && (
        <div className="absolute z-10 left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
          {matched.map(o => (
            <button key={o} type="button" onMouseDown={() => { onChange(o); setOpen(false) }}
              className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
              {o}
            </button>
          ))}
          {value && !orgs.includes(value) && (
            <button type="button" onMouseDown={() => { setOrgs(p => [...p, value]); setOpen(false) }}
              className="w-full text-left px-3 py-2 text-sm text-yellow-700 font-semibold hover:bg-yellow-50">
              + "{value}" 신규 기관 추가
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ── 메인 ─────────────────────────────────────────────────────
export default function LeadsDemoV5() {
  const [leads, setLeads] = useState<Lead[]>(INIT_LEADS)
  const [persons, setPersons] = useState<PersonOption[]>(MOCK_PERSONS)
  const [selectedId, setSelectedId] = useState<string | null>('1')
  const [tab, setTab] = useState<'main'|'customer'|'edit'>('main')
  const [filter, setFilter] = useState('전체')
  const [showClosed, setShowClosed] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<FormState>(BLANK)
  const [logInput, setLogInput] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [showAi, setShowAi] = useState(false)
  // 인라인 빠른 편집
  const [inlineEdit, setInlineEdit] = useState<'status'|'service'|'remind'|null>(null)
  // 드롭박스 동기화 상태
  const [syncState, setSyncState] = useState<Record<string,'idle'|'syncing'|'done'>>({})


  const filtered = leads.filter(l => {
    if (!showClosed && (l.status==='완료'||l.status==='취소')) return false
    if (filter !== '전체' && l.status !== filter) return false
    return true
  })
  const selected = leads.find(l => l.id === selectedId) ?? null
  const counts = leads.reduce((a,l) => { a[l.status]=(a[l.status]||0)+1; return a }, {} as Record<string,number>)
  const activeCount = leads.filter(l => !['완료','취소'].includes(l.status)).length
  const remindCount = leads.filter(l => {
    const d = getDday(l.remind_date); return d !== null && d <= 3 && !['완료','취소'].includes(l.status)
  }).length

  function setF<K extends keyof FormState>(k: K, v: FormState[K]) { setForm(f => ({...f,[k]:v})) }

  // 신규 리드 저장
  function saveLead() {
    const id = uid()
    setLeads(ls => [{
      ...form, id,
      lead_id:`LEAD${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${String(ls.length+1).padStart(4,'0')}`,
      logs:[],
    }, ...ls])
    setSelectedId(id); setShowForm(false); setTab('main')
  }

  // 수정 탭에서 인라인 저장
  function saveEdit() {
    if (!selected) return
    setLeads(ls => ls.map(l => l.id===selected.id ? {...l, ...form} : l))
    setTab('main')
  }

  function openNew() {
    setForm(BLANK); setShowForm(true)
  }

  // 수정 탭 열 때 폼 초기화
  function openEditTab() {
    if (!selected) return
    setForm({ ...selected, personId:'' }); setTab('edit')
  }

  function addLog() {
    if (!logInput.trim() || !selected) return
    setLeads(ls => ls.map(l => l.id===selected.id ? {
      ...l, logs:[...l.logs, { id:uid(), content:logInput.trim(), contacted_at:new Date().toISOString(), author_name:'나 (데모)' }]
    } : l))
    setLogInput(''); setShowAi(false)
  }
  function deleteLog(lid: string) {
    if (!selected) return
    setLeads(ls => ls.map(l => l.id===selected.id ? {...l, logs:l.logs.filter(g => g.id!==lid)} : l))
  }
  function handleAi() {
    if (showAi) { setShowAi(false); return }
    setAiLoading(true)
    setTimeout(() => { setAiLoading(false); setShowAi(true) }, 1100)
  }

  const AI_MOCK: Record<string,string> = {
    '1':'예산 500→470만 조정 완료. 5/23 행사 · 5/22 셋업. 4/18 현장 미팅 예정. 수정 견적 내부 결재 대기.',
    '3':'드럼 2조·앰프 4개 6월 렌탈. 견적 발송 후 회신 대기. 4/20 리마인드.',
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
          {['전체','유입','미팅','견적','협상'].map(s => (
            <button key={s} onClick={() => setFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${filter===s?'bg-gray-900 text-white':'text-gray-500 hover:bg-gray-100'}`}>
              {s}{s!=='전체'&&counts[s]?<span className="ml-1 opacity-60 text-xs">{counts[s]}</span>:null}
            </button>
          ))}
          <div className="flex-1" />
          <button onClick={() => setShowClosed(v=>!v)} className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1.5 rounded-lg hover:bg-gray-100">
            {showClosed?'완료/취소 숨기기':'완료/취소 보기'}
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">

        {/* ── 왼쪽 목록 ── */}
        <div className="w-[360px] flex-shrink-0 border-r border-gray-200 bg-white overflow-y-auto">
          <div className="p-2 space-y-1">
            {filtered.map(lead => {
              const cfg = STATUS_CFG[lead.status]||STATUS_CFG['유입']
              const dday = getDday(lead.remind_date)
              const isSelected = lead.id === selectedId

              return (
                <button key={lead.id} onClick={() => { setSelectedId(lead.id); setShowAi(false) }}
                  className={`w-full text-left rounded-xl transition-all overflow-hidden border ${isSelected?'border-yellow-200 bg-yellow-50':'border-transparent hover:bg-gray-50'}`}>
                  <div className="flex items-stretch">

                    {/* D-day 세로 블록 */}
                    <div className={`w-14 flex-shrink-0 flex items-center justify-center ${
                      dday === null ? 'bg-gray-50' :
                      dday === 0   ? 'bg-red-500' :
                      dday < 0    ? 'bg-red-100' :
                      dday <= 3   ? 'bg-orange-100' :
                      dday <= 7   ? 'bg-yellow-100' : 'bg-gray-100'
                    }`}>
                      {dday === null ? (
                        <span className="text-gray-300 text-xs">—</span>
                      ) : (
                        <span className={`font-black text-sm leading-none ${
                          dday===0?'text-white':dday<0?'text-red-600':dday<=3?'text-orange-600':dday<=7?'text-yellow-700':'text-gray-500'
                        }`}>
                          {dday===0?'D-DAY':dday<0?`D+${Math.abs(dday)}`:`D-${dday}`}
                        </span>
                      )}
                    </div>

                    {/* 카드 내용 */}
                    <div className="flex-1 min-w-0 px-3 py-2.5">
                      {/* 행1: 프로젝트명 */}
                      <p className="text-sm font-bold text-gray-900 truncate">
                        {lead.project_name || '(프로젝트명 없음)'}
                      </p>
                      {/* 행2: 담당자 · 기관 */}
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dot}`} />
                        <span className="text-xs text-gray-600 truncate">{lead.contact_name}</span>
                        {lead.client_org && <>
                          <span className="text-gray-300 text-xs flex-shrink-0">·</span>
                          <span className="text-xs text-gray-400 truncate">{lead.client_org}</span>
                        </>}
                      </div>
                      {/* 행3: 배지 + 메타 */}
                      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                        <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 ${cfg.badge}`}>{lead.status}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded border font-medium flex-shrink-0 ${SVC_CLR[lead.service_type]||'text-gray-400 bg-gray-50 border-gray-200'}`}>{lead.service_type}</span>
                        <span className="text-xs text-gray-400 flex-shrink-0 ml-auto">{lead.assignee_name}</span>
                      </div>
                    </div>
                  </div>
                </button>
              )
            })}
            {filtered.length===0 && <p className="text-center py-12 text-sm text-gray-400">해당 조건의 리드가 없습니다.</p>}
          </div>
        </div>

        {/* ── 오른쪽 상세 ── */}
        {selected ? (
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-2xl mx-auto px-8 py-6">

              {/* 타이틀 */}
              <div className="flex items-start justify-between gap-4 mb-4">
                <div className="min-w-0 flex-1">

                  {/* 클릭 수정 배지 행 */}
                  <div className="flex items-center gap-2 flex-wrap mb-1.5">

                    {/* D-day → 클릭 시 날짜 선택 */}
                    <div className="relative">
                      <button
                        onClick={() => setInlineEdit(inlineEdit==='remind' ? null : 'remind')}
                        title="리마인드 날짜 수정"
                        className="transition-opacity hover:opacity-70">
                        {(() => { const d=getDday(selected.remind_date); return d!==null ? <DdayBlock d={d} /> : <span className="text-xs text-gray-300 border border-dashed border-gray-200 px-2 py-1 rounded-lg">D-day 없음</span> })()}
                      </button>
                      {inlineEdit==='remind' && (
                        <div className="absolute z-20 top-full mt-1 left-0 bg-white border border-gray-200 rounded-xl shadow-lg p-3 min-w-[200px]">
                          <p className="text-xs text-gray-500 mb-2 font-medium">리마인드 날짜</p>
                          <input type="date" className={INP}
                            value={selected.remind_date}
                            onChange={e => {
                              setLeads(ls => ls.map(l => l.id===selected.id ? {...l, remind_date: e.target.value} : l))
                              setInlineEdit(null)
                            }} />
                          {selected.remind_date && (
                            <button onClick={() => { setLeads(ls => ls.map(l => l.id===selected.id ? {...l, remind_date:''} : l)); setInlineEdit(null) }}
                              className="mt-2 w-full text-xs text-red-400 hover:text-red-600">삭제</button>
                          )}
                        </div>
                      )}
                    </div>

                    {/* 상태 → 클릭 시 드롭다운 */}
                    <div className="relative">
                      <button
                        onClick={() => setInlineEdit(inlineEdit==='status' ? null : 'status')}
                        title="상태 변경"
                        className={`text-xs px-2.5 py-1 rounded-full font-semibold transition-opacity hover:opacity-70 ${STATUS_CFG[selected.status]?.badge}`}>
                        {selected.status} ▾
                      </button>
                      {inlineEdit==='status' && (
                        <div className="absolute z-20 top-full mt-1 left-0 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden min-w-[100px]">
                          {STATUSES.map(s => (
                            <button key={s} onClick={() => { setLeads(ls => ls.map(l => l.id===selected.id ? {...l, status:s} : l)); setInlineEdit(null) }}
                              className={`w-full text-left px-3 py-2 text-xs font-medium hover:bg-gray-50 flex items-center gap-2 ${s===selected.status?'bg-gray-50':''}`}>
                              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${STATUS_CFG[s]?.dot||'bg-gray-400'}`} />
                              {s}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* 서비스 → 클릭 시 드롭다운 */}
                    <div className="relative">
                      <button
                        onClick={() => setInlineEdit(inlineEdit==='service' ? null : 'service')}
                        title="서비스 변경"
                        className={`text-xs px-2 py-1 rounded border font-medium transition-opacity hover:opacity-70 ${SVC_CLR[selected.service_type]||'bg-gray-50 text-gray-400 border-gray-200'}`}>
                        {selected.service_type} ▾
                      </button>
                      {inlineEdit==='service' && (
                        <div className="absolute z-20 top-full mt-1 left-0 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden min-w-[130px]">
                          {SERVICES.map(s => (
                            <button key={s} onClick={() => { setLeads(ls => ls.map(l => l.id===selected.id ? {...l, service_type:s} : l)); setInlineEdit(null) }}
                              className={`w-full text-left px-3 py-2 text-xs font-medium hover:bg-gray-50 ${s===selected.service_type?'bg-gray-50 font-bold':''}`}>
                              {s}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* 다른 곳 클릭 시 팝오버 닫기 */}
                    {inlineEdit && (
                      <div className="fixed inset-0 z-10" onClick={() => setInlineEdit(null)} />
                    )}
                  </div>

                  <h2 className="text-xl font-bold text-gray-900">{selected.project_name||'(프로젝트명 없음)'}</h2>
                  <p className="text-sm text-gray-500 mt-0.5">{selected.contact_name} · {selected.client_org}</p>
                </div>

                {/* 버튼: 드롭박스 + 동기화 + 계약전환 */}
                <div className="flex gap-2 flex-shrink-0">
                  {selected.dropbox_url ? (
                    <div className="flex items-center gap-1">
                      <a href={selected.dropbox_url} target="_blank" rel="noreferrer"
                        className="flex items-center gap-1.5 text-sm border border-gray-200 hover:border-blue-300 hover:bg-blue-50 text-gray-600 hover:text-blue-600 px-3 py-1.5 rounded-xl transition-colors">
                        <span>📁</span><span>드롭박스</span>
                      </a>
                      {/* 폴더명 동기화 버튼 */}
                      <button
                        title="폴더명을 현재 프로젝트명으로 동기화"
                        onClick={() => {
                          if (!selected.project_name) return
                          setSyncState(s => ({...s, [selected.id]:'syncing'}))
                          setTimeout(() => {
                            // URL 마지막 경로명을 현재 프로젝트명으로 교체
                            const url = selected.dropbox_url
                            const lastSlash = url.lastIndexOf('/')
                            const parent = url.substring(0, lastSlash)
                            const oldFolder = url.substring(lastSlash+1)
                            const datePrefix = oldFolder.match(/^(\d{6})\s/) ? oldFolder.match(/^(\d{6})\s/)![1]+' ' : ''
                            const newUrl = `${parent}/${datePrefix}${selected.project_name}`
                            setLeads(ls => ls.map(l => l.id===selected.id ? {...l, dropbox_url:newUrl} : l))
                            setSyncState(s => ({...s, [selected.id]:'done'}))
                            setTimeout(() => setSyncState(s => ({...s, [selected.id]:'idle'})), 2000)
                          }, 900)
                        }}
                        className={`p-1.5 rounded-lg border transition-all text-sm ${
                          syncState[selected.id]==='syncing' ? 'border-gray-200 text-gray-400 animate-spin' :
                          syncState[selected.id]==='done'    ? 'border-emerald-200 bg-emerald-50 text-emerald-600' :
                          'border-gray-200 hover:border-gray-300 text-gray-400 hover:text-gray-600'
                        }`}>
                        {syncState[selected.id]==='done' ? '✓' : '🔄'}
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setLeads(ls => ls.map(l => l.id===selected.id ? {...l, dropbox_url:'https://www.dropbox.com/home/★ADMIN/SOS/260416 '+(selected.project_name||'리드')} : l))}
                      className="flex items-center gap-1.5 text-sm border border-dashed border-gray-300 hover:border-gray-400 text-gray-400 hover:text-gray-600 px-3 py-1.5 rounded-xl transition-colors">
                      <span>📁</span><span>폴더 연결</span>
                    </button>
                  )}
                  <button className="text-sm bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-semibold px-3 py-1.5 rounded-xl transition-colors">
                    계약 전환
                  </button>
                </div>
              </div>

              {/* 탭 */}
              <div className="flex border-b border-gray-200 mb-5">
                {(['main','customer','edit'] as const).map(t => (
                  <button key={t}
                    onClick={() => { if (t==='edit') openEditTab(); else setTab(t) }}
                    className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${tab===t?'border-yellow-400 text-gray-900':'border-transparent text-gray-400 hover:text-gray-600'}`}>
                    {t==='main'?'요약 · 소통':t==='customer'?'고객 카드':'수정'}
                  </button>
                ))}
              </div>

              {/* ── 탭: 요약 + 소통 (기본) ── */}
              {tab==='main' && (
                <div className="space-y-4">

                  {/* 요약 카드 */}
                  <div className="bg-white rounded-2xl border border-gray-200 p-5">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2.5">요약</p>
                    {selected.notes ? (
                      <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{selected.notes}</p>
                    ) : (
                      <p className="text-sm text-gray-400 italic">요약 없음 — 수정 탭에서 추가하세요.</p>
                    )}
                  </div>

                  {/* 소통 내역 카드 */}
                  <div className="bg-white rounded-2xl border border-gray-200 p-5">
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                        소통 내역 <span className="normal-case font-normal text-gray-400">{selected.logs.length}건</span>
                      </span>
                      {selected.logs.length >= 2 && (
                        <button onClick={handleAi} disabled={aiLoading}
                          className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors disabled:opacity-50 ${showAi?'bg-violet-50 border-violet-200 text-violet-700':'bg-gray-50 border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                          {aiLoading?<><span className="animate-spin inline-block">⏳</span> 요약 중...</>:showAi?'✦ AI 요약 닫기':'✦ AI로 요약'}
                        </button>
                      )}
                    </div>

                    {showAi && AI_MOCK[selected.id] && (
                      <div className="mb-4 bg-violet-50 border border-violet-200 rounded-xl p-3.5">
                        <p className="text-xs font-semibold text-violet-700 mb-1">✦ AI 요약</p>
                        <p className="text-sm text-violet-900 leading-relaxed">{AI_MOCK[selected.id]}</p>
                      </div>
                    )}

                    <div className="space-y-0 mb-4">
                      {selected.logs.length===0 && <p className="text-sm text-gray-400 text-center py-6">소통 내역이 없습니다.</p>}
                      {[...selected.logs].reverse().map(log => (
                        <LogItem key={log.id} log={log} onDelete={() => deleteLog(log.id)} />
                      ))}
                    </div>

                    <div className="border border-gray-200 rounded-xl p-3.5 bg-gray-50">
                      <textarea value={logInput} onChange={e => setLogInput(e.target.value)}
                        placeholder="소통 내용, 전화 전사록, 이메일 내용 등 자유롭게..."
                        className="w-full text-sm text-gray-700 bg-transparent resize-none outline-none placeholder-gray-300 min-h-[64px]" />
                      <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-200">
                        <button onClick={() => setLogInput(v=>(v?v+'\n':'')+new Date().toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'})+' ')}
                          className="text-xs text-gray-400 hover:text-gray-600">현재 시간 입력</button>
                        <button onClick={addLog} className="text-xs bg-gray-900 text-white px-3 py-1.5 rounded-lg hover:bg-gray-700">저장</button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ── 탭: 고객 카드 ── */}
              {tab==='customer' && (
                <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-5">
                  {/* 기관 */}
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">기관</p>
                    <div className="grid grid-cols-2 gap-x-8 gap-y-3">
                      <InfoRow label="기관명"   value={selected.client_org||'—'} />
                      <InfoRow label="지역"     value={selected.customer_region||'—'} />
                      <InfoRow label="기관 유형" value={selected.customer_type||'—'} />
                    </div>
                  </div>
                  <hr className="border-gray-100" />
                  {/* 담당자 + 연락처 */}
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">담당자 · 연락처</p>
                    <div className="grid grid-cols-2 gap-x-8 gap-y-3">
                      <InfoRow label="이름"   value={selected.contact_name||'—'} />
                      <InfoRow label="직급"   value={selected.contact_title||'—'} />
                      <InfoRow label="부서"   value={selected.contact_dept||'—'} />
                      <InfoRow label="전화"   value={selected.phone||'—'} highlight />
                      <InfoRow label="이메일" value={selected.email||'—'} />
                    </div>
                  </div>
                </div>
              )}

              {/* ── 탭: 수정 (인라인 폼) ── */}
              {tab==='edit' && (
                <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
                  <div>
                    <label className={LBL}>프로젝트명</label>
                    <input type="text" className={INP} value={form.project_name} onChange={e => setF('project_name', e.target.value)} />
                  </div>
                  <div>
                    <label className={LBL}>담당자</label>
                    <PersonSearch form={form} setForm={setForm} persons={persons} setPersons={setPersons} />
                  </div>
                  <div>
                    <label className={LBL}>기관명</label>
                    <OrgSearch value={form.client_org} onChange={v => setF('client_org', v)} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={LBL}>서비스 유형</label>
                      <select className={SEL} value={form.service_type} onChange={e => setF('service_type', e.target.value)}>
                        {SERVICES.map(s=><option key={s}>{s}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={LBL}>상태</label>
                      <select className={SEL} value={form.status} onChange={e => setF('status', e.target.value)}>
                        {STATUSES.map(s=><option key={s}>{s}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={LBL}>유입 채널</label>
                      <select className={SEL} value={form.channel} onChange={e => setF('channel', e.target.value)}>
                        {CHANNELS.map(c=><option key={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={LBL}>담당 직원</label>
                      <select className={SEL} value={form.assignee_name} onChange={e => setF('assignee_name', e.target.value)}>
                        {ASSIGNEES.map(a=><option key={a}>{a}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={LBL}>유입일</label>
                      <input type="date" className={INP} value={form.inflow_date} onChange={e => setF('inflow_date', e.target.value)} />
                    </div>
                    <div>
                      <label className={LBL}>리마인드 날짜</label>
                      <input type="date" className={INP} value={form.remind_date} onChange={e => setF('remind_date', e.target.value)} />
                    </div>
                  </div>
                  <div>
                    <label className={LBL}>요약 / 메모</label>
                    <textarea className={INP+' resize-none'} rows={3}
                      value={form.notes} onChange={e => setF('notes', e.target.value)} />
                  </div>
                  <hr className="border-gray-100" />
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">고객 카드</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={LBL}>지역</label>
                      <select className={SEL} value={form.customer_region} onChange={e => setF('customer_region', e.target.value)}>
                        <option value="">선택 안함</option>
                        {REGIONS.map(r=><option key={r}>{r}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={LBL}>기관 유형</label>
                      <select className={SEL} value={form.customer_type} onChange={e => setF('customer_type', e.target.value)}>
                        <option value="">선택 안함</option>
                        {CUST_TYPES.map(t=><option key={t}>{t}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={LBL}>직급</label>
                      <input type="text" className={INP} value={form.contact_title} onChange={e => setF('contact_title', e.target.value)} />
                    </div>
                    <div>
                      <label className={LBL}>부서</label>
                      <input type="text" className={INP} value={form.contact_dept} onChange={e => setF('contact_dept', e.target.value)} />
                    </div>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button onClick={() => setTab('main')}
                      className="flex-1 border border-gray-200 text-gray-600 text-sm py-2.5 rounded-xl hover:bg-gray-50">취소</button>
                    <button onClick={saveEdit}
                      className="flex-1 bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-semibold text-sm py-2.5 rounded-xl">저장</button>
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

      {/* ── 신규 리드 폼 오버레이 ── */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/30" onClick={() => setShowForm(false)} />
          <div className="w-[480px] bg-white shadow-2xl flex flex-col">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
              <h2 className="text-base font-bold text-gray-900">새 리드 추가</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
              <div>
                <label className={LBL}>프로젝트명</label>
                <input type="text" className={INP} placeholder="ex) 2026 진로체험 페스티벌"
                  value={form.project_name} onChange={e => setF('project_name', e.target.value)} />
              </div>
              <div>
                <label className={LBL}>담당자 *</label>
                <PersonSearch form={form} setForm={setForm} persons={persons} setPersons={setPersons} />
              </div>
              <div>
                <label className={LBL}>기관명</label>
                <OrgSearch value={form.client_org} onChange={v => setF('client_org', v)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LBL}>서비스 유형</label>
                  <select className={SEL} value={form.service_type} onChange={e => setF('service_type', e.target.value)}>
                    {SERVICES.map(s=><option key={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className={LBL}>유입 채널</label>
                  <select className={SEL} value={form.channel} onChange={e => setF('channel', e.target.value)}>
                    {CHANNELS.map(c=><option key={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LBL}>담당 직원</label>
                  <select className={SEL} value={form.assignee_name} onChange={e => setF('assignee_name', e.target.value)}>
                    {ASSIGNEES.map(a=><option key={a}>{a}</option>)}
                  </select>
                </div>
                <div>
                  <label className={LBL}>리마인드 날짜</label>
                  <input type="date" className={INP} value={form.remind_date} onChange={e => setF('remind_date', e.target.value)} />
                </div>
              </div>
              <div>
                <label className={LBL}>요약 / 메모</label>
                <textarea className={INP+' resize-none'} rows={2} placeholder="예산, 규모, 진행 상황 등"
                  value={form.notes} onChange={e => setF('notes', e.target.value)} />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex gap-3 flex-shrink-0">
              <button onClick={() => setShowForm(false)}
                className="flex-1 border border-gray-200 text-gray-600 text-sm py-2.5 rounded-xl hover:bg-gray-50">취소</button>
              <button onClick={saveLead}
                className="flex-1 bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-semibold text-sm py-2.5 rounded-xl">리드 추가</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function InfoRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-xs text-gray-400 w-16 flex-shrink-0">{label}</span>
      <span className={`text-sm font-medium break-all ${highlight?'text-blue-600':'text-gray-800'}`}>{value}</span>
    </div>
  )
}
