'use client'
import { useState } from 'react'

/* ─────────────────────────────────────────────
   타입 & 목업 데이터
───────────────────────────────────────────── */
interface SaleRow { id: string; title: string; amount: number; date: string; service_type: string }
interface LeadRow { id: string; lead_id: string; service_type: string; status: string; inflow_date: string; assignee: string }
interface Customer {
  id: string; name: string
  type: '학교' | '공공기관' | '기업' | '개인'
  contact_name: string; phone: string; email: string; region: string; notes: string
  total_sales: number; sales_count: number; lead_count: number
  last_deal_date: string | null
  leads: LeadRow[]; sales: SaleRow[]
}

const DB: Customer[] = [
  { id:'c1', name:'경기필하모닉오케스트라', type:'공공기관',
    contact_name:'최은영 팀장', phone:'031-555-0000', email:'choi@gpo.or.kr', region:'경기',
    notes:'기존 거래처. 연간 정기 납품 가능성. 할인율 10% 적용.',
    total_sales:23000000, sales_count:5, lead_count:2, last_deal_date:'2026-03-15',
    leads:[{ id:'l1', lead_id:'LEAD20260402-0003', service_type:'납품설치', status:'견적발송', inflow_date:'2026-04-02', assignee:'조민현' }],
    sales:[
      { id:'s1', title:'연습실 음향 세팅', amount:4800000, date:'2025-11-20', service_type:'납품설치' },
      { id:'s2', title:'공연장 조명 렌탈', amount:3200000, date:'2025-08-10', service_type:'교구대여' },
      { id:'s3', title:'마이크+스피커 납품', amount:6500000, date:'2025-03-05', service_type:'납품설치' },
      { id:'s4', title:'스테이지 모니터 설치', amount:5200000, date:'2024-11-12', service_type:'납품설치' },
      { id:'s5', title:'행사 음향 운영', amount:3300000, date:'2024-06-20', service_type:'행사운영' },
    ]},
  { id:'c2', name:'서울예술고등학교', type:'학교',
    contact_name:'김민지 교사', phone:'010-1234-5678', email:'kim@seoulas.hs.kr', region:'서울',
    notes:'매 학기 교육프로그램 문의. 예산 300만원 내외.',
    total_sales:8500000, sales_count:2, lead_count:3, last_deal_date:'2025-09-10',
    leads:[{ id:'l2', lead_id:'LEAD20260331-0001', service_type:'교육프로그램', status:'진행중', inflow_date:'2026-03-31', assignee:'조민현' }],
    sales:[
      { id:'s6', title:'2025 2학기 음악교육', amount:4500000, date:'2025-09-10', service_type:'교육프로그램' },
      { id:'s7', title:'2024 입학식 공연', amount:4000000, date:'2024-03-02', service_type:'행사운영' },
    ]},
  { id:'c3', name:'인천예술고등학교', type:'학교',
    contact_name:'윤서영 교사', phone:'010-7777-8888', email:'', region:'인천',
    notes:'지인 소개. 하반기 재계약 가능성 있음.',
    total_sales:3200000, sales_count:3, lead_count:0, last_deal_date:'2026-04-01',
    leads:[],
    sales:[{ id:'s8', title:'입학식 공연 기획·운영', amount:3200000, date:'2026-04-01', service_type:'행사운영' }]},
  { id:'c4', name:'수원시립미술관', type:'공공기관',
    contact_name:'정다은 주임', phone:'010-2222-3333', email:'jung@swmuseum.or.kr', region:'경기',
    notes:'전시 기간 한정 대여 위주. 납기 엄수 중요.',
    total_sales:1200000, sales_count:1, lead_count:1, last_deal_date:'2026-01-15',
    leads:[{ id:'l3', lead_id:'LEAD20260402-0004', service_type:'교구대여', status:'회신대기', inflow_date:'2026-04-02', assignee:'이수진' }],
    sales:[{ id:'s9', title:'겨울특별전 음향 대여', amount:1200000, date:'2026-01-15', service_type:'교구대여' }]},
  { id:'c5', name:'광진구청소년수련관', type:'공공기관',
    contact_name:'박준호 팀장', phone:'010-9876-5432', email:'', region:'서울',
    notes:'신규 고객. 지인 소개로 유입.',
    total_sales:0, sales_count:0, lead_count:1, last_deal_date:null,
    leads:[{ id:'l5', lead_id:'LEAD20260401-0002', service_type:'행사운영', status:'신규', inflow_date:'2026-04-01', assignee:'이수진' }],
    sales:[]},
  { id:'c6', name:'한국콘텐츠진흥원', type:'기업',
    contact_name:'강민수 과장', phone:'02-3153-0000', email:'kang@kocca.kr', region:'서울',
    notes:'네이버 채널톡 유입. 예산 미확인.',
    total_sales:0, sales_count:0, lead_count:1, last_deal_date:null,
    leads:[{ id:'l6', lead_id:'LEAD20260403-0005', service_type:'콘텐츠제작', status:'신규', inflow_date:'2026-04-03', assignee:'방준영' }],
    sales:[]},
]

/* ─── 티어 정의 ─── */
type Tier = 'vip' | 'regular' | 'new'
const TIERS: { key: Tier; label: string; emoji: string; desc: string; headerBg: string; headerText: string; accentBg: string }[] = [
  { key:'vip',     label:'VIP',   emoji:'⭐', desc:'1,000만원 이상',   headerBg:'bg-yellow-50',  headerText:'text-yellow-700', accentBg:'bg-yellow-100' },
  { key:'regular', label:'일반',  emoji:'✅', desc:'거래 이력 있음',   headerBg:'bg-green-50',   headerText:'text-green-700',  accentBg:'bg-green-100'  },
  { key:'new',     label:'신규',  emoji:'🌱', desc:'아직 거래 없음',   headerBg:'bg-blue-50',    headerText:'text-blue-700',   accentBg:'bg-blue-100'   },
]
function getTier(c: Customer): Tier {
  if (c.total_sales >= 10000000) return 'vip'
  if (c.total_sales > 0) return 'regular'
  return 'new'
}

/* ─── 공통 스타일 ─── */
const TYPE_COLOR: Record<string, { bg: string; text: string }> = {
  '학교':    { bg:'bg-blue-100',   text:'text-blue-700'   },
  '공공기관': { bg:'bg-green-100',  text:'text-green-700'  },
  '기업':    { bg:'bg-purple-100', text:'text-purple-700' },
  '개인':    { bg:'bg-gray-100',   text:'text-gray-600'   },
}
const STATUS_BADGE: Record<string, string> = {
  '신규':'bg-blue-100 text-blue-700','회신대기':'bg-yellow-100 text-yellow-700',
  '견적발송':'bg-orange-100 text-orange-700','진행중':'bg-green-100 text-green-700',
  '완료':'bg-gray-100 text-gray-500','취소':'bg-red-100 text-red-400',
}

function fmt(n: number) {
  if (n >= 100000000) return `${(n/100000000).toFixed(1)}억`
  if (n >= 10000) return `${Math.round(n/10000)}만`
  return n.toLocaleString()
}

/* ─────────────────────────────────────────────
   상세 패널
───────────────────────────────────────────── */
function DetailPanel({ c, onClose }: { c: Customer; onClose: ()=>void }) {
  const col = TYPE_COLOR[c.type]
  const activeLeads = c.leads.filter(l=>!['완료','취소'].includes(l.status))
  const tier = getTier(c)
  const tierInfo = TIERS.find(t=>t.key===tier)!

  return (
    <>
      {/* 헤더 */}
      <div className="px-5 py-4 border-b border-gray-100 shrink-0">
        <div className="flex items-start gap-3">
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-white font-bold text-lg shrink-0 ${
            tier==='vip'?'bg-yellow-400':tier==='regular'?'bg-green-500':'bg-blue-400'
          }`}>
            {c.name[0]}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h2 className="text-base font-bold text-gray-900">{c.name}</h2>
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${col.bg} ${col.text}`}>{c.type}</span>
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${tierInfo.accentBg} ${tierInfo.headerText}`}>
                {tierInfo.emoji} {tierInfo.label}
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-0.5">{c.contact_name} · {c.phone}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none shrink-0">×</button>
        </div>
        {/* 매출 요약 */}
        {c.sales_count > 0 && (
          <div className="mt-3 flex items-center gap-4 px-3 py-2 bg-gray-50 rounded-lg">
            <div><p className="text-xs text-gray-400">총 매출</p><p className="text-base font-bold text-green-600">{fmt(c.total_sales)}</p></div>
            <div className="w-px h-8 bg-gray-200" />
            <div><p className="text-xs text-gray-400">거래 건수</p><p className="text-base font-bold text-gray-800">{c.sales_count}건</p></div>
            <div className="w-px h-8 bg-gray-200" />
            <div><p className="text-xs text-gray-400">최근 거래</p><p className="text-sm font-medium text-gray-700">{c.last_deal_date||'-'}</p></div>
          </div>
        )}
      </div>

      {/* 콘텐츠 */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
        {/* 기본 정보 */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          {[['전화',c.phone],['이메일',c.email||'-'],['지역',c.region],['최근거래',c.last_deal_date||'-']].map(([k,v])=>(
            <div key={k as string}>
              <span className="text-xs text-gray-400">{k}</span>
              <p className="text-sm font-medium text-gray-800">{v as string}</p>
            </div>
          ))}
        </div>

        {c.notes && (
          <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-600 whitespace-pre-wrap">{c.notes}</div>
        )}

        {/* 진행 리드 */}
        {activeLeads.length > 0 && (
          <div>
            <p className="text-xs text-gray-400 mb-2">진행 중인 리드</p>
            {activeLeads.map(l => (
              <div key={l.id} className={`flex items-center justify-between rounded-lg px-3 py-2.5 mb-1.5 ${tierInfo.accentBg}`}>
                <div>
                  <p className="text-xs font-mono text-gray-400">{l.lead_id}</p>
                  <p className="text-sm font-medium text-gray-800">{l.service_type} · {l.assignee}</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[l.status]||''}`}>{l.status}</span>
              </div>
            ))}
          </div>
        )}

        {/* 매출 이력 */}
        {c.sales.length > 0 && (
          <div>
            <p className="text-xs text-gray-400 mb-2">매출 이력</p>
            {c.sales.map(s => (
              <div key={s.id} className="flex items-center justify-between border border-gray-100 rounded-lg px-3 py-2 mb-1.5 hover:bg-gray-50">
                <div>
                  <p className="text-sm font-medium text-gray-800">{s.title}</p>
                  <p className="text-xs text-gray-400">{s.service_type} · {s.date}</p>
                </div>
                <p className="text-sm font-bold text-gray-700 shrink-0">{fmt(s.amount)}</p>
              </div>
            ))}
            <div className="flex justify-between px-3 py-2 bg-green-50 rounded-lg mt-1">
              <span className="text-xs font-semibold text-green-700">총 매출</span>
              <span className="text-sm font-bold text-green-700">{c.total_sales.toLocaleString()}원</span>
            </div>
          </div>
        )}

        {c.sales.length===0 && activeLeads.length===0 && (
          <p className="text-center text-sm text-gray-400 py-6">아직 거래 이력이 없어요.</p>
        )}
      </div>

      {/* 하단 버튼 */}
      <div className="px-5 py-3 border-t border-gray-100 flex gap-2 shrink-0">
        <button className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">정보 수정</button>
        <button className="flex-1 px-3 py-2 text-sm font-semibold rounded-lg"
          style={{backgroundColor:'#FFCE00',color:'#121212'}}>이 고객으로 리드 등록</button>
      </div>
    </>
  )
}

/* ─────────────────────────────────────────────
   메인 페이지
───────────────────────────────────────────── */
export default function CustomersDemoPage() {
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<'sales'|'recent'|'name'>('sales')
  const [selected, setSelected] = useState<Customer | null>(DB[0])
  const [collapsedTiers, setCollapsedTiers] = useState<Set<Tier>>(new Set())

  function toggleTier(tier: Tier) {
    setCollapsedTiers(prev => {
      const next = new Set(prev)
      next.has(tier) ? next.delete(tier) : next.add(tier)
      return next
    })
  }

  // 검색 필터 후 티어별 분류
  const matchedCustomers = DB.filter(c =>
    !search || c.name.includes(search) || c.contact_name.includes(search) || c.region.includes(search)
  )

  function getSorted(list: Customer[]) {
    return [...list].sort((a,b)=>{
      if (sort==='sales') return b.total_sales - a.total_sales
      if (sort==='name')  return a.name.localeCompare(b.name)
      const da = a.last_deal_date||'0000'; const db = b.last_deal_date||'0000'
      return db.localeCompare(da)
    })
  }

  const tierGroups = TIERS.map(t => ({
    ...t,
    customers: getSorted(matchedCustomers.filter(c => getTier(c) === t.key)),
  })).filter(g => g.customers.length > 0)

  // 전체 요약
  const totalRevenue  = DB.reduce((s,c)=>s+c.total_sales,0)
  const vipCount      = DB.filter(c=>getTier(c)==='vip').length
  const activeLeadCount = DB.reduce((s,c)=>s+c.leads.filter(l=>!['완료','취소'].includes(l.status)).length,0)

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-xl font-bold text-gray-900">고객 DB</h1>
          <p className="text-sm text-gray-500 mt-0.5">데모 (목업)</p>
        </div>
        <button className="px-4 py-2 text-sm font-semibold rounded-lg"
          style={{backgroundColor:'#FFCE00',color:'#121212'}}>+ 신규 고객</button>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-4 gap-3 mb-4 mt-4">
        {[
          { label:'전체 고객', value:`${DB.length}개`, color:'text-gray-800', bg:'bg-white' },
          { label:'누적 매출', value:fmt(totalRevenue), color:'text-green-600', bg:'bg-green-50' },
          { label:'VIP (1000만+)', value:`${vipCount}개`, color:'text-yellow-600', bg:'bg-yellow-50' },
          { label:'진행 중 리드', value:`${activeLeadCount}건`, color:'text-blue-600', bg:'bg-blue-50' },
        ].map(s=>(
          <div key={s.label} className={`${s.bg} border border-gray-200 rounded-xl px-4 py-3`}>
            <p className="text-xs text-gray-400 mb-1">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* 검색 + 정렬 */}
      <div className="flex items-center gap-2 mb-3">
        <input type="text" placeholder="기관명, 담당자, 지역 검색..."
          value={search} onChange={e=>setSearch(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm w-56 focus:outline-none focus:ring-2 focus:ring-yellow-300" />
        <div className="flex items-center gap-1.5 ml-auto">
          <span className="text-xs text-gray-400">정렬:</span>
          {([['sales','매출순'],['recent','최근거래'],['name','이름순']] as const).map(([k,v])=>(
            <button key={k} onClick={()=>setSort(k)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${sort===k?'text-gray-900':'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
              style={sort===k?{backgroundColor:'#FFCE00'}:{}}>
              {v}
            </button>
          ))}
        </div>
      </div>

      {/* 스플릿 뷰 */}
      <div className="flex gap-4" style={{height:'calc(100vh - 360px)', minHeight:'500px'}}>

        {/* 왼쪽: 티어 섹션 + 테이블 */}
        <div className="w-[55%] flex flex-col border border-gray-200 rounded-xl bg-white overflow-hidden">
          <div className="overflow-y-auto flex-1">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-20 bg-gray-50">
                <tr className="border-b border-gray-100">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">기관명</th>
                  <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500 whitespace-nowrap">유형</th>
                  <th className="text-right px-3 py-3 text-xs font-semibold text-gray-500 whitespace-nowrap">총 매출</th>
                  <th className="text-right px-3 py-3 text-xs font-semibold text-gray-500 whitespace-nowrap">건수</th>
                  <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500 whitespace-nowrap">최근 거래</th>
                  <th className="text-center px-3 py-3 text-xs font-semibold text-gray-500 whitespace-nowrap">리드</th>
                </tr>
              </thead>

              {tierGroups.map(tier => {
                const isCollapsed = collapsedTiers.has(tier.key)
                const tierTotal = tier.customers.reduce((s,c)=>s+c.total_sales,0)
                return (
                  <tbody key={tier.key}>
                    {/* 티어 섹션 헤더 */}
                    <tr className={`${tier.headerBg} cursor-pointer select-none`}
                      onClick={()=>toggleTier(tier.key)}>
                      <td colSpan={6} className="px-4 py-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm">{tier.emoji}</span>
                          <span className={`text-xs font-bold ${tier.headerText}`}>{tier.label}</span>
                          <span className={`text-xs ${tier.headerText} opacity-70`}>
                            {tier.customers.length}개
                            {tierTotal > 0 && ` · ${fmt(tierTotal)}`}
                          </span>
                          <span className="ml-auto text-gray-400 text-xs">{isCollapsed ? '▶ 펼치기' : '▼ 접기'}</span>
                        </div>
                      </td>
                    </tr>

                    {/* 고객 행들 */}
                    {!isCollapsed && tier.customers.map(c => {
                      const col = TYPE_COLOR[c.type]
                      const isSelected = selected?.id === c.id
                      const activeLeads = c.leads.filter(l=>!['완료','취소'].includes(l.status)).length
                      return (
                        <tr key={c.id}
                          className={`border-t border-gray-50 cursor-pointer transition-colors ${
                            isSelected
                              ? 'bg-yellow-50 ring-1 ring-inset ring-yellow-200'
                              : 'hover:bg-gray-50'
                          }`}
                          onClick={()=>setSelected(isSelected ? null : c)}>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              {/* 티어 컬러 점 */}
                              <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                tier.key==='vip'?'bg-yellow-400':tier.key==='regular'?'bg-green-400':'bg-blue-300'
                              }`} />
                              <div>
                                <p className="font-medium text-gray-900 text-sm">{c.name}</p>
                                <p className="text-xs text-gray-400">{c.contact_name} · {c.region}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-3">
                            <span className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${col.bg} ${col.text}`}>{c.type}</span>
                          </td>
                          <td className="px-3 py-3 text-right">
                            {c.total_sales > 0
                              ? <span className="text-sm font-bold text-gray-800">{fmt(c.total_sales)}</span>
                              : <span className="text-xs text-gray-300">-</span>}
                          </td>
                          <td className="px-3 py-3 text-right text-sm text-gray-500">
                            {c.sales_count > 0 ? c.sales_count : <span className="text-gray-300">-</span>}
                          </td>
                          <td className="px-3 py-3 text-xs text-gray-400 whitespace-nowrap">
                            {c.last_deal_date || <span className="text-gray-300">-</span>}
                          </td>
                          <td className="px-3 py-3 text-center">
                            {activeLeads > 0
                              ? <span className="inline-flex items-center justify-center w-5 h-5 bg-blue-100 text-blue-700 text-xs rounded-full font-bold">{activeLeads}</span>
                              : <span className="text-gray-300 text-xs">-</span>}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                )
              })}
            </table>
          </div>
        </div>

        {/* 오른쪽: 상세 패널 */}
        <div className="flex-1 flex flex-col border border-gray-200 rounded-xl bg-white overflow-hidden">
          {selected
            ? <DetailPanel c={selected} onClose={()=>setSelected(null)} />
            : (
              <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-2">
                <span className="text-3xl">👈</span>
                <p className="text-sm">고객을 선택하세요</p>
              </div>
            )}
        </div>
      </div>
    </div>
  )
}
