'use client'
import { useState, useTransition, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  createCustomer, updateCustomer, deleteCustomer, quickCreateCustomer,
  createPerson, updatePerson, deletePerson,
  addRelation, endRelation, updateRelation, deleteRelation,
} from './actions'
import { getCustomerLogs, createCustomerLog, deleteCustomerLog } from './customer-log-actions'
import { createProfileMap } from '@/lib/utils'
import { getLimitForEntity } from '@/lib/contract-limits'

/* ── 타입 ── */
interface OrgContact {
  id: string; person_id: string; person_name: string
  person_phone: string; person_email: string
  dept: string; title: string; started_at: string; ended_at: string | null; is_current: boolean
}
interface OrgSale { id: string; title: string; amount: number; service_type: string; date: string; client_dept?: string | null; entity_id?: string | null }
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
interface PersonSale { id: string; name: string; revenue: number; contract_stage: string; service_type: string | null }
interface Person {
  id: string; name: string; phone: string; email: string; notes: string
  channeltalk_user_id?: string | null
  job_history: JobHistory[]; leads: PersonLead[]
  sales: PersonSale[]; total_sales: number
}
interface BizEntity { id: string; name: string; short_name: string | null; entity_type: string | null }
interface Props { customers: Customer[]; persons: Person[]; entities?: BizEntity[]; isAdmin: boolean }

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

export default function CustomersClient({ customers, persons, entities = [], isAdmin }: Props) {
  const router = useRouter()
  const [listView,    setListView]    = useState<'org'|'person'>('org')
  const [detailType,  setDetailType]  = useState<'org'|'person'>('org')
  const [detailId,    setDetailId]    = useState<string|null>(null)
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

  const orgMap    = createProfileMap(customers)
  const personMap = createProfileMap(persons)
  const currentOrg    = detailType==='org'    ? orgMap[detailId!]    : null
  const currentPerson = detailType==='person' ? personMap[detailId!] : null

  /* 기관 CRUD — 모달 create는 즉시 close (snappy), 인라인 edit은 await 후 close (stale data 노출 방지). */
  function handleSaveOrg(e: React.FormEvent) {
    e.preventDefault()
    const isInlineEdit = editingInfo && !showNewOrg
    if (isInlineEdit) {
      // 인라인: 기존 동작 유지 (편집 폼이 새 값 계속 보여줌 → 저장 후 close)
      startTransition(async () => {
        const res = await updateCustomer(currentOrg!.id, {
          name: orgForm.name||currentOrg!.name, type: orgForm.type||currentOrg!.type,
          region: orgForm.region||null, phone: orgForm.phone||null,
          notes: orgForm.notes||null,
        })
        if (res?.error) { alert('저장 실패: ' + res.error); return }
        setEditingInfo(false)
        router.refresh()
      })
      return
    }
    // 모달 create: 즉시 close, 실패 시 rollback
    const formSnapshot = orgForm
    setShowNewOrg(false); setOrgForm({})
    startTransition(async () => {
      const fd = new FormData()
      Object.entries(formSnapshot).forEach(([k,v])=>{ if(v) fd.set(k,v) })
      const res = await createCustomer(fd)
      if (res?.error) {
        alert('등록 실패: ' + res.error)
        setOrgForm(formSnapshot); setShowNewOrg(true)
        return
      }
      router.refresh()
    })
  }

  /* 담당자 CRUD */
  function handleSavePerson(e: React.FormEvent) {
    e.preventDefault()
    const isInlineEdit = editingInfo && !showNewPerson
    if (isInlineEdit) {
      startTransition(async () => {
        const res = await updatePerson(currentPerson!.id, {
          name: perForm.name||currentPerson!.name, phone: perForm.phone||null,
          email: perForm.email||null, notes: perForm.notes||null,
        })
        if (res?.error) { alert('저장 실패: ' + res.error); return }
        setEditingInfo(false)
        router.refresh()
      })
      return
    }
    // 모달 create
    const nameToCheck = perForm.name?.trim()
    if (nameToCheck) {
      const dup = persons.find(p => p.name === nameToCheck)
      if (dup && !confirm(`'${nameToCheck}' 이름의 고객이 이미 있어요.\n그래도 등록할까요?`)) return
    }
    const formSnapshot = perForm
    const orgSearchSnapshot = perOrgSearch
    setShowNewPerson(false); setPerOrgSearch('')
    startTransition(async () => {
      const fd = new FormData()
      Object.entries(formSnapshot).forEach(([k,v])=>{ if(v) fd.set(k,v) })
      const res = await createPerson(fd)
      if (res?.error) {
        alert('등록 실패: ' + res.error)
        setPerForm(formSnapshot); setShowNewPerson(true); setPerOrgSearch(orgSearchSnapshot)
        return
      }
      router.refresh()
    })
  }

  /* 소속 관계 추가 */
  function handleAddRelation(e: React.FormEvent) {
    e.preventDefault()
    if (!relForm.customer_id) { alert('기관을 선택해 주세요.'); return }
    if (!relForm.person_id)   { alert('고객을 선택해 주세요.'); return }
    const formSnapshot = relForm
    const orgSearchSnapshot = relOrgSearch
    setShowAddRel(false); setRelForm({}); setRelOrgSearch('')
    startTransition(async () => {
      const res = await addRelation({
        person_id:   formSnapshot.person_id,
        customer_id: formSnapshot.customer_id,
        dept:        formSnapshot.dept || undefined,
        title:       formSnapshot.title || undefined,
        started_at:  formSnapshot.started_at || undefined,
      })
      if (res?.error) {
        alert('연결 실패: ' + res.error)
        setRelForm(formSnapshot); setRelOrgSearch(orgSearchSnapshot); setShowAddRel(true)
        return
      }
      router.refresh()
    })
  }

  function handleSaveRelEdit(relId: string) {
    // 인라인 편집은 await 후 close (stale 노출 방지)
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
    const contentSnapshot = newLogContent.trim()
    const dateSnapshot = newLogDate
    const typeSnapshot = newLogType
    setNewLogContent(''); setNewLogDate(nowDatetime())
    startTransition(async () => {
      const res = await createCustomerLog({
        log_type: typeSnapshot,
        content: contentSnapshot,
        contacted_at: dateSnapshot ? new Date(dateSnapshot).toISOString() : new Date().toISOString(),
        ...(detailType==='org' ? {customer_id:detailId, person_id:null} : {person_id:detailId, customer_id:null}),
      })
      if (res?.error) {
        alert('저장 실패: '+res.error)
        setNewLogContent(contentSnapshot); setNewLogDate(dateSnapshot)
        return
      }
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
    const headers = ['기관명','유형','지역','전화','총매출(원)','계약건수','최근거래일','고객수','메모']
    const rows = customers.map(c=>[c.name,c.type,c.region,c.phone,c.total_sales,c.sales_count,c.last_deal_date||'',c.contacts.length,c.notes])
    downloadCSV(headers, rows, `기관목록_${new Date().toISOString().slice(0,10)}.csv`)
  }
  function handleExportPersons() {
    const headers = ['이름','전화','이메일','현재소속기관','직책','부서','이직횟수','메모']
    const rows = persons.map(p=>{
      const cur=p.job_history.find(j=>j.is_current)
      return [p.name,p.phone,p.email,cur?.customer_name||'',cur?.title||'',cur?.dept||'',p.job_history.length>1?p.job_history.length-1:0,p.notes]
    })
    downloadCSV(headers, rows, `고객목록_${new Date().toISOString().slice(0,10)}.csv`)
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
          {label:'고객 수',  value:`${persons.length}명`,   color:'text-blue-600', bg:'bg-blue-50'},
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

      {/* ── 카드 그리드 (기관 선택 전) ── */}
      {!detailId && listView === 'org' && (
        <div>
          {/* 검색 + 타입 필터 + 추가 버튼 */}
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <input type="text" placeholder="기관명, 지역 검색..." value={orgSearch} onChange={e=>setOrgSearch(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-yellow-300" />
            <div className="flex gap-1.5">
              {['전체','학교','교육청','공공기관','기업','기타'].map(t => {
                const cnt = t === '전체' ? customers.length : customers.filter(c => c.type === t).length
                const active = t === '전체' ? !orgSearch : orgSearch === t
                return (
                  <button key={t}
                    onClick={() => setOrgSearch(t === '전체' ? '' : t)}
                    className="px-2.5 py-1.5 rounded-full text-xs font-medium border transition-all"
                    style={active ? { background: '#121212', color: '#FFCE00', borderColor: '#121212' } : { background: '#fff', color: '#6B7280', borderColor: '#E5E7EB' }}>
                    {t} <span className="opacity-60">({cnt})</span>
                  </button>
                )
              })}
            </div>
            {isAdmin && (
              <button onClick={() => { setOrgForm({}); setShowNewOrg(true) }}
                className="ml-auto px-4 py-2 text-sm font-semibold rounded-lg"
                style={{ backgroundColor: '#FFCE00', color: '#121212' }}>
                + 기관 등록
              </button>
            )}
          </div>
          {/* 탭 전환 */}
          <div className="flex items-center gap-2 mb-4">
            <button onClick={() => setListView('org')}
              className="px-3 py-1.5 text-xs font-medium rounded-full border"
              style={{background:'#121212',color:'#FFCE00',borderColor:'#121212'}}>
              🏛️ 기관 ({customers.length})
            </button>
            <button onClick={() => setListView('person')}
              className="px-3 py-1.5 text-xs font-medium rounded-full border"
              style={{background:'#fff',color:'#6B7280',borderColor:'#E5E7EB'}}>
              👤 고객 ({persons.length})
            </button>
          </div>
          {/* 카드 그리드 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {customers
              .filter(o => !orgSearch || o.name.includes(orgSearch) || o.region.includes(orgSearch) || o.type === orgSearch)
              .map(o => {
                const currentContacts = o.contacts.filter(c => c.is_current)
                return (
                  <div key={o.id} onClick={() => goToOrg(o.id)}
                    className="bg-white rounded-xl p-5 cursor-pointer hover:shadow-md transition-shadow"
                    style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center text-xl flex-shrink-0">🏢</div>
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-gray-900 text-sm truncate">{o.name}</p>
                        <p className="text-xs text-gray-400">{o.type}{o.region ? ` · ${o.region}` : ''}</p>
                      </div>
                    </div>
                    <div className="border-t border-gray-100 pt-3 mb-3">
                      <p className="text-xs text-gray-400 mb-1.5">고객</p>
                      {currentContacts.length === 0 ? (
                        <p className="text-xs text-gray-300">미등록</p>
                      ) : currentContacts.slice(0, 2).map(ct => (
                        <div key={ct.id} className="flex items-center gap-2 text-xs mb-1">
                          <span className="font-semibold text-gray-800">{ct.person_name}</span>
                          {ct.title && <span className="text-gray-400">{ct.title}</span>}
                          {ct.person_phone && <span className="text-gray-500 ml-auto">{ct.person_phone}</span>}
                        </div>
                      ))}
                      {currentContacts.length > 2 && <p className="text-xs text-gray-400">+{currentContacts.length - 2}명 더</p>}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      <span>거래 <strong className="text-gray-800">{o.sales_count}건</strong></span>
                      {o.total_sales > 0 && <span>누적 <strong className="text-green-700">{fmt(o.total_sales)}</strong></span>}
                    </div>
                  </div>
                )
              })}
          </div>
        </div>
      )}

      {/* ── 담당자 탭 (기관 선택 전) ── */}
      {!detailId && listView === 'person' && (
        <div>
          <div className="flex items-center gap-3 mb-4">
            <button onClick={() => setListView('org')}
              className="px-3 py-1.5 text-xs font-medium rounded-full border"
              style={{background:'#fff',color:'#6B7280',borderColor:'#E5E7EB'}}>
              🏛️ 기관 ({customers.length})
            </button>
            <button onClick={() => setListView('person')}
              className="px-3 py-1.5 text-xs font-medium rounded-full border"
              style={{background:'#121212',color:'#FFCE00',borderColor:'#121212'}}>
              👤 고객 ({persons.length})
            </button>
            <input type="text" placeholder="고객 이름 검색..." value={pSearch} onChange={e=>setPSearch(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-52 focus:outline-none focus:ring-2 focus:ring-yellow-300 ml-4" />
            {isAdmin && (
              <button onClick={() => { setPerForm({}); setPerOrgSearch(''); setShowNewPerson(true) }}
                className="ml-auto px-4 py-2 text-sm font-semibold rounded-lg"
                style={{ backgroundColor: '#FFCE00', color: '#121212' }}>
                + 고객 등록
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredPersons.map(p => {
              const cur = p.job_history.find(j => j.is_current)
              return (
                <div key={p.id} onClick={() => goToPerson(p.id)}
                  className="bg-white rounded-xl p-5 cursor-pointer hover:shadow-md transition-shadow"
                  style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0" style={{ background: '#121212', color: '#FFCE00' }}>
                      {p.name[0]}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-gray-900 text-sm">{p.name}</p>
                      <p className="text-xs text-gray-400">{cur?.customer_name || '소속 없음'}{cur?.title ? ` · ${cur.title}` : ''}</p>
                    </div>
                  </div>
                  <div className="text-xs text-gray-500 space-y-1">
                    {p.phone && <p>📞 {p.phone}</p>}
                    {p.email && <p>✉ {p.email}</p>}
                  </div>
                  {p.total_sales > 0 && (
                    <div className="mt-3 pt-2 border-t border-gray-100 text-xs text-gray-500">
                      누적 매출 <strong className="text-green-700">{fmt(p.total_sales)}</strong>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── 상세 뷰 (기관/담당자 선택 후) ── */}
      {detailId && (
        <div>
          <button onClick={() => setDetailId(null)}
            className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-700 mb-4 transition-colors">
            ← 고객 목록
          </button>
          <div className="border border-gray-200 rounded-xl bg-white overflow-hidden" style={{ minHeight: '600px' }}>


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
                      <p className="text-xs text-gray-400">고객 이력 ({o.contacts.length}명)</p>
                      {isAdmin&&<button onClick={()=>{setRelForm({customer_id:o.id});setShowAddRel(true)}} className="text-xs text-gray-400 hover:text-gray-700 border border-gray-200 rounded px-2 py-0.5">+ 고객 연결</button>}
                    </div>
                    {o.contacts.length===0
                      ?<p className="text-xs text-gray-300 italic">연결된 고객이 없어요.</p>
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

                  {/* 부서별 수의계약 한도 현황 */}
                  <DeptLimitSection sales={o.sales} entities={entities} />

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
                      <p className="text-xs text-orange-700 font-semibold mb-1">💡 이 고객을 따라 새 거래처가 열렸어요</p>
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

                  {/* 매출 이력 */}
                  {p.sales.length > 0 && (
                    <div>
                      <p className="text-xs text-gray-400 mb-2">매출 이력 ({p.sales.length}건)</p>
                      {p.sales.map(s => (
                        <div key={s.id} className="flex items-center justify-between border border-gray-100 rounded-lg px-3 py-2 mb-1.5">
                          <div>
                            <p className="text-sm font-medium text-gray-800">{s.name}</p>
                            <p className="text-xs text-gray-400">
                              {s.service_type && <span>{s.service_type} · </span>}
                              <span className={s.contract_stage === '잔금' ? 'text-gray-400' : 'text-green-600'}>{s.contract_stage}</span>
                            </p>
                          </div>
                          <p className="text-sm font-bold text-gray-700 shrink-0">{fmt(s.revenue)}</p>
                        </div>
                      ))}
                      <div className="flex justify-between px-3 py-2 bg-green-50 rounded-lg">
                        <span className="text-xs font-semibold text-green-700">총 매출</span>
                        <span className="text-sm font-bold text-green-700">{p.total_sales.toLocaleString()}원</span>
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
                  {isAdmin&&<button onClick={()=>{if(confirm('이 고객을 삭제할까요?\n소속 관계가 모두 삭제됩니다.'))startTransition(async()=>{const r=await deletePerson(p.id);if(r?.error){alert('삭제 실패: '+r.error);return}setDetailId(null);router.refresh()})}} className="px-3 py-2 text-xs text-red-400 border border-red-100 rounded-lg hover:bg-red-50">삭제</button>}
                  <button onClick={()=>router.push('/leads')} className="flex-1 px-3 py-2 text-sm font-semibold rounded-lg text-center" style={{backgroundColor:'#FFCE00',color:'#121212'}}>이 고객 리드 보기</button>
                </div>
              </>
            )
          })()}
          </div>
        </div>
      )}


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

      {/* ── 모달: 새 고객 ── */}
      {showNewPerson&&(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={()=>setShowNewPerson(false)}/>
          <form onSubmit={handleSavePerson} className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-3">
            <h2 className="text-lg font-bold text-gray-900 mb-2">새 고객 등록</h2>
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
              <div><label className={lbl}>고객 *</label>
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
                <span className="text-xs text-gray-400">고객</span>
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

/* ── 부서별 수의계약 한도 현황 ─────────────────────────── */
function DeptLimitSection({ sales, entities }: { sales: OrgSale[]; entities: BizEntity[] }) {
  const currentYear = new Date().getFullYear()
  // 회계연도(현재 연도) 기준 sales 필터
  const yearSales = sales.filter(s => s.date && new Date(s.date).getFullYear() === currentYear)
  if (yearSales.length === 0 || entities.length === 0) return null

  // 부서×사업자별 누적
  type Cell = { total: number }
  const grid = new Map<string, Map<string, Cell>>()  // dept → entity_id → cell
  const deptsSet = new Set<string>()
  for (const s of yearSales) {
    const dept = s.client_dept ?? '(부서 미지정)'
    const eid = s.entity_id ?? '__unassigned__'
    deptsSet.add(dept)
    if (!grid.has(dept)) grid.set(dept, new Map())
    const row = grid.get(dept)!
    if (!row.has(eid)) row.set(eid, { total: 0 })
    row.get(eid)!.total += s.amount ?? 0
  }
  const depts = Array.from(deptsSet).sort()
  // entity 표시 — entities 등록된 것만
  const entityMap = Object.fromEntries(entities.map(e => [e.id, e]))
  // 표시할 entity 컬럼: 누적이 1원이라도 있는 entity만
  const usedEntityIds = new Set<string>()
  for (const row of grid.values()) for (const eid of row.keys()) if (eid !== '__unassigned__') usedEntityIds.add(eid)
  const displayEntities = entities.filter(e => usedEntityIds.has(e.id))
  if (displayEntities.length === 0) return null

  return (
    <div>
      <p className="text-xs text-gray-400 mb-2">부서별 수의계약 한도 현황 ({currentYear}년)</p>
      <div className="overflow-x-auto rounded-lg border border-gray-100">
        <table className="w-full text-[11px]">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-2 py-1.5 font-semibold text-gray-500">부서</th>
              {displayEntities.map(e => (
                <th key={e.id} className="text-right px-2 py-1.5 font-semibold text-gray-500">
                  {e.short_name || e.name}
                  <span className="block text-[9px] text-gray-400 font-normal">{e.entity_type === '여성기업' ? '여성 5500만' : '일반 2200만'}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {depts.map(dept => {
              const row = grid.get(dept) ?? new Map()
              return (
                <tr key={dept}>
                  <td className="px-2 py-1.5 text-gray-700">{dept}</td>
                  {displayEntities.map(e => {
                    const cell = row.get(e.id)
                    const used = cell?.total ?? 0
                    const limit = getLimitForEntity(e.entity_type)
                    const pct = limit > 0 ? Math.round((used / limit) * 100) : 0
                    const color = pct >= 100 ? 'text-red-600 font-bold' : pct >= 80 ? 'text-orange-500 font-semibold' : pct > 0 ? 'text-gray-700' : 'text-gray-300'
                    return (
                      <td key={e.id} className={`text-right px-2 py-1.5 font-mono ${color}`}>
                        {used > 0 ? `${(used/10000).toFixed(0)}/${(limit/10000).toFixed(0)}만` : '—'}
                        {pct >= 80 && <span className="ml-1">{pct >= 100 ? '⚠️' : '!'}</span>}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="text-[10px] text-gray-400 mt-1.5">한도: 일반 2,200만 / 여성기업 5,500만 (부서당, 회계연도, 부가세 포함)</p>
    </div>
  )
}
