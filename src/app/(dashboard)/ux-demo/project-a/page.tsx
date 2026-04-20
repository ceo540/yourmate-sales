'use client'

import { useState, useRef, useEffect } from 'react'

// ── 타입 ──────────────────────────────────────────────────────────────────────
type LogType = '통화' | '이메일' | '방문' | '미팅' | '출장' | '내부회의' | '메모'
type LogCategory = '외부' | '내부'
type MemoBlockType = '기획' | '결정사항' | '참고' | '주의사항' | '일반'

const LOG_CATEGORY: Record<LogType, LogCategory> = {
  통화: '외부', 이메일: '외부', 방문: '외부', 미팅: '외부', 출장: '외부',
  내부회의: '내부', 메모: '내부',
}
// 타입별 추가 필드 여부
const LOG_HAS_PARTICIPANTS: LogType[] = ['미팅', '내부회의', '출장']
const LOG_HAS_LOCATION: LogType[] = ['방문', '미팅', '출장']
const LOG_HAS_OUTCOME: LogType[] = ['미팅', '내부회의']

// ── 목업 데이터 ───────────────────────────────────────────────────────────────
const PROJECT_BASE = {
  name: '260414 경기도특수교육원 진드페',
  client_org: '경기도교육청 특수교육원',
  contact_name: '김미현 주무관',
  phone: '031-000-0000',
  email: 'kim@goe.go.kr',
  service: '교육프로그램',
  revenue: 42000000,
  pipeline_status: '진행중',
  contract_stage: '선금',
  inflow_date: '2026-04-14',
  event_date: '2026-06-11',
  customer_linked: true,
  contract_type: '용역계약',
  entity: '(주)유어메이트',
  signed_date: '2026-04-12',
  payment_date: '2026-06-20',
  advance_rate: 20,
  advance_paid: true,
}

const CUSTOMER_CARD = {
  name: '경기도교육청 특수교육원', type: '공공기관', region: '경기',
  total_deals: 3, total_revenue: 118000000,
  contacts: [
    { name: '김미현', title: '주무관', dept: '교육지원팀', phone: '031-000-0000' },
    { name: '박성준', title: '팀장', dept: '교육지원팀', phone: '031-000-0001' },
  ],
  past_deals: [
    { name: '2025 e페스티벌 운영', stage: '잔금', revenue: 38000000 },
    { name: '2025 진드페 운영', stage: '잔금', revenue: 38000000 },
  ],
}

const PROFILES = ['임지영', '유제민', '방준영', '조민현', '이하나']
const PIPELINE = ['유입', '협의중', '견적발송', '계약', '진행중', '완료']
const CONTRACT_STAGES = ['계약', '착수', '선금', '중도금', '완수', '계산서발행', '잔금']
const COST_CATEGORIES = ['인건비', '장비', '경비', '재료비', '외주', '기타']

const INIT_TASKS = [
  { id: 1, title: '사전답사 일정 확정', status: '완료', assignee: '임지영', due: '2026-04-18', priority: '높음' },
  { id: 2, title: '강사 섭외 및 계약', status: '진행중', assignee: '임지영', due: '2026-04-25', priority: '긴급' },
  { id: 3, title: '음향 장비 사전 점검', status: '할 일', assignee: '유제민', due: '2026-05-10', priority: '높음' },
  { id: 4, title: '행사 진행 매뉴얼 작성', status: '할 일', assignee: '임지영', due: '2026-05-20', priority: '보통' },
  { id: 5, title: '세금계산서 발행', status: '할 일', assignee: '방준영', due: '2026-06-20', priority: '보통' },
]

// 소통내역: 외부/내부 구분 + 타입별 추가 필드
const INIT_LOGS: {
  id: number; date: string; type: LogType; author: string; content: string
  participants?: string[]; location?: string; outcome?: string
}[] = [
  {
    id: 1, date: '2026-04-20', type: '출장', author: '임지영',
    content: '곤지암리조트 사전답사. 음향 설치 위치 확인. 무대 10x6m, 86석 세팅 가능.',
    participants: ['임지영', '유제민'],
    location: '곤지암리조트 그랜드볼룸',
    outcome: '음향 위치 B구역 확정, 조명 추가 견적 필요',
  },
  {
    id: 2, date: '2026-04-16', type: '내부회의', author: '임지영',
    content: '강사 풀 최종 검토. 음악치료사 2명 + 무용치료사 1명 조합으로 결정.',
    participants: ['임지영', '방준영', '조민현'],
    outcome: '강사 계약서 4/20까지 초안 작성, 방준영 담당',
  },
  {
    id: 3, date: '2026-04-15', type: '통화', author: '임지영',
    content: '김미현 주무관 통화 — 행사 테마 "함께하는 우리" 확정. 프로그램 초안 4/25까지 제출 요청.',
  },
  {
    id: 4, date: '2026-04-10', type: '이메일', author: '방준영',
    content: '견적서 발송 완료. 총액 4,200만원. 교통비/숙박비 별도 협의 예정.',
  },
  {
    id: 5, date: '2026-04-05', type: '미팅', author: '임지영',
    content: '경기도교육청 방문 미팅. 행사 규모·예산 최종 확인. 특수교육 학생 86명.',
    participants: ['임지영', '김미현', '박성준'],
    location: '경기도교육청 특수교육원 3층 회의실',
    outcome: '예산 4,200만원 확정, 계약서 기안 시작',
  },
]

// 프로젝트 메모 블록
const INIT_MEMO_BLOCKS: { id: number; type: MemoBlockType; title: string; content: string }[] = [
  {
    id: 1, type: '기획',
    title: '행사 기본 구성',
    content: `· 대상: 특수교육 학생 86명 + 보조교사\n· 형태: 체험형 음악·무용 치료 프로그램\n· 시간: 09:00 ~ 17:00 (6h)\n· 구성: 오전 음악치료 / 오후 무용치료 / 마무리 합창`,
  },
  {
    id: 2, type: '결정사항',
    title: '주요 결정',
    content: `· 강사: 음악치료사 2명(조미영, 한가람) + 무용치료사 1명(최서연)\n· 음향 위치: B구역 고정 설치\n· 선금 20% 수령 완료 (840만원, 4/14)`,
  },
  {
    id: 3, type: '참고',
    title: '담당자 참고사항',
    content: `· 김미현 주무관 결재권 없음 → 최종 승인은 박성준 팀장\n· 행사 당일 버스 2대 필요 (교육청 자체 수배)\n· 식사는 교육청에서 별도 발주`,
  },
]

const INIT_COSTS = [
  { id: 1, item: '강사비 (음악치료사 2명)', category: '인건비', amount: 8000000 },
  { id: 2, item: '강사비 (무용치료사 1명)', category: '인건비', amount: 3000000 },
  { id: 3, item: '음향 장비 렌탈', category: '장비', amount: 5500000 },
  { id: 4, item: '교통·숙박', category: '경비', amount: 2000000 },
  { id: 5, item: '소모품·재료비', category: '재료비', amount: 1500000 },
  { id: 6, item: '기타 용역비', category: '외주', amount: 8500000 },
]

const DROPBOX_FILES = [
  { name: 'brief.md', type: 'md', size: '2KB', modified: '2026-04-14' },
  { name: '견적서_경기도특수교육원.xlsx', type: 'xlsx', size: '45KB', modified: '2026-04-10' },
  { name: '계약서_서명본.pdf', type: 'pdf', size: '1.2MB', modified: '2026-04-12' },
  { name: '사전답사_사진.zip', type: 'zip', size: '38MB', modified: '2026-04-20' },
]

const CALENDAR_EVENTS = [
  { id: 1, title: '강사 미팅 (음악치료사)', date: '2026-04-28', time: '14:00', attendees: ['임지영'], color: 'bg-purple-50 text-purple-700' },
  { id: 2, title: '프로그램 초안 제출 마감', date: '2026-04-25', time: '-', attendees: ['임지영'], color: 'bg-red-50 text-red-600' },
  { id: 3, title: '진드페 행사일', date: '2026-06-11', time: '09:00', attendees: ['임지영', '유제민', '방준영'], color: 'bg-yellow-100 text-yellow-800' },
]

// ── 스타일 상수 ───────────────────────────────────────────────────────────────
const LOG_TYPE_STYLE: Record<LogType, { badge: string; bar: string; label: string }> = {
  통화:    { badge: 'bg-blue-50 text-blue-700 border-blue-100',   bar: 'bg-blue-400',   label: '📞 통화' },
  이메일:  { badge: 'bg-violet-50 text-violet-700 border-violet-100', bar: 'bg-violet-400', label: '✉ 이메일' },
  방문:    { badge: 'bg-green-50 text-green-700 border-green-100',  bar: 'bg-green-400',  label: '🏢 방문' },
  미팅:    { badge: 'bg-teal-50 text-teal-700 border-teal-100',    bar: 'bg-teal-400',   label: '🤝 미팅' },
  출장:    { badge: 'bg-cyan-50 text-cyan-700 border-cyan-100',    bar: 'bg-cyan-400',   label: '🚗 출장' },
  내부회의: { badge: 'bg-orange-50 text-orange-700 border-orange-100', bar: 'bg-orange-400', label: '💬 내부회의' },
  메모:    { badge: 'bg-yellow-50 text-yellow-700 border-yellow-100', bar: 'bg-yellow-400', label: '📝 메모' },
}

const MEMO_BLOCK_STYLE: Record<MemoBlockType, { icon: string; color: string; border: string }> = {
  기획:    { icon: '📋', color: 'text-blue-700 bg-blue-50',    border: 'border-l-blue-400' },
  결정사항: { icon: '✅', color: 'text-green-700 bg-green-50',  border: 'border-l-green-400' },
  참고:    { icon: '📌', color: 'text-purple-700 bg-purple-50', border: 'border-l-purple-400' },
  주의사항: { icon: '⚠️', color: 'text-orange-700 bg-orange-50', border: 'border-l-orange-400' },
  일반:    { icon: '📝', color: 'text-gray-600 bg-gray-100',    border: 'border-l-gray-300' },
}

const STATUS_STYLE: Record<string, string> = {
  '완료': 'bg-green-100 text-green-700', '진행중': 'bg-blue-100 text-blue-700',
  '할 일': 'bg-gray-100 text-gray-500', '보류': 'bg-red-100 text-red-500',
}
const PRIORITY_DOT: Record<string, string> = {
  긴급: 'bg-red-500', 높음: 'bg-orange-400', 보통: 'bg-gray-300', 낮음: 'bg-gray-200',
}
const STAGE_COLORS: Record<string, string> = {
  계약: 'bg-blue-100 text-blue-700', 착수: 'bg-purple-100 text-purple-700',
  선금: 'bg-yellow-100 text-yellow-700', 중도금: 'bg-orange-100 text-orange-700',
  완수: 'bg-teal-100 text-teal-700', 계산서발행: 'bg-indigo-100 text-indigo-700',
  잔금: 'bg-green-100 text-green-700',
}
const FILE_ICON: Record<string, string> = {
  pdf: '📄', xlsx: '📊', md: '📝', zip: '📦', jpg: '🖼', png: '🖼', default: '📎',
}
const AVATAR_COLORS = ['bg-yellow-400', 'bg-blue-400', 'bg-green-400', 'bg-purple-400', 'bg-orange-400']

function fmtMoney(n: number) {
  if (n >= 100000000) return `${(n / 100000000).toFixed(1)}억`
  if (n >= 10000000) return `${Math.round(n / 10000000) * 10}백만`
  return `${Math.round(n / 10000)}만`
}

function Avatar({ name, size = 'sm', colorIdx = 0 }: { name: string; size?: 'sm' | 'md'; colorIdx?: number }) {
  const sz = size === 'sm' ? 'w-5 h-5 text-xs' : 'w-7 h-7 text-sm'
  return (
    <div className={`${sz} ${AVATAR_COLORS[colorIdx % AVATAR_COLORS.length]} rounded-full flex items-center justify-center font-semibold text-gray-900 flex-shrink-0`}>
      {name[0]}
    </div>
  )
}

// ── 담당자 피커 ───────────────────────────────────────────────────────────────
function AssigneePicker({ label, value, multi, onChange }: {
  label: string; value: string[]; multi: boolean; onChange: (v: string[]) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])
  function toggle(name: string) {
    if (multi) onChange(value.includes(name) ? value.filter(n => n !== name) : [...value, name])
    else { onChange([name]); setOpen(false) }
  }
  return (
    <div className="relative" ref={ref}>
      <div className="flex items-center gap-1.5 flex-wrap cursor-pointer" onClick={() => setOpen(true)}>
        {value.length === 0
          ? <span className="text-xs text-gray-400 border border-dashed border-gray-200 px-2 py-0.5 rounded hover:border-gray-400">+ {label}</span>
          : value.map((n, i) => (
            <div key={n} className="flex items-center gap-1">
              <Avatar name={n} size="sm" colorIdx={PROFILES.indexOf(n)} />
              <span className="text-xs text-gray-700">{n}</span>
            </div>
          ))
        }
        {value.length > 0 && <span className="text-xs text-gray-400 hover:text-gray-600">+</span>}
      </div>
      {open && (
        <div className="absolute left-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-30 min-w-36 py-1">
          {PROFILES.map((n, i) => (
            <button key={n} onClick={() => toggle(n)}
              className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 ${value.includes(n) ? 'font-medium text-gray-900' : 'text-gray-600'}`}>
              <Avatar name={n} size="sm" colorIdx={i} />{n}
              {value.includes(n) && <span className="ml-auto text-yellow-500 text-xs">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── 원가 편집 모달 ────────────────────────────────────────────────────────────
function CostEditor({ costs, onSave, onClose }: {
  costs: typeof INIT_COSTS; onSave: (c: typeof INIT_COSTS) => void; onClose: () => void
}) {
  const [rows, setRows] = useState(costs.map(c => ({ ...c, amountStr: String(c.amount / 10000) })))
  const total = rows.reduce((s, r) => s + (parseFloat(r.amountStr) || 0) * 10000, 0)
  const update = (id: number, f: string, v: string) =>
    setRows(rs => rs.map(r => r.id === id ? { ...r, [f]: v } : r))
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-800">원가 편집</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">✕</button>
        </div>
        <div className="p-4 max-h-80 overflow-y-auto space-y-2">
          <div className="grid grid-cols-12 gap-2 text-xs text-gray-400 px-1 mb-1">
            <span className="col-span-5">항목</span><span className="col-span-3">분류</span>
            <span className="col-span-3 text-right">금액(만원)</span><span className="col-span-1" />
          </div>
          {rows.map(r => (
            <div key={r.id} className="grid grid-cols-12 gap-2 items-center">
              <input value={r.item} onChange={e => update(r.id, 'item', e.target.value)} placeholder="항목명"
                className="col-span-5 text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-yellow-400" />
              <select value={r.category} onChange={e => update(r.id, 'category', e.target.value)}
                className="col-span-3 text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-yellow-400">
                {COST_CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
              <input value={r.amountStr} onChange={e => update(r.id, 'amountStr', e.target.value)} placeholder="0"
                className="col-span-3 text-sm border border-gray-200 rounded-lg px-2 py-1.5 text-right focus:outline-none focus:ring-1 focus:ring-yellow-400" />
              <button onClick={() => setRows(rs => rs.filter(x => x.id !== r.id))} className="col-span-1 text-gray-300 hover:text-red-400 text-center">✕</button>
            </div>
          ))}
          <button onClick={() => setRows(rs => [...rs, { id: Date.now(), item: '', category: '기타', amount: 0, amountStr: '' }])}
            className="w-full text-sm text-gray-400 hover:text-gray-700 border border-dashed border-gray-200 rounded-lg py-2 hover:border-gray-400">
            + 항목 추가
          </button>
        </div>
        <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between">
          <span className="text-sm"><span className="text-gray-500">합계 </span><span className="font-bold text-gray-900">{fmtMoney(total)}원</span></span>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50">취소</button>
            <button onClick={() => { onSave(rows.map(({ amountStr, ...r }) => ({ ...r, amount: (parseFloat(amountStr) || 0) * 10000 }))); onClose() }}
              className="px-4 py-2 text-sm font-medium bg-yellow-400 text-gray-900 rounded-lg hover:bg-yellow-300">저장</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── 소통 내역 추가 폼 ─────────────────────────────────────────────────────────
function LogForm({ onAdd, defaultAuthor }: {
  onAdd: (log: (typeof INIT_LOGS)[0]) => void; defaultAuthor: string
}) {
  const [type, setType] = useState<LogType>('통화')
  const [content, setContent] = useState('')
  const [participants, setParticipants] = useState<string[]>([])
  const [location, setLocation] = useState('')
  const [outcome, setOutcome] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))

  const cat = LOG_CATEGORY[type]
  const showParticipants = LOG_HAS_PARTICIPANTS.includes(type)
  const showLocation = LOG_HAS_LOCATION.includes(type)
  const showOutcome = LOG_HAS_OUTCOME.includes(type)

  function submit() {
    if (!content.trim()) return
    onAdd({
      id: Date.now(), date, type, author: defaultAuthor, content,
      ...(showParticipants && participants.length > 0 ? { participants } : {}),
      ...(showLocation && location ? { location } : {}),
      ...(showOutcome && outcome ? { outcome } : {}),
    })
    setContent(''); setLocation(''); setOutcome(''); setParticipants([])
  }

  return (
    <div className="px-4 pt-3 pb-3 border-b border-gray-50">
      {/* 타입 선택 */}
      <div className="flex gap-1.5 flex-wrap mb-3">
        {/* 외부 */}
        <div className="flex items-center gap-1">
          <span className="text-xs text-gray-400 mr-1">외부</span>
          {(['통화', '이메일', '방문', '미팅', '출장'] as LogType[]).map(t => (
            <button key={t} onClick={() => setType(t)}
              className={`text-xs px-2.5 py-1 rounded-full border transition-all ${type === t ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-200 text-gray-500 hover:border-gray-400'}`}>
              {t}
            </button>
          ))}
        </div>
        <div className="w-px bg-gray-200 mx-1" />
        {/* 내부 */}
        <div className="flex items-center gap-1">
          <span className="text-xs text-gray-400 mr-1">내부</span>
          {(['내부회의', '메모'] as LogType[]).map(t => (
            <button key={t} onClick={() => setType(t)}
              className={`text-xs px-2.5 py-1 rounded-full border transition-all ${type === t ? 'bg-orange-500 text-white border-orange-500' : 'border-gray-200 text-gray-500 hover:border-gray-400'}`}>
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* 날짜 + 본문 */}
      <div className="flex gap-2 mb-2">
        <input type="date" value={date} onChange={e => setDate(e.target.value)}
          className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 text-gray-600 focus:outline-none focus:ring-1 focus:ring-yellow-400 w-32 flex-shrink-0" />
        <textarea value={content} onChange={e => setContent(e.target.value)}
          placeholder={type === '내부회의' ? '회의 내용 입력...' : type === '메모' ? '메모 입력...' : '소통 내용 입력...'}
          className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-yellow-400"
          rows={2} />
      </div>

      {/* 추가 필드 */}
      {(showParticipants || showLocation || showOutcome) && (
        <div className="space-y-1.5 mb-2 pl-2 border-l-2 border-gray-100">
          {showLocation && (
            <input value={location} onChange={e => setLocation(e.target.value)} placeholder="장소"
              className="w-full text-xs border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-yellow-400" />
          )}
          {showParticipants && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">참석자</span>
              <div className="flex gap-1 flex-wrap">
                {PROFILES.map((n, i) => (
                  <button key={n} onClick={() => setParticipants(ps => ps.includes(n) ? ps.filter(x => x !== n) : [...ps, n])}
                    className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border transition-all ${participants.includes(n) ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-200 text-gray-500'}`}>
                    {n}
                  </button>
                ))}
              </div>
            </div>
          )}
          {showOutcome && (
            <input value={outcome} onChange={e => setOutcome(e.target.value)} placeholder="결정 사항 또는 결과 (선택)"
              className="w-full text-xs border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-yellow-400" />
          )}
        </div>
      )}

      <button onClick={submit}
        className="px-4 py-1.5 bg-yellow-400 text-gray-900 text-xs font-medium rounded-lg hover:bg-yellow-300">
        저장
      </button>
    </div>
  )
}

// ── 메인 컴포넌트 ─────────────────────────────────────────────────────────────
export default function ProjectDemoA() {
  const [finTab, setFinTab] = useState<'contract' | 'cost'>('contract')
  const [tasks, setTasks] = useState(INIT_TASKS)
  const [logs, setLogs] = useState(INIT_LOGS)
  const [logFilter, setLogFilter] = useState<'전체' | '외부' | '내부'>('전체')
  const [taskFilter, setTaskFilter] = useState<'pending' | 'all'>('pending')
  const [costs, setCosts] = useState(INIT_COSTS)
  const [showCostEditor, setShowCostEditor] = useState(false)
  const [pm, setPm] = useState(['임지영'])
  const [members, setMembers] = useState(['유제민', '방준영'])
  const [showCustomerDetail, setShowCustomerDetail] = useState(false)
  const [claudeOpen, setClaudeOpen] = useState(true)
  const [claudeInput, setClaudeInput] = useState('')

  // 프로젝트 메모 블록
  const [memoBlocks, setMemoBlocks] = useState(INIT_MEMO_BLOCKS)
  const [editingMemoId, setEditingMemoId] = useState<number | null>(null)
  const [editingContent, setEditingContent] = useState('')
  const [addingMemo, setAddingMemo] = useState(false)
  const [newMemoType, setNewMemoType] = useState<MemoBlockType>('일반')
  const [newMemoTitle, setNewMemoTitle] = useState('')
  const [newMemoContent, setNewMemoContent] = useState('')

  const pipelineIdx = PIPELINE.indexOf(PROJECT_BASE.pipeline_status)
  const contractStageIdx = CONTRACT_STAGES.indexOf(PROJECT_BASE.contract_stage)
  const totalCost = costs.reduce((s, c) => s + c.amount, 0)
  const profit = PROJECT_BASE.revenue - totalCost
  const margin = Math.round((profit / PROJECT_BASE.revenue) * 100)
  const pendingTasks = tasks.filter(t => t.status !== '완료')
  const shownTasks = taskFilter === 'pending' ? pendingTasks : tasks
  const filteredLogs = logFilter === '전체' ? logs
    : logs.filter(l => LOG_CATEGORY[l.type] === (logFilter === '외부' ? '외부' : '내부'))

  function startEditMemo(id: number, content: string) { setEditingMemoId(id); setEditingContent(content) }
  function saveEditMemo(id: number) {
    setMemoBlocks(bs => bs.map(b => b.id === id ? { ...b, content: editingContent } : b))
    setEditingMemoId(null)
  }
  function addMemoBlock() {
    if (!newMemoTitle.trim()) return
    setMemoBlocks(bs => [...bs, { id: Date.now(), type: newMemoType, title: newMemoTitle, content: newMemoContent }])
    setNewMemoTitle(''); setNewMemoContent(''); setAddingMemo(false)
  }

  return (
    <div className="min-h-screen bg-[#F5F5F3]">
      {showCostEditor && <CostEditor costs={costs} onSave={setCosts} onClose={() => setShowCostEditor(false)} />}

      {/* ── 헤더 ── */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs bg-purple-50 text-purple-600 px-2 py-0.5 rounded-full">{PROJECT_BASE.service}</span>
                <span className="text-gray-200">·</span>
                <span className="text-xs text-gray-400">아트키움 사업부</span>
                <span className="text-gray-200">·</span>
                <span className="text-xs text-gray-400">유입 {PROJECT_BASE.inflow_date}</span>
              </div>
              <h1 className="text-xl font-bold text-gray-900">{PROJECT_BASE.name}</h1>
              <div className="flex items-center gap-5 mt-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400 w-10">PM</span>
                  <AssigneePicker label="PM 지정" value={pm} multi={false} onChange={setPm} />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400 w-14">관련 인원</span>
                  <AssigneePicker label="인원 추가" value={members} multi onChange={setMembers} />
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className={`text-sm px-3 py-1.5 rounded-full font-medium ${STAGE_COLORS[PROJECT_BASE.contract_stage]}`}>
                {PROJECT_BASE.contract_stage}
              </span>
              <button className="px-4 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-700">편집</button>
            </div>
          </div>
          {/* 파이프라인 */}
          <div className="flex items-center gap-0 mt-3">
            {PIPELINE.map((stage, i) => (
              <div key={stage} className="flex items-center">
                <div className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer ${
                  i < pipelineIdx ? 'text-gray-400' : i === pipelineIdx ? 'bg-yellow-400 text-gray-900 shadow-sm' : 'text-gray-300'
                }`}>
                  {i < pipelineIdx && <span className="text-green-500">✓</span>}
                  {stage}
                </div>
                {i < PIPELINE.length - 1 && <span className="text-gray-200 text-xs mx-0.5">›</span>}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── 본문 ── */}
      <div className="max-w-7xl mx-auto px-6 py-5 flex gap-5 items-start">

        {/* ─── 좌측 ──────────────────────────────────────── */}
        <div className="flex-1 min-w-0 space-y-4">

          {/* 요약 수치 */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: '계약 금액', value: fmtMoney(PROJECT_BASE.revenue) + '원', sub: '부가세 별도', color: 'text-gray-900' },
              { label: `마진 ${margin}%`, value: fmtMoney(profit) + '원', sub: `원가 ${fmtMoney(totalCost)}원`, color: 'text-green-600' },
              { label: '진행 업무', value: `${pendingTasks.length}건`, sub: `전체 ${tasks.length}건`, color: pendingTasks.length > 0 ? 'text-blue-600' : 'text-green-600' },
              { label: '행사일', value: '06/11', sub: 'D-52', color: 'text-orange-500' },
            ].map(c => (
              <div key={c.label} className="bg-white rounded-xl border border-gray-100 px-4 py-3">
                <p className="text-xs text-gray-400">{c.label}</p>
                <p className={`text-base font-bold mt-0.5 ${c.color}`}>{c.value}</p>
                <p className="text-xs text-gray-400 mt-0.5">{c.sub}</p>
              </div>
            ))}
          </div>

          {/* ── 프로젝트 메모 ── */}
          <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-gray-800">프로젝트 메모</h2>
                <span className="text-xs text-gray-400">소통이 아닌 기획·결정 등 핵심 정보</span>
              </div>
              <button onClick={() => setAddingMemo(true)} className="text-xs text-gray-400 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-50">+ 블록 추가</button>
            </div>

            {/* 블록 추가 폼 */}
            {addingMemo && (
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">유형</span>
                  <div className="flex gap-1 flex-wrap">
                    {(Object.keys(MEMO_BLOCK_STYLE) as MemoBlockType[]).map(t => (
                      <button key={t} onClick={() => setNewMemoType(t)}
                        className={`text-xs px-2.5 py-0.5 rounded-full border ${newMemoType === t ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-200 text-gray-500'}`}>
                        {MEMO_BLOCK_STYLE[t].icon} {t}
                      </button>
                    ))}
                  </div>
                </div>
                <input value={newMemoTitle} onChange={e => setNewMemoTitle(e.target.value)} placeholder="제목"
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-yellow-400" />
                <textarea value={newMemoContent} onChange={e => setNewMemoContent(e.target.value)} placeholder="내용 입력..."
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-yellow-400"
                  rows={3} />
                <div className="flex gap-2">
                  <button onClick={addMemoBlock} className="px-3 py-1.5 bg-yellow-400 text-gray-900 text-xs font-medium rounded-lg hover:bg-yellow-300">추가</button>
                  <button onClick={() => setAddingMemo(false)} className="px-3 py-1.5 border border-gray-200 text-gray-500 text-xs rounded-lg hover:bg-gray-50">취소</button>
                </div>
              </div>
            )}

            {/* 메모 블록 리스트 */}
            <div className="divide-y divide-gray-50">
              {memoBlocks.length === 0 ? (
                <p className="text-center py-8 text-sm text-gray-400">등록된 메모가 없습니다.</p>
              ) : memoBlocks.map(b => {
                const style = MEMO_BLOCK_STYLE[b.type]
                const isEditing = editingMemoId === b.id
                return (
                  <div key={b.id} className={`px-4 py-3 border-l-4 ${style.border} group hover:bg-gray-50`}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${style.color}`}>{style.icon} {b.type}</span>
                        <span className="text-sm font-semibold text-gray-800">{b.title}</span>
                      </div>
                      <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        {!isEditing && (
                          <button onClick={() => startEditMemo(b.id, b.content)} className="text-xs text-gray-400 hover:text-gray-700">편집</button>
                        )}
                        <button onClick={() => setMemoBlocks(bs => bs.filter(x => x.id !== b.id))} className="text-xs text-gray-300 hover:text-red-400">삭제</button>
                      </div>
                    </div>
                    {isEditing ? (
                      <div className="space-y-1.5">
                        <textarea value={editingContent} onChange={e => setEditingContent(e.target.value)}
                          className="w-full text-sm border border-yellow-300 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-yellow-400"
                          rows={4} />
                        <div className="flex gap-2">
                          <button onClick={() => saveEditMemo(b.id)} className="px-3 py-1 bg-yellow-400 text-gray-900 text-xs font-medium rounded-lg hover:bg-yellow-300">저장</button>
                          <button onClick={() => setEditingMemoId(null)} className="px-3 py-1 border border-gray-200 text-gray-500 text-xs rounded-lg">취소</button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-700 whitespace-pre-line leading-relaxed">{b.content}</p>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* ── 업무 ── */}
          <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
              <div className="flex items-center gap-3">
                <h2 className="text-sm font-semibold text-gray-800">업무</h2>
                <div className="flex gap-0.5 bg-gray-100 rounded-full p-0.5">
                  {(['pending', 'all'] as const).map(f => (
                    <button key={f} onClick={() => setTaskFilter(f)}
                      className={`text-xs px-2.5 py-0.5 rounded-full transition-all ${taskFilter === f ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400'}`}>
                      {f === 'pending' ? `진행중 ${pendingTasks.length}` : `전체 ${tasks.length}`}
                    </button>
                  ))}
                </div>
              </div>
              <button className="text-xs text-gray-400 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-50">+ 추가</button>
            </div>
            <div className="divide-y divide-gray-50">
              {shownTasks.map(t => (
                <div key={t.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 group">
                  <button onClick={() => setTasks(ts => ts.map(x => x.id === t.id ? { ...x, status: x.status === '완료' ? '할 일' : '완료' } : x))}
                    className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all ${t.status === '완료' ? 'border-green-400 bg-green-400' : 'border-gray-300 hover:border-gray-500'}`}>
                    {t.status === '완료' && <span className="text-white text-xs leading-none">✓</span>}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm ${t.status === '완료' ? 'line-through text-gray-300' : 'text-gray-800'}`}>{t.title}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <Avatar name={t.assignee} size="sm" colorIdx={PROFILES.indexOf(t.assignee)} />
                      <span className="text-xs text-gray-400">{t.assignee}</span>
                      {t.due && <span className="text-xs text-gray-400">· {t.due}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100">
                    <span className={`w-1.5 h-1.5 rounded-full ${PRIORITY_DOT[t.priority]}`} />
                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${STATUS_STYLE[t.status]}`}>{t.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── 소통 내역 ── */}
          <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
              <div className="flex items-center gap-3">
                <h2 className="text-sm font-semibold text-gray-800">소통 내역</h2>
                {/* 필터 */}
                <div className="flex gap-0.5 bg-gray-100 rounded-full p-0.5">
                  {(['전체', '외부', '내부'] as const).map(f => (
                    <button key={f} onClick={() => setLogFilter(f)}
                      className={`text-xs px-2.5 py-0.5 rounded-full transition-all ${logFilter === f ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400'}`}>
                      {f} {f !== '전체' && <span className="ml-0.5">{logs.filter(l => LOG_CATEGORY[l.type] === f).length}</span>}
                    </button>
                  ))}
                </div>
              </div>
              <span className="text-xs text-gray-400">{filteredLogs.length}건</span>
            </div>

            <LogForm onAdd={log => setLogs(ls => [log, ...ls])} defaultAuthor={pm[0] || '방준영'} />

            <div className="divide-y divide-gray-50">
              {filteredLogs.map((l, i) => {
                const style = LOG_TYPE_STYLE[l.type]
                const cat = LOG_CATEGORY[l.type]
                return (
                  <div key={l.id} className="px-4 py-3 group hover:bg-gray-50">
                    <div className="flex items-start gap-3">
                      {/* 카테고리 인디케이터 */}
                      <div className={`w-0.5 self-stretch rounded-full mt-1 ${cat === '외부' ? 'bg-blue-300' : 'bg-orange-300'}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-xs px-1.5 py-0.5 rounded border ${style.badge}`}>{style.label}</span>
                          <span className="text-xs text-gray-400">{l.date}</span>
                          <div className="flex items-center gap-1">
                            <Avatar name={l.author} size="sm" colorIdx={PROFILES.indexOf(l.author)} />
                            <span className="text-xs text-gray-400">{l.author}</span>
                          </div>
                          <span className={`ml-auto text-xs px-1.5 py-0.5 rounded-full ${cat === '외부' ? 'bg-blue-50 text-blue-500' : 'bg-orange-50 text-orange-500'}`}>{cat}</span>
                        </div>
                        <p className="text-sm text-gray-700 leading-relaxed">{l.content}</p>

                        {/* 추가 필드 */}
                        {(l.location || l.participants || l.outcome) && (
                          <div className="mt-2 space-y-1">
                            {l.location && (
                              <p className="text-xs text-gray-400">📍 {l.location}</p>
                            )}
                            {l.participants && l.participants.length > 0 && (
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs text-gray-400">참석</span>
                                <div className="flex gap-1">
                                  {l.participants.map((n, i) => (
                                    <div key={n} className="flex items-center gap-1">
                                      <Avatar name={n} size="sm" colorIdx={PROFILES.indexOf(n)} />
                                      <span className="text-xs text-gray-600">{n}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                            {l.outcome && (
                              <div className="bg-yellow-50 border border-yellow-100 rounded-lg px-2.5 py-1.5">
                                <p className="text-xs text-yellow-800"><span className="font-medium">결정: </span>{l.outcome}</p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* ── Claude ── */}
          <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
            <button onClick={() => setClaudeOpen(o => !o)}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50">
              <h2 className="text-sm font-semibold text-gray-800">Claude 협업</h2>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">프로젝트 맥락 자동 주입</span>
                <span className="text-gray-300 text-xs">{claudeOpen ? '▲' : '▼'}</span>
              </div>
            </button>
            {claudeOpen && (
              <div className="border-t border-gray-50 p-4">
                <div className="flex flex-wrap gap-2 mb-3">
                  {['강사 계약서 초안 써줘', '일정 확인 이메일 써줘', '행사 체크리스트 만들어줘'].map(q => (
                    <button key={q} onClick={() => setClaudeInput(q)}
                      className="text-xs px-3 py-1.5 bg-gray-50 border border-gray-200 text-gray-600 rounded-full hover:bg-gray-100">{q}</button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input value={claudeInput} onChange={e => setClaudeInput(e.target.value)}
                    placeholder="메시지 입력..."
                    className="flex-1 text-sm border border-gray-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-1 focus:ring-yellow-400" />
                  <button className="px-4 py-2.5 bg-yellow-400 text-gray-900 text-sm font-medium rounded-xl hover:bg-yellow-300">전송</button>
                </div>
              </div>
            )}
          </div>

          {/* ── Dropbox 파일 ── */}
          <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
              <div className="flex items-center gap-2">
                <span>☁</span>
                <h2 className="text-sm font-semibold text-gray-800">Dropbox 파일</h2>
                <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">{DROPBOX_FILES.length}</span>
              </div>
              <button className="text-xs text-gray-400 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-50">폴더 열기 ↗</button>
            </div>
            <div className="divide-y divide-gray-50">
              {DROPBOX_FILES.map(f => (
                <div key={f.name} className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 cursor-pointer group">
                  <span className="text-base flex-shrink-0">{FILE_ICON[f.type] ?? FILE_ICON.default}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-800 group-hover:text-blue-600 truncate">{f.name}</p>
                    <p className="text-xs text-gray-400">{f.size} · {f.modified}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── 캘린더 ── */}
          <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
              <div className="flex items-center gap-2">
                <span>📅</span>
                <h2 className="text-sm font-semibold text-gray-800">관련 일정</h2>
              </div>
              <button className="text-xs text-gray-400 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-50">+ 추가</button>
            </div>
            <div className="divide-y divide-gray-50">
              {CALENDAR_EVENTS.map(e => (
                <div key={e.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50">
                  <div className={`text-xs px-2 py-1 rounded-lg font-medium flex-shrink-0 ${e.color}`}>
                    {e.date.slice(5).replace('-', '/')}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800">{e.title}</p>
                    <p className="text-xs text-gray-400">{e.time !== '-' ? e.time + ' · ' : ''}{e.attendees.join(', ')}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="px-4 py-2.5 border-t border-gray-50">
              <p className="text-xs text-gray-400">Google Calendar 연동 시 실제 일정과 자동 동기화됩니다.</p>
            </div>
          </div>

          {/* ── 이메일 (미연동) ── */}
          <div className="bg-white border border-gray-100 rounded-xl px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span>✉</span>
              <div>
                <p className="text-sm font-medium text-gray-700">관련 이메일</p>
                <p className="text-xs text-gray-400">Gmail을 연동하면 고객사 이메일 스레드가 자동 표시됩니다.</p>
              </div>
            </div>
            <button className="text-xs px-3 py-1.5 border border-dashed border-gray-300 text-gray-500 rounded-lg hover:border-gray-400 flex-shrink-0">Gmail 연동</button>
          </div>

        </div>

        {/* ─── 우측 사이드바 ─────────────────────────────── */}
        <div className="w-72 flex-shrink-0 sticky top-20 space-y-4">

          {/* 고객 카드 */}
          {PROJECT_BASE.customer_linked ? (
            <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 bg-green-400 rounded-full" />
                  <h2 className="text-sm font-semibold text-gray-800">고객 카드</h2>
                </div>
                <button onClick={() => setShowCustomerDetail(s => !s)} className="text-xs text-gray-400 hover:text-gray-700">
                  {showCustomerDetail ? '접기' : '펼치기'}
                </button>
              </div>
              <div className="px-4 py-3">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center text-sm font-bold text-blue-600 flex-shrink-0">경</div>
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{CUSTOMER_CARD.name}</p>
                    <p className="text-xs text-gray-400">{CUSTOMER_CARD.type} · {CUSTOMER_CARD.region}</p>
                  </div>
                </div>
                <div className="flex gap-2 mb-3">
                  <div className="flex-1 bg-gray-50 rounded-lg px-2 py-2 text-center">
                    <p className="text-sm font-bold text-gray-900">{CUSTOMER_CARD.total_deals}건</p>
                    <p className="text-xs text-gray-400">총 계약</p>
                  </div>
                  <div className="flex-1 bg-gray-50 rounded-lg px-2 py-2 text-center">
                    <p className="text-sm font-bold text-gray-900">{fmtMoney(CUSTOMER_CARD.total_revenue)}</p>
                    <p className="text-xs text-gray-400">총 매출</p>
                  </div>
                </div>
                <div className="space-y-1.5">
                  {CUSTOMER_CARD.contacts.map(c => (
                    <div key={c.name} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5">
                        <div className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 text-xs">{c.name[0]}</div>
                        <span className="text-gray-700">{c.name}</span>
                        <span className="text-gray-400">{c.title}</span>
                      </div>
                      <span className="text-blue-500">{c.phone}</span>
                    </div>
                  ))}
                </div>
                {showCustomerDetail && (
                  <div className="mt-3 pt-3 border-t border-gray-50">
                    <p className="text-xs text-gray-400 mb-2">과거 거래</p>
                    <div className="space-y-1.5">
                      {CUSTOMER_CARD.past_deals.map(d => (
                        <div key={d.name} className="flex items-center justify-between text-xs">
                          <span className="text-gray-600 truncate flex-1 mr-2">{d.name}</span>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <span className={`px-1.5 py-0.5 rounded-full ${STAGE_COLORS[d.stage]}`}>{d.stage}</span>
                            <span className="text-gray-500 font-medium">{fmtMoney(d.revenue)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white border border-dashed border-gray-200 rounded-xl px-4 py-4 text-center">
              <p className="text-sm font-medium text-gray-700 mb-1">고객 카드 미연결</p>
              <p className="text-xs text-gray-400 mb-3">고객 DB에 연결하면 담당자, 이직 이력, 과거 거래를 한눈에 볼 수 있어요.</p>
              <button className="w-full text-sm px-3 py-2 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50">+ 고객 카드 연결</button>
            </div>
          )}

          {/* 재무 탭 */}
          <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
            <div className="flex border-b border-gray-100">
              {(['contract', 'cost'] as const).map(t => (
                <button key={t} onClick={() => setFinTab(t)}
                  className={`flex-1 py-2.5 text-sm font-medium transition-all ${finTab === t ? 'text-gray-900 border-b-2 border-yellow-400' : 'text-gray-400'}`}>
                  {t === 'contract' ? '계약 정보' : '원가'}
                </button>
              ))}
            </div>

            {finTab === 'contract' && (
              <div className="px-4 py-3">
                <p className="text-xs text-gray-400 mb-1.5">계약 단계</p>
                <div className="flex flex-wrap gap-1 mb-3">
                  {CONTRACT_STAGES.map((s, i) => (
                    <button key={s} className={`text-xs px-2 py-0.5 rounded-full ${
                      i === contractStageIdx ? STAGE_COLORS[s] + ' font-medium' :
                      i < contractStageIdx ? 'text-gray-300' : 'text-gray-400 hover:bg-gray-50'
                    }`}>
                      {i < contractStageIdx ? '✓ ' : ''}{s}
                    </button>
                  ))}
                </div>
                <div className="border-t border-gray-50 pt-3 space-y-2 text-xs">
                  {[
                    { k: '계약 유형', v: PROJECT_BASE.contract_type },
                    { k: '발행사', v: PROJECT_BASE.entity },
                    { k: '계약일', v: PROJECT_BASE.signed_date },
                    { k: '정산 예정', v: PROJECT_BASE.payment_date },
                  ].map(r => (
                    <div key={r.k} className="flex justify-between">
                      <span className="text-gray-400">{r.k}</span>
                      <span className="text-gray-700">{r.v}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-3 pt-3 border-t border-gray-50">
                  <p className="text-xs text-gray-400 mb-2">입금 현황</p>
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">선금 {PROJECT_BASE.advance_rate}%</span>
                      <span className={PROJECT_BASE.advance_paid ? 'text-green-600 font-medium' : 'text-gray-300'}>
                        {fmtMoney(PROJECT_BASE.revenue * PROJECT_BASE.advance_rate / 100)}원 {PROJECT_BASE.advance_paid ? '✓' : '대기'}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">잔금 {100 - PROJECT_BASE.advance_rate}%</span>
                      <span className="text-gray-300">{fmtMoney(PROJECT_BASE.revenue * (100 - PROJECT_BASE.advance_rate) / 100)}원</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-green-400 rounded-full" style={{ width: `${PROJECT_BASE.advance_rate}%` }} />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {finTab === 'cost' && (
              <div className="px-4 py-3">
                <div className="space-y-2">
                  {costs.map(c => (
                    <div key={c.id} className="flex items-center gap-2 text-xs">
                      <span className="text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded text-center w-12 flex-shrink-0">{c.category}</span>
                      <span className="flex-1 text-gray-600 truncate">{c.item}</span>
                      <span className="text-gray-800 font-medium flex-shrink-0">{fmtMoney(c.amount)}</span>
                    </div>
                  ))}
                </div>
                <button onClick={() => setShowCostEditor(true)}
                  className="mt-3 w-full text-xs py-2 border border-dashed border-gray-200 text-gray-400 rounded-lg hover:border-gray-400 hover:text-gray-700 transition-all">
                  + 편집
                </button>
                <div className="mt-2 pt-2 border-t border-gray-100 space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">원가</span><span className="font-semibold text-gray-900">{fmtMoney(totalCost)}원</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">매출</span><span className="text-gray-500">{fmtMoney(PROJECT_BASE.revenue)}원</span>
                  </div>
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-green-600">이익</span><span className="text-green-600">{fmtMoney(profit)}원 ({margin}%)</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 기본 정보 */}
          <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-50">
              <h2 className="text-sm font-semibold text-gray-800">기본 정보</h2>
            </div>
            <div className="px-4 py-3 space-y-2 text-xs">
              {[
                { k: '고객 기관', v: PROJECT_BASE.client_org },
                { k: '고객 담당자', v: PROJECT_BASE.contact_name },
                { k: '연락처', v: PROJECT_BASE.phone },
                { k: '이메일', v: PROJECT_BASE.email },
                { k: '유입일', v: PROJECT_BASE.inflow_date },
                { k: '행사일', v: PROJECT_BASE.event_date },
              ].map(r => (
                <div key={r.k} className="flex justify-between gap-2">
                  <span className="text-gray-400 flex-shrink-0">{r.k}</span>
                  <span className="text-gray-700 text-right truncate">{r.v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
