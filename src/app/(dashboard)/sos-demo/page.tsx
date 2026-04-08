'use client'

import { useState } from 'react'

// ─── 타입 ─────────────────────────────────────────────────────────
interface EventInfo {
  event_date?: string      // "2026-07-03" (ISO – date picker)
  class_period?: string    // "6-7교시"
  start_time?: string      // "14:20"
  end_time?: string        // "16:00"
  venue?: string
  student_count?: string
  setup_time?: string      // "10:00" (time picker)
  calltime?: string        // "12:20" (time picker)
  venue_clear?: string
  banner_size?: string
  teacher_name?: string    // 고객 DB 연결
  teacher_phone?: string
  extra?: string
}

interface Concert {
  id: string
  year: number
  month: number
  concert_date: string
  school: string
  concept: string
  mc: string
  artists: string[]
  staff: string[]
  stage: Stage
  tasks_done: number
  tasks_total: number
  event_info: EventInfo
  sale_id?: string
}

type Stage = '계약 전' | '계약 완료' | '준비 중' | '공연 예정' | '완료' | '취소'
const STAGES: Stage[] = ['계약 전', '계약 완료', '준비 중', '공연 예정', '완료', '취소']

const STAGE_BADGE: Record<Stage, string> = {
  '계약 전':   'bg-gray-100 text-gray-500',
  '계약 완료': 'bg-purple-100 text-purple-700',
  '준비 중':   'bg-blue-100 text-blue-700',
  '공연 예정': 'bg-yellow-100 text-yellow-700',
  '완료':      'bg-green-100 text-green-700',
  '취소':      'bg-red-100 text-red-400',
}
const STAGE_TASKS: Record<Stage, number> = {
  '계약 전': 1, '계약 완료': 3, '준비 중': 6, '공연 예정': 8, '완료': 11, '취소': 0,
}

const MOCK_CUSTOMERS = [
  '양동중', '청명중', '파주중', '한빛고', '수원중', '성남중', '부천중', '의정부중',
  '평택중', '화성중', '안산중', '광명중', '시흥중', '용인중', '고양중', '구리중',
]

type TagOption = { name: string; group: 'artist' | 'team' | 'freelancer' }

const VENDOR_OPTIONS: TagOption[] = [
  '성영주', '부석현', '김민경', '쿠모', '레다', '심각한 개구리', '109',
  '현서', '할순', '이동현', '별은', '조은세', 'Chad Burger', '홀린', 'Maji',
].map(n => ({ name: n, group: 'artist' }))

const STAFF_OPTIONS: TagOption[] = [
  ...['방준영', '임지영', '정태영', '조민현', '김수아', '유제민'].map(n => ({ name: n, group: 'team' as const })),
  ...['이학선', '조민식', '김찬영', '박민수', '강동현', '한지훈'].map(n => ({ name: n, group: 'freelancer' as const })),
]

// 고객 DB — 학교별 담당 선생님 (데모용 mock)
const MOCK_TEACHERS: Record<string, { name: string; phone: string }[]> = {
  '양동중':  [{ name: '박지수', phone: '010-1234-5678' }, { name: '최수진', phone: '010-2222-3333' }],
  '청명중':  [{ name: '이민준', phone: '010-9876-5432' }],
  '파주중':  [{ name: '김정은', phone: '010-4286-5150' }],
  '한빛고':  [{ name: '정다은', phone: '010-5555-6666' }],
}

const SOS_TASKS = [
  { key: 'cs',       label: 'CS 응대 및 CRM' },
  { key: 'quote',    label: '견적서 발송' },
  { key: 'contract', label: '계약 확정·요청사항' },
  { key: 'artist',   label: '아티스트 컨택' },
  { key: 'survey',   label: '사전설문지 전달' },
  { key: 'cuesheet', label: '큐시트·대본 전달' },
  { key: 'manual',   label: '일주일 전 안내' },
  { key: 'concert',  label: '공연 진행' },
  { key: 'thanks',   label: '감사 메시지 발송' },
  { key: 'content',  label: '콘텐츠 제작·업로드' },
  { key: 'payment',  label: '정산 처리' },
]

// ─── 유틸 ─────────────────────────────────────────────────────────
function calcRuntime(start?: string, end?: string): string {
  if (!start || !end) return ''
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  const mins = (eh * 60 + em) - (sh * 60 + sm)
  if (mins <= 0) return ''
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return h > 0 ? `${h}시간 ${m}분` : `${m}분`
}

function fmtDate(iso?: string): string {
  if (!iso) return ''
  const d = new Date(iso + 'T00:00:00')
  const day = ['일','월','화','수','목','금','토'][d.getDay()]
  return `${d.getMonth()+1}월 ${d.getDate()}일(${day})`
}

function buildCopyText(concert: Concert): string {
  const info = concert.event_info
  const runtime = calcRuntime(info.start_time, info.end_time)
  const dateStr = info.event_date ? fmtDate(info.event_date) : concert.concert_date
  const timeStr = info.start_time && info.end_time
    ? `${info.start_time} ~ ${info.end_time}${runtime ? ` (${runtime})` : ''}`
    : ''
  const eventDatetime = [dateStr, info.class_period, timeStr].filter(Boolean).join(' ')

  return `### 개요

- 학교명 : ${concert.school || ''}
- 행사일시 : ${eventDatetime}
- 장소 : ${info.venue || ''}
- 학생 수 : ${info.student_count || ''}
- 설치 및 리허설 가능시간 : ${info.setup_time || ''}
- 아티스트 콜타임 : ${info.calltime || ''}
- 행사장소 공실 요청 : ${info.venue_clear || ''}
- 현수막 길이 : ${info.banner_size || ''}
- 그 외 :
    - 선생님 연락처
        - 성함: ${info.teacher_name || ''}
        - 번호: ${info.teacher_phone || ''}${info.extra ? `\n    - ${info.extra}` : ''}`
}

// ─── 목데이터 ─────────────────────────────────────────────────────
const MOCK_2026: Concert[] = [
  {
    id: '26-1', year: 2026, month: 7, concert_date: '7월 3일(금)', school: '양동중', concept: '',
    mc: '성영주', artists: ['성영주', '쿠모'], staff: ['조민현', '유제민'],
    stage: '준비 중', tasks_done: 6, tasks_total: 11, sale_id: 'mock-1',
    event_info: {
      event_date: '2026-07-03', class_period: '5-6교시',
      start_time: '14:20', end_time: '16:00',
      venue: '양동중 강당', student_count: '150명',
      setup_time: '10:00', calltime: '12:30',
      banner_size: '6000*900', teacher_name: '박지수', teacher_phone: '010-1234-5678',
    },
  },
  { id: '26-2', year: 2026, month: 7,  concert_date: '7월 18일(금)',  school: '',     concept: '사연기반', mc: '', artists: [],                               staff: ['조민현'],           stage: '계약 전',  tasks_done: 0,  tasks_total: 11, event_info: {} },
  { id: '26-3', year: 2026, month: 9,  concert_date: '9월 예정',      school: '',     concept: '',         mc: '', artists: [],                               staff: [],                   stage: '계약 전',  tasks_done: 0,  tasks_total: 11, event_info: {} },
  { id: '26-4', year: 2026, month: 10, concert_date: '10월 8일(수)',  school: '청명중', concept: '',       mc: '부석현', artists: ['부석현', '김민경', '레다'], staff: ['임지영'],           stage: '계약 완료', tasks_done: 3, tasks_total: 11, sale_id: 'mock-4',
    event_info: { event_date: '2026-10-08', start_time: '13:00', end_time: '15:00', venue: '청명중 체육관', student_count: '200명', teacher_name: '이민준', teacher_phone: '010-9876-5432' } },
  { id: '26-5', year: 2026, month: 10, concert_date: '10월 15일(수)', school: '한빛고', concept: '',       mc: '성영주', artists: ['성영주', '심각한 개구리', '109'], staff: ['유제민', '조민현'], stage: '계약 전', tasks_done: 1, tasks_total: 11, event_info: {} },
  { id: '26-6', year: 2026, month: 11, concert_date: '11월 5일(수)',  school: '',     concept: '',         mc: '', artists: [],                               staff: [],                   stage: '계약 전',  tasks_done: 0,  tasks_total: 11, event_info: {} },
]

const MOCK_2025: Concert[] = [
  { id: '25-1',  year: 2025, month: 7,  concert_date: '7월 3일(목)',   school: '', concept: '',         mc: '부석현',        artists: ['부석현', '김민경', '쿠모'],           staff: ['조민현'], stage: '완료', tasks_done: 11, tasks_total: 11, event_info: {} },
  { id: '25-2',  year: 2025, month: 7,  concert_date: '7월 7일(월)',   school: '', concept: '',         mc: '성영주',        artists: ['성영주', '조은세', '별은'],           staff: ['임지영'], stage: '완료', tasks_done: 11, tasks_total: 11, event_info: {} },
  { id: '25-3',  year: 2025, month: 7,  concert_date: '7월 8일(화)',   school: '', concept: '사연기반', mc: '성영주',        artists: ['성영주', '쿠모'],                     staff: ['조민현'], stage: '완료', tasks_done: 11, tasks_total: 11, event_info: {} },
  { id: '25-4',  year: 2025, month: 7,  concert_date: '7월 10일(목)',  school: '', concept: '',         mc: '성영주',        artists: ['성영주', '이동현'],                   staff: ['유제민'], stage: '완료', tasks_done: 11, tasks_total: 11, event_info: {} },
  { id: '25-5',  year: 2025, month: 7,  concert_date: '7월 16일(수)',  school: '', concept: '',         mc: '성영주',        artists: ['성영주', 'Chad Burger', '별은'],     staff: ['임지영'], stage: '완료', tasks_done: 11, tasks_total: 11, event_info: {} },
  { id: '25-6',  year: 2025, month: 10, concert_date: '10월 15일(수)', school: '', concept: '',         mc: '부석현',        artists: ['부석현', '쿠모'],                     staff: ['조민현'], stage: '완료', tasks_done: 11, tasks_total: 11, event_info: {} },
  { id: '25-7',  year: 2025, month: 10, concert_date: '10월 21일(화)', school: '', concept: '',         mc: '성영주',        artists: ['성영주', '레다'],                     staff: ['임지영'], stage: '완료', tasks_done: 11, tasks_total: 11, event_info: {} },
  { id: '25-8',  year: 2025, month: 10, concert_date: '10월 26일(일)', school: '', concept: '',         mc: '성영주',        artists: ['성영주', '쿠모'],                     staff: ['유제민'], stage: '완료', tasks_done: 11, tasks_total: 11, event_info: {} },
  { id: '25-9',  year: 2025, month: 10, concert_date: '10월 27일(월)', school: '', concept: '',         mc: '성영주',        artists: ['성영주', '109'],                      staff: ['조민현'], stage: '완료', tasks_done: 11, tasks_total: 11, event_info: {} },
  { id: '25-10', year: 2025, month: 10, concert_date: '10월 28일(화)', school: '', concept: '',         mc: '성영주',        artists: ['성영주', '심각한 개구리'],            staff: ['임지영'], stage: '완료', tasks_done: 11, tasks_total: 11, event_info: {} },
  { id: '25-11', year: 2025, month: 11, concert_date: '11월 10일(월)', school: '', concept: '',         mc: '성영주',        artists: ['성영주', '109'],                      staff: ['유제민'], stage: '완료', tasks_done: 11, tasks_total: 11, event_info: {} },
  { id: '25-12', year: 2025, month: 11, concert_date: '11월 20일(목)', school: '', concept: '',         mc: '심각한 개구리', artists: ['심각한 개구리', '레다', '현서'],    staff: ['조민현'], stage: '완료', tasks_done: 11, tasks_total: 11, event_info: {} },
  { id: '25-13', year: 2025, month: 11, concert_date: '11월 22일(토)', school: '', concept: '',         mc: '레다',          artists: ['레다', '홀린', 'Maji'],              staff: ['임지영'], stage: '완료', tasks_done: 11, tasks_total: 11, event_info: {} },
  { id: '25-14', year: 2025, month: 11, concert_date: '11월 27일(목)', school: '', concept: '',         mc: '성영주',        artists: ['성영주', '109', '레다'],              staff: ['유제민'], stage: '완료', tasks_done: 11, tasks_total: 11, event_info: {} },
  { id: '25-15', year: 2025, month: 12, concert_date: '12월 4일(목)',  school: '', concept: '',         mc: '심각한 개구리', artists: ['심각한 개구리', '레다', '109'],     staff: ['조민현'], stage: '완료', tasks_done: 11, tasks_total: 11, event_info: {} },
  { id: '25-16', year: 2025, month: 12, concert_date: '12월 19일(금)', school: '', concept: '',         mc: '심각한 개구리', artists: ['심각한 개구리', '레다'],             staff: ['임지영'], stage: '완료', tasks_done: 11, tasks_total: 11, event_info: {} },
  { id: '25-17', year: 2025, month: 12, concert_date: '12월 23일(화)', school: '', concept: '',         mc: '부석현',        artists: ['부석현', '심각한 개구리', '조은세'],  staff: ['유제민'], stage: '완료', tasks_done: 11, tasks_total: 11, event_info: {} },
  { id: '25-18', year: 2025, month: 12, concert_date: '12월 26일(금)', school: '', concept: '',         mc: '심각한 개구리', artists: ['심각한 개구리', '레다'],             staff: ['조민현'], stage: '완료', tasks_done: 11, tasks_total: 11, event_info: {} },
  { id: '25-19', year: 2026, month: 1,  concert_date: '1월 6일(화)',   school: '', concept: '',         mc: '레다',          artists: ['레다', '심각한 개구리', '조은세'],    staff: ['임지영'], stage: '완료', tasks_done: 11, tasks_total: 11, event_info: {} },
]

const MONTHS = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월']

// ─── 검색 콤보박스 ────────────────────────────────────────────────
const BASE_INP = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400'

function SearchCombo({ value, onChange, options, placeholder }: {
  value: string; onChange: (v: string) => void; options: string[]; placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const filtered = value ? options.filter(o => o.includes(value)) : options
  const noExactMatch = value.trim() !== '' && !options.includes(value.trim())
  return (
    <div className="relative">
      <input value={value} onChange={e => { onChange(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder} className={BASE_INP} />
      {open && (filtered.length > 0 || noExactMatch) && (
        <div className="absolute z-30 left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
          {filtered.map(o => (
            <button key={o} type="button" onMouseDown={() => { onChange(o); setOpen(false) }}
              className="w-full text-left px-3 py-2 text-sm hover:bg-yellow-50 hover:text-yellow-700">{o}</button>
          ))}
          {noExactMatch && (
            <button type="button" onMouseDown={() => { onChange(value.trim()); setOpen(false) }}
              className="w-full text-left px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 border-t border-gray-100 flex items-center gap-1.5">
              <span className="font-semibold">+</span> &ldquo;{value.trim()}&rdquo; 새로 추가
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ─── 검색 태그 입력 ───────────────────────────────────────────────
function SearchTagInput({ selected, onChange, options, placeholder }: {
  selected: string[]; onChange: (v: string[]) => void; options: TagOption[]; placeholder?: string
}) {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const available = options.filter(o => !selected.includes(o.name) && (q === '' || o.name.toLowerCase().includes(q.toLowerCase())))
  const canAdd = q.trim() !== '' && !selected.includes(q.trim()) && !options.some(o => o.name === q.trim())
  return (
    <div>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {selected.map(s => {
            const grp = options.find(o => o.name === s)?.group
            return (
              <span key={s} className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${
                grp === 'freelancer' ? 'bg-orange-100 text-orange-700' : grp === 'team' ? 'bg-gray-800 text-white' : 'bg-yellow-100 text-yellow-800'
              }`}>
                {s}
                <button type="button" onClick={() => onChange(selected.filter(x => x !== s))} className="opacity-60 hover:opacity-100 leading-none">&times;</button>
              </span>
            )
          })}
        </div>
      )}
      <div className="relative">
        <input value={q} onChange={e => { setQ(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder={placeholder || '이름으로 검색...'} className={BASE_INP} />
        {open && (available.length > 0 || canAdd) && (
          <div className="absolute z-30 left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
            {available.map(o => (
              <button key={o.name} type="button" onMouseDown={() => { onChange([...selected, o.name]); setQ('') }}
                className="w-full text-left px-3 py-2 text-sm hover:bg-yellow-50 flex items-center justify-between">
                <span>{o.name}</span>
                {o.group === 'freelancer' && <span className="text-[10px] text-orange-500 bg-orange-50 px-1.5 py-0.5 rounded-full">프리랜서</span>}
                {o.group === 'team' && <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">팀원</span>}
              </button>
            ))}
            {canAdd && (
              <button type="button" onMouseDown={() => { onChange([...selected, q.trim()]); setQ('') }}
                className="w-full text-left px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 border-t border-gray-100 flex items-center gap-1.5">
                <span className="font-semibold">+</span> &ldquo;{q.trim()}&rdquo; 새로 추가
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── 모달 ─────────────────────────────────────────────────────────
function ConcertModal({ concert, onClose, onSave }: {
  concert?: Concert; onClose: () => void
  onSave: (data: Partial<Concert>) => void
}) {
  const [tab, setTab] = useState<'basic' | 'event'>('basic')
  const [form, setForm] = useState({
    year: concert?.year ?? 2026,
    month: concert?.month ?? 7,
    concert_date: concert?.concert_date ?? '',
    school: concert?.school ?? '',
    concept: concert?.concept ?? '',
    stage: (concert?.stage ?? '계약 전') as Stage,
    mc: concert?.mc ?? '',
    artists: concert?.artists ?? [] as string[],
    staff: concert?.staff ?? [] as string[],
    event_info: concert?.event_info ?? {} as EventInfo,
  })

  const inp  = BASE_INP
  const lbl  = 'block text-xs font-medium text-gray-500 mb-1'
  const set  = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))
  const setI = (k: keyof EventInfo, v: any) => setForm(f => ({ ...f, event_info: { ...f.event_info, [k]: v } }))

  const runtime = calcRuntime(form.event_info.start_time, form.event_info.end_time)
  const teachers = MOCK_TEACHERS[form.school] ?? []

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="font-bold text-gray-800">{concert ? '공연 수정' : '새 공연 추가'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>
        <div className="flex border-b px-6">
          {(['basic', 'event'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`py-2.5 px-4 text-sm font-medium border-b-2 -mb-px transition-colors ${
                tab === t ? 'border-yellow-400 text-gray-800' : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}>
              {t === 'basic' ? '기본 정보' : '행사 개요'}
            </button>
          ))}
        </div>

        <div className="overflow-y-auto flex-1 p-6 space-y-4">
          {tab === 'basic' ? (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={lbl}>연도</label>
                  <select value={form.year} onChange={e => set('year', +e.target.value)} className={inp}>
                    {[2025, 2026, 2027].map(y => <option key={y}>{y}</option>)}
                  </select>
                </div>
                <div>
                  <label className={lbl}>단계</label>
                  <select value={form.stage} onChange={e => set('stage', e.target.value)} className={inp}>
                    {STAGES.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={lbl}>날짜 (표시용)</label>
                  <input value={form.concert_date} onChange={e => set('concert_date', e.target.value)} placeholder="예: 7월 3일(금)" className={inp} />
                </div>
                <div>
                  <label className={lbl}>컨셉</label>
                  <input value={form.concept} onChange={e => set('concept', e.target.value)} placeholder="예: 사연기반" className={inp} />
                </div>
              </div>
              <div>
                <label className={lbl}>학교 <span className="text-blue-400 text-[10px]">고객 DB</span></label>
                <SearchCombo value={form.school} onChange={v => set('school', v)} options={MOCK_CUSTOMERS} placeholder="학교명 검색 또는 직접 입력" />
              </div>
              <div>
                <label className={lbl}>MC</label>
                <input value={form.mc} onChange={e => set('mc', e.target.value)} placeholder="MC 이름" className={inp} />
              </div>
              <div>
                <label className={lbl}>아티스트 <span className="text-blue-400 text-[10px]">거래처 DB</span></label>
                <SearchTagInput selected={form.artists} onChange={v => set('artists', v)} options={VENDOR_OPTIONS} placeholder="아티스트 검색..." />
              </div>
              <div>
                <label className={lbl}>스태프 <span className="text-blue-400 text-[10px]">팀원 + 거래처 프리랜서</span></label>
                <SearchTagInput selected={form.staff} onChange={v => set('staff', v)} options={STAFF_OPTIONS} placeholder="팀원 또는 프리랜서 검색..." />
              </div>
            </>
          ) : (
            <>
              {/* 날짜 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lbl}>날짜</label>
                  <input type="date" value={form.event_info.event_date ?? ''} onChange={e => {
                    setI('event_date', e.target.value)
                    if (e.target.value) {
                      const d = new Date(e.target.value + 'T00:00:00')
                      set('concert_date', `${d.getMonth()+1}월 ${d.getDate()}일`)
                      set('month', d.getMonth() + 1)
                    }
                  }} className={inp} />
                </div>
                <div>
                  <label className={lbl}>교시</label>
                  <input value={form.event_info.class_period ?? ''} onChange={e => setI('class_period', e.target.value)} placeholder="예: 6-7교시" className={inp} />
                </div>
              </div>

              {/* 시간 */}
              <div className="grid grid-cols-3 gap-3 items-end">
                <div>
                  <label className={lbl}>시작 시간</label>
                  <input type="time" value={form.event_info.start_time ?? ''} onChange={e => setI('start_time', e.target.value)} className={inp} />
                </div>
                <div>
                  <label className={lbl}>종료 시간</label>
                  <input type="time" value={form.event_info.end_time ?? ''} onChange={e => setI('end_time', e.target.value)} className={inp} />
                </div>
                <div className="pb-2 text-sm font-semibold text-gray-600">
                  {runtime ? `⏱ ${runtime}` : <span className="text-gray-300 text-xs">자동 계산</span>}
                </div>
              </div>

              {/* 장소·학생수 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={lbl}>장소</label>
                  <input value={form.event_info.venue ?? ''} onChange={e => setI('venue', e.target.value)} placeholder="예: 파주중 강당" className={inp} />
                </div>
                <div>
                  <label className={lbl}>학생 수</label>
                  <input value={form.event_info.student_count ?? ''} onChange={e => setI('student_count', e.target.value)} placeholder="예: 139명" className={inp} />
                </div>
              </div>

              {/* 설치·콜타임 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={lbl}>설치·리허설 가능시간</label>
                  <input type="time" value={form.event_info.setup_time ?? ''} onChange={e => setI('setup_time', e.target.value)} className={inp} />
                </div>
                <div>
                  <label className={lbl}>아티스트 콜타임</label>
                  <input type="time" value={form.event_info.calltime ?? ''} onChange={e => setI('calltime', e.target.value)} className={inp} />
                </div>
              </div>

              {/* 현수막·공실 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={lbl}>현수막 길이</label>
                  <input value={form.event_info.banner_size ?? ''} onChange={e => setI('banner_size', e.target.value)} placeholder="예: 6000*900" className={inp} />
                </div>
                <div>
                  <label className={lbl}>행사장소 공실 요청</label>
                  <input value={form.event_info.venue_clear ?? ''} onChange={e => setI('venue_clear', e.target.value)} placeholder="" className={inp} />
                </div>
              </div>

              {/* 담당 선생님 — 고객 DB 연결 */}
              <div>
                <label className={lbl}>
                  담당 선생님{' '}
                  <span className="text-blue-400 text-[10px]">고객 DB</span>
                </label>
                {teachers.length > 0 ? (
                  <div className="flex flex-wrap gap-2 mb-2">
                    {teachers.map(t => (
                      <button key={t.name} type="button"
                        onClick={() => { setI('teacher_name', t.name); setI('teacher_phone', t.phone) }}
                        className={`px-3 py-1.5 rounded-full text-xs border transition-colors ${
                          form.event_info.teacher_name === t.name
                            ? 'bg-blue-100 border-blue-300 text-blue-700'
                            : 'border-gray-200 text-gray-500 hover:border-blue-300'
                        }`}>
                        {t.name} {t.phone}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 mb-2">
                    {form.school ? `"${form.school}" 등록된 선생님 없음 — 직접 입력` : '학교명 입력 후 선생님 선택 가능'}
                  </p>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <input value={form.event_info.teacher_name ?? ''} onChange={e => setI('teacher_name', e.target.value)} placeholder="성함" className={inp} />
                  <input value={form.event_info.teacher_phone ?? ''} onChange={e => setI('teacher_phone', e.target.value)} placeholder="번호" className={inp} />
                </div>
              </div>

              {/* 그 외 */}
              <div>
                <label className={lbl}>그 외</label>
                <input value={form.event_info.extra ?? ''} onChange={e => setI('extra', e.target.value)} placeholder="기타 메모" className={inp} />
              </div>
            </>
          )}
        </div>

        <div className="flex justify-end gap-2 px-6 py-4 border-t">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-gray-200 hover:bg-gray-50">취소</button>
          <button
            onClick={() => { onSave({ ...form, tasks_done: concert ? concert.tasks_done : STAGE_TASKS[form.stage], tasks_total: 11 }); onClose() }}
            className="px-5 py-2 text-sm rounded-lg bg-yellow-400 font-semibold hover:bg-yellow-500"
          >
            {concert ? '수정' : '추가'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── 진행 도트 ────────────────────────────────────────────────────
function ProgressDots({ done, total, stage }: { done: number; total: number; stage: Stage }) {
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
          stage === '취소' ? 'bg-gray-200' : i < done ? (done === total ? 'bg-green-400' : 'bg-yellow-400') : 'bg-gray-200'
        }`} />
      ))}
      <span className="text-xs text-gray-400 ml-1">{done}/{total}</span>
    </div>
  )
}

function StaffAvatars({ names }: { names: string[] }) {
  if (names.length === 0) return <span className="text-xs text-gray-300">미배정</span>
  return (
    <div className="flex items-center">
      {names.slice(0, 3).map((name, i) => (
        <div key={name} className={`w-6 h-6 rounded-full bg-gray-700 text-white text-[10px] font-bold flex items-center justify-center border-2 border-white ${i > 0 ? '-ml-1.5' : ''}`}>
          {name[0]}
        </div>
      ))}
      {names.length > 3 && <span className="text-xs text-gray-400 ml-1">+{names.length - 3}</span>}
    </div>
  )
}

// ─── 공연 카드 ────────────────────────────────────────────────────
function ConcertCard({ concert, onEdit, onDelete, onStageChange, onTaskToggle }: {
  concert: Concert; onEdit: () => void; onDelete: () => void
  onStageChange: (s: Stage) => void; onTaskToggle: (key: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [showActions, setShowActions] = useState(false)
  const [copied, setCopied] = useState(false)
  const isUrgent = concert.stage === '공연 예정'
  const info = concert.event_info
  const runtime = calcRuntime(info.start_time, info.end_time)

  const dateStr = info.event_date ? fmtDate(info.event_date).replace(/\([^)]+\)/, '') : ''
  const timeStr = info.start_time && info.end_time
    ? `${info.start_time} ~ ${info.end_time}${runtime ? ` (${runtime})` : ''}`
    : ''
  const eventLine = [dateStr, info.class_period, timeStr].filter(Boolean).join(' ')
  const hasInfo = !!(eventLine || info.venue || info.student_count || info.teacher_name)

  function handleCopy() {
    navigator.clipboard.writeText(buildCopyText(concert))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div
      className={`bg-white border rounded-2xl overflow-hidden transition-all ${
        isUrgent ? 'border-yellow-200' : expanded ? 'border-gray-200' : 'border-gray-100'
      }`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {/* 카드 헤더 */}
      <div className="px-5 py-4 flex items-center gap-4 cursor-pointer hover:bg-gray-50/60 transition-colors" onClick={() => setExpanded(v => !v)}>
        <div className={`flex-shrink-0 text-center w-16 py-2 rounded-xl ${concert.stage === '완료' ? 'bg-gray-50' : isUrgent ? 'bg-yellow-50' : 'bg-gray-50'}`}>
          <div className={`text-xs font-semibold ${concert.stage === '완료' ? 'text-gray-400' : isUrgent ? 'text-yellow-600' : 'text-gray-500'}`}>
            {concert.concert_date}
          </div>
        </div>
        <div className="w-32 flex-shrink-0">
          <div className={`font-semibold text-sm truncate ${concert.school ? 'text-gray-800' : 'text-gray-300'}`}>
            {concert.school || '학교 미정'}
          </div>
          {concert.concept && <div className="text-xs text-gray-400 mt-0.5">{concert.concept}</div>}
        </div>
        <div className="flex-1 min-w-0">
          {concert.mc || concert.artists.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {concert.mc && <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-medium">MC {concert.mc}</span>}
              {concert.artists.slice(0, 3).map(a => <span key={a} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{a}</span>)}
              {concert.artists.length > 3 && <span className="text-xs text-gray-400">+{concert.artists.length - 3}</span>}
            </div>
          ) : <span className="text-xs text-gray-300">아티스트 미정</span>}
        </div>
        <div className="flex-shrink-0"><StaffAvatars names={concert.staff} /></div>
        <div className="flex-shrink-0 hidden sm:block">
          <ProgressDots done={concert.tasks_done} total={concert.tasks_total} stage={concert.stage} />
        </div>
        <div className="flex-shrink-0" onClick={e => e.stopPropagation()}>
          <select value={concert.stage} onChange={e => onStageChange(e.target.value as Stage)}
            className={`text-xs font-medium px-2.5 py-1 rounded-full border-0 cursor-pointer appearance-none text-center ${STAGE_BADGE[concert.stage]}`}>
            {STAGES.map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div className={`flex-shrink-0 flex items-center gap-1 transition-opacity ${showActions ? 'opacity-100' : 'opacity-0'}`} onClick={e => e.stopPropagation()}>
          <button onClick={onEdit} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 text-sm">✏️</button>
          <button onClick={onDelete} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 text-sm">🗑️</button>
          {concert.sale_id && (
            <button onClick={() => alert('/sales/' + concert.sale_id)} className="p-1.5 rounded-lg hover:bg-yellow-50 text-yellow-500 text-sm font-bold">→</button>
          )}
        </div>
        <div className="flex-shrink-0 text-gray-300 text-xs">{expanded ? '▲' : '▼'}</div>
      </div>

      {/* 확장 영역 */}
      {expanded && (
        <div className="border-t border-gray-100 bg-gray-50/40" onClick={e => e.stopPropagation()}>

          {/* ① 행사 개요 */}
          <div className="px-5 pt-4 pb-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">행사 개요</span>
              <div className="flex items-center gap-2">
                <button onClick={handleCopy}
                  className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${
                    copied ? 'bg-green-100 border-green-200 text-green-700' : 'border-gray-200 text-gray-500 hover:border-gray-400'
                  }`}>
                  {copied ? '✓ 복사됨' : '📋 복사'}
                </button>
                <button onClick={onEdit} className="text-xs text-yellow-600 hover:underline">편집</button>
              </div>
            </div>
            {hasInfo ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-2">
                {[
                  { label: '행사 일시',   value: eventLine },
                  { label: '장소',         value: info.venue },
                  { label: '학생 수',      value: info.student_count },
                  { label: '설치·리허설', value: info.setup_time },
                  { label: '콜타임',       value: info.calltime },
                  { label: '공실 요청',    value: info.venue_clear },
                  { label: '현수막',       value: info.banner_size },
                  { label: '선생님',       value: info.teacher_name ? `${info.teacher_name}${info.teacher_phone ? '  ' + info.teacher_phone : ''}` : undefined },
                  { label: '그 외',        value: info.extra },
                ].filter(r => r.value).map(r => (
                  <div key={r.label} className="flex flex-col">
                    <span className="text-[10px] text-gray-400">{r.label}</span>
                    <span className="text-xs text-gray-700">{r.value}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-300">
                행사 정보가 없습니다.{' '}
                <button onClick={onEdit} className="text-yellow-600 hover:underline">추가하기</button>
              </p>
            )}
          </div>

          {/* ② 행사 인력 */}
          <div className="px-5 py-3 border-t border-gray-100">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-2">행사 인력</span>
            <div className="flex flex-wrap gap-x-6 gap-y-1.5">
              {concert.mc && (
                <div>
                  <span className="text-[10px] text-gray-400 block">MC</span>
                  <span className="text-xs font-medium text-yellow-700 bg-yellow-100 px-2 py-0.5 rounded-full">{concert.mc}</span>
                </div>
              )}
              {concert.artists.length > 0 && (
                <div>
                  <span className="text-[10px] text-gray-400 block">아티스트</span>
                  <div className="flex flex-wrap gap-1 mt-0.5">
                    {concert.artists.map(a => <span key={a} className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full">{a}</span>)}
                  </div>
                </div>
              )}
              {concert.staff.length > 0 && (
                <div>
                  <span className="text-[10px] text-gray-400 block">스태프</span>
                  <div className="flex flex-wrap gap-1 mt-0.5">
                    {concert.staff.map(s => <span key={s} className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">{s}</span>)}
                  </div>
                </div>
              )}
              {!concert.mc && concert.artists.length === 0 && concert.staff.length === 0 && (
                <p className="text-xs text-gray-300">인력 미배정</p>
              )}
            </div>
          </div>

          {/* ③ 업무 */}
          <div className="px-5 py-3 border-t border-gray-100">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-2">업무</span>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {SOS_TASKS.map((task, i) => {
                const done = i < concert.tasks_done
                return (
                  <button key={task.key} onClick={() => onTaskToggle(task.key)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl text-left transition-colors ${
                      done ? 'bg-white border border-green-100 text-gray-400' : 'bg-white border border-gray-200 text-gray-700 hover:border-yellow-300'
                    }`}>
                    <div className={`w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center ${done ? 'bg-green-400 border-green-400' : 'border-gray-300'}`}>
                      {done && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 12 12"><path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                    </div>
                    <span className={`text-xs leading-tight ${done ? 'line-through' : ''}`}>{task.label}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── 메인 ─────────────────────────────────────────────────────────
export default function SosDemoPage() {
  const [concerts, setConcerts] = useState<Concert[]>([...MOCK_2026, ...MOCK_2025])
  const [selectedYear, setSelectedYear] = useState(2026)
  const [modal, setModal] = useState<{ open: boolean; concert?: Concert }>({ open: false })

  const yearConcerts = concerts.filter(c => c.year === selectedYear)
  const byMonth = yearConcerts.reduce<Record<number, Concert[]>>((acc, c) => {
    if (!acc[c.month]) acc[c.month] = []
    acc[c.month].push(c)
    return acc
  }, {})
  const months = Object.keys(byMonth).map(Number).sort((a, b) => a - b)

  const total    = yearConcerts.length
  const done     = yearConcerts.filter(c => c.stage === '완료').length
  const upcoming = yearConcerts.filter(c => c.stage !== '완료' && c.stage !== '취소').length

  function handleSave(data: Partial<Concert>) {
    if (modal.concert) {
      setConcerts(cs => cs.map(c => c.id === modal.concert!.id ? { ...c, ...data } : c))
    } else {
      const { id: _id, tasks_total: _tt, ...rest } = data as Concert
      setConcerts(cs => [{ id: String(Date.now()), tasks_total: 11, ...rest }, ...cs])
    }
  }

  function handleDelete(id: string) {
    if (!confirm('삭제할까요?')) return
    setConcerts(cs => cs.filter(c => c.id !== id))
  }

  function handleStageChange(id: string, stage: Stage) {
    setConcerts(cs => cs.map(c => c.id !== id ? c : { ...c, stage, tasks_done: STAGE_TASKS[stage] }))
  }

  function handleTaskToggle(concertId: string, taskKey: string) {
    setConcerts(cs => cs.map(c => {
      if (c.id !== concertId) return c
      const idx = SOS_TASKS.findIndex(t => t.key === taskKey)
      if (idx === -1) return c
      const newDone = idx < c.tasks_done ? idx : idx + 1
      return { ...c, tasks_done: newDone }
    }))
  }

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-800">🎵 SOS 공연 관리</h1>
            <span className="text-xs bg-yellow-300 text-yellow-900 font-semibold px-2 py-0.5 rounded-full">UI 데모</span>
          </div>
          <p className="text-sm text-gray-400 mt-0.5">Sound OF School 공연 일정 및 현황</p>
        </div>
        <button onClick={() => setModal({ open: true })}
          className="flex items-center gap-1.5 px-4 py-2 bg-yellow-400 rounded-xl font-semibold text-sm hover:bg-yellow-500">
          <span className="text-lg leading-none">+</span> 공연 추가
        </button>
      </div>

      <div className="flex gap-2 mb-5">
        {[2026, 2025].map(y => (
          <button key={y} onClick={() => setSelectedYear(y)}
            className={`px-5 py-2 rounded-xl text-sm font-semibold transition-colors ${
              selectedYear === y ? 'bg-gray-800 text-white' : 'bg-white border border-gray-200 text-gray-500 hover:border-gray-400'
            }`}>{y}년</button>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-3 mb-7">
        {[
          { label: '전체 공연', value: total,    color: 'bg-white' },
          { label: '진행 예정', value: upcoming, color: 'bg-yellow-50' },
          { label: '완료',      value: done,     color: 'bg-green-50' },
        ].map(card => (
          <div key={card.label} className={`${card.color} border border-gray-100 rounded-xl p-4 text-center`}>
            <div className="text-2xl font-bold text-gray-800">{card.value}</div>
            <div className="text-xs text-gray-500 mt-0.5">{card.label}</div>
          </div>
        ))}
      </div>

      {months.length === 0 ? (
        <div className="py-20 text-center text-gray-400">
          <div className="text-3xl mb-2">🎵</div>
          <p className="text-sm">{selectedYear}년 공연이 없습니다</p>
          <button onClick={() => setModal({ open: true })} className="mt-3 text-xs text-yellow-600 underline">공연 추가하기</button>
        </div>
      ) : (
        <div className="space-y-8">
          {months.map(month => (
            <div key={month}>
              <div className="flex items-center gap-3 mb-3">
                <span className="text-sm font-bold text-gray-700">{MONTHS[month - 1]}</span>
                <span className="text-xs text-gray-400">{byMonth[month].length}건</span>
                <div className="flex-1 h-px bg-gray-100" />
              </div>
              <div className="space-y-2">
                {byMonth[month].map(concert => (
                  <ConcertCard key={concert.id} concert={concert}
                    onEdit={() => setModal({ open: true, concert })}
                    onDelete={() => handleDelete(concert.id)}
                    onStageChange={stage => handleStageChange(concert.id, stage)}
                    onTaskToggle={key => handleTaskToggle(concert.id, key)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {modal.open && (
        <ConcertModal concert={modal.concert} onClose={() => setModal({ open: false })} onSave={handleSave} />
      )}
    </div>
  )
}
