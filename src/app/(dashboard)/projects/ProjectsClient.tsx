'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { assignProjectNumbers, createProjectStandalone } from './project-list-actions'
import { quickCreateCustomerWithContact } from '../customers/actions'
import { DEPT_SERVICE_GROUPS } from '@/types'

const SVC_COLOR: Record<string, string> = {
  'SOS': '#7C3AED', '교육프로그램': '#2563EB', '납품설치': '#2563EB',
  '교구대여': '#D97706', '제작인쇄': '#EC4899', '콘텐츠제작': '#EC4899',
  '행사운영': '#F97316', '행사대여': '#F59E0B', '유지보수': '#0891B2',
  '002ENT': '#EF4444', '프로젝트': '#6B7280',
}
const STAGE_CLR: Record<string, string> = {
  '계약': 'bg-blue-50 text-blue-600', '착수': 'bg-purple-50 text-purple-600',
  '선금': 'bg-yellow-50 text-yellow-700', '중도금': 'bg-orange-50 text-orange-600',
  '완수': 'bg-teal-50 text-teal-600', '계산서발행': 'bg-indigo-50 text-indigo-600',
  '잔금': 'bg-green-50 text-green-600',
}
const STATUS_CLR: Record<string, string> = {
  '진행중': 'bg-blue-100 text-blue-700',
  '완료':   'bg-green-100 text-green-700',
  '보류':   'bg-red-100 text-red-600',
  '취소':   'bg-gray-100 text-gray-500',
}
function fmtMoney(n: number | null) {
  if (!n) return '—'
  if (n >= 100000000) return `${(n / 100000000).toFixed(1)}억`
  if (n >= 10000) return `${Math.round(n / 10000)}만`
  return n.toLocaleString()
}

function SortableTh({ label, keyName, sortKey, sortDir, onClick, align }: {
  label: string
  keyName: SortKey
  sortKey: SortKey
  sortDir: SortDir
  onClick: (key: SortKey) => void
  align?: 'left' | 'right'
}) {
  const active = sortKey === keyName
  const arrow = !active ? '' : sortDir === 'asc' ? ' ↑' : ' ↓'
  return (
    <th
      onClick={() => onClick(keyName)}
      className={`px-3 py-2.5 text-${align ?? 'left'} text-xs font-semibold cursor-pointer select-none hover:bg-gray-100 ${active ? 'text-gray-900' : 'text-gray-500'}`}
      title={`${label} 기준 정렬`}
    >
      {label}<span className="text-yellow-600">{arrow}</span>
    </th>
  )
}

interface Project {
  id: string
  name: string
  project_number: string | null
  service_type: string | null
  status: string
  customer_name: string | null
  pm_name: string | null
  revenue: number | null
  contract_stage: string | null
  inflow_date: string | null
  // 운영 분류 (Phase 5 가시성)
  main_type: string | null
  expansion_tags: string[]
}

const MAIN_TYPE_BADGE: Record<string, string> = {
  '학교공연형':   'bg-purple-50 text-purple-700 border-purple-200',
  '교육운영형':   'bg-emerald-50 text-emerald-700 border-emerald-200',
  '복합행사형':   'bg-amber-50 text-amber-700 border-amber-200',
  '렌탈·납품형':  'bg-blue-50 text-blue-700 border-blue-200',
  '콘텐츠제작형': 'bg-pink-50 text-pink-700 border-pink-200',
}
const MAIN_TYPES_FILTER = ['전체', '학교공연형', '교육운영형', '복합행사형', '렌탈·납품형', '콘텐츠제작형']

interface SimpleOption { id: string; name: string }

type SortKey = 'project_number' | 'name' | 'customer_name' | 'service_type' | 'main_type' | 'status' | 'contract_stage' | 'pm_name' | 'revenue' | 'inflow_date'
type SortDir = 'asc' | 'desc'

export default function ProjectsClient({ projects, isAdmin, profiles, customers }: {
  projects: Project[]
  isAdmin: boolean
  profiles: SimpleOption[]
  customers: SimpleOption[]
}) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('전체')
  const [svcFilter, setSvcFilter] = useState('전체')
  const [pmFilter, setPmFilter] = useState('전체')   // 담당자 필터
  const [mainTypeFilter, setMainTypeFilter] = useState('전체')  // 운영 분류 (Phase 5)
  const [sortKey, setSortKey] = useState<SortKey>('project_number')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      // 텍스트는 asc(가나다·번호 작은→큰), 숫자/날짜는 desc(최신·큰값 우선)가 자연스러움
      setSortDir(['revenue', 'inflow_date'].includes(key) ? 'desc' : 'asc')
    }
  }

  function compare(a: Project, b: Project): number {
    const av = (a as any)[sortKey]
    const bv = (b as any)[sortKey]
    // null은 항상 마지막
    if (av == null && bv == null) return 0
    if (av == null) return 1
    if (bv == null) return -1
    let cmp: number
    if (typeof av === 'number' && typeof bv === 'number') cmp = av - bv
    else cmp = String(av).localeCompare(String(bv), 'ko')
    return sortDir === 'asc' ? cmp : -cmp
  }
  const [assignPending, startAssign] = useTransition()
  const [createPending, startCreate] = useTransition()
  const [assignMsg, setAssignMsg] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [createForm, setCreateForm] = useState({
    name: '', service_type: '', customer_id: '', pm_id: '',
  })
  // 생성 결과 모달용 (리드 전환과 동일 패턴)
  const [createResult, setCreateResult] = useState<{
    id: string; project_number: string
    dropbox_url: string | null; dropbox_error?: string
  } | null>(null)
  // 고객사 추가 모드 상태 (select에서 "+ 새 고객사" 선택 시 활성화)
  const [newCustomer, setNewCustomer] = useState({
    name: '', contact_name: '', contact_dept: '', contact_title: '',
    contact_phone: '', contact_email: '',
  })
  const [localCustomers, setLocalCustomers] = useState(customers)
  const isAddingCustomer = createForm.customer_id === '__NEW__'

  function resetCreate() {
    setCreateOpen(false)
    setCreateResult(null)
    setCreateForm({ name: '', service_type: '', customer_id: '', pm_id: '' })
    setNewCustomer({ name: '', contact_name: '', contact_dept: '', contact_title: '', contact_phone: '', contact_email: '' })
  }

  // 모든 서비스 타입 (DEPT_SERVICE_GROUPS 평탄화)
  const allServiceTypes = Array.from(new Set(DEPT_SERVICE_GROUPS.flatMap(g => g.services)))

  const svcTypes = ['전체', ...Array.from(new Set(projects.map(p => p.service_type).filter(Boolean) as string[]))]

  const filtered = projects.filter(p => {
    if (statusFilter !== '전체' && p.status !== statusFilter) return false
    if (svcFilter !== '전체' && p.service_type !== svcFilter) return false
    if (mainTypeFilter !== '전체') {
      if (mainTypeFilter === '미설정') { if (p.main_type) return false }
      else if (p.main_type !== mainTypeFilter) return false
    }
    if (pmFilter !== '전체') {
      if (pmFilter === '미지정') { if (p.pm_name) return false }
      else if (p.pm_name !== pmFilter) return false
    }
    if (search) {
      const q = search.toLowerCase()
      return (
        p.name.toLowerCase().includes(q) ||
        (p.project_number ?? '').toLowerCase().includes(q) ||
        (p.customer_name ?? '').toLowerCase().includes(q) ||
        (p.service_type ?? '').toLowerCase().includes(q) ||
        (p.main_type ?? '').toLowerCase().includes(q) ||
        (p.expansion_tags ?? []).some(t => t.toLowerCase().includes(q)) ||
        (p.pm_name ?? '').toLowerCase().includes(q)
      )
    }
    return true
  }).slice().sort(compare)

  // 담당자 필터 옵션 (실제 데이터 기준 + 미지정)
  const pmOptions = ['전체', '미지정', ...Array.from(new Set(projects.map(p => p.pm_name).filter(Boolean) as string[]))]

  return (
    <div>
      {/* 새 프로젝트 추가 버튼 + 폼 */}
      <div className="mb-4">
        <button onClick={() => setCreateOpen(true)}
          className="text-sm font-semibold px-4 py-2 rounded-lg hover:opacity-80"
          style={{ backgroundColor: '#FFCE00', color: '#121212' }}>
          + 새 프로젝트
        </button>
      </div>

      {/* 새 프로젝트 모달 */}
      {createOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4" onClick={() => !createPending && !createResult && resetCreate()}>
          <div onClick={e => e.stopPropagation()} className="bg-white rounded-2xl shadow-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto">
            {!createResult ? (
          <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-5 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-yellow-800">새 프로젝트 만들기</p>
              <button onClick={resetCreate} className="text-gray-400 hover:text-gray-700 text-lg leading-none">×</button>
            </div>
            <input autoFocus value={createForm.name} onChange={e => setCreateForm(f => ({...f, name: e.target.value}))}
              placeholder="프로젝트명 *"
              className="w-full text-sm border border-yellow-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:border-yellow-400" />
            <div className="grid grid-cols-3 gap-2">
              <select value={createForm.service_type} onChange={e => setCreateForm(f => ({...f, service_type: e.target.value}))}
                className="text-sm border border-yellow-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:border-yellow-400">
                <option value="">서비스 *</option>
                {allServiceTypes.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <select value={createForm.customer_id} onChange={e => setCreateForm(f => ({...f, customer_id: e.target.value}))}
                className="text-sm border border-yellow-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:border-yellow-400">
                <option value="">고객사 (선택)</option>
                {localCustomers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                <option value="__NEW__">+ 새 고객사 추가</option>
              </select>
              <select value={createForm.pm_id} onChange={e => setCreateForm(f => ({...f, pm_id: e.target.value}))}
                className="text-sm border border-yellow-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:border-yellow-400">
                <option value="">PM (선택)</option>
                {profiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            {isAddingCustomer && (
              <div className="border border-yellow-300 rounded-lg p-3 space-y-2 bg-white">
                <input value={newCustomer.name} onChange={e => setNewCustomer(c => ({...c, name: e.target.value}))}
                  placeholder="새 고객사 이름 *"
                  className="w-full text-sm border border-yellow-200 rounded-lg px-3 py-2 focus:outline-none focus:border-yellow-500" />
                <div className="grid grid-cols-3 gap-2">
                  <input value={newCustomer.contact_name} onChange={e => setNewCustomer(c => ({...c, contact_name: e.target.value}))}
                    placeholder="담당자 이름"
                    className="text-sm border border-yellow-200 rounded-lg px-3 py-2 focus:outline-none focus:border-yellow-500" />
                  <input value={newCustomer.contact_dept} onChange={e => setNewCustomer(c => ({...c, contact_dept: e.target.value}))}
                    placeholder="부서 (수의계약 한도용)"
                    className="text-sm border border-yellow-200 rounded-lg px-3 py-2 focus:outline-none focus:border-yellow-500" />
                  <input value={newCustomer.contact_title} onChange={e => setNewCustomer(c => ({...c, contact_title: e.target.value}))}
                    placeholder="직급"
                    className="text-sm border border-yellow-200 rounded-lg px-3 py-2 focus:outline-none focus:border-yellow-500" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input value={newCustomer.contact_phone} onChange={e => setNewCustomer(c => ({...c, contact_phone: e.target.value}))}
                    placeholder="연락처"
                    className="text-sm border border-yellow-200 rounded-lg px-3 py-2 focus:outline-none focus:border-yellow-500" />
                  <input value={newCustomer.contact_email} onChange={e => setNewCustomer(c => ({...c, contact_email: e.target.value}))}
                    placeholder="이메일"
                    className="text-sm border border-yellow-200 rounded-lg px-3 py-2 focus:outline-none focus:border-yellow-500" />
                </div>
                <p className="text-[11px] text-gray-500">고객사명 외 필드는 모두 선택. 담당자 이름이 있으면 담당자 DB(부서/직급 포함)에도 등록됩니다.</p>
                <div className="flex gap-2">
                  <button onClick={async () => {
                    if (!newCustomer.name.trim()) return
                    const res = await quickCreateCustomerWithContact({
                      name: newCustomer.name.trim(),
                      contact: newCustomer.contact_name.trim() ? {
                        name: newCustomer.contact_name.trim(),
                        dept: newCustomer.contact_dept.trim() || undefined,
                        title: newCustomer.contact_title.trim() || undefined,
                        phone: newCustomer.contact_phone.trim() || undefined,
                        email: newCustomer.contact_email.trim() || undefined,
                      } : null,
                    })
                    if ('customer_id' in res) {
                      setLocalCustomers(prev => [...prev, { id: res.customer_id, name: newCustomer.name.trim() }])
                      setCreateForm(f => ({ ...f, customer_id: res.customer_id }))
                      setNewCustomer({ name: '', contact_name: '', contact_dept: '', contact_title: '', contact_phone: '', contact_email: '' })
                    }
                  }}
                    disabled={!newCustomer.name.trim()}
                    className="px-3 py-2 text-xs font-semibold rounded-lg hover:opacity-80 disabled:opacity-40"
                    style={{ backgroundColor: '#FFCE00', color: '#121212' }}>
                    고객사 추가
                  </button>
                  <button onClick={() => {
                    setCreateForm(f => ({ ...f, customer_id: '' }))
                    setNewCustomer({ name: '', contact_name: '', contact_dept: '', contact_title: '', contact_phone: '', contact_email: '' })
                  }} className="px-3 py-2 text-xs border border-gray-200 rounded-lg text-gray-500">
                    취소
                  </button>
                </div>
              </div>
            )}
            <p className="text-[11px] text-gray-500">생성 후 프로젝트 페이지로 이동합니다. 매출(계약)은 들어가서 [+ 새 매출]로 추가하세요.</p>
            <div className="flex gap-2">
              <button onClick={() => startCreate(async () => {
                if (!createForm.name.trim()) return
                // __NEW__ 상태면 customer_id 비활성 (사용자가 새 고객사를 추가하지 않은 채 생성한 경우)
                const customerId = createForm.customer_id === '__NEW__' ? null : (createForm.customer_id || null)
                const res = await createProjectStandalone({
                  name: createForm.name.trim(),
                  service_type: createForm.service_type || null,
                  customer_id: customerId,
                  pm_id: createForm.pm_id || null,
                })
                if (res.id && res.project_number !== undefined) {
                  setCreateResult({
                    id: res.id,
                    project_number: res.project_number,
                    dropbox_url: res.dropbox_url ?? null,
                    dropbox_error: res.dropbox_error,
                  })
                }
              })}
                disabled={!createForm.name.trim() || !createForm.service_type || createPending || isAddingCustomer}
                className="px-4 py-2 text-sm font-semibold rounded-lg hover:opacity-80 disabled:opacity-40"
                style={{ backgroundColor: '#FFCE00', color: '#121212' }}>
                {createPending ? '생성 중...' : '생성'}
              </button>
              <button onClick={resetCreate} disabled={createPending}
                className="px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-500 disabled:opacity-40">취소</button>
            </div>
          </div>
            ) : (
              <div className="p-6 space-y-4">
                <div className="text-center">
                  <div className="text-4xl mb-2">✨</div>
                  <p className="text-base font-semibold text-gray-900">프로젝트 생성 완료</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">프로젝트 번호</span>
                    <span className="font-bold text-gray-900">{createResult.project_number}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">건명</span>
                    <span className="text-gray-800 truncate ml-2 max-w-[60%]">{createForm.name}</span>
                  </div>
                  <div className="flex items-start justify-between">
                    <span className="text-gray-500 flex-shrink-0">드롭박스</span>
                    <span className="text-right ml-2">
                      {createResult.dropbox_url ? (
                        <a href={createResult.dropbox_url} target="_blank" rel="noopener noreferrer"
                          className="text-blue-500 hover:underline text-xs break-all">
                          폴더 열기 ↗
                        </a>
                      ) : createResult.dropbox_error ? (
                        <span className="text-red-500 text-xs">{createResult.dropbox_error}</span>
                      ) : (
                        <span className="text-gray-400 text-xs">서비스 미선택 — 폴더 생략</span>
                      )}
                    </span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => {
                    if (createResult) router.push(`/projects/${createResult.id}`)
                  }}
                    className="flex-1 py-2.5 text-sm font-semibold rounded-lg hover:opacity-80"
                    style={{ backgroundColor: '#FFCE00', color: '#121212' }}>
                    프로젝트로 이동
                  </button>
                  <button onClick={resetCreate}
                    className="px-4 py-2.5 text-sm border border-gray-200 rounded-lg text-gray-500">
                    닫기
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 검색 + 필터 */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="프로젝트명, 고객, 번호, 서비스 검색..."
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-72 focus:outline-none focus:ring-2 focus:ring-yellow-300"
        />
        <div className="flex gap-1.5">
          {(['전체', '진행중', '완료', '보류', '취소']).map(s => {
            const cnt = s === '전체' ? projects.length : projects.filter(p => p.status === s).length
            const active = statusFilter === s
            return (
              <button key={s} onClick={() => setStatusFilter(s)}
                className="px-3 py-1.5 rounded-full text-xs font-semibold border transition-all"
                style={active
                  ? { backgroundColor: '#121212', color: '#FFCE00', borderColor: '#121212' }
                  : { backgroundColor: '#fff', color: '#6B7280', borderColor: '#E5E7EB' }
                }>
                {s} <span className="opacity-60">({cnt})</span>
              </button>
            )
          })}
        </div>
        {isAdmin && (
          <button onClick={() => startAssign(async () => {
            const res = await assignProjectNumbers()
            setAssignMsg(res.assigned > 0 ? `${res.assigned}건 번호 부여 완료` : '이미 모두 번호 있음')
            setTimeout(() => setAssignMsg(''), 4000)
          })} disabled={assignPending}
            className="ml-auto text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:border-gray-400 disabled:opacity-50">
            {assignPending ? '처리 중...' : '번호 일괄 부여'}
          </button>
        )}
        {assignMsg && <span className="text-xs text-green-600 font-medium">{assignMsg}</span>}
        {!isAdmin && <span className="ml-auto text-xs text-gray-400">{filtered.length}건</span>}
      </div>
      {/* 운영 분류 (메인유형) 필터 — Phase 5 가시성 */}
      <div className="flex gap-1.5 mb-2 flex-wrap items-center">
        <span className="text-[10px] text-gray-500 mr-1 font-semibold">🧭 운영 분류</span>
        {[...MAIN_TYPES_FILTER, '미설정'].map(t => {
          const active = mainTypeFilter === t
          const cnt = t === '전체'
            ? projects.length
            : t === '미설정'
              ? projects.filter(p => !p.main_type).length
              : projects.filter(p => p.main_type === t).length
          const colorCls = active ? (MAIN_TYPE_BADGE[t] ?? 'bg-gray-900 text-white border-gray-900') : 'bg-white text-gray-500 border-gray-200'
          return (
            <button key={t} onClick={() => setMainTypeFilter(t)}
              className={`px-2.5 py-1 rounded-full text-xs border transition-all font-medium ${active ? colorCls : 'hover:bg-gray-50'}`}
              style={!active ? undefined : (MAIN_TYPE_BADGE[t] ? undefined : { backgroundColor: '#121212', color: '#FFCE00', borderColor: '#121212' })}
            >
              {t} <span className="opacity-60 font-normal">({cnt})</span>
            </button>
          )
        })}
      </div>

      {/* 서비스 필터 (영업용 — 보조 시야) */}
      <div className="flex gap-1.5 mb-2 flex-wrap items-center">
        <span className="text-[10px] text-gray-400 mr-1">서비스</span>
        {svcTypes.map(s => {
          const active = svcFilter === s
          return (
            <button key={s} onClick={() => setSvcFilter(s)}
              className="px-2.5 py-1 rounded-full text-xs border transition-all"
              style={active
                ? { backgroundColor: '#FFCE00', color: '#121212', borderColor: '#FFCE00' }
                : { backgroundColor: '#fff', color: '#9CA3AF', borderColor: '#E5E7EB' }
              }>
              {s}
            </button>
          )
        })}
      </div>

      {/* 담당자 필터 */}
      <div className="flex gap-1.5 mb-4 flex-wrap items-center">
        <span className="text-[10px] text-gray-400 mr-1">담당자</span>
        {pmOptions.map(p => {
          const active = pmFilter === p
          return (
            <button key={p} onClick={() => setPmFilter(p)}
              className="px-2.5 py-1 rounded-full text-xs border transition-all"
              style={active
                ? { backgroundColor: '#374151', color: '#fff', borderColor: '#374151' }
                : { backgroundColor: '#fff', color: '#9CA3AF', borderColor: '#E5E7EB' }
              }>
              {p}
            </button>
          )
        })}
      </div>

      {/* 테이블 */}
      <div className="bg-white rounded-xl overflow-x-auto" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
        <table className="w-full border-collapse" style={{ tableLayout: 'auto' }}>
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <SortableTh label="번호"      keyName="project_number" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
              <SortableTh label="프로젝트명" keyName="name"           sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
              <SortableTh label="고객"      keyName="customer_name"  sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
              <SortableTh label="서비스"    keyName="service_type"   sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
              <SortableTh label="운영 분류" keyName="main_type"      sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
              <SortableTh label="상태"      keyName="status"         sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
              <SortableTh label="단계"      keyName="contract_stage" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
              <SortableTh label="담당자"    keyName="pm_name"        sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
              <SortableTh label="유입"      keyName="inflow_date"    sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
              <SortableTh label="매출"      keyName="revenue"        sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} align="right" />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={10} className="px-4 py-12 text-center text-sm text-gray-400">
                {search ? '검색 결과가 없어.' : '프로젝트가 없어.'}
              </td></tr>
            ) : filtered.map(p => {
              const svcColor = SVC_COLOR[p.service_type ?? ''] ?? '#9CA3AF'
              return (
                <tr key={p.id}
                  className="border-b border-gray-50 hover:bg-gray-50 transition-colors cursor-pointer align-top"
                  onClick={() => router.push(`/projects/${p.id}`)}>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <span className="text-xs font-bold text-gray-400 font-mono">
                      {p.project_number ?? '—'}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="w-0.5 h-6 rounded flex-shrink-0" style={{ background: svcColor }} />
                      <span className="text-sm font-semibold text-gray-900 break-words">{p.name}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-sm text-gray-500 break-words">
                    {p.customer_name ?? '—'}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    {p.service_type ? (
                      <span className="text-xs px-1.5 py-0.5 rounded border font-medium"
                        style={{ color: svcColor, borderColor: svcColor + '40', background: svcColor + '12' }}>
                        {p.service_type}
                      </span>
                    ) : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    {p.main_type ? (
                      <div className="flex items-center gap-1 flex-wrap">
                        <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${MAIN_TYPE_BADGE[p.main_type] ?? 'bg-gray-100 text-gray-700 border-gray-200'}`}>
                          {p.main_type}
                        </span>
                        {p.expansion_tags && p.expansion_tags.length > 0 && (
                          <span className="text-[10px] text-gray-400" title={p.expansion_tags.join(', ')}>
                            +{p.expansion_tags.length}
                          </span>
                        )}
                      </div>
                    ) : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${STATUS_CLR[p.status] ?? 'bg-gray-100 text-gray-500'}`}>
                      {p.status}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    {p.contract_stage ? (
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${STAGE_CLR[p.contract_stage] ?? 'bg-gray-100 text-gray-500'}`}>
                        {p.contract_stage}
                      </span>
                    ) : <span className="text-gray-300 text-xs">—</span>}
                  </td>
                  <td className="px-3 py-2.5 text-sm text-gray-600 whitespace-nowrap">
                    {p.pm_name ?? <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-gray-400 whitespace-nowrap">
                    {p.inflow_date ?? '—'}
                  </td>
                  <td className="px-3 py-2.5 text-sm font-semibold whitespace-nowrap text-right"
                    style={{ color: p.revenue ? '#374151' : '#D1D5DB' }}>
                    {fmtMoney(p.revenue)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
