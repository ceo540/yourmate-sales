'use client'
import { useState, useTransition, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  createCustomer, updateCustomer, deleteCustomer, quickCreateCustomer,
  createPerson, updatePerson, deletePerson,
  addRelation, endRelation, updateRelation, deleteRelation,
} from './actions'
import { getCustomerLogs, createCustomerLog, deleteCustomerLog } from './customer-log-actions'

/* ── 타입 ── */
interface OrgContact {
  id: string; person_id: string; person_name: string
  person_phone: string; person_email: string
  dept: string; title: string; started_at: string; ended_at: string | null; is_current: boolean
}
interface OrgSale { id: string; title: string; amount: number; service_type: string; date: string }
interface Customer {
  id: string; name: string; type: string; region: string
  phone: string; notes: string
  total_sales: number; sales_count: number; last_deal_date: string | null
  contacts: OrgContact[]; sales: OrgSale[]
}
interface JobHistory {
  id: string; customer_id: string; customer_name: string
  dept: string; title: string; started_at: string; ended_at: string | null; is_current: boolean
}
interface PersonLead { id: string; lead_id: string; client_org: string | null; service_type: string | null; status: string; inflow_date: string | null; converted_sale_id: string | null }
interface Person {
  id: string; name: string; phone: string; email: string; notes: string
  channeltalk_user_id?: string | null
  job_history: JobHistory[]; leads: PersonLead[]
}
interface Props { customers: Customer[]; persons: Person[]; isAdmin: boolean }

/* ── 디자인 토큰 ── */
const TYPE_COL: Record<string,{bg:string;text:string}> = {
  '학교':{bg:'bg-blue-100',text:'text-blue-700'},'교육청':{bg:'bg-sky-100',text:'text-sky-700'},
  '공공기관':{bg:'bg-green-100',text:'text-green-700'},'기업':{bg:'bg-purple-100',text:'text-purple-700'},
  '개인':{bg:'bg-gray-100',text:'text-gray-600'},'기타':{bg:'bg-gray-100',text:'text-gray-500'},
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
const ORG_TYPES = ['학교','교육청','공공기관','기업','개인','기타']
const LOG_TYPES = ['통화','방문','미팅','이메일','메모','기타']
const LOG_TYPE_COLORS: Record<string,string> = {
  통화:'bg-blue-100 text-blue-700', 방문:'bg-green-100 text-green-700',
  미팅:'bg-purple-100 text-purple-700', 이메일:'bg-yellow-100 text-yellow-700',
  메모:'bg-gray-100 text-gray-600', 기타:'bg-gray-100 text-gray-400',
}
function nowDatetime() {
  const d=new Date(), pad=(n:number)=>String(n).padStart(2,'0')
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
function downloadCSV(headers: string[], rows: (string|number)[][], filename: string) {
  const csv=[headers,...rows].map(r=>r.map(v=>`"${String(v??'').replace(/"/g,'""')}"`).join(',')).join('\n')
  const blob=new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'})
  const url=URL.createObjectURL(blob), a=document.createElement('a')
  a.href=url; a.download=filename; a.click(); URL.revokeObjectURL(url)
}

export default function CustomersClient({ customers, persons, isAdmin }: Props) {
  const router = useRouter()
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
  const [filterMoved, setFilterMoved] = useState(false)
  const [isPending,   startTransition] = useTransition()

  // 폼 상태
  const [orgForm, setOrgForm] = useState<Record<string,string>>({})
  const [perForm, setPerForm] = useState<Record<string,string>>({})
  const [relForm, setRelForm] = useState<Record<string,string>>({})
  const [editingRelId, setEditingRelId] = useState<string | null>(null)
  const [relEditForm, setRelEditForm] = useState({dept:'', title:'', started_at:'', ended_at:''})
  // 기관 검색 (addRel 모달용 / newPerson 모달용)
  const [relOrgSearch, setRelOrgSearch] = useState('')
  const [showRelOrgDrop, setShowRelOrgDrop] = useState(false)
  const [perOrgSearch, setPerOrgSearch] = useState('')
  const [showPerOrgDrop, setShowPerOrgDrop] = useState(false)
  // 활동 로그
  const [activityLogs, setActivityLogs] = useState<any[]>([])
  const [loadingLogs, setLoadingLogs] = useState(false)
  const [newLogContent, setNewLogContent] = useState('')
  const [newLogType, setNewLogType] = useState('통화')
  const [newLogDate, setNewLogDate] = useState(nowDatetime)
  // 채널톡
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<string|null>(null)
  const [ctConversations, setCtConversations] = useState<any[]>([])
  const [loadingConvs, setLoadingConvs] = useState(false)

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
      if (editingInfo && !showNewOrg) {
        // 인라인 수정 모드
        const res = await updateCustomer(currentOrg!.id, {
          name: orgForm.name||currentOrg!.name, type: orgForm.type||currentOrg!.type,
          region: orgForm.region||null, phone: orgForm.phone||null,
          notes: orgForm.notes||null,
        })
        if (res?.error) { alert('저장 실패: ' + res.error); return }
        setEditingInfo(false)
      } else {
        // 새 기관 등록 모달
        const fd = new FormData()
        Object.entries(orgForm).forEach(([k,v])=>{ if(v) fd.set(k,v) })
        const res = await createCustomer(fd)
        if (res?.error) { alert('등록 실패: ' + res.error); return }
        setShowNewOrg(false)
      }
      router.refresh()
    })
  }

  /* 담당자 CRUD */
  function handleSavePerson(e: React.FormEvent) {
    e.preventDefault()
    // 신규 등록 시 이름 중복 체크
    if (!editingInfo || showNewPerson) {
      const nameToCheck = perForm.name?.trim()
      if (nameToCheck) {
        const dup = persons.find(p => p.name === nameToCheck)
        if (dup && !confirm(`'${nameToCheck}' 이름의 담당자가 이미 있어요.\n그래도 등록할까요?`)) return
      }
    }
    startTransition(async () => {
      if (editingInfo && !showNewPerson) {
        // 인라인 수정 모드
        const res = await updatePerson(currentPerson!.id, {
          name: perForm.name||currentPerson!.name, phone: perForm.phone||null,
          email: perForm.email||null, notes: perForm.notes||null,
        })
        if (res?.error) { alert('저장 실패: ' + res.error); return }
        setEditingInfo(false)
      } else {
        // 새 담당자 등록 모달
        const fd = new FormData()
        Object.entries(perForm).forEach(([k,v])=>{ if(v) fd.set(k,v) })
        const res = await createPerson(fd)
        if (res?.error) { alert('등록 실패: ' + res.error); return }
        setShowNewPerson(false); setPerOrgSearch('')
      }
      router.refresh()
    })
  }

  /* 소속 관계 추가 */
  function handleAddRelation(e: React.FormEvent) {
    e.preventDefault()
    if (!relForm.customer_id) { alert('기관을 선택해 주세요.'); return }
    if (!relForm.person_id)   { alert('담당자를 선택해 주세요.'); return }
    startTransition(async () => {
      const res = await addRelation({
        person_id:   relForm.person_id,
        customer_id: relForm.customer_id,
        dept:        relForm.dept || undefined,
        title:       relForm.title || undefined,
        started_at:  relForm.started_at || undefined,
      })
      if (res?.error) { alert('연결 실패: ' + res.error); return }
      setShowAddRel(false); setRelForm({}); setRelOrgSearch('')
      router.refresh()
    })
  }

  function handleSaveRelEdit(relId: string) {
    startTransition(async () => {
      const res = await updateRelation(relId, {
        dept:       relEditForm.dept || null,
        title:      relEditForm.title || null,
        started_at: relEditForm.started_at || null,
        ended_at:   relEditForm.ended_at || null,
      })
      if (res?.error) { alert('저장 실패: ' + res.error); return }
      setEditingRelId(null)
      router.refresh()
    })
  }

  async function handleQuickCreateOrg(name: string, target: 'rel' | 'per') {
    const result = await quickCreateCustomer(name.trim())
    if ('error' in result) { alert('기관 등록 실패: ' + result.error); return }
    if (target === 'rel') {
      setRelForm(f => ({...f, customer_id: result.id}))
      setRelOrgSearch(name.trim())
      setShowRelOrgDrop(false)
    } else {
      setPerForm(f => ({...f, customer_id: result.id}))
      setPerOrgSearch(name.trim())
      setShowPerOrgDrop(false)
    }
  }

  /* 활동 로그 */
  const refreshLogs = useCallback(async (type: 'customer'|'person', id: string) => {
    setLoadingLogs(true)
    const logs = await getCustomerLogs(type, id)
    setActivityLogs(logs)
    setLoadingLogs(false)
  }, [])

  useEffect(() => {
    setCtConversations([])
    if (!detailId) { setActivityLogs([]); return }
    refreshLogs(detailType==='org'?'customer':'person', detailId)
  }, [detailId, detailType, refreshLogs])

  function handleAddLog() {
    if (!newLogContent.trim() || !detailId) return
    startTransition(async () => {
      const res = await createCustomerLog({
        log_type: newLogType,
        content: newLogContent.trim(),
        contacted_at: newLogDate ? new Date(newLogDate).toISOString() : new Date().toISOString(),
        ...(detailType==='org' ? {customer_id:detailId, person_id:null} : {person_id:detailId, customer_id:null}),
      })
      if (res?.error) { alert('저장 실패: '+res.error); return }
      setNewLogContent(''); setNewLogDate(nowDatetime())
      refreshLogs(detailType==='org'?'customer':'person', detailId)
    })
  }

  function handleDeleteLog(logId: string) {
    if (!confirm('이 로그를 삭제할까요?')) return
    startTransition(async () => {
      const res = await deleteCustomerLog(logId)
      if (res?.error) { alert('삭제 실패: '+res.error); return }
      if (detailId) refreshLogs(detailType==='org'?'customer':'person', detailId)
    })
  }

  /* 채널톡 동기화 */
  async function handleSync() {
    if (!confirm('채널톡에서 고객 정보를 가져올까요?\n데이터 양에 따라 시간이 걸릴 수 있어요.')) return
    setSyncing(true); setSyncResult(null)
    try {
      const res = await fetch('/api/channeltalk/import', { method: 'POST' })
      const json = await res.json()
      if (json.error) { setSyncResult(`오류: ${json.error}`); return }
      setSyncResult(`완료 — 신규 ${json.created}명 / 업데이트 ${json.updated}명 / 기관연결 ${json.linked}건 / 건너뜀 ${json.skipped}명`)
      router.refresh()
    } catch (e: any) {
      setSyncResult(`오류: ${e.message}`)
    } finally {
      setSyncing(false)
    }
  }

  async function loadCtConversations(ctUserId: string) {
    setLoadingConvs(true); setCtConversations([])
    try {
      const res = await fetch(`/api/channeltalk/conversations?userId=${encodeURIComponent(ctUserId)}`)
      const json = await res.json()
      setCtConversations(json.conversations ?? [])
    } catch {
      setCtConversations([])
    } finally {
      setLoadingConvs(false)
    }
  }

  /* CSV 내보내기 */
  function handleExportOrgs() {
    const headers = ['기관명','유형','지역','전화','총매출(원)','계약건수','최근거래일','담당자수','메모']
    const rows = customers.map(c=>[c.name,c.type,c.region,c.phone,c.total_sales,c.sales_count,c.last_deal_date||'',c.contacts.length,c.notes])
    downloadCSV(headers, rows, `기관목록_${new Date().toISOString().slice(0,10)}.csv`)
  }
  function handleExportPersons() {
    const headers = ['이름','전화','이메일','현재소속기관','직책','부서','이직횟수','메모']
    const rows = persons.map(p=>{
      const cur=p.job_history.find(j=>j.is_current)
      return [p.name,p.phone,p.email,cur?.customer_name||'',cur?.title||'',cur?.dept||'',p.job_history.length>1?p.job_history.length-1:0,p.notes]
    })
    downloadCSV(headers, rows, `담당자목록_${new Date().toISOString().slice(0,10)}.csv`)
  }

  /* 티어 그룹 */
  const filteredOrgs = customers.filter(o=>!orgSearch||o.name.includes(orgSearch)||o.region.includes(orgSearch))
  const tierGroups = (['vip','regular','new'] as const).map(t=>({
    tier:t, orgs:filteredOrgs.filter(o=>getTier(o)===t)
  })).filter(g=>g.orgs.length>0)

  const filteredPersons = persons
    .filter(p=>!pSearch||p.name.includes(pSearch))
    .filter(p=>!filterMoved||p.job_history.length>1)

  /* 요약 */
  const totalRevenue = customers.reduce((s,c)=>s+c.total_sales,0)
  const vipCnt = customers.filter(c=>getTier(c)==='vip').length

  return (
    <div className="flex flex-col gap-4">
      {/* 요약 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
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

      {/* 채널톡 동기화 */}
      {isAdmin && (
        <div className="flex items-center gap-3 flex-wrap">
          <button onClick={handleSync} disabled={syncing}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-gray-200 hover:border-blue-300 hover:text-blue-600 disabled:opacity-50 flex items-center gap-1.5 bg-white">
            {syncing ? '⏳ 동기화 중...' : '📡 채널톡 동기화'}
          </button>
          {syncResult && <p className="text-xs text-gray-500">{syncResult}</p>}
        </div>
      )}

      {/* 스플릿 뷰 */}
      <div className="flex flex-col md:flex-row gap-4 md:h-[calc(100vh-320px)] md:min-h-[540px]">

        {/* 왼쪽: 목록 — 모바일에서 상세 선택 시 숨김 */}
        <div className={`${detailId ? 'hidden md:flex' : 'flex'} md:w-[44%] flex-col border border-gray-200 rounded-xl bg-white overflow-hidden min-h-[400px] md:min-h-0`}>
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
                  onClick={()=>{ if(listView==='org'){setOrgForm({});setShowNewOrg(true)}else{setPerForm({});setPerOrgSearch('');setShowNewPerson(true)} }}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg shrink-0"
                  style={{backgroundColor:'#FFCE00',color:'#121212'}}>
                  + 추가
                </button>
              )}
            </div>
            <div className="flex items-center justify-between">
              {listView==='person' ? (
                <button onClick={()=>setFilterMoved(f=>!f)}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${filterMoved?'bg-orange-100 text-orange-700 border-orange-200 font-medium':'border-gray-200 text-gray-400 hover:border-gray-300'}`}>
                  이직자만 보기 {filterMoved&&`(${filteredPersons.length}명)`}
                </button>
              ) : <span/>}
              <button onClick={listView==='org'?handleExportOrgs:handleExportPersons}
                className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-0.5">
                ↓ CSV
              </button>
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

        {/* 오른쪽: 상세 — 모바일에서 선택 시만 표시 */}
        <div className={`${detailId ? 'flex' : 'hidden md:flex'} flex-1 flex-col border border-gray-200 rounded-xl bg-white overflow-hidden min-h-[400px] md:min-h-0`}>
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
                  <button onClick={()=>setDetailId(null)} className="md:hidden flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 mb-2">
                    ← 목록으로
                  </button>
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
                        ?<button onClick={()=>{setOrgForm({name:o.name,type:o.type,region:o.region,phone:o.phone,notes:o.notes});setEditingInfo(true)}}
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
                        </div>
                        <div><label className={lbl}>메모</label><textarea className={inp} rows={2} value={orgForm.notes||''} onChange={e=>setOrgForm(f=>({...f,notes:e.target.value}))}/></div>
                      </div>
                    ):(
                      <div className="grid grid-cols-2 gap-y-2 gap-x-4">
                        {[['전화',o.phone||'-'],['지역',o.region||'-'],['최근거래',o.last_deal_date||'-']].map(([k,v])=>(
                          <div key={k as string}>
                            <span className="text-xs text-gray-400">{k}</span>
                            {k==='전화'&&v!=='-'
                              ?<a href={`tel:${v}`} className="block text-sm font-medium text-blue-600 hover:underline">{v as string}</a>
                              :<p className="text-sm font-medium text-gray-800">{v as string}</p>}
                          </div>
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
                      :(()=>{
                        // 부서별 그룹핑 (dept 없으면 '기타' 그룹)
                        const deptGroups: Record<string, OrgContact[]> = {}
                        for (const c of o.contacts) {
                          const key = c.dept || '기타'
                          if (!deptGroups[key]) deptGroups[key] = []
                          deptGroups[key].push(c)
                        }
                        const sortedDepts = Object.keys(deptGroups).sort((a,b)=>{
                          // 현재 재직자 있는 부서 우선, 기타 맨 뒤
                          const aHasCur = deptGroups[a].some(c=>c.is_current)
                          const bHasCur = deptGroups[b].some(c=>c.is_current)
                          if (aHasCur !== bHasCur) return aHasCur ? -1 : 1
                          if (a==='기타') return 1
                          if (b==='기타') return -1
                          return a.localeCompare(b, 'ko')
                        })
                        return sortedDepts.map(dept=>(
                          <div key={dept} className="mb-3">
                            <div className="flex items-center gap-2 mb-1.5">
                              <span className="text-xs font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded">{dept}</span>
                              <span className="text-xs text-gray-300">{deptGroups[dept].length}명</span>
                            </div>
                            {deptGroups[dept].map((c,i)=>{
                              const hasMoved=personMap[c.person_id]?.job_history.length>1
                              const curJob=personMap[c.person_id]?.job_history.find(j=>j.is_current)
                              const movedTo=!c.is_current&&curJob&&curJob.customer_id!==o.id?curJob:null
                              return (
                                <div key={i} className={`flex items-center gap-3 rounded-lg px-3 py-2.5 mb-1.5 border ${c.is_current?'border-green-200 bg-green-50':'border-gray-100 bg-gray-50'}`}>
                                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${c.is_current?'bg-green-200 text-green-700':'bg-gray-200 text-gray-500'}`}>{c.person_name?.[0]}</div>
                                  <div className="flex-1">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <button onClick={()=>c.person_id&&goToPerson(c.person_id)} className="text-sm font-semibold text-blue-600 hover:text-blue-800 underline">{c.person_name}</button>
                                      {c.title&&<span className="text-xs text-gray-400">{c.title}</span>}
                                      {c.is_current?<span className="text-xs px-1.5 py-0.5 bg-green-100 text-green-700 rounded-full">재직중</span>:<span className="text-xs px-1.5 py-0.5 bg-gray-200 text-gray-500 rounded-full">이직</span>}
                                      {hasMoved&&!c.is_current&&<span className="text-xs px-1.5 py-0.5 bg-orange-100 text-orange-600 rounded-full">이직이력</span>}
                                    </div>
                                    <div className="flex items-center gap-2 flex-wrap mt-0.5">
                                      <span className="text-xs text-gray-400">{c.started_at} ~ {c.ended_at||'현재'}</span>
                                      {c.person_phone&&<a href={`tel:${c.person_phone}`} className="text-xs text-blue-500 hover:underline">📞 {c.person_phone}</a>}
                                    </div>
                                    {movedTo&&<p className="text-xs text-blue-500 mt-0.5">현재: {movedTo.customer_name} {movedTo.dept}</p>}
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        ))
                      })()}
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

                  {/* 활동 로그 */}
                  <div>
                    <p className="text-xs text-gray-400 mb-2">활동 로그</p>
                    <div className="bg-gray-50 rounded-lg p-3 mb-3 space-y-2">
                      <div className="flex gap-2">
                        <select value={newLogType} onChange={e=>setNewLogType(e.target.value)} className="text-xs border border-gray-200 rounded px-2 py-1.5 bg-white shrink-0">
                          {LOG_TYPES.map(t=><option key={t}>{t}</option>)}
                        </select>
                        <input type="datetime-local" value={newLogDate} onChange={e=>setNewLogDate(e.target.value)}
                          className="text-xs border border-gray-200 rounded px-2 py-1.5 flex-1 min-w-0" style={{appearance:'auto'} as React.CSSProperties}/>
                      </div>
                      <textarea value={newLogContent} onChange={e=>setNewLogContent(e.target.value)}
                        placeholder="통화 내용, 방문 결과, 미팅 요약..." rows={2}
                        className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 resize-none focus:outline-none focus:ring-1 focus:ring-yellow-300"/>
                      <button onClick={handleAddLog} disabled={!newLogContent.trim()||isPending}
                        className="w-full py-1.5 text-xs font-semibold rounded disabled:opacity-50"
                        style={{backgroundColor:'#FFCE00',color:'#121212'}}>{isPending?'저장중...':'로그 저장'}</button>
                    </div>
                    {loadingLogs ? (
                      <p className="text-xs text-gray-300 text-center py-2">로딩 중...</p>
                    ) : activityLogs.length===0 ? (
                      <p className="text-xs text-gray-300 italic">아직 활동 기록이 없어요.</p>
                    ) : (
                      <div className="space-y-2">
                        {activityLogs.map((log:any)=>(
                          <div key={log.id} className="border border-gray-100 rounded-lg px-3 py-2">
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className={`text-xs px-1.5 py-0.5 rounded-full ${LOG_TYPE_COLORS[log.log_type]||'bg-gray-100 text-gray-500'}`}>{log.log_type}</span>
                                <span className="text-xs text-gray-400">{log.contacted_at?.slice(0,16).replace('T',' ')}</span>
                                {log.author?.name&&<span className="text-xs text-gray-300">· {log.author.name}</span>}
                              </div>
                              {isAdmin&&<button onClick={()=>handleDeleteLog(log.id)} className="text-xs text-red-300 hover:text-red-500 ml-2 shrink-0">삭제</button>}
                            </div>
                            <p className="text-xs text-gray-700 whitespace-pre-wrap">{log.content}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="px-5 py-3 border-t border-gray-100 flex gap-2 shrink-0">
                  {isAdmin&&<button onClick={()=>{if(confirm('이 기관을 삭제할까요?\n소속 관계가 모두 삭제됩니다.'))startTransition(async()=>{const r=await deleteCustomer(o.id);if(r?.error){alert('삭제 실패: '+r.error);return}setDetailId(null);router.refresh()})}} className="px-3 py-2 text-xs text-red-400 border border-red-100 rounded-lg hover:bg-red-50">삭제</button>}
                  <button onClick={()=>router.push(`/leads?new=1&client_org=${encodeURIComponent(o.name)}`)} className="flex-1 px-3 py-2 text-sm font-semibold rounded-lg" style={{backgroundColor:'#FFCE00',color:'#121212'}}>이 기관으로 리드 등록</button>
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
                  <button onClick={()=>setDetailId(null)} className="md:hidden flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 mb-2">
                    ← 목록으로
                  </button>
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
                          <div key={k as string}>
                            <span className="text-xs text-gray-400">{k}</span>
                            {k==='전화'&&v!=='-'
                              ?<a href={`tel:${v}`} className="block text-sm font-medium text-blue-600 hover:underline">{v as string}</a>
                              :<p className="text-sm font-medium text-gray-800">{v as string}</p>}
                          </div>
                        ))}
                        {p.notes&&<div className="col-span-2"><span className="text-xs text-gray-400">메모</span><p className="text-sm text-gray-600 whitespace-pre-wrap">{p.notes}</p></div>}
                      </div>
                    )}
                  </div>

                  {/* 소속 이력 */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs text-gray-400">소속 이력</p>
                    </div>
                    {p.job_history.length===0
                      ?<p className="text-xs text-gray-300 italic">소속 이력이 없어요.</p>
                      :<div className="relative pl-5">
                        <div className="absolute left-1.5 top-2 bottom-2 w-px bg-gray-200"/>
                        {[...p.job_history].reverse().map((j,i)=>(
                          <div key={i} className="relative flex gap-3 mb-3">
                            <div className={`absolute -left-[13px] top-1.5 w-3 h-3 rounded-full border-2 border-white shadow-sm ${j.is_current?'bg-green-400':'bg-gray-300'}`}/>
                            <div className="flex-1 bg-gray-50 rounded-lg p-2.5">
                              {editingRelId===j.id ? (
                                <div className="space-y-2">
                                  <p className="text-xs font-semibold text-gray-700">{j.customer_name}</p>
                                  <div className="grid grid-cols-2 gap-2">
                                    <div>
                                      <label className={lbl}>부서</label>
                                      <input className={inp} placeholder="예: 지역교육과" value={relEditForm.dept} onChange={e=>setRelEditForm(f=>({...f,dept:e.target.value}))}/>
                                    </div>
                                    <div>
                                      <label className={lbl}>직책</label>
                                      <input className={inp} list="title-options" placeholder="예: 장학사" value={relEditForm.title} onChange={e=>setRelEditForm(f=>({...f,title:e.target.value}))}/>
                                      <datalist id="title-options">
                                        {['장학사','교사','주무관','주사','팀장','과장','부장','대리','사원','담당자','기타'].map(t=><option key={t} value={t}/>)}
                                      </datalist>
                                    </div>
                                    <div>
                                      <label className={lbl}>시작일</label>
                                      <input type="date" className={inp} value={relEditForm.started_at} onChange={e=>setRelEditForm(f=>({...f,started_at:e.target.value}))} style={{appearance:'auto'} as React.CSSProperties}/>
                                    </div>
                                    <div>
                                      <label className={lbl}>종료일</label>
                                      <input type="date" className={inp} value={relEditForm.ended_at} onChange={e=>setRelEditForm(f=>({...f,ended_at:e.target.value}))} style={{appearance:'auto'} as React.CSSProperties}/>
                                    </div>
                                  </div>
                                  <div className="flex gap-1.5 pt-1">
                                    <button disabled={isPending} onClick={()=>handleSaveRelEdit(j.id)} className="px-3 py-1 text-xs font-semibold rounded disabled:opacity-50" style={{backgroundColor:'#FFCE00',color:'#121212'}}>{isPending?'저장중...':'저장'}</button>
                                    <button onClick={()=>setEditingRelId(null)} className="px-3 py-1 text-xs border border-gray-200 rounded hover:bg-white">취소</button>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  <div className="flex items-center justify-between">
                                    <button onClick={()=>j.customer_id&&goToOrg(j.customer_id)} className="text-sm font-semibold text-blue-600 hover:text-blue-800 underline">{j.customer_name}</button>
                                    <div className="flex items-center gap-1.5">
                                      {j.is_current&&<span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">현재</span>}
                                      {isAdmin&&<button onClick={()=>{setEditingRelId(j.id);setRelEditForm({dept:j.dept||'',title:j.title||'',started_at:j.started_at||'',ended_at:j.ended_at||''})}} className="text-xs text-gray-400 hover:text-gray-700 border border-gray-200 rounded px-1.5 py-0.5">수정</button>}
                                      {isAdmin&&<button onClick={()=>{if(confirm('이 소속 이력을 삭제할까요?'))startTransition(async()=>{const r=await deleteRelation(j.id);if(r?.error){alert('삭제 실패: '+r.error);return}router.refresh()})}} className="text-xs text-red-400 hover:text-red-600 border border-red-100 rounded px-1.5 py-0.5">삭제</button>}
                                    </div>
                                  </div>
                                  {(j.dept||j.title)
                                    ?<p className="text-xs text-gray-500 mt-0.5">{[j.dept,j.title].filter(Boolean).join(' · ')}</p>
                                    :<p className="text-xs text-gray-300 italic mt-0.5">부서·직책 미입력</p>}
                                  <p className="text-xs text-gray-400">{j.started_at||'?'} ~ {j.ended_at||'현재'}</p>
                                </>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>}
                    {isAdmin&&(
                      <button onClick={()=>{setRelForm({person_id:p.id});setShowAddRel(true)}} className="mt-2 w-full py-2 text-sm font-medium border-2 border-dashed border-gray-200 rounded-lg text-gray-400 hover:border-yellow-300 hover:text-yellow-600 transition-colors">
                        + 소속 / 이직 추가
                      </button>
                    )}
                  </div>

                  {/* 리드 & 계약 이력 */}
                  <div>
                    <p className="text-xs text-gray-400 mb-2">리드 & 계약 이력 ({p.leads.length}건)</p>
                    {p.leads.length === 0 ? (
                      <p className="text-xs text-gray-300 italic">아직 연결된 리드가 없어요.</p>
                    ) : (
                      <div className="space-y-1.5">
                        {p.leads.map((l) => (
                          <a key={l.id} href={`/leads`}
                            className="flex items-center justify-between border border-gray-100 rounded-xl px-3 py-2 hover:border-yellow-300 hover:bg-yellow-50 transition-colors group">
                            <div className="min-w-0">
                              <p className="text-xs font-medium text-gray-700 group-hover:text-yellow-800 truncate">{l.client_org || '기관 미입력'}</p>
                              <p className="text-[11px] text-gray-400">{l.inflow_date} · {l.service_type || '서비스 미지정'}</p>
                            </div>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ml-2 shrink-0 ${
                              l.status === '계약' ? 'bg-teal-100 text-teal-700' :
                              l.status === '취소' ? 'bg-red-100 text-red-400' :
                              l.status === '진행중' ? 'bg-green-100 text-green-700' :
                              'bg-blue-100 text-blue-700'
                            }`}>{l.status}</span>
                          </a>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* 활동 로그 */}
                  <div>
                    <p className="text-xs text-gray-400 mb-2">활동 로그</p>
                    <div className="bg-gray-50 rounded-lg p-3 mb-3 space-y-2">
                      <div className="flex gap-2">
                        <select value={newLogType} onChange={e=>setNewLogType(e.target.value)} className="text-xs border border-gray-200 rounded px-2 py-1.5 bg-white shrink-0">
                          {LOG_TYPES.map(t=><option key={t}>{t}</option>)}
                        </select>
                        <input type="datetime-local" value={newLogDate} onChange={e=>setNewLogDate(e.target.value)}
                          className="text-xs border border-gray-200 rounded px-2 py-1.5 flex-1 min-w-0" style={{appearance:'auto'} as React.CSSProperties}/>
                      </div>
                      <textarea value={newLogContent} onChange={e=>setNewLogContent(e.target.value)}
                        placeholder="통화 내용, 방문 결과, 미팅 요약..." rows={2}
                        className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 resize-none focus:outline-none focus:ring-1 focus:ring-yellow-300"/>
                      <button onClick={handleAddLog} disabled={!newLogContent.trim()||isPending}
                        className="w-full py-1.5 text-xs font-semibold rounded disabled:opacity-50"
                        style={{backgroundColor:'#FFCE00',color:'#121212'}}>{isPending?'저장중...':'로그 저장'}</button>
                    </div>
                    {loadingLogs ? (
                      <p className="text-xs text-gray-300 text-center py-2">로딩 중...</p>
                    ) : activityLogs.length===0 ? (
                      <p className="text-xs text-gray-300 italic">아직 활동 기록이 없어요.</p>
                    ) : (
                      <div className="space-y-2">
                        {activityLogs.map((log:any)=>(
                          <div key={log.id} className="border border-gray-100 rounded-lg px-3 py-2">
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className={`text-xs px-1.5 py-0.5 rounded-full ${LOG_TYPE_COLORS[log.log_type]||'bg-gray-100 text-gray-500'}`}>{log.log_type}</span>
                                <span className="text-xs text-gray-400">{log.contacted_at?.slice(0,16).replace('T',' ')}</span>
                                {log.author?.name&&<span className="text-xs text-gray-300">· {log.author.name}</span>}
                              </div>
                              {isAdmin&&<button onClick={()=>handleDeleteLog(log.id)} className="text-xs text-red-300 hover:text-red-500 ml-2 shrink-0">삭제</button>}
                            </div>
                            <p className="text-xs text-gray-700 whitespace-pre-wrap">{log.content}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* 채널톡 대화 이력 */}
                  {p.channeltalk_user_id && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs text-gray-400">채널톡 대화 이력</p>
                        <button onClick={()=>loadCtConversations(p.channeltalk_user_id!)}
                          disabled={loadingConvs}
                          className="text-xs text-blue-500 hover:text-blue-700 border border-blue-100 rounded px-2 py-0.5 disabled:opacity-50">
                          {loadingConvs ? '불러오는 중...' : '불러오기'}
                        </button>
                      </div>
                      {loadingConvs ? (
                        <p className="text-xs text-gray-300 text-center py-2">로딩 중...</p>
                      ) : ctConversations.length === 0 ? (
                        <p className="text-xs text-gray-300 italic">버튼을 눌러 채팅 내역을 불러오세요.</p>
                      ) : (
                        <div className="space-y-3">
                          {ctConversations.map((conv: any) => (
                            <div key={conv.id} className="border border-blue-100 rounded-lg p-3 bg-blue-50/30">
                              <div className="flex items-center justify-between mb-2">
                                <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${conv.state==='opened'?'bg-green-100 text-green-700':'bg-gray-100 text-gray-500'}`}>
                                  {conv.state==='opened'?'진행중':'종료'}
                                </span>
                                <span className="text-xs text-gray-400">{conv.createdAt?.slice(0,10)}</span>
                              </div>
                              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                                {conv.messages.length === 0
                                  ? <p className="text-xs text-gray-300 italic">메시지 없음</p>
                                  : conv.messages.map((m: any) => (
                                  <div key={m.id} className={`flex ${m.personType==='user'?'justify-start':'justify-end'}`}>
                                    <div className={`text-xs px-2.5 py-1.5 rounded-xl max-w-[80%] leading-relaxed ${m.personType==='user'?'bg-white border border-gray-200 text-gray-700':'bg-blue-500 text-white'}`}>
                                      {m.text}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="px-5 py-3 border-t border-gray-100 flex gap-2 shrink-0">
                  {isAdmin&&<button onClick={()=>{if(confirm('이 담당자를 삭제할까요?\n소속 관계가 모두 삭제됩니다.'))startTransition(async()=>{const r=await deletePerson(p.id);if(r?.error){alert('삭제 실패: '+r.error);return}setDetailId(null);router.refresh()})}} className="px-3 py-2 text-xs text-red-400 border border-red-100 rounded-lg hover:bg-red-50">삭제</button>}
                  <button onClick={()=>router.push('/leads')} className="flex-1 px-3 py-2 text-sm font-semibold rounded-lg text-center" style={{backgroundColor:'#FFCE00',color:'#121212'}}>이 담당자 리드 보기</button>
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
              <div>
                <label className={lbl}>직책</label>
                <input className={inp} list="per-title-options" placeholder="예: 장학사" value={perForm.title||''} onChange={e=>setPerForm(f=>({...f,title:e.target.value}))}/>
                <datalist id="per-title-options">
                  {['장학사','교사','주무관','주사','팀장','과장','부장','대리','사원','담당자','기타'].map(t=><option key={t} value={t}/>)}
                </datalist>
              </div>
              <div><label className={lbl}>휴대폰</label><input className={inp} value={perForm.phone||''} onChange={e=>setPerForm(f=>({...f,phone:e.target.value}))}/></div>
              <div><label className={lbl}>이메일</label><input className={inp} value={perForm.email||''} onChange={e=>setPerForm(f=>({...f,email:e.target.value}))}/></div>
            </div>
            <div>
              <label className={lbl}>소속 기관 (선택)</label>
              {!perForm.customer_id ? (
                <div className="relative">
                  <input
                    className={inp}
                    placeholder="기관명 검색 또는 직접 입력..."
                    value={perOrgSearch}
                    onChange={e=>{setPerOrgSearch(e.target.value);setShowPerOrgDrop(true)}}
                    onFocus={()=>setShowPerOrgDrop(true)}
                    onBlur={()=>setTimeout(()=>setShowPerOrgDrop(false),150)}
                    autoComplete="off"
                  />
                  {showPerOrgDrop&&(
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {customers.filter(c=>!perOrgSearch||c.name.toLowerCase().includes(perOrgSearch.toLowerCase())).slice(0,8).map(c=>(
                        <button key={c.id} type="button" onMouseDown={()=>{setPerForm(f=>({...f,customer_id:c.id}));setPerOrgSearch(c.name);setShowPerOrgDrop(false)}}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-yellow-50 hover:text-yellow-800">
                          {c.name}
                        </button>
                      ))}
                      {perOrgSearch.trim()&&!customers.find(c=>c.name.toLowerCase()===perOrgSearch.toLowerCase())&&(
                        <button type="button" onMouseDown={()=>handleQuickCreateOrg(perOrgSearch,'per')}
                          className="w-full text-left px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 border-t border-gray-100 font-medium">
                          + &ldquo;{perOrgSearch}&rdquo; 새 기관으로 등록
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-between bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
                  <div>
                    <span className="text-xs text-blue-400">선택된 기관</span>
                    <p className="text-sm font-semibold text-blue-800">{customers.find(c=>c.id===perForm.customer_id)?.name||perOrgSearch}</p>
                  </div>
                  <button type="button" onClick={()=>{setPerForm(f=>({...f,customer_id:''}));setPerOrgSearch('')}} className="text-xs text-blue-400 hover:text-blue-600">변경</button>
                </div>
              )}
            </div>
            {perForm.customer_id&&(
              <div className="grid grid-cols-2 gap-3">
                <div><label className={lbl}>부서</label><input className={inp} placeholder="예: 지역교육과" value={perForm.dept||''} onChange={e=>setPerForm(f=>({...f,dept:e.target.value}))}/></div>
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
            {!relForm.customer_id ? (
              <div>
                <label className={lbl}>기관 *</label>
                <div className="relative">
                  <input
                    className={inp}
                    placeholder="기관명 검색 또는 직접 입력..."
                    value={relOrgSearch}
                    onChange={e=>{setRelOrgSearch(e.target.value);setShowRelOrgDrop(true)}}
                    onFocus={()=>setShowRelOrgDrop(true)}
                    onBlur={()=>setTimeout(()=>setShowRelOrgDrop(false),150)}
                    autoComplete="off"
                  />
                  {showRelOrgDrop&&(
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-52 overflow-y-auto">
                      {customers.filter(c=>!relOrgSearch||c.name.toLowerCase().includes(relOrgSearch.toLowerCase())).slice(0,8).map(c=>(
                        <button key={c.id} type="button" onMouseDown={()=>{setRelForm(f=>({...f,customer_id:c.id}));setRelOrgSearch(c.name);setShowRelOrgDrop(false)}}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-yellow-50 hover:text-yellow-800">
                          {c.name}
                        </button>
                      ))}
                      {relOrgSearch.trim()&&!customers.find(c=>c.name.toLowerCase()===relOrgSearch.toLowerCase())&&(
                        <button type="button" onMouseDown={()=>handleQuickCreateOrg(relOrgSearch,'rel')}
                          className="w-full text-left px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 border-t border-gray-100 font-medium">
                          + &ldquo;{relOrgSearch}&rdquo; 새 기관으로 등록
                        </button>
                      )}
                      {!relOrgSearch&&customers.length===0&&(
                        <p className="px-3 py-2 text-xs text-gray-400">등록된 기관이 없어요</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
                <div>
                  <span className="text-xs text-blue-400">기관</span>
                  <p className="text-sm font-semibold text-blue-800">{orgMap[relForm.customer_id]?.name || relOrgSearch}</p>
                </div>
                <button type="button" onClick={()=>{setRelForm(f=>({...f,customer_id:''}));setRelOrgSearch('')}} className="text-xs text-blue-400 hover:text-blue-600">변경</button>
              </div>
            )}
            {relForm.person_id&&(
              <div className="bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">
                <span className="text-xs text-gray-400">담당자</span>
                <p className="text-sm font-semibold text-gray-800">{personMap[relForm.person_id]?.name}</p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div><label className={lbl}>부서</label><input className={inp} placeholder="예: 지역교육과" value={relForm.dept||''} onChange={e=>setRelForm(f=>({...f,dept:e.target.value}))}/></div>
              <div>
                <label className={lbl}>직책</label>
                <input className={inp} list="rel-title-options" placeholder="예: 장학사" value={relForm.title||''} onChange={e=>setRelForm(f=>({...f,title:e.target.value}))}/>
                <datalist id="rel-title-options">
                  {['장학사','교사','주무관','주사','팀장','과장','부장','대리','사원','담당자','기타'].map(t=><option key={t} value={t}/>)}
                </datalist>
              </div>
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
