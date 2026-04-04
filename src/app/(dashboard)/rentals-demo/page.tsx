'use client'
import { useState, useEffect } from 'react'

// ─── 상수 ────────────────────────────────────────────────────────
const STATUS_BADGE: Record<string, string> = {
  유입:       'bg-gray-100 text-gray-500',
  상담:       'bg-purple-100 text-purple-700',
  견적발송:   'bg-blue-100 text-blue-700',
  확정:       'bg-yellow-100 text-yellow-700',
  계약서서명: 'bg-orange-100 text-orange-700',
  진행중:     'bg-green-100 text-green-700',
  반납:       'bg-teal-100 text-teal-700',
  완료:       'bg-gray-100 text-gray-400',
  취소:       'bg-red-100 text-red-400',
}
const STATUS_BAR: Record<string, string> = {
  유입: 'bg-gray-300', 상담: 'bg-purple-400', 견적발송: 'bg-blue-400',
  확정: 'bg-yellow-400', 계약서서명: 'bg-orange-400', 진행중: 'bg-green-500',
  반납: 'bg-teal-400', 완료: 'bg-gray-200', 취소: 'bg-red-300',
}
const NEXT: Record<string, string> = {
  유입:'상담', 상담:'견적발송', 견적발송:'확정',
  확정:'계약서서명', 계약서서명:'진행중', 진행중:'반납', 반납:'완료',
}

// ─── 타입 ────────────────────────────────────────────────────────
interface R {
  id: string; customer_name: string; contact_name: string | null; phone: string | null
  customer_type: string; status: string
  rental_start: string | null; rental_end: string | null; payment_due: string | null
  delivery_method: string | null; total_amount: number; deposit: number
  assignee_name: string | null; inflow_source: string | null; items_count: number
}
interface Item { id: string; item_name: string; quantity: number; months: number; unit_price: number; total_price: number }
interface Contact { date: string; author: string; content: string }
interface FileItem { name: string; type: 'pdf' | 'image' | 'doc'; date: string }

// ─── 목업 데이터 ──────────────────────────────────────────────────
const MOCK: R[] = [
  { id:'1',  customer_name:'한빛초등학교', contact_name:'김선생',  phone:'010-1234-5678', customer_type:'기관', status:'진행중',     rental_start:'2026-03-01', rental_end:'2026-06-30', payment_due:'2026-03-01', delivery_method:'착불택배',     total_amount:1200000, deposit:200000, assignee_name:'홍길동', inflow_source:'네이버',   items_count:2 },
  { id:'2',  customer_name:'푸른중학교',   contact_name:'박담당',  phone:'010-9876-5432', customer_type:'기관', status:'견적발송',   rental_start:'2026-05-01', rental_end:null,         payment_due:null,         delivery_method:'업체배송수거', total_amount:0,       deposit:0,      assignee_name:'김철수', inflow_source:'인스타',   items_count:0 },
  { id:'3',  customer_name:'새벽고등학교', contact_name:'이선생',  phone:'010-2222-3333', customer_type:'기관', status:'상담',       rental_start:'2026-05-15', rental_end:'2026-08-31', payment_due:null,         delivery_method:null,          total_amount:850000,  deposit:100000, assignee_name:'이영희', inflow_source:'기존고객', items_count:2 },
  { id:'4',  customer_name:'홍길동',       contact_name:null,      phone:'010-1111-2222', customer_type:'개인', status:'확정',       rental_start:'2026-04-15', rental_end:'2026-07-15', payment_due:'2026-04-10', delivery_method:'퀵',           total_amount:300000,  deposit:50000,  assignee_name:'홍길동', inflow_source:'지인',     items_count:1 },
  { id:'5',  customer_name:'다온특수학교', contact_name:'최담당',  phone:'010-3333-4444', customer_type:'기관', status:'계약서서명', rental_start:'2026-04-20', rental_end:'2026-10-20', payment_due:'2026-04-18', delivery_method:'업체배송수거', total_amount:2400000, deposit:400000, assignee_name:'홍길동', inflow_source:'채널톡',   items_count:5 },
  { id:'6',  customer_name:'햇살어린이집', contact_name:'강원장',  phone:'010-5555-6666', customer_type:'기관', status:'유입',       rental_start:null,         rental_end:null,         payment_due:null,         delivery_method:null,          total_amount:0,       deposit:0,      assignee_name:null,     inflow_source:'유튜브',   items_count:0 },
  { id:'7',  customer_name:'나루문화센터', contact_name:'조팀장',  phone:'010-7777-8888', customer_type:'기관', status:'반납',       rental_start:'2026-01-01', rental_end:'2026-04-07', payment_due:'2026-01-01', delivery_method:'착불택배',     total_amount:600000,  deposit:100000, assignee_name:'김철수', inflow_source:'기타',     items_count:2 },
  { id:'8',  customer_name:'이순신',       contact_name:null,      phone:'010-9999-0000', customer_type:'개인', status:'완료',       rental_start:'2025-09-01', rental_end:'2026-02-28', payment_due:'2025-09-01', delivery_method:'방문수령반납', total_amount:450000,  deposit:50000,  assignee_name:'이영희', inflow_source:'네이버',   items_count:1 },
  { id:'9',  customer_name:'온누리복지관', contact_name:'신담당',  phone:'010-2222-3333', customer_type:'기관', status:'진행중',     rental_start:'2026-02-15', rental_end:'2026-05-10', payment_due:'2026-02-15', delivery_method:'업체배송수거', total_amount:980000,  deposit:150000, assignee_name:'김철수', inflow_source:'채널톡',   items_count:4 },
  { id:'10', customer_name:'가람학교',     contact_name:'서선생',  phone:'010-4444-5555', customer_type:'기관', status:'확정',       rental_start:'2026-04-08', rental_end:'2026-07-08', payment_due:'2026-04-05', delivery_method:'착불택배',     total_amount:720000,  deposit:100000, assignee_name:'홍길동', inflow_source:'네이버',   items_count:3 },
]

const MOCK_ITEMS: Record<string, Item[]> = {
  '1': [
    { id:'i1', item_name:'젬베 10 단기', quantity:10, months:3, unit_price:15000,  total_price:450000 },
    { id:'i2', item_name:'톤차임(25음)', quantity:1,  months:3, unit_price:250000, total_price:750000 },
  ],
  '4': [{ id:'i3', item_name:'오션드럼', quantity:1, months:3, unit_price:100000, total_price:300000 }],
  '5': [
    { id:'i4', item_name:'젬베 소형',   quantity:8,  months:6, unit_price:12000,  total_price:576000 },
    { id:'i5', item_name:'핸드벨(8음)', quantity:3,  months:6, unit_price:80000,  total_price:1440000 },
    { id:'i6', item_name:'마라카스',    quantity:10, months:6, unit_price:6400,   total_price:384000 },
  ],
  '9': [
    { id:'i7', item_name:'공명실로폰(27음)', quantity:2, months:3, unit_price:120000, total_price:720000 },
    { id:'i8', item_name:'게더링드럼',       quantity:1, months:3, unit_price:86667,  total_price:260000 },
  ],
  '10': [
    { id:'i9', item_name:'젬베 중형', quantity:6, months:3, unit_price:20000, total_price:360000 },
    { id:'ia', item_name:'오션드럼', quantity:2, months:3, unit_price:60000, total_price:360000 },
  ],
}

// 소통 이력 (리드 관리의 contact_1/2/3와 동일한 개념)
const MOCK_CONTACTS: Record<string, Contact[]> = {
  '1': [
    { date:'2026-02-15', author:'홍길동', content:'네이버 문의 인입. 젬베 10개 + 톤차임 3개월 렌탈 요청. 배송 가능 여부 확인 요청.' },
    { date:'2026-02-20', author:'홍길동', content:'견적서 발송 완료 (120만원 / 보증금 20만원). 착수금 입금 요청.' },
    { date:'2026-02-28', author:'홍길동', content:'착수금 20만원 입금 확인. 배송 일정 3/1 확정. 송장 전달 예정.' },
  ],
  '5': [
    { date:'2026-03-20', author:'홍길동', content:'채널톡 인입. 특수학교 음악치료 교구 6개월 렌탈 희망. 5종 견적 요청.' },
    { date:'2026-03-25', author:'홍길동', content:'견적서 발송. 240만원 / 보증금 40만원. 계약서 양식 문의 있음.' },
    { date:'2026-04-01', author:'홍길동', content:'임대차 계약서 작성 완료. 서명 요청 문자 발송. 배송일 4/20 예정.' },
  ],
  '10': [
    { date:'2026-03-25', author:'홍길동', content:'네이버 플레이스 문의. 젬베 6개 + 오션드럼 2개 3개월 렌탈.' },
    { date:'2026-03-28', author:'홍길동', content:'견적서 발송 (72만원). 배송일 4/8 확정. 결제 기한 4/5.' },
  ],
}

const MOCK_FILES: Record<string, FileItem[]> = {
  '1': [
    { name:'260220 한빛초등학교 견적서.pdf',  type:'pdf',   date:'2026-02-20' },
    { name:'260228 임대차계약서_서명완료.pdf', type:'pdf',   date:'2026-02-28' },
    { name:'260301 배송 송장.jpg',            type:'image', date:'2026-03-01' },
  ],
  '5': [
    { name:'260325 다온특수학교 견적서.pdf',  type:'pdf',   date:'2026-03-25' },
    { name:'260401 임대차계약서_서명전.pdf',  type:'pdf',   date:'2026-04-01' },
  ],
  '10': [
    { name:'260328 가람학교 견적서.pdf',      type:'pdf',   date:'2026-03-28' },
  ],
}

const MOCK_DROPBOX: Record<string, string> = {
  '1':  'https://www.dropbox.com/home/%EB%B0%A9%20%EC%A4%80%EC%98%81/1.%20%EA%B0%80%EC%97%85/%E2%98%85%20DB/3%20%ED%95%99%EA%B5%90%EC%83%81%EC%A0%90/1%20%EA%B5%90%EA%B5%AC%EB%8C%80%EC%97%AC/260301%20%ED%95%9C%EB%B9%9B%EC%B4%88%EB%93%B1%ED%95%99%EA%B5%90',
  '5':  'https://www.dropbox.com/home/%EB%B0%A9%20%EC%A4%80%EC%98%81/1.%20%EA%B0%80%EC%97%85/%E2%98%85%20DB/3%20%ED%95%99%EA%B5%90%EC%83%81%EC%A0%90/1%20%EA%B5%90%EA%B5%AC%EB%8C%80%EC%97%AC/260420%20%EB%8B%A4%EC%98%A8%ED%8A%B9%EC%88%98%ED%95%99%EA%B5%90',
  '10': 'https://www.dropbox.com/home/%EB%B0%A9%20%EC%A4%80%EC%98%81/1.%20%EA%B0%80%EC%97%85/%E2%98%85%20DB/3%20%ED%95%99%EA%B5%90%EC%83%81%EC%A0%90/1%20%EA%B5%90%EA%B5%AC%EB%8C%80%EC%97%AC/260408%20%EA%B0%80%EB%9E%8C%ED%95%99%EA%B5%90',
}

// ─── 프로세스 체크리스트 ──────────────────────────────────────────
const STATUS_TO_STEP: Record<string, number> = {
  유입: 0, 상담: 0, 견적발송: 1, 확정: 2, 계약서서명: 3, 진행중: 4, 반납: 5, 완료: 6,
}
const PROCESS_STEPS = [
  {
    label: '1. 최초 유입',
    sublabel: 'CS 응대 및 요구사항 파악',
    color: 'purple',
    items: [
      { id: '1-1', text: '고객 CRM에 기록 및 업데이트' },
      { id: '1-2', text: '가이드 확인 후 필요내용 요청 (성함·연락처·기관명·항목/수량·렌탈일정·주소·수령방법)' },
      { id: '1-3', text: '재고 확인 후 답변 (재고 없을 시 추가 구매 여부 확인 필수)' },
    ],
  },
  {
    label: '2. 견적서 작성',
    sublabel: '견적서 작성 및 전달',
    color: 'blue',
    items: [
      { id: '2-1', text: '임대차계약서(견적서) 작성 및 전달 (배송비: 택배 편도 1~2만원)' },
      { id: '2-2', text: '확정 시 사인 후 전달받기' },
    ],
  },
  {
    label: '3. 렌탈 진행',
    sublabel: '렌탈 진행 준비',
    color: 'yellow',
    items: [
      { id: '3-1', text: '필요 서류 받기 · 개인: 보증금·신분증·서명된 계약서 / 기업: 사업자등록증·계약서 / 학교·기관: 고유번호증·계약서' },
      { id: '3-2', text: '결제 완료' },
    ],
  },
  {
    label: '4. 포장',
    sublabel: '',
    color: 'orange',
    items: [
      { id: '4-1', text: '악기 검수' },
      { id: '4-2', text: '영상과 사진 남기기' },
      { id: '4-3', text: '렌탈 공통 안내사항 + 악기별 안내사항 동봉' },
    ],
  },
  {
    label: '5. 배송 진행',
    sublabel: '',
    color: 'green',
    items: [
      { id: '5-1', text: '택배: 우체국 방문택배 예약' },
      { id: '5-2', text: '택배 내놓기' },
      { id: '5-3', text: '송장번호 공유' },
      { id: '5-4', text: '방문수령: 방문일정 확인 (대면 or 비대면)' },
      { id: '5-5', text: '퀵: 한국로지스 이용' },
    ],
  },
  {
    label: '6. 반납일 도래 연락',
    sublabel: '',
    color: 'teal',
    items: [
      { id: '6-1', text: '반납 안내' },
      { id: '6-2', text: '택배/방문반납: 반납 사전 연락' },
      { id: '6-3', text: '퀵/직접배송: 픽업 안내' },
    ],
  },
  {
    label: '7. 검수',
    sublabel: '',
    color: 'gray',
    items: [
      { id: '7-1', text: '물품 검수' },
    ],
  },
]
const STEP_COLOR: Record<string, { ring: string; bg: string; dot: string; text: string; check: string }> = {
  purple: { ring:'ring-purple-200', bg:'bg-purple-50', dot:'bg-purple-400', text:'text-purple-700', check:'accent-purple-400' },
  blue:   { ring:'ring-blue-200',   bg:'bg-blue-50',   dot:'bg-blue-400',   text:'text-blue-700',   check:'accent-blue-400' },
  yellow: { ring:'ring-yellow-200', bg:'bg-yellow-50', dot:'bg-yellow-400', text:'text-yellow-700', check:'accent-yellow-400' },
  orange: { ring:'ring-orange-200', bg:'bg-orange-50', dot:'bg-orange-400', text:'text-orange-700', check:'accent-orange-400' },
  green:  { ring:'ring-green-200',  bg:'bg-green-50',  dot:'bg-green-500',  text:'text-green-700',  check:'accent-green-400' },
  teal:   { ring:'ring-teal-200',   bg:'bg-teal-50',   dot:'bg-teal-400',   text:'text-teal-700',   check:'accent-teal-400' },
  gray:   { ring:'ring-gray-200',   bg:'bg-gray-50',   dot:'bg-gray-300',   text:'text-gray-500',   check:'accent-gray-400' },
}

// ─── 유틸 ────────────────────────────────────────────────────────
const fmt = (n: number) => n.toLocaleString()
function daysFrom(d: string) {
  return Math.ceil((new Date(d).getTime() - new Date().setHours(0,0,0,0)) / 86400000)
}
function getDDay(dateStr: string | null) {
  if (!dateStr) return null
  const d = daysFrom(dateStr)
  if (d < 0)   return { label:`D+${Math.abs(d)}`, cls:'bg-gray-100 text-gray-400',           row:'' }
  if (d === 0) return { label:'D-day',              cls:'bg-red-500 text-white font-bold',     row:'bg-red-50/60' }
  if (d <= 3)  return { label:`D-${d}`,             cls:'bg-red-100 text-red-600 font-semibold', row:'bg-red-50/40' }
  if (d <= 7)  return { label:`D-${d}`,             cls:'bg-yellow-100 text-yellow-700',      row:'bg-yellow-50/40' }
  return       { label:`D-${d}`,                    cls:'bg-gray-100 text-gray-400',          row:'' }
}
function getDisplayDDay(r: R) {
  if (['확정','계약서서명'].includes(r.status)) return getDDay(r.rental_start)
  if (['진행중','반납'].includes(r.status))     return getDDay(r.rental_end)
  return null
}
function FileIcon({ type }: { type: string }) {
  if (type === 'pdf')   return <span className="text-red-400 text-sm">📄</span>
  if (type === 'image') return <span className="text-blue-400 text-sm">🖼️</span>
  return <span className="text-gray-400 text-sm">📎</span>
}

// ─── 보기 탭 ─────────────────────────────────────────────────────
const VIEWS = [
  { key:'전체',     label:'전체',          filter:(r:R) => !['완료','취소'].includes(r.status),           sort:(a:R,b:R) => (a.rental_end??'9') < (b.rental_end??'9') ? -1 : 1 },
  { key:'배송 예정', label:'📦 배송 예정',  filter:(r:R) => ['확정','계약서서명'].includes(r.status),      sort:(a:R,b:R) => (a.rental_start??'9') < (b.rental_start??'9') ? -1 : 1 },
  { key:'수거 예정', label:'🔁 수거 예정',  filter:(r:R) => ['진행중','반납'].includes(r.status),          sort:(a:R,b:R) => (a.rental_end??'9') < (b.rental_end??'9') ? -1 : 1 },
  { key:'진행 전',  label:'🔔 진행 전',    filter:(r:R) => ['유입','상담','견적발송'].includes(r.status),  sort:(_a:R,_b:R) => 0 },
  { key:'완료 체크', label:'✅ 완료 체크',  filter:(r:R) => ['완료','취소'].includes(r.status),            sort:(a:R,b:R) => (a.rental_end??'') > (b.rental_end??'') ? -1 : 1 },
] as const
type ViewKey = typeof VIEWS[number]['key']

// ─── 메인 ────────────────────────────────────────────────────────
export default function RentalsDemoPage() {
  const [viewKey, setViewKey]   = useState<ViewKey>('전체')
  const [selected, setSelected] = useState<R | null>(MOCK[0])
  const [addContact, setAddContact] = useState(false)
  const [contactText, setContactText] = useState('')
  const [checklist, setChecklist] = useState<Record<string, boolean>>({})
  const [expandedStep, setExpandedStep] = useState<number | null>(null)

  useEffect(() => {
    if (selected) {
      setChecklist({})
      setExpandedStep(STATUS_TO_STEP[selected.status] ?? null)
    }
  }, [selected?.id])

  const view = VIEWS.find(v => v.key === viewKey)!
  const rows = [...MOCK].filter(view.filter).sort(view.sort)

  const contacts = selected ? (MOCK_CONTACTS[selected.id] ?? []) : []
  const files    = selected ? (MOCK_FILES[selected.id] ?? []) : []
  const dbxUrl   = selected ? MOCK_DROPBOX[selected.id] : null
  const items    = selected ? (MOCK_ITEMS[selected.id] ?? []) : []
  const itemsTotal = items.reduce((s, i) => s + i.total_price, 0)

  const stats = [
    { label:'전체 진행',       value: MOCK.filter(r => !['완료','취소'].includes(r.status)).length, color:'text-gray-800' },
    { label:'배송 예정',       value: MOCK.filter(r => ['확정','계약서서명'].includes(r.status)).length, color:'text-yellow-600' },
    { label:'렌탈중',          value: MOCK.filter(r => r.status === '진행중').length, color:'text-green-600' },
    { label:'수거 임박 7일',   value: MOCK.filter(r => r.rental_end && ['진행중','반납'].includes(r.status) && daysFrom(r.rental_end) >= 0 && daysFrom(r.rental_end) <= 7).length, color:'text-red-600' },
  ]

  return (
    <div className="flex flex-col gap-4">
      {/* 헤더 */}
      <div className="flex items-center gap-2">
        <h1 className="text-xl font-bold text-gray-900">렌탈 관리</h1>
        <span className="text-xs px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded-full font-medium">UI 데모</span>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {stats.map(s => (
          <div key={s.label} className="bg-white border border-gray-200 rounded-xl px-4 py-3">
            <p className="text-xs text-gray-400 mb-1">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* 탭 + 등록 */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex flex-wrap gap-1.5">
          {VIEWS.map(v => (
            <button key={v.key} onClick={() => setViewKey(v.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${viewKey === v.key ? 'text-gray-900' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
              style={viewKey === v.key ? { backgroundColor:'#FFCE00' } : {}}>
              {v.label} <span className="opacity-50">({MOCK.filter(v.filter).length})</span>
            </button>
          ))}
        </div>
        <button className="px-4 py-1.5 text-sm font-semibold rounded-lg" style={{ backgroundColor:'#FFCE00', color:'#121212' }}>
          + 렌탈 등록
        </button>
      </div>

      {/* 스플릿 패널 */}
      <div className="flex flex-col md:flex-row gap-4 md:h-[calc(100vh-360px)] md:min-h-[560px]">

        {/* 왼쪽: 목록 */}
        <div className={`${selected ? 'hidden md:flex' : 'flex'} md:w-[50%] flex-col border border-gray-200 rounded-xl bg-white overflow-hidden min-h-[400px] md:min-h-0`}>
          <div className="overflow-y-auto flex-1">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-gray-50 z-10">
                <tr className="border-b border-gray-100">
                  <th className="w-1 p-0" />
                  <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-400 w-16">D-Day</th>
                  <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-400">고객</th>
                  <th className="hidden sm:table-cell text-left px-3 py-2.5 text-xs font-semibold text-gray-400">배송→수거</th>
                  <th className="hidden sm:table-cell text-left px-3 py-2.5 text-xs font-semibold text-gray-400">담당</th>
                  <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-400">상태</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-400 text-sm">해당 건이 없습니다.</td></tr>
                )}
                {rows.map(r => {
                  const dday = getDisplayDDay(r)
                  const isSel = selected?.id === r.id
                  return (
                    <tr key={r.id} onClick={() => setSelected(isSel ? null : r)}
                      className={`border-t border-gray-50 cursor-pointer transition-colors ${isSel ? 'bg-yellow-50 ring-1 ring-inset ring-yellow-200' : dday?.row ? `${dday.row} hover:brightness-95` : 'hover:bg-gray-50'}`}>
                      <td className="p-0"><div className={`w-1 min-h-[52px] ${STATUS_BAR[r.status]}`} /></td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        {dday
                          ? <span className={`text-xs px-2 py-0.5 rounded-full ${dday.cls}`}>{dday.label}</span>
                          : <span className="text-gray-300 text-xs">—</span>}
                      </td>
                      <td className="px-3 py-3">
                        <p className="font-semibold text-gray-900 text-sm leading-tight">{r.customer_name}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{r.contact_name ?? r.customer_type}</p>
                      </td>
                      <td className="hidden sm:table-cell px-3 py-3 whitespace-nowrap">
                        <p className="text-xs text-gray-600">{r.rental_start?.slice(5) ?? '—'}</p>
                        <p className="text-xs text-gray-400">{r.rental_end?.slice(5) ?? '—'}</p>
                      </td>
                      <td className="hidden sm:table-cell px-3 py-3 text-xs text-gray-500 whitespace-nowrap">
                        {r.assignee_name ?? <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-3 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[r.status]}`}>{r.status}</span>
                        {r.items_count > 0 && <p className="text-[10px] text-gray-400 mt-0.5">{r.items_count}종</p>}
                        {r.total_amount > 0 && <p className="text-[10px] font-semibold text-gray-600 mt-0.5">{fmt(r.total_amount)}원</p>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* 오른쪽: 상세 패널 */}
        <div className={`${selected ? 'flex' : 'hidden md:flex'} flex-1 flex-col border border-gray-200 rounded-xl bg-white overflow-hidden min-h-[400px] md:min-h-0`}>
          {!selected ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-2">
              <span className="text-3xl">👈</span>
              <p className="text-sm">왼쪽에서 렌탈 건을 선택하세요</p>
            </div>
          ) : (
            <>
              {/* 패널 헤더 */}
              <div className="px-5 py-4 border-b border-gray-100 bg-white shrink-0">
                <button onClick={() => setSelected(null)} className="md:hidden flex items-center gap-1 text-xs text-gray-400 mb-2">← 목록으로</button>
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-base font-bold text-gray-900">{selected.customer_name}</h2>
                    {selected.contact_name && (
                      <p className="text-xs text-gray-500 mt-0.5">{selected.contact_name}{selected.phone && ` · ${selected.phone}`}</p>
                    )}
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[selected.status]}`}>{selected.status}</span>
                      <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full">{selected.customer_type}</span>
                      {(() => { const d = getDisplayDDay(selected); return d ? <span className={`text-xs px-2 py-0.5 rounded-full ${d.cls}`}>{d.label}</span> : null })()}
                      {dbxUrl && (
                        <a href={dbxUrl} target="_blank" rel="noopener noreferrer"
                          className="text-xs px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full hover:bg-blue-100 transition-colors flex items-center gap-1">
                          📁 드롭박스
                        </a>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <button className="text-xs px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600">수정</button>
                    <button className="text-xs px-3 py-1.5 border border-red-100 text-red-400 rounded-lg hover:bg-red-50">삭제</button>
                  </div>
                </div>
              </div>

              <div className="overflow-y-auto flex-1 px-5 py-4 space-y-5">

                {/* 상태 진행바 */}
                <div className="bg-gray-50 rounded-xl p-3">
                  <div className="flex items-center gap-1 flex-wrap mb-3">
                    {['유입','상담','견적발송','확정','계약서서명','진행중','반납','완료'].map((s, i, arr) => (
                      <div key={s} className="flex items-center gap-1">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${selected.status === s ? STATUS_BADGE[s] + ' ring-1 ring-offset-1 ring-gray-300' : 'text-gray-300'}`}>{s}</span>
                        {i < arr.length - 1 && <span className="text-gray-200 text-[10px]">›</span>}
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {NEXT[selected.status] && (
                      <button className="px-3 py-1.5 bg-gray-900 text-white text-xs rounded-lg font-medium hover:bg-gray-800">
                        → {NEXT[selected.status]}으로 변경
                      </button>
                    )}
                    {!['취소','완료'].includes(selected.status) && (
                      <button className="px-3 py-1.5 border border-red-100 text-red-400 text-xs rounded-lg hover:bg-red-50">취소 처리</button>
                    )}
                  </div>
                </div>

                {/* 기본 정보 */}
                <div>
                  <p className="text-xs font-semibold text-gray-400 mb-2.5">기본 정보</p>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                    {([
                      ['배송일',    selected.rental_start],
                      ['수거일',    selected.rental_end],
                      ['결제 시기', selected.payment_due],
                      ['배송 방법', selected.delivery_method],
                      ['총 금액',   selected.total_amount ? fmt(selected.total_amount) + '원' : null],
                      ['보증금',    selected.deposit ? fmt(selected.deposit) + '원' : null],
                      ['담당 직원', selected.assignee_name],
                      ['유입 경로', selected.inflow_source],
                    ] as [string, string | null][]).filter(([, v]) => v).map(([label, value]) => (
                      <div key={label}>
                        <p className="text-xs text-gray-400">{label}</p>
                        <p className="text-gray-800 mt-0.5 font-medium">{value}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* ── 소통 이력 ── */}
                <div>
                  <div className="flex items-center justify-between mb-2.5">
                    <p className="text-xs font-semibold text-gray-400">소통 이력</p>
                    <button onClick={() => setAddContact(!addContact)}
                      className="text-xs px-2.5 py-1 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600">
                      + 추가
                    </button>
                  </div>

                  {addContact && (
                    <div className="mb-3 p-3 bg-gray-50 rounded-xl space-y-2">
                      <textarea
                        value={contactText}
                        onChange={e => setContactText(e.target.value)}
                        className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 resize-none bg-white focus:outline-none focus:border-gray-300"
                        rows={3}
                        placeholder="상담 내용, 통화 내용, 이메일 내용 등..." />
                      <div className="flex gap-2 justify-end">
                        <button onClick={() => { setAddContact(false); setContactText('') }}
                          className="text-xs px-3 py-1.5 border border-gray-200 rounded-lg text-gray-500">취소</button>
                        <button className="text-xs px-3 py-1.5 bg-gray-900 text-white rounded-lg">저장 (데모)</button>
                      </div>
                    </div>
                  )}

                  {contacts.length === 0 ? (
                    <p className="text-xs text-gray-300 py-3 text-center">기록된 소통 내역이 없어요</p>
                  ) : (
                    <div className="space-y-2.5">
                      {contacts.map((c, i) => (
                        <div key={i} className="flex gap-3">
                          <div className="flex flex-col items-center gap-1 pt-0.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-gray-300 shrink-0 mt-1" />
                            {i < contacts.length - 1 && <div className="w-px flex-1 bg-gray-100 min-h-[16px]" />}
                          </div>
                          <div className="flex-1 pb-1">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="text-[10px] font-medium text-gray-500">{c.author}</span>
                              <span className="text-[10px] text-gray-300">{c.date}</span>
                            </div>
                            <p className="text-xs text-gray-600 leading-relaxed">{c.content}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* ── 대여 품목 ── */}
                {items.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-gray-400 mb-2.5">대여 품목</p>
                    <div className="border border-gray-100 rounded-xl overflow-hidden">
                      <table className="w-full text-xs">
                        <thead className="bg-gray-50">
                          <tr className="border-b border-gray-100">
                            <th className="text-left px-3 py-2 text-gray-400 font-medium">품목</th>
                            <th className="text-center px-2 py-2 text-gray-400 font-medium">수량</th>
                            <th className="text-center px-2 py-2 text-gray-400 font-medium">개월</th>
                            <th className="text-right px-3 py-2 text-gray-400 font-medium">합계</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {items.map(item => (
                            <tr key={item.id}>
                              <td className="px-3 py-2 text-gray-700 font-medium">{item.item_name}</td>
                              <td className="text-center px-2 py-2 text-gray-500">{item.quantity}</td>
                              <td className="text-center px-2 py-2 text-gray-500">{item.months}개월</td>
                              <td className="text-right px-3 py-2 font-semibold text-gray-700">{fmt(item.total_price)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <div className="px-3 py-2 border-t border-gray-100 bg-gray-50 flex justify-between">
                        <span className="text-xs text-gray-400">품목 합계</span>
                        <span className="text-xs font-bold text-gray-800">{fmt(itemsTotal)}원</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── 프로세스 체크리스트 ── */}
                <div>
                  <p className="text-xs font-semibold text-gray-400 mb-3">프로세스 체크리스트</p>
                  <div className="space-y-2">
                    {PROCESS_STEPS.map((step, idx) => {
                      const currentStep = STATUS_TO_STEP[selected.status] ?? 0
                      const isPast    = idx < currentStep
                      const isCurrent = idx === currentStep
                      const isFuture  = idx > currentStep
                      const isOpen    = expandedStep === idx
                      const c = STEP_COLOR[step.color]
                      const allChecked = step.items.every(it => checklist[it.id])
                      const checkedCount = step.items.filter(it => checklist[it.id]).length

                      return (
                        <div key={idx}
                          className={`rounded-xl border transition-all ${
                            isCurrent
                              ? `ring-1 ${c.ring} border-transparent ${c.bg}`
                              : isPast
                              ? 'border-gray-100 bg-white opacity-60'
                              : 'border-gray-100 bg-white opacity-40'
                          }`}>
                          <button
                            onClick={() => setExpandedStep(isOpen ? null : idx)}
                            className="w-full flex items-center gap-3 px-3 py-2.5 text-left">
                            {/* 상태 아이콘 */}
                            <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                              isPast && allChecked ? 'bg-green-100' :
                              isPast ? 'bg-gray-100' :
                              isCurrent ? c.dot : 'bg-gray-100'
                            }`}>
                              {isPast && allChecked ? (
                                <span className="text-green-500 text-[10px] font-bold">✓</span>
                              ) : isPast ? (
                                <span className="text-gray-400 text-[10px]">−</span>
                              ) : isCurrent ? (
                                <span className="text-white text-[10px] font-bold">{idx + 1}</span>
                              ) : (
                                <span className="text-gray-300 text-[10px]">{idx + 1}</span>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={`text-xs font-semibold ${isCurrent ? c.text : isPast ? 'text-gray-500' : 'text-gray-300'}`}>
                                {step.label}
                              </p>
                              {step.sublabel && (
                                <p className="text-[10px] text-gray-400 mt-0.5">{step.sublabel}</p>
                              )}
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {(isCurrent || isPast) && (
                                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${allChecked ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
                                  {checkedCount}/{step.items.length}
                                </span>
                              )}
                              <span className={`text-gray-300 text-xs transition-transform ${isOpen ? 'rotate-180' : ''}`}>▾</span>
                            </div>
                          </button>

                          {isOpen && (
                            <div className="px-3 pb-3 space-y-2">
                              <div className="w-full h-px bg-gray-100 mb-2.5" />
                              {step.items.map(item => (
                                <label key={item.id} className="flex items-start gap-2.5 cursor-pointer group">
                                  <input
                                    type="checkbox"
                                    checked={!!checklist[item.id]}
                                    onChange={e => setChecklist(prev => ({ ...prev, [item.id]: e.target.checked }))}
                                    className={`w-3.5 h-3.5 mt-0.5 rounded ${c.check} shrink-0`}
                                  />
                                  <span className={`text-xs leading-relaxed transition-colors ${
                                    checklist[item.id] ? 'text-gray-300 line-through' : 'text-gray-600 group-hover:text-gray-900'
                                  }`}>{item.text}</span>
                                </label>
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* ── 파일 · 드롭박스 ── */}
                <div>
                  <div className="flex items-center justify-between mb-2.5">
                    <p className="text-xs font-semibold text-gray-400">파일 · 드롭박스</p>
                    {dbxUrl && (
                      <a href={dbxUrl} target="_blank" rel="noopener noreferrer"
                        className="text-xs px-2.5 py-1 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors">
                        📁 폴더 열기
                      </a>
                    )}
                  </div>

                  {!dbxUrl && (
                    <div className="bg-gray-50 border border-dashed border-gray-200 rounded-xl p-4 text-center">
                      <p className="text-xs text-gray-400 mb-1">드롭박스 폴더가 없어요</p>
                      <p className="text-[10px] text-gray-300">렌탈 등록 시 자동 생성됩니다</p>
                    </div>
                  )}

                  {dbxUrl && files.length === 0 && (
                    <p className="text-xs text-gray-300 py-2 text-center">파일을 드롭박스 폴더에 직접 업로드하세요</p>
                  )}

                  {files.length > 0 && (
                    <div className="border border-gray-100 rounded-xl overflow-hidden divide-y divide-gray-50">
                      {files.map((f, i) => (
                        <div key={i} className="flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 cursor-pointer transition-colors">
                          <FileIcon type={f.type} />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-gray-700 font-medium truncate">{f.name}</p>
                            <p className="text-[10px] text-gray-400">{f.date}</p>
                          </div>
                          <span className="text-[10px] text-gray-300 shrink-0">드롭박스</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* ── 메모 ── */}
                <div className="pb-2">
                  <p className="text-xs font-semibold text-gray-400 mb-2">메모</p>
                  <textarea
                    className="w-full border border-gray-100 rounded-xl px-3 py-2.5 text-xs text-gray-700 resize-none bg-gray-50 focus:outline-none focus:border-gray-300 min-h-[72px]"
                    rows={3}
                    placeholder="기타 메모..." />
                </div>

              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
