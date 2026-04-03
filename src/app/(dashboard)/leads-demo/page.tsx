'use client'
import { useState } from 'react'

/* ────────────────────────────────────────────
   타입 & 공통 데이터
──────────────────────────────────────────── */
const STATUS_BAR: Record<string, string> = {
  '신규': 'bg-blue-500', '회신대기': 'bg-yellow-400',
  '견적발송': 'bg-orange-400', '진행중': 'bg-green-500',
  '완료': 'bg-gray-300', '취소': 'bg-red-300',
}
const STATUS_BADGE: Record<string, string> = {
  '신규': 'bg-blue-100 text-blue-700', '회신대기': 'bg-yellow-100 text-yellow-700',
  '견적발송': 'bg-orange-100 text-orange-700', '진행중': 'bg-green-100 text-green-700',
  '완료': 'bg-gray-100 text-gray-500', '취소': 'bg-red-100 text-red-400',
}
const STATUSES = ['신규', '회신대기', '견적발송', '진행중', '완료', '취소'] as const
type Status = typeof STATUSES[number]

interface Contact { text: string; date: string }
interface Lead {
  id: string; lead_id: string; client_org: string; contact_name: string
  service_type: string; assignee: string; status: Status
  inflow_date: string; remind_date: string | null
  phone: string; email: string; channel: string; inflow_source: string
  initial_content: string; contacts: Contact[]; notes: string
  // 고객 DB 연결 (미래 구현)
  customer_id?: string
  past_sales_count?: number
}

const today = new Date()
function daysFrom(dateStr: string) {
  const d = new Date(dateStr); d.setHours(0,0,0,0)
  const t = new Date(today); t.setHours(0,0,0,0)
  return Math.round((d.getTime() - t.getTime()) / 86400000)
}
function getDday(rd: string | null) {
  if (!rd) return null
  const diff = daysFrom(rd)
  if (diff < 0)  return { label: `D+${Math.abs(diff)}`, color: 'bg-red-100 text-red-700 font-bold',      rowBg: 'bg-red-50/70',    diff }
  if (diff === 0) return { label: 'D-day',    color: 'bg-red-500 text-white font-bold',         rowBg: 'bg-red-50/70',    diff }
  if (diff <= 3)  return { label: `D-${diff}`, color: 'bg-orange-100 text-orange-700 font-semibold', rowBg: 'bg-orange-50/70', diff }
  if (diff <= 7)  return { label: `D-${diff}`, color: 'bg-yellow-100 text-yellow-700',          rowBg: 'bg-yellow-50/50', diff }
  return { label: `D-${diff}`, color: 'bg-gray-100 text-gray-400', rowBg: '', diff }
}
const pad = (n: number) => String(n).padStart(2,'0')
const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`
const add = (n: number) => { const d = new Date(today); d.setDate(d.getDate()+n); return fmt(d) }

/* ── D-day 기준 정렬 (null은 맨 아래) ── */
function sortByDday(a: Lead, b: Lead) {
  const da = a.remind_date ? daysFrom(a.remind_date) : 9999
  const db = b.remind_date ? daysFrom(b.remind_date) : 9999
  return da - db
}

const MOCK: Lead[] = [
  { id:'1', lead_id:'LEAD20260331-0001', client_org:'서울예술고등학교', contact_name:'김민지 교사',
    service_type:'교육프로그램', assignee:'조민현', status:'진행중',
    inflow_date:add(-8), remind_date:add(-1),
    phone:'010-1234-5678', email:'kim@seoulas.hs.kr', channel:'이메일', inflow_source:'네이버',
    initial_content:'2학기 음악 교육프로그램 문의. 1학년 전체 대상 4회 진행 희망.',
    contacts:[
      { text:'담당자와 통화, 희망 일정 확인. 6월 중순~7월 초 원하심.', date:add(-6) },
      { text:'견적서 초안 발송 완료. 검토 후 회신 요청드림.', date:add(-3) },
    ], notes:'예산 300만원 내외. 담당 장학사 승인 필요.',
    customer_id:'cust-1', past_sales_count: 2 },
  { id:'2', lead_id:'LEAD20260401-0002', client_org:'광진구청소년수련관', contact_name:'박준호 팀장',
    service_type:'행사운영', assignee:'이수진', status:'신규',
    inflow_date:add(-2), remind_date:add(0),
    phone:'010-9876-5432', email:'', channel:'전화', inflow_source:'지인',
    initial_content:'여름방학 청소년 문화 행사 운영 대행 요청. 200명 규모.',
    contacts:[], notes:'', past_sales_count: 0 },
  { id:'3', lead_id:'LEAD20260402-0003', client_org:'경기필하모닉오케스트라', contact_name:'최은영 팀장',
    service_type:'납품설치', assignee:'조민현', status:'견적발송',
    inflow_date:add(-5), remind_date:add(2),
    phone:'031-555-0000', email:'choi@gpo.or.kr', channel:'이메일', inflow_source:'기존고객',
    initial_content:'연습실 음향 장비 교체. 스피커+앰프+믹서.',
    contacts:[{ text:'현장 방문 미팅. 3개 연습실. 납기 8월 초 요청.', date:add(-3) }],
    notes:'기존 거래처. 할인율 논의 필요.',
    customer_id:'cust-3', past_sales_count: 5 },
  { id:'4', lead_id:'LEAD20260402-0004', client_org:'수원시립미술관', contact_name:'정다은 주임',
    service_type:'교구대여', assignee:'이수진', status:'회신대기',
    inflow_date:add(-3), remind_date:add(4),
    phone:'010-2222-3333', email:'jung@swmuseum.or.kr', channel:'카카오', inflow_source:'인스타',
    initial_content:'기획전시 기간(5월 3주) 음향장비 대여 문의.',
    contacts:[{ text:'카카오채널 상세 스펙 문의. 견적서 요청받음.', date:add(-2) }],
    notes:'전시 일정 확정 후 재연락 예정.', past_sales_count: 1 },
  { id:'5', lead_id:'LEAD20260403-0005', client_org:'한국콘텐츠진흥원', contact_name:'강민수 과장',
    service_type:'콘텐츠제작', assignee:'방준영', status:'신규',
    inflow_date:fmt(today), remind_date:add(10),
    phone:'02-3153-0000', email:'kang@kocca.kr', channel:'채널톡', inflow_source:'네이버',
    initial_content:'기관 홍보 영상 제작 의뢰. 메인 1편+숏폼 3편.',
    contacts:[], notes:'', past_sales_count: 0 },
  { id:'6', lead_id:'LEAD20260325-0006', client_org:'인천예술고등학교', contact_name:'윤서영 교사',
    service_type:'교육프로그램', assignee:'조민현', status:'완료',
    inflow_date:add(-15), remind_date:null,
    phone:'010-7777-8888', email:'', channel:'전화', inflow_source:'지인',
    initial_content:'입학식 공연 기획 및 운영 의뢰.',
    contacts:[
      { text:'계약서 작성 완료. 3월 초 행사 진행 확정.', date:add(-12) },
      { text:'행사 완료. 결과 보고서 발송.', date:add(-5) },
    ], notes:'성공적으로 마무리. 하반기 재계약 가능성 있음.',
    customer_id:'cust-6', past_sales_count: 3 },
]

/* ────────────────────────────────────────────
   공유 컴포넌트
──────────────────────────────────────────── */
function SummaryCards({ leads }: { leads: Lead[] }) {
  const remindOverdue = leads.filter(l =>
    l.remind_date && !['완료','취소'].includes(l.status) && daysFrom(l.remind_date) <= 0
  ).length
  const items = [
    { label:'전체 리드', value: leads.length,                          color:'text-gray-800',  bg:'bg-white' },
    { label:'신규 문의', value: leads.filter(l=>l.status==='신규').length, color:'text-blue-600',  bg:'bg-blue-50' },
    { label:'진행중',   value: leads.filter(l=>l.status==='진행중').length,color:'text-green-600', bg:'bg-green-50' },
    { label:'리마인드 초과', value: remindOverdue,                     color:'text-red-600',   bg:'bg-red-50' },
  ]
  return (
    <div className="grid grid-cols-4 gap-3 mb-5">
      {items.map(s => (
        <div key={s.label} className={`${s.bg} border border-gray-200 rounded-xl px-4 py-3`}>
          <p className="text-xs text-gray-400 mb-1">{s.label}</p>
          <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
        </div>
      ))}
    </div>
  )
}

function FilterBar({ filter, setFilter, search, setSearch, leads }: {
  filter: string; setFilter: (s:string)=>void
  search: string; setSearch: (s:string)=>void
  leads: Lead[]
}) {
  return (
    <div className="flex flex-col sm:flex-row gap-3 mb-4">
      <div className="flex flex-wrap gap-1.5">
        {['전체', ...STATUSES].map(s => (
          <button key={s} onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              filter === s ? 'text-gray-900' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
            style={filter === s ? { backgroundColor:'#FFCE00' } : {}}>
            {s}{s !== '전체' && <span className="ml-1 opacity-60">({leads.filter(l=>l.status===s).length})</span>}
          </button>
        ))}
      </div>
      <div className="flex gap-2 ml-auto">
        <input type="text" placeholder="기관명, 담당자 검색..."
          value={search} onChange={e => setSearch(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm w-52 focus:outline-none focus:ring-2 focus:ring-yellow-300" />
        <button className="px-4 py-1.5 text-sm font-semibold rounded-lg whitespace-nowrap"
          style={{ backgroundColor:'#FFCE00', color:'#121212' }}>+ 새 리드</button>
      </div>
    </div>
  )
}

function PastSalesBadge({ count }: { count?: number }) {
  if (!count) return null
  return (
    <span className="ml-1.5 text-xs px-1.5 py-0.5 bg-purple-100 text-purple-600 rounded-full font-medium" title="이전 매출건 수">
      거래 {count}건
    </span>
  )
}

function DetailContent({ lead, inline = false }: { lead: Lead; inline?: boolean }) {
  const [editing, setEditing] = useState(false)
  const grid = 'grid grid-cols-2 gap-y-3 gap-x-4 text-sm'
  return (
    <div className={`space-y-5 ${inline ? '' : 'px-6 py-5'}`}>
      {/* 배지 줄 */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_BADGE[lead.status]}`}>{lead.status}</span>
        <span className="text-xs px-2.5 py-1 bg-gray-100 text-gray-600 rounded-full">{lead.service_type}</span>
        {lead.remind_date && (() => { const d=getDday(lead.remind_date); return d ? <span className={`text-xs px-2.5 py-1 rounded-full ${d.color}`}>{d.label} ({lead.remind_date})</span> : null })()}
        {lead.customer_id && (
          <span className="text-xs px-2.5 py-1 bg-purple-100 text-purple-700 rounded-full">고객 DB 연결됨</span>
        )}
      </div>

      {/* 이전 거래 이력 (고객 DB) */}
      {(lead.past_sales_count ?? 0) > 0 && (
        <div className="bg-purple-50 border border-purple-100 rounded-lg px-3 py-2.5 flex items-center gap-3">
          <span className="text-lg">🗂</span>
          <div>
            <p className="text-xs font-semibold text-purple-700">이전 매출 {lead.past_sales_count}건 있음</p>
            <p className="text-xs text-purple-500">고객 DB에서 계약 이력 확인 가능</p>
          </div>
          <button className="ml-auto text-xs text-purple-600 underline">보기 →</button>
        </div>
      )}

      {/* 기본 정보 */}
      <div className={grid}>
        {[
          ['담당자', lead.contact_name], ['담당 직원', lead.assignee],
          ['휴대폰', lead.phone], ['이메일', lead.email || '-'],
          ['소통 경로', lead.channel], ['유입 경로', lead.inflow_source],
          ['유입일', lead.inflow_date], ['리마인드', lead.remind_date || '-'],
        ].map(([k,v]) => (
          <div key={k}>
            <span className="text-gray-400 text-xs">{k}</span>
            <p className="text-gray-800 font-medium text-sm">{v}</p>
          </div>
        ))}
      </div>

      {/* 최초 유입 내용 */}
      {lead.initial_content && (
        <div>
          <p className="text-xs text-gray-400 mb-1.5">최초 유입 내용</p>
          <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3 whitespace-pre-wrap">{lead.initial_content}</p>
        </div>
      )}

      {/* 소통 타임라인 */}
      <div>
        <p className="text-xs text-gray-400 mb-3">소통 내역</p>
        {lead.contacts.length === 0
          ? <p className="text-xs text-gray-300 italic">아직 소통 내역이 없어요.</p>
          : (
            <div className="relative pl-5">
              <div className="absolute left-1.5 top-2 bottom-2 w-px bg-gray-200" />
              <div className="space-y-4">
                {lead.contacts.map((c,i) => (
                  <div key={i} className="relative flex gap-3">
                    <div className="absolute -left-[13px] top-1.5 w-3 h-3 rounded-full border-2 border-white shadow-sm" style={{ backgroundColor:'#FFCE00' }} />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-semibold text-gray-500">{i+1}차</span>
                        <span className="text-xs text-gray-300">{c.date}</span>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-2.5 text-sm text-gray-700 whitespace-pre-wrap">{c.text}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
      </div>

      {/* 메모 */}
      <div>
        <p className="text-xs text-gray-400 mb-1.5">메모</p>
        <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3 whitespace-pre-wrap min-h-[2.5rem]">
          {lead.notes || <span className="text-gray-300 italic">없음</span>}
        </p>
      </div>

      {/* 액션 버튼 */}
      <div className="flex gap-2 pt-1">
        <button className="flex-1 px-3 py-2 text-sm font-medium border border-gray-200 rounded-lg hover:bg-gray-50">수정</button>
        {lead.status !== '완료' && (
          <button className="flex-1 px-3 py-2 text-sm font-semibold rounded-lg"
            style={{ backgroundColor:'#FFCE00', color:'#121212' }}>매출건으로 전환</button>
        )}
        <button className="px-3 py-2 text-sm text-red-400 border border-red-100 rounded-lg hover:bg-red-50">삭제</button>
      </div>
    </div>
  )
}

function LeadTable({ leads, onSelect, selectedId, compact = false }: {
  leads: Lead[]; onSelect: (l:Lead)=>void; selectedId?: string; compact?: boolean
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="w-1 p-0" />
              <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500 w-24 whitespace-nowrap">D-day</th>
              <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500">기관명</th>
              {!compact && <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500">담당자</th>}
              <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500">서비스</th>
              {!compact && <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500">담당</th>}
              <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500">상태</th>
              {!compact && <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500">유입일</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {leads.map(lead => {
              const dday = getDday(lead.remind_date)
              const isSelected = selectedId === lead.id
              return (
                <tr key={lead.id}
                  className={`cursor-pointer transition-colors ${
                    isSelected ? 'bg-yellow-50 ring-1 ring-inset ring-yellow-300' :
                    dday?.rowBg ? `${dday.rowBg} hover:brightness-95` : 'hover:bg-gray-50'
                  }`}
                  onClick={() => onSelect(lead)}>
                  <td className="p-0">
                    <div className={`w-1 min-h-[52px] ${STATUS_BAR[lead.status]}`} />
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap">
                    {dday
                      ? <span className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${dday.color}`}>{dday.label}</span>
                      : <span className="text-gray-300 text-xs">-</span>}
                  </td>
                  <td className="px-3 py-3">
                    <div className="font-medium text-gray-900 flex items-center">
                      {lead.client_org}
                      {(lead.past_sales_count ?? 0) > 0 && <PastSalesBadge count={lead.past_sales_count} />}
                    </div>
                    <div className="text-xs text-gray-400">{lead.lead_id}</div>
                  </td>
                  {!compact && <td className="px-3 py-3 text-gray-600 text-sm">{lead.contact_name}</td>}
                  <td className="px-3 py-3">
                    <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full whitespace-nowrap">{lead.service_type}</span>
                  </td>
                  {!compact && <td className="px-3 py-3 text-gray-600 text-sm">{lead.assignee}</td>}
                  <td className="px-3 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${STATUS_BADGE[lead.status]}`}>
                      {lead.status}
                    </span>
                  </td>
                  {!compact && <td className="px-3 py-3 text-gray-400 text-xs whitespace-nowrap">{lead.inflow_date}</td>}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ────────────────────────────────────────────
   Variant A — 스플릿 뷰 (이메일 클라이언트 스타일)
──────────────────────────────────────────── */
function VariantA({ leads }: { leads: Lead[] }) {
  const [filter, setFilter] = useState('전체')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Lead | null>(leads[0])
  const filtered = leads.filter(l =>
    (filter === '전체' || l.status === filter) &&
    (!search || [l.client_org, l.contact_name].some(v => v?.toLowerCase().includes(search.toLowerCase())))
  ).sort(sortByDday)
  return (
    <div>
      <SummaryCards leads={leads} />
      <FilterBar filter={filter} setFilter={setFilter} search={search} setSearch={setSearch} leads={leads} />
      <div className="flex gap-4 h-[calc(100vh-320px)] min-h-[480px]">
        {/* 왼쪽 목록 */}
        <div className="w-[55%] overflow-y-auto rounded-xl border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-gray-50 z-10">
              <tr className="border-b border-gray-100">
                <th className="w-1 p-0" />
                <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500 w-24 whitespace-nowrap">D-day</th>
                <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500">기관명</th>
                <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500">서비스</th>
                <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500">상태</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(lead => {
                const dday = getDday(lead.remind_date)
                const isSelected = selected?.id === lead.id
                return (
                  <tr key={lead.id}
                    className={`cursor-pointer transition-colors ${
                      isSelected ? 'bg-yellow-50 ring-1 ring-inset ring-yellow-200' :
                      dday?.rowBg ? `${dday.rowBg} hover:brightness-95` : 'hover:bg-gray-50'
                    }`}
                    onClick={() => setSelected(lead)}>
                    <td className="p-0"><div className={`w-1 min-h-[52px] ${STATUS_BAR[lead.status]}`} /></td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      {dday ? <span className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${dday.color}`}>{dday.label}</span>
                             : <span className="text-gray-300 text-xs">-</span>}
                    </td>
                    <td className="px-3 py-3">
                      <div className="font-medium text-gray-900 text-sm flex items-center gap-1">
                        {lead.client_org}
                        {(lead.past_sales_count??0)>0 && <PastSalesBadge count={lead.past_sales_count} />}
                      </div>
                      <div className="text-xs text-gray-400">{lead.contact_name}</div>
                    </td>
                    <td className="px-3 py-3">
                      <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full whitespace-nowrap">{lead.service_type}</span>
                    </td>
                    <td className="px-3 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${STATUS_BADGE[lead.status]}`}>{lead.status}</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {/* 오른쪽 상세 */}
        <div className="flex-1 overflow-y-auto rounded-xl border border-gray-200 bg-white">
          {selected ? (
            <>
              <div className="px-5 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
                <p className="text-xs text-gray-400">{selected.lead_id}</p>
                <h2 className="text-lg font-bold text-gray-900">{selected.client_org}</h2>
              </div>
              <DetailContent lead={selected} />
            </>
          ) : (
            <div className="flex items-center justify-center h-full text-sm text-gray-400">
              왼쪽에서 리드를 선택하세요
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ────────────────────────────────────────────
   Variant B — 센터 모달
──────────────────────────────────────────── */
function VariantB({ leads }: { leads: Lead[] }) {
  const [filter, setFilter] = useState('전체')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Lead | null>(null)
  const filtered = leads.filter(l =>
    (filter === '전체' || l.status === filter) &&
    (!search || [l.client_org, l.contact_name].some(v => v?.toLowerCase().includes(search.toLowerCase())))
  ).sort(sortByDday)
  return (
    <div>
      <SummaryCards leads={leads} />
      <FilterBar filter={filter} setFilter={setFilter} search={search} setSearch={setSearch} leads={leads} />
      <LeadTable leads={filtered} onSelect={setSelected} selectedId={selected?.id} />
      {selected && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-6" onClick={() => setSelected(null)}>
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[85vh] overflow-y-auto flex flex-col"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between px-6 py-5 border-b border-gray-100 sticky top-0 bg-white z-10">
              <div>
                <p className="text-xs text-gray-400">{selected.lead_id}</p>
                <h2 className="text-lg font-bold text-gray-900">{selected.client_org}</h2>
              </div>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-700 text-2xl leading-none ml-4">×</button>
            </div>
            <DetailContent lead={selected} />
          </div>
        </div>
      )}
    </div>
  )
}

/* ────────────────────────────────────────────
   Variant C — 인라인 아코디언
──────────────────────────────────────────── */
function VariantC({ leads }: { leads: Lead[] }) {
  const [filter, setFilter] = useState('전체')
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const filtered = leads.filter(l =>
    (filter === '전체' || l.status === filter) &&
    (!search || [l.client_org, l.contact_name].some(v => v?.toLowerCase().includes(search.toLowerCase())))
  ).sort(sortByDday)
  return (
    <div>
      <SummaryCards leads={leads} />
      <FilterBar filter={filter} setFilter={setFilter} search={search} setSearch={setSearch} leads={leads} />
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="w-1 p-0" />
                <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500 w-24 whitespace-nowrap">D-day</th>
                <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500">기관명</th>
                <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500">담당자</th>
                <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500">서비스</th>
                <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500">담당</th>
                <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500">상태</th>
                <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500">유입일</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(lead => {
                const dday = getDday(lead.remind_date)
                const isOpen = selectedId === lead.id
                return (
                  <>
                    <tr key={lead.id}
                      className={`cursor-pointer transition-colors border-t border-gray-50 ${
                        isOpen ? 'bg-yellow-50' :
                        dday?.rowBg ? `${dday.rowBg} hover:brightness-95` : 'hover:bg-gray-50'
                      }`}
                      onClick={() => setSelectedId(isOpen ? null : lead.id)}>
                      <td className="p-0"><div className={`w-1 min-h-[52px] ${STATUS_BAR[lead.status]}`} /></td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        {dday ? <span className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${dday.color}`}>{dday.label}</span>
                               : <span className="text-gray-300 text-xs">-</span>}
                      </td>
                      <td className="px-3 py-3">
                        <div className="font-medium text-gray-900 flex items-center gap-1">
                          {lead.client_org}
                          {(lead.past_sales_count??0)>0 && <PastSalesBadge count={lead.past_sales_count} />}
                        </div>
                        <div className="text-xs text-gray-400">{lead.lead_id}</div>
                      </td>
                      <td className="px-3 py-3 text-gray-600">{lead.contact_name}</td>
                      <td className="px-3 py-3"><span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full whitespace-nowrap">{lead.service_type}</span></td>
                      <td className="px-3 py-3 text-gray-600">{lead.assignee}</td>
                      <td className="px-3 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${STATUS_BADGE[lead.status]}`}>{lead.status}</span>
                      </td>
                      <td className="px-3 py-3 text-gray-400 text-xs whitespace-nowrap">
                        <span className="flex items-center gap-1">{lead.inflow_date} <span className="text-gray-300">{isOpen ? '▲' : '▼'}</span></span>
                      </td>
                    </tr>
                    {isOpen && (
                      <tr key={`${lead.id}-detail`}>
                        <td colSpan={8} className="p-0">
                          <div className="border-t border-yellow-200 bg-yellow-50/40 px-6 py-4">
                            <DetailContent lead={lead} inline />
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

/* ────────────────────────────────────────────
   메인 페이지 — 탭으로 비교
──────────────────────────────────────────── */
type Variant = 'A' | 'B' | 'C'

const VARIANTS: { key: Variant; label: string; desc: string; pros: string; cons: string }[] = [
  { key:'A', label:'A. 스플릿 뷰', desc:'이메일 클라이언트처럼 좌목록/우상세',
    pros:'빵빵이 겹침 없음 · 목록+상세 동시에 봄 · 가장 넓은 정보량',
    cons:'화면이 좁으면 답답할 수 있음' },
  { key:'B', label:'B. 센터 모달', desc:'행 클릭 시 중앙 팝업',
    pros:'빵빵이 겹침 없음 · 기존 UX 패턴 익숙 · 구현 단순',
    cons:'목록이 배경으로 사라짐' },
  { key:'C', label:'C. 인라인 아코디언', desc:'행 클릭 시 그 자리서 확장',
    pros:'빵빵이 겹침 없음 · 오버레이 없음 · 맥락 유지',
    cons:'테이블 높이가 늘어나 스크롤 늘어남' },
]

export default function LeadsDemoPage() {
  const [variant, setVariant] = useState<Variant>('A')

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-5 px-4 py-2 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-700 font-medium">
        UI 개선 데모 (목업) — 탭을 눌러 레이아웃 방식을 비교하세요
      </div>

      {/* 고객 DB 안내 배너 */}
      <div className="mb-5 px-4 py-3 bg-purple-50 border border-purple-200 rounded-xl flex items-start gap-3">
        <span className="text-xl mt-0.5">🗂</span>
        <div>
          <p className="text-sm font-semibold text-purple-800">고객 DB 연동 (제안)</p>
          <p className="text-xs text-purple-600 mt-0.5">
            기관명이 기존 거래처와 일치하면 <span className="font-semibold">거래 N건</span> 뱃지가 붙고, 상세 패널에서 이전 매출 이력을 바로 확인할 수 있어요.
            리드 등록 시 기관명 자동완성으로 오타·중복 방지.
          </p>
        </div>
      </div>

      {/* 변형 선택 탭 */}
      <div className="flex gap-3 mb-6 flex-wrap">
        {VARIANTS.map(v => (
          <button key={v.key} onClick={() => setVariant(v.key)}
            className={`flex-1 min-w-[200px] text-left px-4 py-3 rounded-xl border-2 transition-all ${
              variant === v.key ? 'border-yellow-400 bg-yellow-50' : 'border-gray-200 bg-white hover:border-gray-300'
            }`}>
            <p className={`text-sm font-bold mb-0.5 ${variant===v.key ? 'text-gray-900' : 'text-gray-600'}`}>{v.label}</p>
            <p className="text-xs text-gray-500 mb-2">{v.desc}</p>
            <p className="text-xs text-green-600">✓ {v.pros}</p>
            <p className="text-xs text-red-400 mt-0.5">✗ {v.cons}</p>
          </button>
        ))}
      </div>

      {/* 선택된 변형 렌더 */}
      {variant === 'A' && <VariantA leads={MOCK} />}
      {variant === 'B' && <VariantB leads={MOCK} />}
      {variant === 'C' && <VariantC leads={MOCK} />}
    </div>
  )
}
