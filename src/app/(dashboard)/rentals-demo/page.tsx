'use client'
import { useState } from 'react'

// ─── 타입 & 상수 ────────────────────────────────────────────────
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
  유입:       'bg-gray-300',
  상담:       'bg-purple-400',
  견적발송:   'bg-blue-400',
  확정:       'bg-yellow-400',
  계약서서명: 'bg-orange-400',
  진행중:     'bg-green-500',
  반납:       'bg-teal-400',
  완료:       'bg-gray-200',
  취소:       'bg-red-300',
}
const NEXT: Record<string, string> = {
  유입:'상담', 상담:'견적발송', 견적발송:'확정',
  확정:'계약서서명', 계약서서명:'진행중', 진행중:'반납', 반납:'완료',
}

interface R {
  id: string
  customer_name: string; contact_name: string | null; phone: string | null
  customer_type: string; status: string
  rental_start: string | null; rental_end: string | null; payment_due: string | null
  delivery_method: string | null
  total_amount: number; deposit: number
  assignee_name: string | null; inflow_source: string | null
  items_count: number; notes: string | null
}
interface Item { id: string; item_name: string; quantity: number; months: number; unit_price: number; total_price: number }

const MOCK: R[] = [
  { id:'1',  customer_name:'OO초등학교',  contact_name:'김선생',  phone:'010-1234-5678', customer_type:'기관', status:'진행중',     rental_start:'2026-03-01', rental_end:'2026-06-30', payment_due:'2026-03-01', delivery_method:'착불택배',    total_amount:1200000, deposit:200000, assignee_name:'홍길동', inflow_source:'네이버',   items_count:3, notes:'젬베 채 추가 요청 있음' },
  { id:'2',  customer_name:'XX중학교',    contact_name:'박담당',  phone:'010-9876-5432', customer_type:'기관', status:'견적발송',   rental_start:'2026-05-01', rental_end:null,         payment_due:null,         delivery_method:'업체배송수거', total_amount:0,       deposit:0,      assignee_name:'김철수', inflow_source:'인스타',   items_count:0, notes:null },
  { id:'3',  customer_name:'△△고등학교', contact_name:'이선생',  phone:'010-2222-3333', customer_type:'기관', status:'상담',       rental_start:'2026-05-15', rental_end:'2026-08-31', payment_due:null,         delivery_method:null,          total_amount:850000,  deposit:100000, assignee_name:'이영희', inflow_source:'기존고객', items_count:2, notes:null },
  { id:'4',  customer_name:'홍길동',      contact_name:null,      phone:'010-1111-2222', customer_type:'개인', status:'확정',       rental_start:'2026-04-15', rental_end:'2026-07-15', payment_due:'2026-04-10', delivery_method:'퀵',          total_amount:300000,  deposit:50000,  assignee_name:'홍길동', inflow_source:'지인',     items_count:1, notes:'현관 앞 배송' },
  { id:'5',  customer_name:'□□특수학교', contact_name:'최담당',  phone:'010-3333-4444', customer_type:'기관', status:'계약서서명', rental_start:'2026-04-20', rental_end:'2026-10-20', payment_due:'2026-04-18', delivery_method:'업체배송수거', total_amount:2400000, deposit:400000, assignee_name:'홍길동', inflow_source:'채널톡',   items_count:5, notes:'계약서 서명 후 착수금 입금 확인 필요' },
  { id:'6',  customer_name:'○○어린이집', contact_name:'강원장',  phone:'010-5555-6666', customer_type:'기관', status:'유입',       rental_start:null,         rental_end:null,         payment_due:null,         delivery_method:null,          total_amount:0,       deposit:0,      assignee_name:null,     inflow_source:'유튜브',   items_count:0, notes:null },
  { id:'7',  customer_name:'☆☆문화센터', contact_name:'조팀장',  phone:'010-7777-8888', customer_type:'기관', status:'반납',       rental_start:'2026-01-01', rental_end:'2026-04-07', payment_due:'2026-01-01', delivery_method:'착불택배',    total_amount:600000,  deposit:100000, assignee_name:'김철수', inflow_source:'기타',     items_count:2, notes:'수거 택배 송장 전달 필요' },
  { id:'8',  customer_name:'이순신',      contact_name:null,      phone:'010-9999-0000', customer_type:'개인', status:'완료',       rental_start:'2025-09-01', rental_end:'2026-02-28', payment_due:'2025-09-01', delivery_method:'방문수령반납', total_amount:450000,  deposit:50000,  assignee_name:'이영희', inflow_source:'네이버',   items_count:1, notes:null },
  { id:'9',  customer_name:'◇◇복지관',   contact_name:'신담당',  phone:'010-2222-3333', customer_type:'기관', status:'진행중',     rental_start:'2026-02-15', rental_end:'2026-05-10', payment_due:'2026-02-15', delivery_method:'업체배송수거', total_amount:980000,  deposit:150000, assignee_name:'김철수', inflow_source:'채널톡',   items_count:4, notes:null },
  { id:'10', customer_name:'◎◎학교',     contact_name:'서선생',  phone:'010-4444-5555', customer_type:'기관', status:'확정',       rental_start:'2026-04-08', rental_end:'2026-07-08', payment_due:'2026-04-05', delivery_method:'착불택배',    total_amount:720000,  deposit:100000, assignee_name:'홍길동', inflow_source:'네이버',   items_count:3, notes:'배송 전 재고 확인 필요' },
]

const MOCK_ITEMS: Record<string, Item[]> = {
  '1': [
    { id:'i1', item_name:'젬베 10 단기',     quantity:10, months:3, unit_price:15000,  total_price:450000 },
    { id:'i2', item_name:'톤차임(25음)',      quantity:1,  months:3, unit_price:250000, total_price:750000 },
  ],
  '4': [
    { id:'i3', item_name:'오션드럼',         quantity:1,  months:3, unit_price:100000, total_price:300000 },
  ],
  '5': [
    { id:'i4', item_name:'젬베 소형',        quantity:8,  months:6, unit_price:12000,  total_price:576000 },
    { id:'i5', item_name:'핸드벨(8음)',      quantity:3,  months:6, unit_price:80000,  total_price:1440000 },
    { id:'i6', item_name:'마라카스',         quantity:10, months:6, unit_price:6400,   total_price:384000 },
  ],
  '9': [
    { id:'i7', item_name:'공명실로폰(27음)', quantity:2,  months:3, unit_price:120000, total_price:720000 },
    { id:'i8', item_name:'게더링드럼',       quantity:1,  months:3, unit_price:86667,  total_price:260000 },
  ],
  '10': [
    { id:'i9', item_name:'젬베 중형',        quantity:6,  months:3, unit_price:20000,  total_price:360000 },
    { id:'ia', item_name:'오션드럼',         quantity:2,  months:3, unit_price:60000,  total_price:360000 },
  ],
}

// ─── 유틸 ────────────────────────────────────────────────────────
const fmt = (n: number) => n.toLocaleString()

function daysFrom(date: string) {
  return Math.ceil((new Date(date).getTime() - new Date().setHours(0,0,0,0)) / 86400000)
}

function getDDay(dateStr: string | null, active = true) {
  if (!dateStr || !active) return null
  const d = daysFrom(dateStr)
  if (d < -1)  return { label: `D+${Math.abs(d)}`, cls: 'bg-gray-100 text-gray-400',           row: '' }
  if (d === -1 || d === 0) return { label: d === 0 ? 'D-day' : 'D+1', cls: 'bg-red-500 text-white font-bold',   row: 'bg-red-50/60' }
  if (d <= 3)  return { label: `D-${d}`, cls: 'bg-red-100 text-red-600 font-semibold',    row: 'bg-red-50/40' }
  if (d <= 7)  return { label: `D-${d}`, cls: 'bg-yellow-100 text-yellow-700',            row: 'bg-yellow-50/40' }
  return { label: `D-${d}`, cls: 'bg-gray-100 text-gray-400', row: '' }
}

// ─── 보기(탭) 정의 ────────────────────────────────────────────────
// 노션의 보내기/수거/완료(체크용) 보기를 반영
const VIEWS = [
  {
    key: '전체',
    label: '전체',
    desc: '완료·취소 제외',
    filter: (r: R) => !['완료','취소'].includes(r.status),
    sort: (a: R, b: R) => {
      // 수거 임박순 (진행중/반납) → 배송 임박순 (확정/계약서서명) → 나머지
      const urgentEnd = ['진행중','반납'].includes(a.status) && a.rental_end ? daysFrom(a.rental_end) : 9999
      const urgentEndB = ['진행중','반납'].includes(b.status) && b.rental_end ? daysFrom(b.rental_end) : 9999
      return urgentEnd - urgentEndB
    },
  },
  {
    key: '배송 예정',
    label: '📦 배송 예정',
    desc: '확정·계약서서명 → 배송일 임박순',
    filter: (r: R) => ['확정','계약서서명'].includes(r.status),
    sort: (a: R, b: R) => {
      const da = a.rental_start ? daysFrom(a.rental_start) : 9999
      const db = b.rental_start ? daysFrom(b.rental_start) : 9999
      return da - db
    },
  },
  {
    key: '수거 예정',
    label: '🔁 수거 예정',
    desc: '진행중·반납 → 수거일 임박순',
    filter: (r: R) => ['진행중','반납'].includes(r.status),
    sort: (a: R, b: R) => {
      const da = a.rental_end ? daysFrom(a.rental_end) : 9999
      const db = b.rental_end ? daysFrom(b.rental_end) : 9999
      return da - db
    },
  },
  {
    key: '진행 전',
    label: '🔔 진행 전',
    desc: '유입·상담·견적발송',
    filter: (r: R) => ['유입','상담','견적발송'].includes(r.status),
    sort: (a: R, b: R) => new Date(b.id).getTime() - new Date(a.id).getTime(),
  },
  {
    key: '완료 체크',
    label: '✅ 완료 체크',
    desc: '완료된 건 점검용',
    filter: (r: R) => ['완료','취소'].includes(r.status),
    sort: (a: R, b: R) => {
      const da = a.rental_end || ''
      const db = b.rental_end || ''
      return da < db ? 1 : -1
    },
  },
] as const

type ViewKey = typeof VIEWS[number]['key']

export default function RentalsDemoPage() {
  const [viewKey, setViewKey] = useState<ViewKey>('전체')
  const [selected, setSelected] = useState<R | null>(MOCK[0])

  const view = VIEWS.find(v => v.key === viewKey)!
  const rows = [...MOCK].filter(view.filter).sort(view.sort)

  // 요약 카운트
  const stats = [
    { label: '전체 진행', value: MOCK.filter(r => !['완료','취소'].includes(r.status)).length, color: 'text-gray-800' },
    { label: '배송 예정', value: MOCK.filter(r => ['확정','계약서서명'].includes(r.status)).length, color: 'text-yellow-600' },
    { label: '렌탈중',   value: MOCK.filter(r => r.status === '진행중').length, color: 'text-green-600' },
    { label: '수거 임박 (7일)', value: MOCK.filter(r => r.rental_end && ['진행중','반납'].includes(r.status) && daysFrom(r.rental_end) <= 7 && daysFrom(r.rental_end) >= 0).length, color: 'text-red-600' },
  ]

  // D-Day 기준: 배송 예정 탭이면 rental_start, 수거 예정/전체이면 rental_end
  function getDisplayDDay(r: R) {
    if (['확정','계약서서명'].includes(r.status) && r.rental_start)
      return getDDay(r.rental_start, true)
    if (['진행중','반납'].includes(r.status) && r.rental_end)
      return getDDay(r.rental_end, true)
    return null
  }

  const items = selected ? (MOCK_ITEMS[selected.id] ?? []) : []
  const itemsTotal = items.reduce((s, i) => s + i.total_price, 0)

  return (
    <div className="flex flex-col gap-4">
      {/* 데모 배지 */}
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

      {/* 보기 탭 + 등록 버튼 */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex flex-wrap gap-1.5">
          {VIEWS.map(v => {
            const cnt = MOCK.filter(v.filter).length
            return (
              <button key={v.key} onClick={() => setViewKey(v.key)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${viewKey === v.key ? 'text-gray-900' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                style={viewKey === v.key ? { backgroundColor: '#FFCE00' } : {}}>
                {v.label}
                <span className="ml-1 opacity-60">({cnt})</span>
              </button>
            )
          })}
        </div>
        <button className="px-4 py-1.5 text-sm font-semibold rounded-lg" style={{ backgroundColor: '#FFCE00', color: '#121212' }}>
          + 렌탈 등록
        </button>
      </div>

      {/* 스플릿 패널 */}
      <div className="flex flex-col md:flex-row gap-4 md:h-[calc(100vh-360px)] md:min-h-[540px]">

        {/* 왼쪽: 목록 테이블 */}
        <div className={`${selected ? 'hidden md:flex' : 'flex'} md:w-[52%] flex-col border border-gray-200 rounded-xl bg-white overflow-hidden min-h-[400px] md:min-h-0`}>
          <div className="overflow-y-auto flex-1">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-gray-50 z-10">
                <tr className="border-b border-gray-100">
                  <th className="w-1 p-0" />
                  <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-400">D-Day</th>
                  <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-400">고객</th>
                  <th className="hidden sm:table-cell text-left px-3 py-2.5 text-xs font-semibold text-gray-400">배송 → 수거</th>
                  <th className="hidden sm:table-cell text-left px-3 py-2.5 text-xs font-semibold text-gray-400">담당</th>
                  <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-400">상태</th>
                  <th className="hidden md:table-cell text-right px-3 py-2.5 text-xs font-semibold text-gray-400">금액</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-400 text-sm">해당 건이 없습니다.</td></tr>
                ) : rows.map(r => {
                  const dday = getDisplayDDay(r)
                  const isSel = selected?.id === r.id
                  return (
                    <tr key={r.id}
                      onClick={() => setSelected(isSel ? null : r)}
                      className={`border-t border-gray-50 cursor-pointer transition-colors ${isSel ? 'bg-yellow-50 ring-1 ring-inset ring-yellow-200' : dday?.row ? `${dday.row} hover:brightness-95` : 'hover:bg-gray-50'}`}>
                      <td className="p-0">
                        <div className={`w-1 min-h-[52px] ${STATUS_BAR[r.status]}`} />
                      </td>
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
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${STATUS_BADGE[r.status]}`}>{r.status}</span>
                        {r.items_count > 0 && <p className="text-[10px] text-gray-400 mt-0.5">{r.items_count}종</p>}
                      </td>
                      <td className="hidden md:table-cell px-3 py-3 text-right">
                        {r.total_amount > 0
                          ? <span className="text-xs font-semibold text-gray-700">{fmt(r.total_amount)}원</span>
                          : <span className="text-gray-300 text-xs">—</span>}
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
                <button onClick={() => setSelected(null)} className="md:hidden flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 mb-2">← 목록으로</button>
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-base font-bold text-gray-900">{selected.customer_name}</h2>
                    {selected.contact_name && <p className="text-xs text-gray-500 mt-0.5">{selected.contact_name} {selected.phone && `· ${selected.phone}`}</p>}
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[selected.status]}`}>{selected.status}</span>
                      <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full">{selected.customer_type}</span>
                      {(() => {
                        const d = getDisplayDDay(selected)
                        return d ? <span className={`text-xs px-2 py-0.5 rounded-full ${d.cls}`}>{d.label}</span> : null
                      })()}
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

                {/* 핵심 정보 그리드 */}
                <div>
                  <p className="text-xs font-semibold text-gray-400 mb-2.5">기본 정보</p>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                    {([
                      ['배송일', selected.rental_start],
                      ['수거일', selected.rental_end],
                      ['결제 시기', selected.payment_due],
                      ['배송 방법', selected.delivery_method],
                      ['총 금액', selected.total_amount ? fmt(selected.total_amount) + '원' : null],
                      ['보증금', selected.deposit ? fmt(selected.deposit) + '원' : null],
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

                {/* 품목 */}
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
                              <td className="text-right px-3 py-2 text-gray-700 font-semibold">{fmt(item.total_price)}</td>
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

                {/* 체크리스트 (배송·수거 예정 건에서 활용) */}
                {['확정','계약서서명','진행중','반납'].includes(selected.status) && (
                  <div>
                    <p className="text-xs font-semibold text-gray-400 mb-2.5">
                      {['확정','계약서서명'].includes(selected.status) ? '📦 배송 체크리스트' : '🔁 수거 체크리스트'}
                    </p>
                    <div className="space-y-2">
                      {(['확정','계약서서명'].includes(selected.status) ? [
                        '계약서 서명 확인', '착수금 입금 확인', '품목 수량 점검', '송장 번호 입력', '배송 완료 고객 안내',
                      ] : [
                        '수거 일정 고객 확인', '송장/퀵 접수', '반납 품목 수량 점검', '보증금 환불 처리', '계약 종료 처리',
                      ]).map(item => (
                        <label key={item} className="flex items-center gap-2 cursor-pointer group">
                          <input type="checkbox" className="w-3.5 h-3.5 rounded accent-yellow-400" />
                          <span className="text-xs text-gray-600 group-hover:text-gray-900">{item}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {/* 메모 */}
                <div>
                  <p className="text-xs font-semibold text-gray-400 mb-2">상담 메모</p>
                  <textarea
                    defaultValue={selected.notes ?? ''}
                    className="w-full border border-gray-100 rounded-xl px-3 py-2.5 text-xs text-gray-700 resize-none bg-gray-50 focus:outline-none focus:border-gray-300 min-h-[80px]"
                    rows={4}
                    placeholder="상담 내용, 요청사항, 특이사항 등..." />
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
