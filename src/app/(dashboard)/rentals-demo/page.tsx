'use client'
import { useState } from 'react'

const STATUS_STYLE: Record<string, string> = {
  유입:       'bg-gray-100 text-gray-600',
  상담:       'bg-purple-100 text-purple-700',
  견적발송:   'bg-blue-100 text-blue-700',
  확정:       'bg-yellow-100 text-yellow-700',
  계약서서명: 'bg-orange-100 text-orange-700',
  진행중:     'bg-green-100 text-green-700',
  반납:       'bg-teal-100 text-teal-700',
  완료:       'bg-gray-100 text-gray-500',
  취소:       'bg-red-100 text-red-400',
}
const STATUS_COL_BG: Record<string, string> = {
  유입:       'bg-gray-50 border-gray-200',
  상담:       'bg-purple-50 border-purple-100',
  견적발송:   'bg-blue-50 border-blue-100',
  확정:       'bg-yellow-50 border-yellow-100',
  계약서서명: 'bg-orange-50 border-orange-100',
  진행중:     'bg-green-50 border-green-100',
  반납:       'bg-teal-50 border-teal-100',
  완료:       'bg-gray-50 border-gray-200',
}

interface R {
  id: string; customer_name: string; contact_name: string | null
  phone: string | null; status: string
  rental_start: string | null; rental_end: string | null
  total_amount: number; deposit: number
  assignee_name: string | null; customer_type: string
  items_count: number; inflow_source: string | null
}

const MOCK: R[] = [
  { id:'1', customer_name:'OO초등학교',  contact_name:'김선생',  phone:'010-1234-5678', status:'진행중',     rental_start:'2026-03-01', rental_end:'2026-06-30', total_amount:1200000, deposit:200000, assignee_name:'홍길동', customer_type:'기관', items_count:3, inflow_source:'네이버' },
  { id:'2', customer_name:'XX중학교',    contact_name:'박담당',  phone:'010-9876-5432', status:'견적발송',   rental_start:'2026-05-01', rental_end:null,         total_amount:0,       deposit:0,      assignee_name:'김철수', customer_type:'기관', items_count:0, inflow_source:'인스타' },
  { id:'3', customer_name:'△△고등학교', contact_name:'이선생',  phone:null,            status:'상담',       rental_start:'2026-05-15', rental_end:'2026-08-31', total_amount:850000,  deposit:100000, assignee_name:'이영희', customer_type:'기관', items_count:2, inflow_source:'기존고객' },
  { id:'4', customer_name:'홍길동',      contact_name:null,      phone:'010-1111-2222', status:'확정',       rental_start:'2026-04-10', rental_end:'2026-07-10', total_amount:300000,  deposit:50000,  assignee_name:'홍길동', customer_type:'개인', items_count:1, inflow_source:'지인' },
  { id:'5', customer_name:'□□특수학교', contact_name:'최담당',  phone:'010-3333-4444', status:'계약서서명', rental_start:'2026-04-20', rental_end:'2026-10-20', total_amount:2400000, deposit:400000, assignee_name:'홍길동', customer_type:'기관', items_count:5, inflow_source:'채널톡' },
  { id:'6', customer_name:'○○어린이집', contact_name:'강원장',  phone:'010-5555-6666', status:'유입',       rental_start:null,         rental_end:null,         total_amount:0,       deposit:0,      assignee_name:null,     customer_type:'기관', items_count:0, inflow_source:'유튜브' },
  { id:'7', customer_name:'☆☆문화센터', contact_name:'조팀장',  phone:'010-7777-8888', status:'반납',       rental_start:'2026-01-01', rental_end:'2026-04-04', total_amount:600000,  deposit:100000, assignee_name:'김철수', customer_type:'기관', items_count:2, inflow_source:'기타' },
  { id:'8', customer_name:'이순신',      contact_name:null,      phone:'010-9999-0000', status:'완료',       rental_start:'2025-09-01', rental_end:'2026-02-28', total_amount:450000,  deposit:50000,  assignee_name:'이영희', customer_type:'개인', items_count:1, inflow_source:'네이버' },
  { id:'9', customer_name:'◇◇복지관',   contact_name:'신담당',  phone:'010-2222-3333', status:'진행중',     rental_start:'2026-02-15', rental_end:'2026-05-15', total_amount:980000,  deposit:150000, assignee_name:'김철수', customer_type:'기관', items_count:4, inflow_source:'채널톡' },
]

const fmt = (n: number) => n.toLocaleString()

function dDay(d: string) {
  return Math.ceil((new Date(d).getTime() - new Date().setHours(0,0,0,0)) / 86400000)
}
function DDayBadge({ date }: { date: string }) {
  const d = dDay(date)
  if (d < 0)  return <span className="text-[10px] text-gray-300">지남</span>
  if (d === 0) return <span className="text-[10px] bg-red-500 text-white px-1.5 py-0.5 rounded-full font-bold">D-day</span>
  if (d <= 3)  return <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full">D-{d}</span>
  if (d <= 7)  return <span className="text-[10px] bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded-full">D-{d}</span>
  return <span className="text-[10px] text-gray-400">D-{d}</span>
}

// ─────────────────────────────────────────────
// 안 A: 칸반 보드
// ─────────────────────────────────────────────
const COLS = ['유입','상담','견적발송','확정','계약서서명','진행중','반납','완료'] as const

function KanbanView() {
  return (
    <div className="overflow-x-auto pb-4 -mx-2 px-2">
      <div className="flex gap-3" style={{ minWidth: `${COLS.length * 216}px` }}>
        {COLS.map(status => {
          const items = MOCK.filter(r => r.status === status)
          return (
            <div key={status} className={`w-52 shrink-0 rounded-xl border p-3 flex flex-col gap-2 ${STATUS_COL_BG[status]}`}>
              <div className="flex items-center justify-between">
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLE[status]}`}>{status}</span>
                <span className="text-xs text-gray-400 font-medium">{items.length}</span>
              </div>
              {items.length === 0 && <div className="text-center py-8 text-xs text-gray-300">—</div>}
              {items.map(r => (
                <div key={r.id} className="bg-white rounded-xl p-3 shadow-sm border border-gray-100 hover:shadow-md transition-shadow cursor-pointer">
                  <p className="text-sm font-semibold text-gray-800">{r.customer_name}</p>
                  {r.contact_name && <p className="text-xs text-gray-400 mt-0.5">{r.contact_name}</p>}
                  <div className="mt-2.5 space-y-1.5">
                    {r.rental_start && (
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-gray-400">배송</span>
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-gray-600">{r.rental_start.slice(5)}</span>
                          <DDayBadge date={r.rental_start} />
                        </div>
                      </div>
                    )}
                    {r.rental_end && (
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-gray-400">수거</span>
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-gray-600">{r.rental_end.slice(5)}</span>
                          <DDayBadge date={r.rental_end} />
                        </div>
                      </div>
                    )}
                    {r.total_amount > 0 && (
                      <p className="text-[10px] font-medium text-gray-600 text-right pt-0.5">{fmt(r.total_amount)}원</p>
                    )}
                  </div>
                  {r.assignee_name && (
                    <div className="mt-2.5 flex items-center gap-1.5">
                      <div className="w-4 h-4 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                        <span className="text-[8px] font-medium text-gray-600">{r.assignee_name[0]}</span>
                      </div>
                      <span className="text-[10px] text-gray-400">{r.assignee_name}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// 안 B: 슬라이드오버 (목록 + 우측 상세 패널)
// ─────────────────────────────────────────────
const NEXT: Record<string, string> = {
  유입:'상담', 상담:'견적발송', 견적발송:'확정',
  확정:'계약서서명', 계약서서명:'진행중', 진행중:'반납', 반납:'완료',
}

function SlideoverView() {
  const [selected, setSelected] = useState<R | null>(MOCK[0])
  const [filter, setFilter] = useState('전체')

  const filtered = filter === '전체'
    ? MOCK.filter(r => r.status !== '완료' && r.status !== '취소')
    : MOCK.filter(r => r.status === filter)

  return (
    <div className="flex border border-gray-200 rounded-2xl overflow-hidden bg-white" style={{ minHeight: 560 }}>
      {/* 목록 */}
      <div className={`flex flex-col border-r border-gray-100 shrink-0 ${selected ? 'w-64' : 'flex-1'}`}>
        <div className="p-3 border-b border-gray-50 space-y-2">
          <p className="text-xs font-semibold text-gray-400 px-1">렌탈 목록</p>
          <div className="flex gap-1 flex-wrap">
            {['전체','진행중','확정','견적발송','상담','유입'].map(s => (
              <button key={s} onClick={() => setFilter(s)}
                className={`text-[11px] px-2 py-0.5 rounded-md transition-colors font-medium ${filter === s ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-100'}`}>
                {s}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
          {filtered.map(r => (
            <div key={r.id}
              onClick={() => setSelected(r)}
              className={`px-4 py-3 cursor-pointer transition-colors group ${selected?.id === r.id ? 'bg-yellow-50 border-l-2 border-yellow-400' : 'hover:bg-gray-50 border-l-2 border-transparent'}`}>
              <div className="flex items-center justify-between mb-0.5">
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${STATUS_STYLE[r.status]}`}>{r.status}</span>
                {r.rental_end && <DDayBadge date={r.rental_end} />}
              </div>
              <p className={`text-sm font-semibold ${selected?.id === r.id ? 'text-gray-900' : 'text-gray-700'}`}>{r.customer_name}</p>
              {r.contact_name && <p className="text-xs text-gray-400">{r.contact_name}</p>}
              {r.total_amount > 0 && <p className="text-xs text-gray-500 mt-0.5">{fmt(r.total_amount)}원</p>}
            </div>
          ))}
        </div>
      </div>

      {/* 상세 패널 */}
      {selected ? (
        <div className="flex-1 overflow-y-auto">
          {/* 패널 헤더 */}
          <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-start justify-between z-10">
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <h2 className="text-base font-bold text-gray-900">{selected.customer_name}</h2>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLE[selected.status]}`}>{selected.status}</span>
              </div>
              {selected.contact_name && <p className="text-xs text-gray-500">{selected.contact_name}{selected.phone && ` · ${selected.phone}`}</p>}
            </div>
            <button onClick={() => setSelected(null)} className="text-gray-300 hover:text-gray-500 text-lg leading-none mt-1">×</button>
          </div>

          <div className="px-6 py-4 space-y-5">
            {/* 상태 진행바 */}
            <div className="flex items-center gap-1 flex-wrap p-3 bg-gray-50 rounded-xl">
              {['유입','상담','견적발송','확정','계약서서명','진행중','반납','완료'].map((s, i, arr) => (
                <div key={s} className="flex items-center gap-1">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${selected.status === s ? STATUS_STYLE[s] + ' ring-1 ring-offset-1 ring-gray-300' : 'text-gray-300'}`}>{s}</span>
                  {i < arr.length - 1 && <span className="text-gray-200 text-[10px]">›</span>}
                </div>
              ))}
            </div>

            {/* 기본 정보 */}
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              {([
                ['고객 구분', selected.customer_type],
                ['유입경로', selected.inflow_source],
                ['배송일', selected.rental_start],
                ['수거일', selected.rental_end],
                ['총 금액', selected.total_amount ? fmt(selected.total_amount) + '원' : null],
                ['보증금',  selected.deposit ? fmt(selected.deposit) + '원' : null],
                ['담당 직원', selected.assignee_name],
                ['품목 수', selected.items_count ? `${selected.items_count}종` : null],
              ] as [string, string | null][]).filter(([, v]) => v).map(([label, value]) => (
                <div key={label}>
                  <span className="text-xs text-gray-400">{label}</span>
                  <p className="text-gray-800 mt-0.5">{value}</p>
                </div>
              ))}
            </div>

            {/* 메모 */}
            <div>
              <p className="text-xs font-medium text-gray-400 mb-2">내용 · 상담 메모</p>
              <textarea
                className="w-full border border-gray-100 rounded-xl px-3 py-2.5 text-sm text-gray-600 resize-none bg-gray-50 focus:outline-none focus:border-gray-300 transition-colors"
                rows={5}
                placeholder="상담 내용, 요청사항 등..." />
            </div>

            {/* 액션 */}
            <div className="flex gap-2 pb-2">
              {NEXT[selected.status] && (
                <button className="flex-1 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-semibold hover:bg-gray-800">
                  → {NEXT[selected.status]}으로 변경
                </button>
              )}
              <button className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">수정</button>
              <button className="px-4 py-2.5 border border-red-100 text-red-400 rounded-xl text-sm hover:bg-red-50">취소</button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-gray-300 text-sm">
          왼쪽 목록에서 건을 클릭하세요
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────
// 안 C: 테이블 뷰
// ─────────────────────────────────────────────
const GROUPS = [
  { label: '전체',       statuses: null },
  { label: '진행 전',    statuses: ['유입','상담','견적발송','확정','계약서서명'] },
  { label: '렌탈중',     statuses: ['진행중','반납'] },
  { label: '완료·취소',  statuses: ['완료','취소'] },
]

function TableView() {
  const [group, setGroup] = useState('전체')
  const sel = GROUPS.find(g => g.label === group)!
  const rows = sel.statuses ? MOCK.filter(r => sel.statuses!.includes(r.status)) : MOCK

  return (
    <div>
      <div className="flex gap-2 mb-4 flex-wrap">
        {GROUPS.map(g => {
          const cnt = g.statuses ? MOCK.filter(r => g.statuses!.includes(r.status)).length : MOCK.length
          return (
            <button key={g.label} onClick={() => setGroup(g.label)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${group === g.label ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
              {g.label} <span className="opacity-50 text-xs">{cnt}</span>
            </button>
          )
        })}
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400">상태</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400">고객명</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400">구분</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-gray-400">배송일</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-gray-400">수거일</th>
              <th className="text-center px-3 py-3 text-xs font-semibold text-gray-400">D-Day</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400">담당</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400">금액</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {rows.map(r => (
              <tr key={r.id} className="hover:bg-gray-50 cursor-pointer transition-colors group">
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLE[r.status]}`}>{r.status}</span>
                </td>
                <td className="px-4 py-3">
                  <p className="font-semibold text-gray-800 group-hover:text-gray-900">{r.customer_name}</p>
                  {r.contact_name && <p className="text-xs text-gray-400">{r.contact_name}</p>}
                </td>
                <td className="px-4 py-3 text-xs text-gray-500">{r.customer_type}</td>
                <td className="px-4 py-3 text-center text-xs text-gray-600">{r.rental_start?.slice(5) ?? <span className="text-gray-300">—</span>}</td>
                <td className="px-4 py-3 text-center text-xs text-gray-600">{r.rental_end?.slice(5) ?? <span className="text-gray-300">—</span>}</td>
                <td className="px-3 py-3 text-center">
                  {r.rental_end ? <DDayBadge date={r.rental_end} /> : <span className="text-xs text-gray-200">—</span>}
                </td>
                <td className="px-4 py-3">
                  {r.assignee_name ? (
                    <div className="flex items-center gap-1.5">
                      <div className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                        <span className="text-[9px] font-medium text-gray-600">{r.assignee_name[0]}</span>
                      </div>
                      <span className="text-xs text-gray-600">{r.assignee_name}</span>
                    </div>
                  ) : <span className="text-xs text-gray-300">—</span>}
                </td>
                <td className="px-4 py-3 text-right">
                  {r.total_amount > 0
                    ? <span className="text-sm font-semibold text-gray-700">{fmt(r.total_amount)}원</span>
                    : <span className="text-xs text-gray-300">—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// 메인
// ─────────────────────────────────────────────
const VIEWS = [
  { key: 'A', label: '안 A  칸반', desc: '상태별 컬럼 · 가로 스크롤' },
  { key: 'B', label: '안 B  슬라이드오버', desc: '목록 클릭 → 우측 패널' },
  { key: 'C', label: '안 C  테이블', desc: '밀도 높은 테이블 · 3그룹 탭' },
] as const

export default function RentalsDemoPage() {
  const [view, setView] = useState<'A' | 'B' | 'C'>('A')
  const current = VIEWS.find(v => v.key === view)!

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-start justify-between mb-5">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <h1 className="text-xl font-bold text-gray-900">렌탈 UI 데모</h1>
            <span className="text-xs px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded-full font-medium">목업 데이터</span>
          </div>
          <p className="text-sm text-gray-400">{current.desc}</p>
        </div>
        <div className="flex gap-2 shrink-0">
          {VIEWS.map(v => (
            <button key={v.key} onClick={() => setView(v.key)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap ${view === v.key ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {view === 'A' && <KanbanView />}
      {view === 'B' && <SlideoverView />}
      {view === 'C' && <TableView />}
    </div>
  )
}
