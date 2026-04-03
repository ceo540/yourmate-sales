'use client'
import { useState } from 'react'

/* ═══════════════════════════════════════════════
   데이터 모델
═══════════════════════════════════════════════ */
interface SaleRow { id: string; title: string; amount: number; date: string; service_type: string; org_name: string; dept: string }
interface JobHistory { org_id: string; org_name: string; dept: string; title: string; from: string; to: string | null }
interface OrgContact { person_id: string; dept: string; title: string; from: string; to: string | null; is_current: boolean }
interface Dept { id: string; name: string; total_sales: number; deal_count: number }

interface Org {
  id: string; name: string; type: '학교'|'공공기관'|'기업'|'개인'
  region: string; phone: string; email: string; homepage: string; notes: string
  depts: Dept[]; total_sales: number; sales_count: number; last_deal_date: string | null
  contacts: OrgContact[]; sales: SaleRow[]
}
interface Person {
  id: string; name: string; phone: string; email: string; notes: string
  job_history: JobHistory[]; deal_ids: string[]
}

/* ── 목업 ── */
const ORGS: Org[] = [
  { id:'c1', name:'경기필하모닉오케스트라', type:'공공기관', region:'경기',
    phone:'031-555-0000', email:'info@gpo.or.kr', homepage:'gpo.or.kr', notes:'연간 정기 납품 가능성. 기획팀·운영팀 각각 발주.',
    depts:[{id:'d1a',name:'기획팀',total_sales:15000000,deal_count:3},{id:'d1b',name:'운영팀',total_sales:8000000,deal_count:2}],
    total_sales:23000000, sales_count:5, last_deal_date:'2026-03-15',
    contacts:[
      {person_id:'p1',dept:'기획팀',title:'팀장',from:'2021-03',to:null,is_current:true},
      {person_id:'p4',dept:'운영팀',title:'주임',from:'2020-01',to:'2024-12',is_current:false},
    ],
    sales:[
      {id:'s1',title:'연습실 음향 세팅',amount:4800000,date:'2025-11-20',service_type:'납품설치',org_name:'경기필하모닉',dept:'기획팀'},
      {id:'s2',title:'공연장 조명 렌탈',amount:3200000,date:'2025-08-10',service_type:'교구대여',org_name:'경기필하모닉',dept:'기획팀'},
      {id:'s3',title:'마이크+스피커 납품',amount:6500000,date:'2025-03-05',service_type:'납품설치',org_name:'경기필하모닉',dept:'기획팀'},
      {id:'s3b',title:'스테이지 세팅 보조',amount:2800000,date:'2024-08-10',service_type:'행사운영',org_name:'경기필하모닉',dept:'운영팀'},
      {id:'s4',title:'스테이지 모니터 설치',amount:5200000,date:'2024-11-12',service_type:'납품설치',org_name:'경기필하모닉',dept:'운영팀'},
    ]},
  { id:'c2', name:'서울예술고등학교', type:'학교', region:'서울',
    phone:'02-1234-5678', email:'office@seoulas.hs.kr', homepage:'', notes:'매 학기 교육프로그램 문의. 예산 300만원 내외.',
    depts:[{id:'d2a',name:'교무처',total_sales:8500000,deal_count:3}],
    total_sales:8500000, sales_count:3, last_deal_date:'2025-09-10',
    contacts:[
      {person_id:'p2',dept:'교무처',title:'교사',from:'2022-09',to:null,is_current:true},
      {person_id:'p3',dept:'교무처',title:'교사',from:'2019-03',to:'2023-08',is_current:false},
    ],
    sales:[
      {id:'s6',title:'2025 2학기 음악교육',amount:4500000,date:'2025-09-10',service_type:'교육프로그램',org_name:'서울예술고',dept:'교무처'},
      {id:'s7b',title:'2022 음악캠프 운영',amount:2000000,date:'2022-07-15',service_type:'행사운영',org_name:'서울예술고',dept:'교무처'},
      {id:'s7',title:'2024 입학식 공연',amount:2000000,date:'2024-03-02',service_type:'행사운영',org_name:'서울예술고',dept:'교무처'},
    ]},
  { id:'c3', name:'인천예술고등학교', type:'학교', region:'인천',
    phone:'032-777-8888', email:'inas@hs.kr', homepage:'', notes:'박지훈 부장교사 통해 유입 (서울예술고 이직).',
    depts:[{id:'d3a',name:'교육기획부',total_sales:3200000,deal_count:1}],
    total_sales:3200000, sales_count:1, last_deal_date:'2026-04-01',
    contacts:[{person_id:'p3',dept:'교육기획부',title:'부장교사',from:'2023-09',to:null,is_current:true}],
    sales:[{id:'s8',title:'입학식 공연 기획·운영',amount:3200000,date:'2026-04-01',service_type:'행사운영',org_name:'인천예술고',dept:'교육기획부'}]},
  { id:'c4', name:'수원시립미술관', type:'공공기관', region:'경기',
    phone:'031-222-3333', email:'info@swmuseum.or.kr', homepage:'swmuseum.or.kr', notes:'김미래 주임(경기필하모닉 출신) 통해 유입.',
    depts:[{id:'d4a',name:'전시운영팀',total_sales:1200000,deal_count:1}],
    total_sales:1200000, sales_count:1, last_deal_date:'2026-01-15',
    contacts:[
      {person_id:'p4',dept:'전시운영팀',title:'주임',from:'2025-01',to:null,is_current:true},
      {person_id:'p5',dept:'전시운영팀',title:'주임',from:'2023-03',to:'2024-12',is_current:false},
    ],
    sales:[{id:'s9',title:'겨울특별전 음향 대여',amount:1200000,date:'2026-01-15',service_type:'교구대여',org_name:'수원시립미술관',dept:'전시운영팀'}]},
  { id:'c5', name:'광진구청소년수련관', type:'공공기관', region:'서울',
    phone:'02-9876-5432', email:'', homepage:'', notes:'신규 고객. 지인 소개.',
    depts:[], total_sales:0, sales_count:0, last_deal_date:null,
    contacts:[{person_id:'p6',dept:'문화사업팀',title:'팀장',from:'2018-01',to:null,is_current:true}],
    sales:[]},
  { id:'c6', name:'한국콘텐츠진흥원', type:'기업', region:'서울',
    phone:'02-3153-0000', email:'contact@kocca.kr', homepage:'kocca.kr', notes:'네이버 채널톡 유입.',
    depts:[], total_sales:0, sales_count:0, last_deal_date:null,
    contacts:[{person_id:'p7',dept:'홍보팀',title:'과장',from:'2024-01',to:null,is_current:true}],
    sales:[]},
]

const PEOPLE: Person[] = [
  { id:'p1', name:'최은영', phone:'031-555-0000', email:'choi@gpo.or.kr', notes:'기획팀 내 예산 결정권 있음.',
    job_history:[{org_id:'c1',org_name:'경기필하모닉오케스트라',dept:'기획팀',title:'팀장',from:'2021-03',to:null}], deal_ids:['s1','s2','s3'] },
  { id:'p2', name:'김민지', phone:'010-1234-5678', email:'kim@seoulas.hs.kr', notes:'매 학기 초 연락. 예산 결재 빠름.',
    job_history:[{org_id:'c2',org_name:'서울예술고등학교',dept:'교무처',title:'교사',from:'2022-09',to:null}], deal_ids:['s6'] },
  { id:'p3', name:'박지훈', phone:'010-9111-2222', email:'park@inas.hs.kr', notes:'서울예술고→인천예술고 이직. 두 기관 모두 거래 연결.',
    job_history:[
      {org_id:'c2',org_name:'서울예술고등학교',dept:'교무처',title:'교사',from:'2019-03',to:'2023-08'},
      {org_id:'c3',org_name:'인천예술고등학교',dept:'교육기획부',title:'부장교사',from:'2023-09',to:null},
    ], deal_ids:['s7b','s7','s8'] },
  { id:'p4', name:'김미래', phone:'010-3344-5566', email:'kimmr@swmuseum.or.kr', notes:'경기필→수원미술관 이직. 수원 거래 시작의 연결고리.',
    job_history:[
      {org_id:'c1',org_name:'경기필하모닉오케스트라',dept:'운영팀',title:'주임',from:'2020-01',to:'2024-12'},
      {org_id:'c4',org_name:'수원시립미술관',dept:'전시운영팀',title:'주임',from:'2025-01',to:null},
    ], deal_ids:['s3b','s4','s9'] },
  { id:'p5', name:'정다은', phone:'010-2222-3333', email:'jung@swmuseum.or.kr', notes:'',
    job_history:[{org_id:'c4',org_name:'수원시립미술관',dept:'전시운영팀',title:'주임',from:'2023-03',to:'2024-12'}], deal_ids:[] },
  { id:'p6', name:'박준호', phone:'010-9876-5432', email:'', notes:'',
    job_history:[{org_id:'c5',org_name:'광진구청소년수련관',dept:'문화사업팀',title:'팀장',from:'2018-01',to:null}], deal_ids:[] },
  { id:'p7', name:'강민수', phone:'02-3153-0000', email:'kang@kocca.kr', notes:'',
    job_history:[{org_id:'c6',org_name:'한국콘텐츠진흥원',dept:'홍보팀',title:'과장',from:'2024-01',to:null}], deal_ids:[] },
]

/* ─── 헬퍼 ─── */
const orgMap    = Object.fromEntries(ORGS.map(o=>[o.id,o]))
const personMap = Object.fromEntries(PEOPLE.map(p=>[p.id,p]))
function fmt(n:number){ if(n>=1e8) return `${(n/1e8).toFixed(1)}억`; if(n>=1e4) return `${Math.round(n/1e4)}만`; return n.toLocaleString() }
function getTier(o:Org){ return o.total_sales>=10000000?'vip':o.total_sales>0?'regular':'new' }
function getDeals(p:Person){ return p.deal_ids.flatMap(id=>ORGS.flatMap(o=>o.sales.filter(s=>s.id===id))) }

const TYPE_COL: Record<string,{bg:string;text:string}>={
  '학교':{bg:'bg-blue-100',text:'text-blue-700'},'공공기관':{bg:'bg-green-100',text:'text-green-700'},
  '기업':{bg:'bg-purple-100',text:'text-purple-700'},'개인':{bg:'bg-gray-100',text:'text-gray-600'}}
const TIER_COL={
  vip:    {dot:'bg-yellow-400',hdr:'bg-yellow-50',txt:'text-yellow-700',emoji:'⭐',label:'VIP',sub:'1,000만원 이상'},
  regular:{dot:'bg-green-400', hdr:'bg-green-50', txt:'text-green-700', emoji:'✅',label:'일반',sub:'거래 이력 있음'},
  new:    {dot:'bg-blue-300',  hdr:'bg-blue-50',  txt:'text-blue-600',  emoji:'🌱',label:'신규',sub:'거래 없음'},
}
const lbl = 'block text-xs font-medium text-gray-500 mb-1'
const inp = 'w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-300'

/* ═══════════════════════════════════════════════
   메인
═══════════════════════════════════════════════ */
export default function CustomersDemoPage2() {
  // 왼쪽 탭
  const [listView,   setListView]   = useState<'org'|'person'>('org')
  // 오른쪽 상세
  const [detailType, setDetailType] = useState<'org'|'person'>('org')
  const [detailId,   setDetailId]   = useState<string|null>(ORGS[0].id)
  // 검색
  const [orgSearch,  setOrgSearch]  = useState('')
  const [pSearch,    setPSearch]    = useState('')
  // 티어 접기
  const [collapsed,  setCollapsed]  = useState<Set<string>>(new Set())
  // 편집 모드
  const [editingInfo, setEditingInfo] = useState(false)
  const [orgForm,  setOrgForm]  = useState<Partial<Org>>({})
  const [perForm,  setPerForm]  = useState<Partial<Person>>({})

  /* 네비게이션 */
  function goToOrg(id:string){
    setDetailType('org'); setDetailId(id)
    setListView('org'); setEditingInfo(false)
  }
  function goToPerson(id:string){
    setDetailType('person'); setDetailId(id)
    setListView('person'); setEditingInfo(false)
  }
  function startEditOrg(o:Org){
    setOrgForm({name:o.name,type:o.type,region:o.region,phone:o.phone,email:o.email,homepage:o.homepage,notes:o.notes})
    setEditingInfo(true)
  }
  function startEditPerson(p:Person){
    setPerForm({name:p.name,phone:p.phone,email:p.email,notes:p.notes})
    setEditingInfo(true)
  }

  /* 요약 */
  const totalRevenue = ORGS.reduce((s,o)=>s+o.total_sales,0)
  const vipCnt = ORGS.filter(o=>getTier(o)==='vip').length
  const activeLead = ORGS.reduce((s,o)=>s+(o.sales.length>0?0:o.contacts.length>0?1:0),0)

  /* 기관 목록 (티어 섹션) */
  const filteredOrgs = ORGS.filter(o=>!orgSearch||o.name.includes(orgSearch)||o.region.includes(orgSearch))
  const tierGroups = (['vip','regular','new'] as const).map(t=>({
    tier:t, orgs:filteredOrgs.filter(o=>getTier(o)===t)
  })).filter(g=>g.orgs.length>0)

  /* 담당자 목록 */
  const filteredPeople = PEOPLE.filter(p=>!pSearch||p.name.includes(pSearch))

  /* 현재 상세 대상 */
  const currentOrg    = detailType==='org'    ? orgMap[detailId!]    : null
  const currentPerson = detailType==='person' ? personMap[detailId!] : null

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-xl font-bold text-gray-900">고객 DB</h1>
          <p className="text-sm text-gray-500 mt-0.5">통합 관계형 — 기관·담당자·이직 연결 데모 (목업)</p>
        </div>
        <button className="px-4 py-2 text-sm font-semibold rounded-lg" style={{backgroundColor:'#FFCE00',color:'#121212'}}>
          + 신규 등록
        </button>
      </div>

      {/* 시나리오 배너 */}
      <div className="mb-4 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-xs text-blue-700">
        <span className="font-semibold">🔑 핵심 시나리오: </span>
        <span className="mr-3"><strong>박지훈</strong> 서울예술고→인천예술고 이직 (두 기관 연결)</span>
        <span><strong>김미래</strong> 경기필하모닉→수원시립미술관 이직 (수원 거래 기원)</span>
        <span className="ml-3 text-blue-500">→ 기관·담당자 이름 클릭해 서로 넘어가보세요</span>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        {[
          {label:'전체 고객',value:`${ORGS.length}개`,color:'text-gray-800',bg:'bg-white'},
          {label:'누적 매출',value:fmt(totalRevenue),color:'text-green-600',bg:'bg-green-50'},
          {label:'VIP (1000만+)',value:`${vipCnt}개`,color:'text-yellow-600',bg:'bg-yellow-50'},
          {label:'담당자 수',value:`${PEOPLE.length}명`,color:'text-blue-600',bg:'bg-blue-50'},
        ].map(s=>(
          <div key={s.label} className={`${s.bg} border border-gray-200 rounded-xl px-4 py-3`}>
            <p className="text-xs text-gray-400 mb-1">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* 스플릿 뷰 */}
      <div className="flex gap-4" style={{height:'calc(100vh - 340px)',minHeight:'540px'}}>

        {/* ── 왼쪽: 목록 ── */}
        <div className="w-[44%] flex flex-col border border-gray-200 rounded-xl bg-white overflow-hidden">
          {/* 탭 + 검색 */}
          <div className="px-3 py-2.5 border-b border-gray-100 space-y-2 shrink-0">
            <div className="flex bg-gray-100 rounded-lg p-0.5 gap-0.5">
              <button onClick={()=>setListView('org')}
                className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-all ${listView==='org'?'bg-white text-gray-900 shadow-sm':'text-gray-500 hover:text-gray-700'}`}>
                🏛️ 기관 ({ORGS.length})
              </button>
              <button onClick={()=>setListView('person')}
                className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-all ${listView==='person'?'bg-white text-gray-900 shadow-sm':'text-gray-500 hover:text-gray-700'}`}>
                👤 담당자 ({PEOPLE.length})
              </button>
            </div>
            {listView==='org'
              ? <input type="text" placeholder="기관명, 지역 검색..." value={orgSearch} onChange={e=>setOrgSearch(e.target.value)} className={inp}/>
              : <input type="text" placeholder="담당자명 검색..." value={pSearch} onChange={e=>setPSearch(e.target.value)} className={inp}/>}
          </div>

          {/* 기관 목록 (티어 섹션) */}
          {listView==='org' && (
            <div className="overflow-y-auto flex-1">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-gray-50 z-10">
                  <tr className="border-b border-gray-100">
                    <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500">기관명</th>
                    <th className="text-right px-3 py-2.5 text-xs font-semibold text-gray-500 whitespace-nowrap">총 매출</th>
                    <th className="text-right px-3 py-2.5 text-xs font-semibold text-gray-500 whitespace-nowrap">건수</th>
                  </tr>
                </thead>
                {tierGroups.map(({tier,orgs})=>{
                  const tc=TIER_COL[tier]
                  const isC=collapsed.has(tier)
                  const tierTotal=orgs.reduce((s,o)=>s+o.total_sales,0)
                  return (
                    <tbody key={tier}>
                      <tr className={`${tc.hdr} cursor-pointer select-none`}
                        onClick={()=>setCollapsed(p=>{const n=new Set(p);n.has(tier)?n.delete(tier):n.add(tier);return n})}>
                        <td colSpan={3} className="px-3 py-1.5">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm">{tc.emoji}</span>
                            <span className={`text-xs font-bold ${tc.txt}`}>{tc.label}</span>
                            <span className={`text-xs ${tc.txt} opacity-70`}>{orgs.length}개{tierTotal>0?` · ${fmt(tierTotal)}`:''}</span>
                            <span className="ml-auto text-gray-400 text-xs">{isC?'▶':'▼'}</span>
                          </div>
                        </td>
                      </tr>
                      {!isC && orgs.map(o=>{
                        const isSel=detailType==='org'&&detailId===o.id
                        return (
                          <tr key={o.id}
                            className={`border-t border-gray-50 cursor-pointer transition-colors ${isSel?'bg-yellow-50 ring-1 ring-inset ring-yellow-200':'hover:bg-gray-50'}`}
                            onClick={()=>goToOrg(o.id)}>
                            <td className="px-3 py-2.5">
                              <div className="flex items-center gap-1.5">
                                <div className={`w-1.5 h-1.5 rounded-full ${tc.dot} shrink-0`}/>
                                <div>
                                  <p className="font-medium text-gray-900 text-sm">{o.name}</p>
                                  <p className="text-xs text-gray-400">{o.region} · <span className={`${TYPE_COL[o.type].text}`}>{o.type}</span></p>
                                </div>
                              </div>
                            </td>
                            <td className="px-3 py-2.5 text-right">
                              {o.total_sales>0?<span className="text-sm font-bold text-gray-800">{fmt(o.total_sales)}</span>:<span className="text-xs text-gray-300">-</span>}
                            </td>
                            <td className="px-3 py-2.5 text-right text-xs text-gray-500">{o.sales_count||'-'}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  )
                })}
              </table>
            </div>
          )}

          {/* 담당자 목록 */}
          {listView==='person' && (
            <div className="overflow-y-auto flex-1">
              {filteredPeople.map(p=>{
                const cur=p.job_history.find(j=>!j.to)
                const deals=getDeals(p)
                const amt=deals.reduce((s,d)=>s+d.amount,0)
                const hasMoved=p.job_history.length>1
                const isSel=detailType==='person'&&detailId===p.id
                return (
                  <div key={p.id}
                    className={`px-4 py-3 border-b border-gray-50 cursor-pointer transition-colors ${isSel?'bg-yellow-50 ring-1 ring-inset ring-yellow-200':'hover:bg-gray-50'}`}
                    onClick={()=>goToPerson(p.id)}>
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${hasMoved?'bg-orange-100 text-orange-700':'bg-gray-100 text-gray-600'}`}>
                        {p.name[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-gray-900 text-sm">{p.name}</span>
                          {hasMoved&&<span className="text-xs px-1.5 py-0.5 bg-orange-100 text-orange-600 rounded-full">이직</span>}
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5 truncate">{cur?`${cur.org_name} · ${cur.title}`:'전직'}</p>
                      </div>
                      <div className="text-right shrink-0">
                        {amt>0?<><p className="text-sm font-bold text-gray-700">{fmt(amt)}</p><p className="text-xs text-gray-400">{deals.length}건</p></>:<p className="text-xs text-gray-300">거래없음</p>}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ── 오른쪽: 상세 ── */}
        <div className="flex-1 flex flex-col border border-gray-200 rounded-xl bg-white overflow-hidden">
          {!detailId&&(
            <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-2">
              <span className="text-3xl">🔗</span><p className="text-sm">기관 또는 담당자를 선택하세요</p>
            </div>
          )}

          {/* 기관 상세 */}
          {currentOrg&&(()=>{
            const o=currentOrg
            const tier=getTier(o); const tc=TIER_COL[tier]
            return (
              <>
                {/* 헤더 */}
                <div className="px-5 py-4 border-b border-gray-100 shrink-0">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-base font-bold text-gray-900">{o.name}</h2>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TYPE_COL[o.type].bg} ${TYPE_COL[o.type].text}`}>{o.type}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${tc.hdr} ${tc.txt}`}>{tc.emoji} {tc.label}</span>
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">{o.region}</p>
                    </div>
                    {o.total_sales>0&&(
                      <div className="text-right shrink-0">
                        <p className="text-lg font-bold text-green-600">{fmt(o.total_sales)}</p>
                        <p className="text-xs text-gray-400">{o.sales_count}건</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* 콘텐츠 */}
                <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

                  {/* 기본 정보 */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs text-gray-400">기본 정보</p>
                      {!editingInfo
                        ? <button onClick={()=>startEditOrg(o)} className="text-xs text-gray-400 hover:text-gray-700 border border-gray-200 rounded px-2 py-0.5">수정</button>
                        : <div className="flex gap-1.5">
                            <button onClick={()=>setEditingInfo(false)} className="text-xs text-gray-400 border border-gray-200 rounded px-2 py-0.5">취소</button>
                            <button onClick={()=>{setEditingInfo(false);alert('저장됐습니다 (데모)')}} className="text-xs font-semibold rounded px-2 py-0.5" style={{backgroundColor:'#FFCE00',color:'#121212'}}>저장</button>
                          </div>}
                    </div>
                    {editingInfo ? (
                      <div className="space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                          <div><label className={lbl}>기관명</label><input className={inp} value={orgForm.name||''} onChange={e=>setOrgForm(f=>({...f,name:e.target.value}))}/></div>
                          <div><label className={lbl}>유형</label>
                            <select className={inp} value={orgForm.type||''} onChange={e=>setOrgForm(f=>({...f,type:e.target.value as any}))}>
                              {['학교','공공기관','기업','개인'].map(t=><option key={t}>{t}</option>)}
                            </select></div>
                          <div><label className={lbl}>지역</label><input className={inp} value={orgForm.region||''} onChange={e=>setOrgForm(f=>({...f,region:e.target.value}))}/></div>
                          <div><label className={lbl}>대표 전화</label><input className={inp} value={orgForm.phone||''} onChange={e=>setOrgForm(f=>({...f,phone:e.target.value}))}/></div>
                          <div><label className={lbl}>이메일</label><input className={inp} value={orgForm.email||''} onChange={e=>setOrgForm(f=>({...f,email:e.target.value}))}/></div>
                          <div><label className={lbl}>홈페이지</label><input className={inp} value={orgForm.homepage||''} onChange={e=>setOrgForm(f=>({...f,homepage:e.target.value}))}/></div>
                        </div>
                        <div><label className={lbl}>메모</label><textarea className={inp} rows={2} value={orgForm.notes||''} onChange={e=>setOrgForm(f=>({...f,notes:e.target.value}))}/></div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-sm">
                        {[['전화',o.phone],['이메일',o.email||'-'],['지역',o.region],['홈페이지',o.homepage||'-'],['최근거래',o.last_deal_date||'-']].map(([k,v])=>(
                          <div key={k as string}><span className="text-xs text-gray-400">{k}</span><p className="text-sm font-medium text-gray-800">{v as string}</p></div>
                        ))}
                        {o.notes&&<div className="col-span-2"><span className="text-xs text-gray-400">메모</span><p className="text-sm text-gray-600 whitespace-pre-wrap">{o.notes}</p></div>}
                      </div>
                    )}
                  </div>

                  {/* 부서별 매출 */}
                  {o.depts.length>0&&(
                    <div>
                      <p className="text-xs text-gray-400 mb-2">부서별 매출</p>
                      {o.depts.map(d=>(
                        <div key={d.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2 mb-1.5">
                          <span className="text-sm text-gray-700 font-medium">{d.name}</span>
                          <div><span className="text-sm font-bold text-gray-800">{fmt(d.total_sales)}</span><span className="text-xs text-gray-400 ml-1.5">{d.deal_count}건</span></div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* 담당자 이력 — 이름 클릭 시 담당자 뷰로 이동 */}
                  <div>
                    <p className="text-xs text-gray-400 mb-2">담당자 이력</p>
                    {o.contacts.map((c,i)=>{
                      const person=personMap[c.person_id]
                      const hasMoved=person&&person.job_history.length>1
                      const curJob=person?.job_history.find(j=>!j.to)
                      const movedTo=!c.is_current&&curJob&&curJob.org_id!==o.id?curJob:null
                      return (
                        <div key={i} className={`flex items-center gap-3 rounded-lg px-3 py-2.5 mb-2 border ${c.is_current?'border-green-200 bg-green-50':'border-gray-100 bg-gray-50'}`}>
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${c.is_current?'bg-green-200 text-green-700':'bg-gray-200 text-gray-500'}`}>
                            {person?.name[0]}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {/* ★ 담당자 이름 클릭 → 담당자 뷰로 이동 */}
                              <button onClick={()=>goToPerson(c.person_id)}
                                className="text-sm font-semibold text-blue-600 hover:text-blue-800 underline">
                                {person?.name}
                              </button>
                              <span className="text-xs text-gray-400">{c.title} · {c.dept}</span>
                              {c.is_current
                                ?<span className="text-xs px-1.5 py-0.5 bg-green-100 text-green-700 rounded-full">재직중</span>
                                :<span className="text-xs px-1.5 py-0.5 bg-gray-200 text-gray-500 rounded-full">이직</span>}
                              {hasMoved&&!c.is_current&&<span className="text-xs px-1.5 py-0.5 bg-orange-100 text-orange-600 rounded-full">이직이력</span>}
                            </div>
                            <p className="text-xs text-gray-400 mt-0.5">{c.from} ~ {c.to||'현재'}</p>
                            {movedTo&&<p className="text-xs text-blue-500 mt-0.5">현재: {movedTo.org_name} {movedTo.dept}</p>}
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* 매출 이력 */}
                  {o.sales.length>0&&(
                    <div>
                      <p className="text-xs text-gray-400 mb-2">매출 이력</p>
                      {o.sales.map(s=>(
                        <div key={s.id} className="flex items-center justify-between border border-gray-100 rounded-lg px-3 py-2 mb-1.5">
                          <div><p className="text-sm font-medium text-gray-800">{s.title}</p><p className="text-xs text-gray-400">{s.dept} · {s.date}</p></div>
                          <p className="text-sm font-bold text-gray-700 shrink-0">{fmt(s.amount)}</p>
                        </div>
                      ))}
                      <div className="flex justify-between px-3 py-2 bg-green-50 rounded-lg">
                        <span className="text-xs font-semibold text-green-700">총 매출</span>
                        <span className="text-sm font-bold text-green-700">{o.total_sales.toLocaleString()}원</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* 하단 버튼 */}
                <div className="px-5 py-3 border-t border-gray-100 flex gap-2 shrink-0">
                  <button className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">담당자 추가</button>
                  <button className="flex-1 px-3 py-2 text-sm font-semibold rounded-lg" style={{backgroundColor:'#FFCE00',color:'#121212'}}>이 기관으로 리드 등록</button>
                </div>
              </>
            )
          })()}

          {/* 담당자 상세 */}
          {currentPerson&&(()=>{
            const p=currentPerson
            const deals=getDeals(p)
            const amt=deals.reduce((s,d)=>s+d.amount,0)
            const hasMoved=p.job_history.length>1
            const cur=p.job_history.find(j=>!j.to)
            return (
              <>
                {/* 헤더 */}
                <div className="px-5 py-4 border-b border-gray-100 shrink-0">
                  <div className="flex items-start gap-3">
                    <div className={`w-11 h-11 rounded-full flex items-center justify-center text-lg font-bold ${hasMoved?'bg-orange-100 text-orange-700':'bg-gray-100 text-gray-600'}`}>
                      {p.name[0]}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-base font-bold text-gray-900">{p.name}</h2>
                        {hasMoved&&<span className="text-xs px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full font-medium">이직 이력</span>}
                      </div>
                      {cur&&<p className="text-xs text-gray-400 mt-0.5">{cur.org_name} · {cur.title}</p>}
                      {amt>0&&<p className="text-sm font-bold text-green-600 mt-1">총 거래 {fmt(amt)} · {deals.length}건</p>}
                    </div>
                  </div>
                  {hasMoved&&(
                    <div className="mt-3 bg-orange-50 border border-orange-100 rounded-lg px-3 py-2">
                      <p className="text-xs text-orange-700 font-semibold mb-1">💡 이 담당자를 따라 새 거래처가 열렸어요</p>
                      <div className="flex items-center gap-1.5 text-xs">
                        {p.job_history.map((j,i)=>(
                          <span key={i} className="flex items-center gap-1">
                            {i>0&&<span className="text-orange-300">→</span>}
                            <button onClick={()=>goToOrg(j.org_id)} className="text-blue-600 underline hover:text-blue-800">{j.org_name}</button>
                            <span className="text-orange-400">({j.to?j.from+'~'+j.to:'현재'})</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* 콘텐츠 */}
                <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

                  {/* 기본 정보 */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs text-gray-400">기본 정보</p>
                      {!editingInfo
                        ? <button onClick={()=>startEditPerson(p)} className="text-xs text-gray-400 hover:text-gray-700 border border-gray-200 rounded px-2 py-0.5">수정</button>
                        : <div className="flex gap-1.5">
                            <button onClick={()=>setEditingInfo(false)} className="text-xs text-gray-400 border border-gray-200 rounded px-2 py-0.5">취소</button>
                            <button onClick={()=>{setEditingInfo(false);alert('저장됐습니다 (데모)')}} className="text-xs font-semibold rounded px-2 py-0.5" style={{backgroundColor:'#FFCE00',color:'#121212'}}>저장</button>
                          </div>}
                    </div>
                    {editingInfo ? (
                      <div className="space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                          <div><label className={lbl}>이름</label><input className={inp} value={perForm.name||''} onChange={e=>setPerForm(f=>({...f,name:e.target.value}))}/></div>
                          <div><label className={lbl}>휴대폰</label><input className={inp} value={perForm.phone||''} onChange={e=>setPerForm(f=>({...f,phone:e.target.value}))}/></div>
                          <div className="col-span-2"><label className={lbl}>이메일</label><input className={inp} value={perForm.email||''} onChange={e=>setPerForm(f=>({...f,email:e.target.value}))}/></div>
                        </div>
                        <div><label className={lbl}>메모</label><textarea className={inp} rows={2} value={perForm.notes||''} onChange={e=>setPerForm(f=>({...f,notes:e.target.value}))}/></div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-sm">
                        {[['전화',p.phone],['이메일',p.email||'-']].map(([k,v])=>(
                          <div key={k as string}><span className="text-xs text-gray-400">{k}</span><p className="text-sm font-medium text-gray-800">{v as string}</p></div>
                        ))}
                        {p.notes&&<div className="col-span-2"><span className="text-xs text-gray-400">메모</span><p className="text-sm text-gray-600">{p.notes}</p></div>}
                      </div>
                    )}
                  </div>

                  {/* 소속 이력 — 기관명 클릭 → 기관 뷰로 이동 */}
                  <div>
                    <p className="text-xs text-gray-400 mb-3">소속 이력</p>
                    <div className="relative pl-5">
                      <div className="absolute left-1.5 top-2 bottom-2 w-px bg-gray-200"/>
                      {[...p.job_history].reverse().map((j,i)=>(
                        <div key={i} className="relative flex gap-3 mb-3">
                          <div className={`absolute -left-[13px] top-1.5 w-3 h-3 rounded-full border-2 border-white shadow-sm ${!j.to?'bg-green-400':'bg-gray-300'}`}/>
                          <div className="flex-1 bg-gray-50 rounded-lg p-2.5">
                            <div className="flex items-center justify-between">
                              {/* ★ 기관명 클릭 → 기관 뷰로 이동 */}
                              <button onClick={()=>goToOrg(j.org_id)}
                                className="text-sm font-semibold text-blue-600 hover:text-blue-800 underline">
                                {j.org_name}
                              </button>
                              {!j.to&&<span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">현재</span>}
                            </div>
                            <p className="text-xs text-gray-500 mt-0.5">{j.dept} · {j.title}</p>
                            <p className="text-xs text-gray-400">{j.from} ~ {j.to||'현재'}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 거래 이력 전체 */}
                  {deals.length>0&&(
                    <div>
                      <p className="text-xs text-gray-400 mb-2">거래 이력 전체 ({deals.length}건)</p>
                      {deals.map(s=>(
                        <div key={s.id} className="flex items-center justify-between border border-gray-100 rounded-lg px-3 py-2 mb-1.5">
                          <div>
                            <p className="text-sm font-medium text-gray-800">{s.title}</p>
                            {/* 기관명 클릭 */}
                            <button onClick={()=>{const o=ORGS.find(o=>o.name.includes(s.org_name));if(o)goToOrg(o.id)}}
                              className="text-xs text-blue-500 underline hover:text-blue-700">{s.org_name}</button>
                            <span className="text-xs text-gray-400"> · {s.date}</span>
                          </div>
                          <p className="text-sm font-bold text-gray-700 shrink-0">{fmt(s.amount)}</p>
                        </div>
                      ))}
                      <div className="flex justify-between px-3 py-2 bg-green-50 rounded-lg">
                        <span className="text-xs font-semibold text-green-700">이 담당자 통해 총</span>
                        <span className="text-sm font-bold text-green-700">{amt.toLocaleString()}원</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* 하단 버튼 */}
                <div className="px-5 py-3 border-t border-gray-100 flex gap-2 shrink-0">
                  <button className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">소속 이력 추가</button>
                  <button className="flex-1 px-3 py-2 text-sm font-semibold rounded-lg" style={{backgroundColor:'#FFCE00',color:'#121212'}}>이 담당자로 리드 등록</button>
                </div>
              </>
            )
          })()}
        </div>
      </div>
    </div>
  )
}
