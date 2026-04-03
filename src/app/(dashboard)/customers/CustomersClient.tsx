'use client'
import { useState, useTransition } from 'react'
import {
  createCustomer, updateCustomer, deleteCustomer,
  createPerson, updatePerson, deletePerson,
  addRelation, endRelation,
} from './actions'

/* ── 타입 ── */
interface OrgContact {
  id: string; person_id: string; person_name: string
  person_phone: string; person_email: string
  dept: string; title: string; started_at: string; ended_at: string | null; is_current: boolean
}
interface OrgSale { id: string; title: string; amount: number; service_type: string; date: string }
interface Customer {
  id: string; name: string; type: string; region: string
  phone: string; email: string; homepage: string; notes: string
  total_sales: number; sales_count: number; last_deal_date: string | null
  contacts: OrgContact[]; sales: OrgSale[]
}
interface JobHistory {
  id: string; customer_id: string; customer_name: string
  dept: string; title: string; started_at: string; ended_at: string | null; is_current: boolean
}
interface Person {
  id: string; name: string; phone: string; email: string; notes: string; job_history: JobHistory[]
}
interface Props { customers: Customer[]; persons: Person[]; isAdmin: boolean }

/* ── 디자인 토큰 ── */
const TYPE_COL: Record<string,{bg:string;text:string}> = {
  '학교':{bg:'bg-blue-100',text:'text-blue-700'},'공공기관':{bg:'bg-green-100',text:'text-green-700'},
  '기업':{bg:'bg-purple-100',text:'text-purple-700'},'개인':{bg:'bg-gray-100',text:'text-gray-600'},
  '기타':{bg:'bg-gray-100',text:'text-gray-500'},
}
const TIER_COL = {
  vip:    {dot:'bg-yellow-400',hdr:'bg-yellow-50',txt:'text-yellow-700',emoji:'⭐',label:'VIP'},
  regular:{dot:'bg-green-400', hdr:'bg-green-50', txt:'text-green-700', emoji:'✅',label:'일반'},
  new:    {dot:'bg-blue-300',  hdr:'bg-blue-50',  txt:'text-blue-600',  emoji:'🌱',label:'신규'},
}
function getTier(c: Customer) { return c.total_sales>=10000000?'vip':c.total_sales>0?'regular':'new' }
function fmt(n:number){ if(n>=1e8) return `${(n/1e8).toFixed(1)}억`; if(n>=1e4) return `${Math.round(n/1e4)}만`; return n.toLocaleString() }
const lbl = 'block text-xs font-medium text-gray-500 mb-1'
const inp = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-300'
const ORG_TYPES = ['학교','공공기관','기업','개인','기타']

export default function CustomersClient({ customers, persons, isAdmin }: Props) {
  const [listView,    setListView]    = useState<'org'|'person'>('org')
  const [detailType,  setDetailType]  = useState<'org'|'person'>('org')
  const [detailId,    setDetailId]    = useState<string|null>(customers[0]?.id ?? null)
  const [orgSearch,   setOrgSearch]   = useState('')
  const [pSearch,     setPSearch]     = useState('')
  const [collapsed,   setCollapsed]   = useState<Set<string>>(new Set())
  const [editingInfo, setEditingInfo] = useState(false)
  const [showNewOrg,  setShowNewOrg]  = useState(false)
  const [showNewPerson, setShowNewPerson] = useState(false)
  const [showAddRel,  setShowAddRel]  = useState(false)
  const [isPending,   startTransition] = useTransition()

  // 폼 상태
  const [orgForm, setOrgForm] = useState<Record<string,string>>({})
  const [perForm, setPerForm] = useState<Record<string,string>>({})
  const [relForm, setRelForm] = useState<Record<string,string>>({})

  /* 네비게이션 */
  function goToOrg(id: string) {
    setDetailType('org'); setDetailId(id); setListView('org'); setEditingInfo(false)
  }
  function goToPerson(id: string) {
    setDetailType('person'); setDetailId(id); setListView('person'); setEditingInfo(false)
  }

  const orgMap    = Object.fromEntries(customers.map(c=>[c.id,c]))
  const personMap = Object.fromEntries(persons.map(p=>[p.id,p]))
  const currentOrg    = detailType==='org'    ? orgMap[detailId!]    : null
  const currentPerson = detailType==='person' ? personMap[detailId!] : null

  /* 기관 CRUD */
  function handleSaveOrg(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      if (currentOrg && editingInfo) {
        await updateCustomer(currentOrg.id, {
          name: orgForm.name||currentOrg.name, type: orgForm.type||currentOrg.type,
          region: orgForm.region||null, phone: orgForm.phone||null,
          email: orgForm.email||null, homepage: orgForm.homepage||null, notes: orgForm.notes||null,
        })
        setEditingInfo(false)
      } else {
        const fd = new FormData()
        Object.entries(orgForm).forEach(([k,v])=>{ if(v) fd.set(k,v) })
        await createCustomer(fd)
        setShowNewOrg(false)
      }
    })
  }

  /* 담당자 CRUD */
  function handleSavePerson(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      if (currentPerson && editingInfo) {
        await updatePerson(currentPerson.id, {
          name: perForm.name||currentPerson.name, phone: perForm.phone||null,
          email: perForm.email||null, notes: perForm.notes||null,
        })
        setEditingInfo(false)
      } else {
        const fd = new FormData()
        Object.entries(perForm).forEach(([k,v])=>{ if(v) fd.set(k,v) })
        await createPerson(fd)
        setShowNewPerson(false)
      }
    })
  }

  /* 소속 관계 추가 */
  function handleAddRelation(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      await addRelation({
        person_id:   relForm.person_id,
        customer_id: relForm.customer_id,
        dept:        relForm.dept || undefined,
        title:       relForm.title || undefined,
        started_at:  relForm.started_at || undefined,
      })
      setShowAddRel(false); setRelForm({})
    })
  }

  /* 티어 그룹 */
  const filteredOrgs = customers.filter(o=>!orgSearch||o.name.includes(orgSearch)||o.region.includes(orgSearch))
  const tierGroups = (['vip','regular','new'] as const).map(t=>({
    tier:t, orgs:filteredOrgs.filter(o=>getTier(o)===t)
  })).filter(g=>g.orgs.length>0)

  const filteredPersons = persons.filter(p=>!pSearch||p.name.includes(pSearch))

  /* 요약 */
  const totalRevenue = customers.reduce((s,c)=>s+c.total_sales,0)
  const vipCnt = customers.filter(c=>getTier(c)==='vip').length

  return (
    <div className="flex flex-col gap-4">
      {/* 요약 카드 */}
      <div className="grid grid-cols-4 gap-3">
        {[
          {label:'전체 기관',  value:`${customers.length}개`, color:'text-gray-800', bg:'bg-white'},
          {label:'누적 매출',  value:fmt(totalRevenue),        color:'text-green-600',bg:'bg-green-50'},
          {label:'VIP (1000만+)', value:`${vipCnt}개`,        color:'text-yellow-600',bg:'bg-yellow-50'},
          {label:'담당자 수',  value:`${persons.length}명`,   color:'text-blue-600', bg:'bg-blue-50'},
        ].map(s=>(
          <div key={s.label} className={`${s.bg} border border-gray-200 rounded-xl px-4 py-3`}>
            <p className="text-xs text-gray-400 mb-1">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* 스플릿 뷰 */}
      <div className="flex gap-4" style={{height:'calc(100vh - 320px)', minHeight:'540px'}}>

        {/* 왼쪽: 목록 */}
        <div className="w-[44%] flex flex-col border border-gray-200 rounded-xl bg-white overflow-hidden">
          <div className="px-3 py-2.5 border-b border-gray-100 space-y-2 shrink-0">
            <div className="flex bg-gray-100 rounded-lg p-0.5 gap-0.5">
              <button onClick={()=>setListView('org')}
                className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-all ${listView==='org'?'bg-white text-gray-900 shadow-sm':'text-gray-500 hover:text-gray-700'}`}>
                🏛️ 기관 ({customers.length})
              </button>
              <button onClick={()=>setListView('person')}
                className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-all ${listView==='person'?'bg-white text-gray-900 shadow-sm':'text-gray-500 hover:text-gray-700'}`}>
                👤 담당자 ({persons.length})
              </button>
            </div>
            <div className="flex gap-2">
              {listView==='org'
                ?<input type="text" placeholder="기관명, 지역 검색..." value={orgSearch} onChange={e=>setOrgSearch(e.target.value)} className={`flex-1 ${inp} py-1.5`}/>
                :<input type="text" placeholder="담당자명 검색..." value={pSearch} onChange={e=>setPSearch(e.target.value)} className={`flex-1 ${inp} py-1.5`}/>}
              {isAdmin && (
                <button
                  onClick={()=>{ listView==='org'?(setShowNewOrg(true)):(setShowNewPerson(true)) }}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg shrink-0"
                  style={{backgroundColor:'#FFCE00',color:'#121212'}}>
                  + 추가
                </button>
              )}
            </div>
          </div>

          {/* 기관 목록 */}
          {listView==='org' && (
            <div className="overflow-y-auto flex-1">
              {customers.length===0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-2 py-12">
                  <p className="text-sm">등록된 기관이 없어요.</p>
                  {isAdmin && <button onClick={()=>setShowNewOrg(true)} className="text-xs text-yellow-600 underline">+ 첫 기관 추가</button>}
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-gray-50 z-10">
                    <tr className="border-b border-gray-100">
                      <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500">기관명</th>
                      <th className="text-right px-3 py-2.5 text-xs font-semibold text-gray-500 whitespace-nowrap">총 매출</th>
                      <th className="text-right px-3 py-2.5 text-xs font-semibold text-gray-500 whitespace-nowrap">건수</th>
                    </tr>
                  </thead>
                  {tierGroups.map(({tier,orgs})=>{
                    const tc=TIER_COL[tier]; const isC=collapsed.has(tier)
                    const tierTotal=orgs.reduce((s,o)=>s+o.total_sales,0)
                    return (
                      <tbody key={tier}>
                        <tr className={`${tc.hdr} cursor-pointer select-none`}
                          onClick={()=>setCollapsed(p=>{const n=new Set(p);n.has(tier)?n.delete(tier):n.add(tier);return n})}>
                          <td colSpan={3} className="px-3 py-1.5">
                            <div className="flex items-center gap-1.5">
                              <span>{tc.emoji}</span>
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
                                    <p className="text-xs text-gray-400">{o.region}{o.region&&o.type?' · ':''}<span className={TYPE_COL[o.type]?.text||'text-gray-500'}>{o.type}</span></p>
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
              )}
            </div>
          )}

          {/* 담당자 목록 */}
          {listView==='person' && (
            <div className="overflow-y-auto flex-1">
              {persons.length===0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-2 py-12">
                  <p className="text-sm">등록된 담당자가 없어요.</p>
                  {isAdmin && <button onClick={()=>setShowNewPerson(true)} className="text-xs text-yellow-600 underline">+ 첫 담당자 추가</button>}
                </div>
              ) : filteredPersons.map(p=>{
                const cur=p.job_history.find(j=>j.is_current)
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
                        <p className="text-xs text-gray-400 mt-0.5 truncate">{cur?`${cur.customer_name} · ${cur.title||''}`:p.job_history.length===0?'소속 없음':'전직'}</p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* 오른쪽: 상세 */}
        <div className="flex-1 flex flex-col border border-gray-200 rounded-xl bg-white overflow-hidden">
          {!detailId&&(
            <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-2">
              <span className="text-3xl">🔗</span><p className="text-sm">기관 또는 담당자를 선택하세요</p>
            </div>
          )}

          {/* 기관 상세 */}
          {currentOrg&&(()=>{
            const o=currentOrg
            const tier=getTier(o); const tc=TIER_COL[tier]; const col=TYPE_COL[o.type]||TYPE_COL['기타']
            return (
              <>
                <div className="px-5 py-4 border-b border-gray-100 shrink-0">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-base font-bold text-gray-900">{o.name}</h2>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${col.bg} ${col.text}`}>{o.type}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${tc.hdr} ${tc.txt}`}>{tc.emoji} {tc.label}</span>
                      </div>
                      {o.region&&<p className="text-xs text-gray-400 mt-0.5">{o.region}</p>}
                    </div>
                    {o.total_sales>0&&<div className="text-right shrink-0"><p className="text-lg font-bold text-green-600">{fmt(o.total_sales)}</p><p className="text-xs text-gray-400">{o.sales_count}건</p></div>}
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
                  {/* 기본 정보 */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs text-gray-400">기본 정보</p>
                      {isAdmin&&(!editingInfo
                        ?<button onClick={()=>{setOrgForm({name:o.name,type:o.type,region:o.region,phone:o.phone,email:o.email,homepage:o.homepage,notes:o.notes});setEditingInfo(true)}}
                           className="text-xs text-gray-400 hover:text-gray-700 border border-gray-200 rounded px-2 py-0.5">수정</button>
                        :<div className="flex gap-1.5">
                           <button onClick={()=>setEditingInfo(false)} className="text-xs text-gray-400 border border-gray-200 rounded px-2 py-0.5">취소</button>
                           <button onClick={handleSaveOrg} disabled={isPending} className="text-xs font-semibold rounded px-2 py-0.5 disabled:opacity-50" style={{backgroundColor:'#FFCE00',color:'#121212'}}>{isPending?'저장중...':'저장'}</button>
                         </div>)}
                    </div>
                    {editingInfo?(
                      <div className="space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                          <div><label className={lbl}>기관명</label><input className={inp} value={orgForm.name||''} onChange={e=>setOrgForm(f=>({...f,name:e.target.value}))}/></div>
                          <div><label className={lbl}>유형</label><select className={inp} value={orgForm.type||''} onChange={e=>setOrgForm(f=>({...f,type:e.target.value}))}>{ORG_TYPES.map(t=><option key={t}>{t}</option>)}</select></div>
                          <div><label className={lbl}>지역</label><input className={inp} value={orgForm.region||''} onChange={e=>setOrgForm(f=>({...f,region:e.target.value}))}/></div>
                          <div><label className={lbl}>대표 전화</label><input className={inp} value={orgForm.phone||''} onChange={e=>setOrgForm(f=>({...f,phone:e.target.value}))}/></div>
                          <div><label className={lbl}>이메일</label><input className={inp} value={orgForm.email||''} onChange={e=>setOrgForm(f=>({...f,email:e.target.value}))}/></div>
                          <div><label className={lbl}>홈페이지</label><input className={inp} value={orgForm.homepage||''} onChange={e=>setOrgForm(f=>({...f,homepage:e.target.value}))}/></div>
                        </div>
                        <div><label className={lbl}>메모</label><textarea className={inp} rows={2} value={orgForm.notes||''} onChange={e=>setOrgForm(f=>({...f,notes:e.target.value}))}/></div>
                      </div>
                    ):(
                      <div className="grid grid-cols-2 gap-y-2 gap-x-4">
                        {[['전화',o.phone],['이메일',o.email||'-'],['지역',o.region||'-'],['홈페이지',o.homepage||'-'],['최근거래',o.last_deal_date||'-']].map(([k,v])=>(
                          <div key={k as string}><span className="text-xs text-gray-400">{k}</span><p className="text-sm font-medium text-gray-800">{v as string}</p></div>
                        ))}
                        {o.notes&&<div className="col-span-2"><span className="text-xs text-gray-400">메모</span><p className="text-sm text-gray-600 whitespace-pre-wrap">{o.notes}</p></div>}
                      </div>
                    )}
                  </div>

                  {/* 담당자 이력 */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs text-gray-400">담당자 이력 ({o.contacts.length}명)</p>
                      {isAdmin&&<button onClick={()=>{setRelForm({customer_id:o.id});setShowAddRel(true)}} className="text-xs text-gray-400 hover:text-gray-700 border border-gray-200 rounded px-2 py-0.5">+ 담당자 연결</button>}
                    </div>
                    {o.contacts.length===0
                      ?<p className="text-xs text-gray-300 italic">연결된 담당자가 없어요.</p>
                      :o.contacts.map((c,i)=>{
                        const hasMoved=personMap[c.person_id]?.job_history.length>1
                        const curJob=personMap[c.person_id]?.job_history.find(j=>j.is_current)
                        const movedTo=!c.is_current&&curJob&&curJob.customer_id!==o.id?curJob:null
                        return (
                          <div key={i} className={`flex items-center gap-3 rounded-lg px-3 py-2.5 mb-2 border ${c.is_current?'border-green-200 bg-green-50':'border-gray-100 bg-gray-50'}`}>
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${c.is_current?'bg-green-200 text-green-700':'bg-gray-200 text-gray-500'}`}>{c.person_name?.[0]}</div>
                            <div className="flex-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <button onClick={()=>c.person_id&&goToPerson(c.person_id)} className="text-sm font-semibold text-blue-600 hover:text-blue-800 underline">{c.person_name}</button>
                                {c.title&&<span className="text-xs text-gray-400">{c.title}</span>}
                                {c.dept&&<span className="text-xs text-gray-400">· {c.dept}</span>}
                                {c.is_current?<span className="text-xs px-1.5 py-0.5 bg-green-100 text-green-700 rounded-full">재직중</span>:<span className="text-xs px-1.5 py-0.5 bg-gray-200 text-gray-500 rounded-full">이직</span>}
                                {hasMoved&&!c.is_current&&<span className="text-xs px-1.5 py-0.5 bg-orange-100 text-orange-600 rounded-full">이직이력</span>}
                              </div>
                              <p className="text-xs text-gray-400">{c.started_at} ~ {c.ended_at||'현재'}</p>
                              {movedTo&&<p className="text-xs text-blue-500 mt-0.5">현재: {movedTo.customer_name} {movedTo.dept}</p>}
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
                          <div><p className="text-sm font-medium text-gray-800">{s.title}</p><p className="text-xs text-gray-400">{s.service_type} · {s.date}</p></div>
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

                <div className="px-5 py-3 border-t border-gray-100 flex gap-2 shrink-0">
                  {isAdmin&&<button onClick={()=>{if(confirm('이 기관을 삭제할까요?'))startTransition(async()=>{await deleteCustomer(o.id)})}} className="px-3 py-2 text-xs text-red-400 border border-red-100 rounded-lg hover:bg-red-50">삭제</button>}
                  <button className="flex-1 px-3 py-2 text-sm font-semibold rounded-lg" style={{backgroundColor:'#FFCE00',color:'#121212'}}>이 기관으로 리드 등록</button>
                </div>
              </>
            )
          })()}

          {/* 담당자 상세 */}
          {currentPerson&&(()=>{
            const p=currentPerson
            const hasMoved=p.job_history.length>1
            const cur=p.job_history.find(j=>j.is_current)
            return (
              <>
                <div className="px-5 py-4 border-b border-gray-100 shrink-0">
                  <div className="flex items-start gap-3">
                    <div className={`w-11 h-11 rounded-full flex items-center justify-center text-lg font-bold ${hasMoved?'bg-orange-100 text-orange-700':'bg-gray-100 text-gray-600'}`}>{p.name[0]}</div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-base font-bold text-gray-900">{p.name}</h2>
                        {hasMoved&&<span className="text-xs px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full">이직 이력</span>}
                      </div>
                      {cur&&<p className="text-xs text-gray-400 mt-0.5">{cur.customer_name} · {cur.title||''}</p>}
                    </div>
                  </div>
                  {hasMoved&&(
                    <div className="mt-3 bg-orange-50 border border-orange-100 rounded-lg px-3 py-2">
                      <p className="text-xs text-orange-700 font-semibold mb-1">💡 이 담당자를 따라 새 거래처가 열렸어요</p>
                      <div className="flex items-center gap-1.5 flex-wrap text-xs">
                        {p.job_history.map((j,i)=>(
                          <span key={i} className="flex items-center gap-1">
                            {i>0&&<span className="text-orange-300">→</span>}
                            <button onClick={()=>j.customer_id&&goToOrg(j.customer_id)} className="text-blue-600 underline hover:text-blue-800">{j.customer_name}</button>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
                  {/* 기본 정보 */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs text-gray-400">기본 정보</p>
                      {isAdmin&&(!editingInfo
                        ?<button onClick={()=>{setPerForm({name:p.name,phone:p.phone,email:p.email,notes:p.notes});setEditingInfo(true)}} className="text-xs text-gray-400 hover:text-gray-700 border border-gray-200 rounded px-2 py-0.5">수정</button>
                        :<div className="flex gap-1.5">
                           <button onClick={()=>setEditingInfo(false)} className="text-xs text-gray-400 border border-gray-200 rounded px-2 py-0.5">취소</button>
                           <button onClick={handleSavePerson} disabled={isPending} className="text-xs font-semibold rounded px-2 py-0.5 disabled:opacity-50" style={{backgroundColor:'#FFCE00',color:'#121212'}}>{isPending?'저장중...':'저장'}</button>
                         </div>)}
                    </div>
                    {editingInfo?(
                      <div className="space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                          <div><label className={lbl}>이름</label><input className={inp} value={perForm.name||''} onChange={e=>setPerForm(f=>({...f,name:e.target.value}))}/></div>
                          <div><label className={lbl}>휴대폰</label><input className={inp} value={perForm.phone||''} onChange={e=>setPerForm(f=>({...f,phone:e.target.value}))}/></div>
                          <div className="col-span-2"><label className={lbl}>이메일</label><input className={inp} value={perForm.email||''} onChange={e=>setPerForm(f=>({...f,email:e.target.value}))}/></div>
                        </div>
                        <div><label className={lbl}>메모</label><textarea className={inp} rows={2} value={perForm.notes||''} onChange={e=>setPerForm(f=>({...f,notes:e.target.value}))}/></div>
                      </div>
                    ):(
                      <div className="grid grid-cols-2 gap-y-2 gap-x-4">
                        {[['전화',p.phone||'-'],['이메일',p.email||'-']].map(([k,v])=>(
                          <div key={k as string}><span className="text-xs text-gray-400">{k}</span><p className="text-sm font-medium text-gray-800">{v as string}</p></div>
                        ))}
                        {p.notes&&<div className="col-span-2"><span className="text-xs text-gray-400">메모</span><p className="text-sm text-gray-600 whitespace-pre-wrap">{p.notes}</p></div>}
                      </div>
                    )}
                  </div>

                  {/* 소속 이력 */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs text-gray-400">소속 이력</p>
                      {isAdmin&&<button onClick={()=>{setRelForm({person_id:p.id});setShowAddRel(true)}} className="text-xs text-gray-400 hover:text-gray-700 border border-gray-200 rounded px-2 py-0.5">+ 이직 추가</button>}
                    </div>
                    {p.job_history.length===0
                      ?<p className="text-xs text-gray-300 italic">소속 이력이 없어요.</p>
                      :<div className="relative pl-5">
                        <div className="absolute left-1.5 top-2 bottom-2 w-px bg-gray-200"/>
                        {[...p.job_history].reverse().map((j,i)=>(
                          <div key={i} className="relative flex gap-3 mb-3">
                            <div className={`absolute -left-[13px] top-1.5 w-3 h-3 rounded-full border-2 border-white shadow-sm ${j.is_current?'bg-green-400':'bg-gray-300'}`}/>
                            <div className="flex-1 bg-gray-50 rounded-lg p-2.5">
                              <div className="flex items-center justify-between">
                                <button onClick={()=>j.customer_id&&goToOrg(j.customer_id)} className="text-sm font-semibold text-blue-600 hover:text-blue-800 underline">{j.customer_name}</button>
                                {j.is_current?<span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">현재</span>:null}
                              </div>
                              {(j.dept||j.title)&&<p className="text-xs text-gray-500 mt-0.5">{[j.dept,j.title].filter(Boolean).join(' · ')}</p>}
                              <p className="text-xs text-gray-400">{j.started_at||'?'} ~ {j.ended_at||'현재'}</p>
                            </div>
                          </div>
                        ))}
                      </div>}
                  </div>
                </div>

                <div className="px-5 py-3 border-t border-gray-100 flex gap-2 shrink-0">
                  {isAdmin&&<button onClick={()=>{if(confirm('이 담당자를 삭제할까요?'))startTransition(async()=>{await deletePerson(p.id)})}} className="px-3 py-2 text-xs text-red-400 border border-red-100 rounded-lg hover:bg-red-50">삭제</button>}
                  <button className="flex-1 px-3 py-2 text-sm font-semibold rounded-lg" style={{backgroundColor:'#FFCE00',color:'#121212'}}>이 담당자로 리드 등록</button>
                </div>
              </>
            )
          })()}
        </div>
      </div>

      {/* ── 모달: 새 기관 ── */}
      {showNewOrg&&(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={()=>setShowNewOrg(false)}/>
          <form onSubmit={handleSaveOrg} className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-3">
            <h2 className="text-lg font-bold text-gray-900 mb-2">새 기관 등록</h2>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={lbl}>기관명 *</label><input className={inp} required value={orgForm.name||''} onChange={e=>setOrgForm(f=>({...f,name:e.target.value}))}/></div>
              <div><label className={lbl}>유형</label><select className={inp} value={orgForm.type||'기타'} onChange={e=>setOrgForm(f=>({...f,type:e.target.value}))}>{ORG_TYPES.map(t=><option key={t}>{t}</option>)}</select></div>
              <div><label className={lbl}>지역</label><input className={inp} value={orgForm.region||''} onChange={e=>setOrgForm(f=>({...f,region:e.target.value}))}/></div>
              <div><label className={lbl}>대표 전화</label><input className={inp} value={orgForm.phone||''} onChange={e=>setOrgForm(f=>({...f,phone:e.target.value}))}/></div>
              <div><label className={lbl}>이메일</label><input className={inp} value={orgForm.email||''} onChange={e=>setOrgForm(f=>({...f,email:e.target.value}))}/></div>
              <div><label className={lbl}>홈페이지</label><input className={inp} value={orgForm.homepage||''} onChange={e=>setOrgForm(f=>({...f,homepage:e.target.value}))}/></div>
            </div>
            <div><label className={lbl}>메모</label><textarea className={inp} rows={2} value={orgForm.notes||''} onChange={e=>setOrgForm(f=>({...f,notes:e.target.value}))}/></div>
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={()=>setShowNewOrg(false)} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">취소</button>
              <button type="submit" disabled={isPending} className="px-4 py-2 text-sm font-semibold rounded-lg disabled:opacity-50" style={{backgroundColor:'#FFCE00',color:'#121212'}}>{isPending?'저장중...':'등록'}</button>
            </div>
          </form>
        </div>
      )}

      {/* ── 모달: 새 담당자 ── */}
      {showNewPerson&&(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={()=>setShowNewPerson(false)}/>
          <form onSubmit={handleSavePerson} className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-3">
            <h2 className="text-lg font-bold text-gray-900 mb-2">새 담당자 등록</h2>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={lbl}>이름 *</label><input className={inp} required value={perForm.name||''} onChange={e=>setPerForm(f=>({...f,name:e.target.value}))}/></div>
              <div><label className={lbl}>직함</label><input className={inp} value={perForm.title||''} onChange={e=>setPerForm(f=>({...f,title:e.target.value}))}/></div>
              <div><label className={lbl}>휴대폰</label><input className={inp} value={perForm.phone||''} onChange={e=>setPerForm(f=>({...f,phone:e.target.value}))}/></div>
              <div><label className={lbl}>이메일</label><input className={inp} value={perForm.email||''} onChange={e=>setPerForm(f=>({...f,email:e.target.value}))}/></div>
            </div>
            <div><label className={lbl}>소속 기관 (선택)</label>
              <select className={inp} value={perForm.customer_id||''} onChange={e=>setPerForm(f=>({...f,customer_id:e.target.value}))}>
                <option value="">선택 안함</option>
                {customers.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            {perForm.customer_id&&(
              <div className="grid grid-cols-2 gap-3">
                <div><label className={lbl}>부서</label><input className={inp} value={perForm.dept||''} onChange={e=>setPerForm(f=>({...f,dept:e.target.value}))}/></div>
                <div><label className={lbl}>소속 시작일</label><input type="date" className={inp} value={perForm.started_at||''} onChange={e=>setPerForm(f=>({...f,started_at:e.target.value}))}/></div>
              </div>
            )}
            <div><label className={lbl}>메모</label><textarea className={inp} rows={2} value={perForm.notes||''} onChange={e=>setPerForm(f=>({...f,notes:e.target.value}))}/></div>
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={()=>setShowNewPerson(false)} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">취소</button>
              <button type="submit" disabled={isPending} className="px-4 py-2 text-sm font-semibold rounded-lg disabled:opacity-50" style={{backgroundColor:'#FFCE00',color:'#121212'}}>{isPending?'저장중...':'등록'}</button>
            </div>
          </form>
        </div>
      )}

      {/* ── 모달: 소속 연결/이직 추가 ── */}
      {showAddRel&&(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={()=>setShowAddRel(false)}/>
          <form onSubmit={handleAddRelation} className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-3">
            <h2 className="text-lg font-bold text-gray-900 mb-2">소속 연결 / 이직 추가</h2>
            {!relForm.person_id&&(
              <div><label className={lbl}>담당자 *</label>
                <select className={inp} required value={relForm.person_id||''} onChange={e=>setRelForm(f=>({...f,person_id:e.target.value}))}>
                  <option value="">선택</option>
                  {persons.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            )}
            {!relForm.customer_id&&(
              <div><label className={lbl}>기관 *</label>
                <select className={inp} required value={relForm.customer_id||''} onChange={e=>setRelForm(f=>({...f,customer_id:e.target.value}))}>
                  <option value="">선택</option>
                  {customers.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            )}
            {(relForm.person_id||relForm.customer_id)&&(
              <>
                {!relForm.person_id&&null}
                {!relForm.customer_id&&null}
                <div><label className={lbl}>담당자</label><p className="text-sm font-medium text-gray-700">{relForm.person_id?personMap[relForm.person_id]?.name:'—'}</p></div>
                <div><label className={lbl}>기관</label><p className="text-sm font-medium text-gray-700">{relForm.customer_id?orgMap[relForm.customer_id]?.name:'—'}</p></div>
              </>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div><label className={lbl}>부서</label><input className={inp} value={relForm.dept||''} onChange={e=>setRelForm(f=>({...f,dept:e.target.value}))}/></div>
              <div><label className={lbl}>직함</label><input className={inp} value={relForm.title||''} onChange={e=>setRelForm(f=>({...f,title:e.target.value}))}/></div>
              <div><label className={lbl}>시작일</label><input type="date" className={inp} value={relForm.started_at||''} onChange={e=>setRelForm(f=>({...f,started_at:e.target.value}))}/></div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={()=>setShowAddRel(false)} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">취소</button>
              <button type="submit" disabled={isPending} className="px-4 py-2 text-sm font-semibold rounded-lg disabled:opacity-50" style={{backgroundColor:'#FFCE00',color:'#121212'}}>{isPending?'저장중...':'연결'}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
