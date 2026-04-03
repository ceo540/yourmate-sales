'use client'

import { useState, useRef, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { DEPARTMENT_LABELS, type Department } from '@/types'
import { createEntity, updateEntity, deleteEntity, updatePermission, updateJoinDate, setInitialLeave, createOneOnOne, deleteOneOnOne, updateDocumentStatus, updateEmployeeEntity } from './actions'

interface UserProfile {
  id: string
  name: string
  email: string | null
  departments: string[] | null
  role: string
  created_at: string
  join_date?: string | null
  entity_id?: string | null
  last_sign_in_at: string | null
  confirmed_at: string | null
}

interface BusinessEntity {
  id: string
  name: string
  business_number: string | null
}

interface OneOnOne {
  id: string; member_id: string; date: string
  content: string | null; action_items: string | null; created_at: string
}
interface DocRequest {
  id: string; member_id: string; doc_type: string
  purpose: string | null; status: string; created_at: string; processed_at: string | null
}

interface Props {
  users: UserProfile[]
  entities: BusinessEntity[]
  permissionsByRole: Record<string, Record<string, string>>
  usedDaysMap: Record<string, number>
  initialDaysMap: Record<string, number>
  oneOnOnes: OneOnOne[]
  docRequests: DocRequest[]
}

const DEPT_KEYS = Object.keys(DEPARTMENT_LABELS) as Department[]
const EMPTY_FORM = { name: '', email: '', departments: [] as string[], role: 'member' }

function DeptCheckboxes({ selected, onChange }: { selected: string[], onChange: (v: string[]) => void }) {
  const toggle = (key: string) =>
    onChange(selected.includes(key) ? selected.filter(d => d !== key) : [...selected, key])
  return (
    <div className="flex flex-wrap gap-2">
      {DEPT_KEYS.map(key => (
        <button
          key={key}
          type="button"
          onClick={() => toggle(key)}
          className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
            selected.includes(key)
              ? 'border-yellow-400 bg-yellow-50 text-yellow-800 font-medium'
              : 'border-gray-200 text-gray-500 hover:border-yellow-300'
          }`}
        >
          {DEPARTMENT_LABELS[key]}
        </button>
      ))}
    </div>
  )
}

export default function AdminClient({ users: initialUsers, entities: initialEntities, permissionsByRole: initialPerms, usedDaysMap, initialDaysMap, oneOnOnes: initialOneOnOnes, docRequests: initialDocRequests }: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [users, setUsers] = useState(initialUsers)
  const [form, setForm] = useState(EMPTY_FORM)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDepts, setEditDepts] = useState<string[]>([])
  const [roleDropdownId, setRoleDropdownId] = useState<string | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // 사업자 관리 상태
  const [activeTab, setActiveTab] = useState<'team' | 'entities' | 'permissions' | 'hr'>('team')
  const [editingJoinId, setEditingJoinId] = useState<string | null>(null)
  const [joinDateVal, setJoinDateVal] = useState('')
  const [editingInitialId, setEditingInitialId] = useState<string | null>(null)
  const [initialDaysVal, setInitialDaysVal] = useState('')

  // 직원 카드 상태
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [hrDetailTab, setHrDetailTab] = useState<'info' | 'oo' | 'docs'>('info')
  const [oneOnOnes, setOneOnOnes] = useState<OneOnOne[]>(initialOneOnOnes)
  const [docRequests, setDocRequests] = useState<DocRequest[]>(initialDocRequests)
  const [ooForm, setOoForm] = useState({ date: '', content: '', action_items: '' })
  const [showOoForm, setShowOoForm] = useState(false)
  const [perms, setPerms] = useState(initialPerms)
  const [togglingKey, setTogglingKey] = useState<string | null>(null)
  const [entities, setEntities] = useState(initialEntities)
  useEffect(() => { setEntities(initialEntities) }, [initialEntities])
  const [showEntityForm, setShowEntityForm] = useState(false)
  const [entityForm, setEntityForm] = useState({ name: '', business_number: '' })
  const [editingEntityId, setEditingEntityId] = useState<string | null>(null)
  const [editEntityForm, setEditEntityForm] = useState({ name: '', business_number: '' })

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setRoleDropdownId(null)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')
    try {
      const res = await fetch('/api/admin/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json().catch(() => ({ error: `서버 오류 (${res.status})` }))
      if (!res.ok) {
        setError(data.error ?? '초대 실패')
      } else {
        setSuccess(`${form.email}로 초대 메일을 발송했습니다.`)
        setForm(EMPTY_FORM)
        setShowForm(false)
        const res2 = await fetch('/api/admin/users')
        const data2 = await res2.json()
        if (data2.users) setUsers(data2.users)
      }
    } catch {
      setError('네트워크 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const handleRoleChange = async (userId: string, newRole: string) => {
    const res = await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, role: newRole }),
    })
    const data = await res.json()
    if (!res.ok) { alert(data.error ?? '변경 실패'); return }
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u))
    setRoleDropdownId(null)
  }

  const handleDeptSave = async (userId: string) => {
    const res = await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, departments: editDepts }),
    })
    const data = await res.json()
    if (!res.ok) { alert(data.error ?? '변경 실패'); return }
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, departments: editDepts } : u))
    setEditingId(null)
  }

  const handleDelete = async (userId: string, userName: string) => {
    if (!confirm(`${userName} 님을 삭제하시겠습니까?`)) return
    const res = await fetch('/api/admin/users', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    })
    const data = await res.json()
    if (!res.ok) { alert(data.error ?? '삭제 실패'); return }
    setUsers(prev => prev.filter(u => u.id !== userId))
  }

  const handleEntityCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    const fd = new FormData()
    fd.set('name', entityForm.name)
    fd.set('business_number', entityForm.business_number)
    await createEntity(fd)
    setEntityForm({ name: '', business_number: '' })
    setShowEntityForm(false)
    startTransition(() => router.refresh())
  }

  const handleEntityUpdate = async (id: string) => {
    const fd = new FormData()
    fd.set('id', id)
    fd.set('name', editEntityForm.name)
    fd.set('business_number', editEntityForm.business_number)
    await updateEntity(fd)
    setEntities(prev => prev.map(e => e.id === id ? { ...e, name: editEntityForm.name, business_number: editEntityForm.business_number || null } : e))
    setEditingEntityId(null)
  }

  const handleEntityDelete = async (id: string, name: string) => {
    if (!confirm(`"${name}" 사업자를 삭제하시겠어요?\n이미 연결된 매출 건에서는 사업자 정보가 사라집니다.`)) return
    await deleteEntity(id)
    setEntities(prev => prev.filter(e => e.id !== id))
  }

  const ALL_PERM_ROWS: { label: string; pageKey?: string; fixed?: { admin: string; manager: string; member: string } }[] = [
    { label: '대시보드',          pageKey: 'dashboard' },
    { label: '대시보드 자금잔고',  pageKey: 'dashboard_finance' },
    { label: '매출 현황',         pageKey: 'sales' },
    { label: '계약 목록',         pageKey: 'sales_report' },
    { label: '매출 등록/수정',    fixed: { admin: '전체', manager: '전체', member: '본인 건만' } },
    { label: '리드 관리',         pageKey: 'leads' },
    { label: '업무 관리',         pageKey: 'tasks' },
    { label: '미수금 현황',       pageKey: 'receivables' },
    { label: '거래처 DB',         pageKey: 'vendors' },
    { label: '지급 관리',         pageKey: 'payments' },
    { label: '재무 현황',         fixed: { admin: '✓', manager: '어드민만', member: '어드민만' } },
    { label: '인건비 관리',       fixed: { admin: '✓', manager: '어드민만', member: '어드민만' } },
    { label: '고정비 관리',       fixed: { admin: '✓', manager: '어드민만', member: '어드민만' } },
    { label: '자금일보',          fixed: { admin: '✓', manager: '어드민만', member: '어드민만' } },
    { label: '팀원 관리',         fixed: { admin: '✓', manager: '어드민만', member: '어드민만' } },
  ]
  const ROLES = [
    { role: 'manager', label: '팀장', color: 'bg-blue-100 text-blue-700' },
    { role: 'member',  label: '팀원/PM', color: 'bg-gray-100 text-gray-600' },
  ]
  const LEVELS = [
    { value: 'off',  label: '끄기',  active: 'bg-gray-200 text-gray-600' },
    { value: 'read', label: '읽기',  active: 'bg-blue-100 text-blue-700' },
    { value: 'own',  label: '담당만', active: 'bg-yellow-100 text-yellow-800' },
    { value: 'full', label: '전체',  active: 'bg-green-100 text-green-700' },
  ]

  async function handleLevelChange(role: string, pageKey: string, level: string) {
    const key = `${role}:${pageKey}`
    setTogglingKey(key)
    setPerms(prev => ({ ...prev, [role]: { ...prev[role], [pageKey]: level } }))
    await updatePermission(role, pageKey, level)
    setTogglingKey(null)
  }

  function LevelSelector({ role, pageKey }: { role: string; pageKey: string }) {
    const current = perms[role]?.[pageKey] ?? 'off'
    const busy = togglingKey === `${role}:${pageKey}`
    return (
      <div className={`inline-flex rounded-lg border border-gray-200 overflow-hidden ${busy ? 'opacity-50' : ''}`}>
        {LEVELS.map(lv => (
          <button
            key={lv.value}
            onClick={() => handleLevelChange(role, pageKey, lv.value)}
            disabled={busy}
            className={`px-2.5 py-1 text-xs font-medium border-r border-gray-200 last:border-r-0 transition-colors ${
              current === lv.value ? lv.active : 'bg-white text-gray-400 hover:bg-gray-50'
            }`}
          >
            {lv.label}
          </button>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 탭 */}
      <div className="flex flex-wrap gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {([['team', '팀원 관리'], ['hr', '직원 관리'], ['entities', '사업자 관리'], ['permissions', '권한 안내']] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* 직원 관리 탭 */}
      {activeTab === 'hr' && (() => {
        const ROLE_COLORS: Record<string, string> = {
          admin: 'bg-yellow-100 text-yellow-800', manager: 'bg-blue-100 text-blue-700', member: 'bg-gray-100 text-gray-600',
        }
        const ROLE_LABELS: Record<string, string> = { admin: '대표', manager: '팀장', member: '팀원' }
        const DOC_TYPES = ['재직증명서', '경력증명서', '근로소득원천징수영수증', '급여명세서', '기타']
        const DOC_STATUS: Record<string, string> = { 요청: 'bg-yellow-100 text-yellow-700', 처리중: 'bg-blue-100 text-blue-700', 발급완료: 'bg-green-100 text-green-700' }

        function calcLeave(joinDate: string | null | undefined) {
          if (!joinDate) return null
          const join = new Date(joinDate)
          const today = new Date()
          const totalMonths = (today.getFullYear() - join.getFullYear()) * 12 + (today.getMonth() - join.getMonth())
          if (totalMonths < 12) return Math.min(totalMonths, 11)
          return Math.min(15 + Math.floor((Math.floor(totalMonths / 12) - 1) / 2), 25)
        }
        function calcTenureStr(joinDate: string) {
          const join = new Date(joinDate)
          const today = new Date()
          const totalMonths = (today.getFullYear() - join.getFullYear()) * 12 + (today.getMonth() - join.getMonth())
          const y = Math.floor(totalMonths / 12); const m = totalMonths % 12
          return m > 0 ? `${y}년 ${m}개월` : `${y}년`
        }

        const selectedUser = users.find(u => u.id === selectedUserId) ?? null
        const userOOs = oneOnOnes.filter(o => o.member_id === selectedUserId).sort((a, b) => b.date.localeCompare(a.date))
        const userDocs = docRequests.filter(d => d.member_id === selectedUserId).sort((a, b) => b.created_at.localeCompare(a.created_at))

        return (
          <div className={`flex gap-4 ${selectedUser ? 'items-start' : ''}`}>
            {/* 직원 카드 그리드 */}
            <div className={`grid grid-cols-2 gap-3 ${selectedUser ? 'w-72 shrink-0' : 'flex-1 sm:grid-cols-3'}`}>
              {users.map(u => {
                const joinDate = u.join_date ?? null
                const usedDays = usedDaysMap[u.id] ?? 0
                const annualLeave = calcLeave(joinDate)
                const remaining = annualLeave != null ? annualLeave - usedDays : null
                const lastOO = oneOnOnes.filter(o => o.member_id === u.id).sort((a, b) => b.date.localeCompare(a.date))[0]
                const pendingDocs = docRequests.filter(d => d.member_id === u.id && d.status === '요청').length
                const isSelected = selectedUserId === u.id

                return (
                  <button key={u.id} onClick={() => { setSelectedUserId(isSelected ? null : u.id); setHrDetailTab('info') }}
                    className={`text-left p-4 rounded-2xl border-2 transition-all hover:shadow-md ${isSelected ? 'border-gray-900 bg-gray-50' : 'border-gray-100 bg-white hover:border-gray-300'}`}>
                    {/* 아바타 + 이름 */}
                    <div className="flex items-center gap-2.5 mb-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center text-base font-bold text-gray-600 shrink-0">
                        {u.name?.[0]}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900 text-sm truncate">{u.name}</p>
                        <span className={`text-[11px] px-1.5 py-0.5 rounded-full font-medium ${ROLE_COLORS[u.role] ?? 'bg-gray-100 text-gray-500'}`}>
                          {ROLE_LABELS[u.role] ?? u.role}
                        </span>
                      </div>
                    </div>

                    {/* 입사/근속 */}
                    <div className="text-xs text-gray-400 mb-2">
                      {joinDate ? (
                        <><span className="font-medium text-gray-600">{calcTenureStr(joinDate)}</span> · {joinDate}</>
                      ) : (
                        <span className="text-red-400">입사일 미입력</span>
                      )}
                    </div>

                    {/* 소속 사업자 */}
                    {u.entity_id && (
                      <div className="text-[11px] text-gray-400 mb-2 truncate">
                        🏢 {entities.find(e => e.id === u.entity_id)?.name ?? ''}
                      </div>
                    )}

                    {/* 연차 바 */}
                    {annualLeave != null && (
                      <div className="mb-2">
                        <div className="flex justify-between text-[11px] text-gray-400 mb-1">
                          <span>연차 {usedDays}/{annualLeave}일</span>
                          <span className={remaining != null && remaining <= 3 ? 'text-red-500 font-medium' : 'text-green-600'}>잔여 {remaining}일</span>
                        </div>
                        <div className="bg-gray-100 rounded-full h-1.5">
                          <div className={`h-1.5 rounded-full ${usedDays/annualLeave >= 0.8 ? 'bg-red-400' : usedDays/annualLeave >= 0.5 ? 'bg-yellow-400' : 'bg-green-400'}`}
                            style={{ width: `${Math.min(Math.round(usedDays/annualLeave*100), 100)}%` }} />
                        </div>
                      </div>
                    )}

                    {/* 배지 */}
                    <div className="flex gap-1.5 flex-wrap mt-2">
                      {lastOO && <span className="text-[11px] bg-purple-50 text-purple-600 px-1.5 py-0.5 rounded-full">원온원 {lastOO.date.slice(5)}</span>}
                      {pendingDocs > 0 && <span className="text-[11px] bg-yellow-50 text-yellow-600 px-1.5 py-0.5 rounded-full">서류요청 {pendingDocs}</span>}
                    </div>
                  </button>
                )
              })}
            </div>

            {/* 상세 패널 */}
            {selectedUser && (
              <div className="flex-1 bg-white border border-gray-200 rounded-2xl overflow-hidden min-w-0">
                {/* 패널 헤더 */}
                <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center text-base font-bold text-gray-600">
                      {selectedUser.name?.[0]}
                    </div>
                    <div>
                      <p className="font-bold text-gray-900">{selectedUser.name}</p>
                      <p className="text-xs text-gray-400">{selectedUser.email}</p>
                    </div>
                  </div>
                  <button onClick={() => setSelectedUserId(null)} className="text-gray-300 hover:text-gray-600 text-xl px-1">×</button>
                </div>

                {/* 상세 탭 */}
                <div className="flex border-b border-gray-100">
                  {([['info','기본 정보'],['oo','원온원'],['docs','서류 발급']] as const).map(([key, label]) => (
                    <button key={key} onClick={() => setHrDetailTab(key)}
                      className={`flex-1 py-2.5 text-xs font-medium transition-colors ${hrDetailTab === key ? 'border-b-2 border-gray-900 text-gray-900' : 'text-gray-400 hover:text-gray-600'}`}>
                      {label}
                    </button>
                  ))}
                </div>

                <div className="p-5">
                  {/* 기본 정보 */}
                  {hrDetailTab === 'info' && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs text-gray-400 mb-1">입사일</p>
                          {editingJoinId === selectedUser.id ? (
                            <div className="flex gap-2">
                              <input type="date" value={joinDateVal} onChange={e => setJoinDateVal(e.target.value)}
                                className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-sm" />
                              <button onClick={async () => { await updateJoinDate(selectedUser.id, joinDateVal); setEditingJoinId(null); startTransition(() => router.refresh()) }}
                                className="px-2 py-1.5 bg-gray-900 text-white text-xs rounded-lg">저장</button>
                              <button onClick={() => setEditingJoinId(null)} className="px-2 py-1.5 border text-xs rounded-lg text-gray-400">✕</button>
                            </div>
                          ) : (
                            <button onClick={() => { setEditingJoinId(selectedUser.id); setJoinDateVal(selectedUser.join_date ?? '') }}
                              className="text-sm font-medium text-gray-700 hover:text-blue-600 underline decoration-dashed underline-offset-2">
                              {selectedUser.join_date ?? '미입력 — 클릭해서 입력'}
                            </button>
                          )}
                        </div>
                        <div>
                          <p className="text-xs text-gray-400 mb-1">근속기간</p>
                          <p className="text-sm font-medium text-gray-700">
                            {selectedUser.join_date ? calcTenureStr(selectedUser.join_date) : '-'}
                          </p>
                        </div>
                      </div>

                      {/* 소속 사업자 */}
                      <div>
                        <p className="text-xs text-gray-400 mb-1">소속 사업자</p>
                        <select
                          value={selectedUser.entity_id ?? ''}
                          onChange={async e => {
                            await updateEmployeeEntity(selectedUser.id, e.target.value)
                            setUsers(prev => prev.map(u => u.id === selectedUser.id ? { ...u, entity_id: e.target.value || null } : u))
                          }}
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
                        >
                          <option value="">미지정</option>
                          {entities.map(e => (
                            <option key={e.id} value={e.id}>{e.name}</option>
                          ))}
                        </select>
                      </div>

                      {/* 연차 현황 */}
                      {(() => {
                        const annualLeave = calcLeave(selectedUser.join_date)
                        const used = usedDaysMap[selectedUser.id] ?? 0
                        const remaining = annualLeave != null ? annualLeave - used : null
                        return annualLeave != null ? (
                          <div className="bg-gray-50 rounded-xl p-4">
                            <p className="text-xs font-semibold text-gray-500 mb-3">연차 현황 ({new Date().getFullYear()}년)</p>
                            <div className="grid grid-cols-3 gap-3 mb-3">
                              {[{ label:'발생', value:`${annualLeave}일`, color:'text-gray-800' },
                                { label:'사용', value:`${used}일`, color:'text-yellow-600' },
                                { label:'잔여', value:`${remaining}일`, color: remaining != null && remaining <= 3 ? 'text-red-500' : 'text-green-600' }
                              ].map(s => (
                                <div key={s.label} className="text-center">
                                  <p className="text-[11px] text-gray-400 mb-0.5">{s.label}</p>
                                  <p className={`font-bold text-lg ${s.color}`}>{s.value}</p>
                                </div>
                              ))}
                            </div>
                            <div>
                              <p className="text-xs text-gray-400 mb-1">초기 사용일수 (시스템 도입 전)</p>
                              {editingInitialId === selectedUser.id ? (
                                <div className="flex gap-2">
                                  <input type="number" min="0" max="25" step="0.5" value={initialDaysVal} onChange={e => setInitialDaysVal(e.target.value)}
                                    className="w-20 border border-gray-200 rounded-lg px-2 py-1.5 text-sm bg-white" placeholder="0" />
                                  <button onClick={async () => { await setInitialLeave(selectedUser.id, parseFloat(initialDaysVal)||0); setEditingInitialId(null); startTransition(() => router.refresh()) }}
                                    className="px-2 py-1.5 bg-gray-900 text-white text-xs rounded-lg">저장</button>
                                  <button onClick={() => setEditingInitialId(null)} className="px-2 py-1.5 border text-xs rounded-lg text-gray-400">✕</button>
                                </div>
                              ) : (
                                <button onClick={() => { setEditingInitialId(selectedUser.id); setInitialDaysVal(String(initialDaysMap[selectedUser.id] ?? '')) }}
                                  className="text-sm text-gray-600 hover:text-blue-600 underline decoration-dashed underline-offset-2">
                                  {(initialDaysMap[selectedUser.id] ?? 0) > 0 ? `${initialDaysMap[selectedUser.id]}일` : '미입력 — 클릭해서 입력'}
                                </button>
                              )}
                            </div>
                          </div>
                        ) : null
                      })()}
                    </div>
                  )}

                  {/* 원온원 */}
                  {hrDetailTab === 'oo' && (
                    <div className="space-y-3">
                      <button onClick={() => setShowOoForm(v => !v)}
                        className="w-full py-2 border border-dashed border-gray-300 rounded-xl text-sm text-gray-500 hover:border-gray-400 hover:text-gray-700 transition-colors">
                        + 새 미팅 기록 추가
                      </button>

                      {showOoForm && (
                        <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                          <div>
                            <label className="text-xs text-gray-400 mb-1 block">날짜</label>
                            <input type="date" value={ooForm.date} onChange={e => setOoForm(f => ({...f, date: e.target.value}))}
                              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white" />
                          </div>
                          <div>
                            <label className="text-xs text-gray-400 mb-1 block">주요 내용</label>
                            <textarea value={ooForm.content} onChange={e => setOoForm(f => ({...f, content: e.target.value}))}
                              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white resize-none" rows={3}
                              placeholder="미팅에서 나눈 내용..." />
                          </div>
                          <div>
                            <label className="text-xs text-gray-400 mb-1 block">액션 아이템</label>
                            <textarea value={ooForm.action_items} onChange={e => setOoForm(f => ({...f, action_items: e.target.value}))}
                              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white resize-none" rows={2}
                              placeholder="- 할 일 1&#10;- 할 일 2" />
                          </div>
                          <div className="flex gap-2">
                            <button onClick={async () => {
                              if (!ooForm.date) return
                              await createOneOnOne(selectedUser.id, ooForm.date, ooForm.content, ooForm.action_items)
                              setOneOnOnes(prev => [{ id: Date.now().toString(), member_id: selectedUser.id, date: ooForm.date, content: ooForm.content, action_items: ooForm.action_items, created_at: new Date().toISOString() }, ...prev])
                              setOoForm({ date: '', content: '', action_items: '' })
                              setShowOoForm(false)
                            }} className="flex-1 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-800">저장</button>
                            <button onClick={() => setShowOoForm(false)} className="flex-1 py-2 border border-gray-200 text-sm rounded-lg text-gray-500">취소</button>
                          </div>
                        </div>
                      )}

                      {userOOs.length === 0 && !showOoForm && (
                        <p className="text-center text-sm text-gray-400 py-6">원온원 기록이 없어요.</p>
                      )}

                      {userOOs.map(o => (
                        <div key={o.id} className="border border-gray-100 rounded-xl p-4">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-semibold text-gray-800">{o.date}</span>
                            <button onClick={async () => { await deleteOneOnOne(o.id); setOneOnOnes(prev => prev.filter(x => x.id !== o.id)) }}
                              className="text-xs text-gray-300 hover:text-red-400">삭제</button>
                          </div>
                          {o.content && <p className="text-sm text-gray-600 whitespace-pre-line mb-2">{o.content}</p>}
                          {o.action_items && (
                            <div className="bg-blue-50 rounded-lg p-2.5">
                              <p className="text-xs font-semibold text-blue-600 mb-1">액션 아이템</p>
                              <p className="text-xs text-blue-700 whitespace-pre-line">{o.action_items}</p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* 서류 발급 */}
                  {hrDetailTab === 'docs' && (
                    <div className="space-y-3">
                      <div className="bg-gray-50 rounded-xl p-4">
                        <p className="text-xs font-semibold text-gray-500 mb-2">직접 발급 등록</p>
                        <div className="flex gap-2">
                          <select id="doc-type-select" className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-sm bg-white">
                            {DOC_TYPES.map(t => <option key={t}>{t}</option>)}
                          </select>
                          <button onClick={async () => {
                            const sel = document.getElementById('doc-type-select') as HTMLSelectElement
                            const docType = sel.value
                            const admin = await import('@/lib/supabase/admin').then(m => m.createAdminClient())
                            // actions를 통해 처리
                            const { data } = await admin.from('document_requests').insert({ member_id: selectedUser.id, doc_type: docType, status: '발급완료', processed_at: new Date().toISOString() }).select().single()
                            if (data) setDocRequests(prev => [data as DocRequest, ...prev])
                          }} className="px-3 py-1.5 bg-gray-900 text-white text-xs rounded-lg whitespace-nowrap">발급완료 처리</button>
                        </div>
                      </div>

                      {userDocs.length === 0 ? (
                        <p className="text-center text-sm text-gray-400 py-6">서류 발급 이력이 없어요.</p>
                      ) : userDocs.map(d => (
                        <div key={d.id} className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0">
                          <div>
                            <p className="text-sm font-medium text-gray-800">{d.doc_type}</p>
                            <p className="text-xs text-gray-400">{d.created_at.slice(0,10)}{d.purpose ? ` · ${d.purpose}` : ''}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`text-xs px-2 py-0.5 rounded-full ${DOC_STATUS[d.status] ?? 'bg-gray-100 text-gray-500'}`}>{d.status}</span>
                            {d.status === '요청' && (
                              <button onClick={async () => { await updateDocumentStatus(d.id, '발급완료'); setDocRequests(prev => prev.map(x => x.id === d.id ? {...x, status:'발급완료'} : x)) }}
                                className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full hover:bg-green-200">처리</button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )
      })()}

      {/* 권한 안내 탭 */}
      {activeTab === 'permissions' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-900">역할별 접근 권한</h2>
            <p className="text-xs text-gray-400 mt-1">토글로 켜고 끄면 즉시 적용돼요. 관리자는 항상 전체 접근이에요.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left text-xs font-semibold text-gray-500 px-6 py-3">메뉴</th>
                  <th className="text-center text-xs font-semibold px-6 py-3">
                    <span className="px-2 py-1 rounded-full bg-yellow-100 text-yellow-800">관리자</span>
                  </th>
                  {ROLES.map(r => (
                    <th key={r.role} className="text-center text-xs font-semibold px-6 py-3">
                      <span className={`px-2 py-1 rounded-full ${r.color}`}>{r.label}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {ALL_PERM_ROWS.map((row) => (
                  <tr key={row.label} className="hover:bg-gray-50">
                    <td className="px-6 py-3.5 text-sm text-gray-700">{row.label}</td>
                    <td className="px-6 py-3.5 text-center">
                      {row.fixed
                        ? <span className="text-xs px-2 py-1 rounded-full bg-green-50 text-green-600 font-medium">{row.fixed.admin}</span>
                        : <span className="inline-flex h-5 w-9 items-center rounded-full bg-green-400 cursor-not-allowed opacity-60"><span className="inline-block h-3.5 w-3.5 translate-x-4 rounded-full bg-white shadow" /></span>
                      }
                    </td>
                    {ROLES.map(r => (
                      <td key={r.role} className="px-6 py-3.5 text-center">
                        {row.fixed
                          ? <span className={`text-xs px-2 py-1 rounded-full ${row.fixed[r.role as 'manager' | 'member'] === '어드민만' ? 'bg-red-50 text-red-400' : 'bg-gray-50 text-gray-500'}`}>{row.fixed[r.role as 'manager' | 'member']}</span>
                          : <LevelSelector role={r.role} pageKey={row.pageKey!} />
                        }
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 space-y-2">
            <p className="text-xs text-gray-400">변경 사항은 해당 역할 직원이 다음 페이지 이동 시 반영돼요.</p>
            <div className="text-xs text-gray-400 space-y-1 pt-1 border-t border-gray-200">
              <p className="font-medium text-gray-500">권한 단계 안내</p>
              <p><span className="font-medium text-gray-600">끄기</span> — 메뉴가 숨겨지고 접근이 차단돼요.</p>
              <p><span className="font-medium text-gray-600">담당만</span> — 팀원 관리에서 지정한 담당 사업부의 매출 건, 또는 본인이 직접 담당자로 지정된 건만 볼 수 있어요. 담당 사업부가 없으면 본인 건만 표시돼요.</p>
              <p><span className="font-medium text-gray-600">읽기</span> — 전체 데이터를 볼 수 있지만 수정은 불가해요.</p>
              <p><span className="font-medium text-gray-600">전체</span> — 전체 데이터를 보고 수정할 수 있어요.</p>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'team' && <div className="bg-white rounded-xl border border-gray-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">현재 팀원 ({users.length}명)</h2>
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 rounded-lg text-xs font-semibold hover:opacity-80 transition-all"
            style={{ backgroundColor: '#FFCE00', color: '#121212' }}
          >
            + 팀원 초대
          </button>
        </div>

        <div className="divide-y divide-gray-50">
          {users.map(user => (
            <div key={user.id} className="px-6 py-3">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-gray-900">{user.name || '이름 없음'}</p>
                    {user.confirmed_at
                      ? <span className="text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-600">가입완료</span>
                      : <span className="text-xs px-2 py-0.5 rounded-full bg-orange-50 text-orange-500">초대됨</span>
                    }
                  </div>
                  {user.email && <p className="text-xs text-gray-400">{user.email}</p>}
                  {editingId === user.id ? (
                    <div className="mt-2 space-y-2">
                      <DeptCheckboxes selected={editDepts} onChange={setEditDepts} />
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleDeptSave(user.id)}
                          className="text-xs px-3 py-1 rounded-lg font-semibold hover:opacity-80 transition-all"
                          style={{ backgroundColor: '#FFCE00', color: '#121212' }}
                        >저장</button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="text-xs px-3 py-1 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors"
                        >취소</button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      {(user.departments ?? []).length > 0
                        ? (user.departments ?? []).map(d => (
                          <span key={d} className="text-xs text-gray-500">
                            {DEPARTMENT_LABELS[d as Department] ?? d}
                          </span>
                        ))
                        : <span className="text-xs text-gray-300">사업부 미지정</span>
                      }
                      <button
                        onClick={() => { setEditingId(user.id); setEditDepts(user.departments ?? []) }}
                        className="text-xs text-gray-300 hover:text-yellow-600 ml-1"
                      >수정</button>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-3 ml-4 flex-shrink-0">
                  <div className="relative" ref={roleDropdownId === user.id ? dropdownRef : undefined}>
                    <button
                      onClick={() => setRoleDropdownId(roleDropdownId === user.id ? null : user.id)}
                      className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors hover:opacity-80 ${
                        user.role === 'admin' ? 'bg-yellow-100 text-yellow-800'
                        : user.role === 'manager' ? 'bg-blue-100 text-blue-700'
                        : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {user.role === 'admin' ? '관리자' : user.role === 'manager' ? '팀장' : '멤버'} ▾
                    </button>
                    {roleDropdownId === user.id && (
                      <div className="absolute right-0 top-full mt-1 z-20 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden min-w-[90px]">
                        {[
                          { value: 'member', label: '멤버', cls: 'text-gray-600' },
                          { value: 'manager', label: '팀장', cls: 'text-blue-700' },
                          { value: 'admin', label: '관리자', cls: 'text-yellow-800' },
                        ].map(opt => (
                          <button
                            key={opt.value}
                            onClick={() => handleRoleChange(user.id, opt.value)}
                            className={`w-full text-left text-xs px-3 py-2 hover:bg-gray-50 transition-colors ${opt.cls} ${user.role === opt.value ? 'font-semibold bg-gray-50' : ''}`}
                          >
                            {user.role === opt.value ? '✓ ' : ''}{opt.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => handleDelete(user.id, user.name)}
                    className="text-xs text-gray-300 hover:text-red-400 transition-colors"
                  >삭제</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>}

      {activeTab === 'team' && success && (
        <div className="bg-green-50 border border-green-200 text-green-700 text-sm px-4 py-3 rounded-lg">
          {success}
        </div>
      )}

      {/* 사업자 관리 */}
      {activeTab === 'entities' && <div className="bg-white rounded-xl border border-gray-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">사업자 관리 ({entities.length}개)</h2>
          <button
            onClick={() => setShowEntityForm(true)}
            className="px-4 py-2 rounded-lg text-xs font-semibold hover:opacity-80 transition-all"
            style={{ backgroundColor: '#FFCE00', color: '#121212' }}
          >
            + 사업자 추가
          </button>
        </div>
        <div className="divide-y divide-gray-50">
          {entities.length === 0 && (
            <p className="px-6 py-4 text-sm text-gray-400">등록된 사업자가 없습니다.</p>
          )}
          {entities.map(entity => (
            <div key={entity.id} className="px-6 py-3">
              {editingEntityId === entity.id ? (
                <div className="flex items-center gap-2">
                  <input
                    value={editEntityForm.name}
                    onChange={e => setEditEntityForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="상호명"
                    className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-yellow-400"
                  />
                  <input
                    value={editEntityForm.business_number}
                    onChange={e => setEditEntityForm(f => ({ ...f, business_number: e.target.value }))}
                    placeholder="사업자번호"
                    className="w-40 px-3 py-1.5 border border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:border-yellow-400"
                  />
                  <button
                    onClick={() => handleEntityUpdate(entity.id)}
                    className="text-xs px-3 py-1.5 rounded-lg font-semibold hover:opacity-80 transition-all"
                    style={{ backgroundColor: '#FFCE00', color: '#121212' }}
                  >저장</button>
                  <button
                    onClick={() => setEditingEntityId(null)}
                    className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors"
                  >취소</button>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium text-gray-900">{entity.name}</span>
                    {entity.business_number && (
                      <span className="ml-2 text-xs text-gray-400 font-mono">{entity.business_number}</span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setEditingEntityId(entity.id); setEditEntityForm({ name: entity.name, business_number: entity.business_number ?? '' }) }}
                      className="text-xs text-gray-400 hover:text-yellow-600 transition-colors"
                    >수정</button>
                    <button
                      onClick={() => handleEntityDelete(entity.id, entity.name)}
                      className="text-xs text-gray-300 hover:text-red-400 transition-colors"
                    >삭제</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
        {showEntityForm && (
          <form onSubmit={handleEntityCreate} className="px-6 py-4 border-t border-gray-100 flex items-center gap-2">
            <input
              value={entityForm.name}
              onChange={e => setEntityForm(f => ({ ...f, name: e.target.value }))}
              placeholder="상호명 *"
              required
              className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-yellow-400"
            />
            <input
              value={entityForm.business_number}
              onChange={e => setEntityForm(f => ({ ...f, business_number: e.target.value }))}
              placeholder="사업자번호 (선택)"
              className="w-44 px-3 py-1.5 border border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:border-yellow-400"
            />
            <button
              type="submit"
              className="text-xs px-4 py-1.5 rounded-lg font-semibold hover:opacity-80 transition-all"
              style={{ backgroundColor: '#FFCE00', color: '#121212' }}
            >추가</button>
            <button
              type="button"
              onClick={() => { setShowEntityForm(false); setEntityForm({ name: '', business_number: '' }) }}
              className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors"
            >취소</button>
          </form>
        )}
      </div>}

      {activeTab === 'team' && showForm && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">새 팀원 초대</h2>
          <p className="text-xs text-gray-400 mb-4">
            입력한 이메일로 초대 링크를 발송합니다.
          </p>
          <form onSubmit={handleInvite} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">이름</label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="홍길동"
                required
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-yellow-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">이메일</label>
              <input
                type="email"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder="name@yourmate.io"
                required
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-yellow-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-2">담당 사업부 (복수 선택 가능)</label>
              <DeptCheckboxes selected={form.departments} onChange={v => setForm(f => ({ ...f, departments: v }))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">권한</label>
              <select
                value={form.role}
                onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-yellow-400 bg-white"
              >
                <option value="member">멤버</option>
                <option value="manager">팀장</option>
                <option value="admin">관리자</option>
              </select>
            </div>
            {error && <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
            <div className="flex gap-2 pt-1">
              <button
                type="submit"
                disabled={loading}
                className="px-5 py-2 rounded-lg text-sm font-semibold disabled:opacity-60 hover:opacity-80 transition-all"
                style={{ backgroundColor: '#FFCE00', color: '#121212' }}
              >
                {loading ? '발송 중...' : '초대 메일 발송'}
              </button>
              <button
                type="button"
                onClick={() => { setShowForm(false); setError('') }}
                className="px-4 py-2 rounded-lg text-sm text-gray-500 hover:text-gray-700 border border-gray-200 transition-colors"
              >취소</button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
