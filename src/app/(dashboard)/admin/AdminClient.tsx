'use client'

import { useState, useRef, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { DEPARTMENT_LABELS, type Department } from '@/types'
import { createEntity, updateEntity, deleteEntity, updatePermission, updateJoinDate, setInitialLeave, createOneOnOne, deleteOneOnOne, updateDocumentStatus, updateEmployeeEntity, adminAddLeave, updateProfileDetail, upsertSalary, deleteSalary, addOnboardingItem, toggleOnboardingItem, deleteOnboardingItem, importOnboardingFromNotion, updateNotionTemplateUrl, createDepartment, updateDepartment, deleteDepartment, reorderDepartments, linkEmployeeCard } from './actions'
import { upsertEmployeeCard, deleteEmployeeCard } from '../payroll/actions'

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
  phone?: string | null
  emergency_name?: string | null
  emergency_phone?: string | null
  bank_name?: string | null
  account_number?: string | null
  birth_date?: string | null
}

interface SalaryRecord {
  id: string; member_id: string; year: number; month: number
  base_salary: number; deductions: number; net_salary: number; memo: string | null
}

interface OnboardingItem {
  id: string; member_id: string; title: string; completed: boolean
  completed_at: string | null; source: string; notion_block_id: string | null; sort_order: number
}

interface EmployeeCard {
  id: string
  employee_name: string
  business_entity: string | null
  profile_id: string | null
  base_salary: number
  meal_allowance: number
  mileage_allowance: number
  allowances: number
  fixed_bonus: number
  national_pension: number
  health_insurance: number
  employment_insurance: number
  income_tax: number
  resident_id: string | null
  bank_info: string | null
  dependents: number
  hourly_rate: number | null
  memo: string | null
  is_active: boolean
}

interface DeptRow {
  id: string; key: string; label: string
  description: string | null; color: string; sort_order: number
  parent_id: string | null
}

interface BusinessEntity {
  id: string
  name: string
  business_number: string | null
  representative_name: string | null
  business_type: string | null
  business_item: string | null
  address: string | null
  email: string | null
  phone: string | null
  corporate_number: string | null
  bank_name: string | null
  account_number: string | null
  account_holder: string | null
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
  salaryRecords: SalaryRecord[]
  onboardingItems: OnboardingItem[]
  notionTemplateUrl: string
  orgDepts: DeptRow[]
  employeeCards: EmployeeCard[]
}

const EMPTY_FORM = { name: '', email: '', departments: [] as string[], role: 'member' }

const DEPT_COLORS = ['#FBBF24','#60A5FA','#34D399','#A78BFA','#F87171','#FB923C','#38BDF8','#4ADE80','#F472B6','#9CA3AF']

function DeptCheckboxes({ selected, onChange, depts }: { selected: string[], onChange: (v: string[]) => void, depts: DeptRow[] }) {
  const toggle = (key: string) =>
    onChange(selected.includes(key) ? selected.filter(d => d !== key) : [...selected, key])
  return (
    <div className="flex flex-wrap gap-2">
      {depts.map(d => (
        <button
          key={d.key}
          type="button"
          onClick={() => toggle(d.key)}
          className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
            selected.includes(d.key)
              ? 'border-yellow-400 bg-yellow-50 text-yellow-800 font-medium'
              : 'border-gray-200 text-gray-500 hover:border-yellow-300'
          }`}
        >
          {d.label}
        </button>
      ))}
    </div>
  )
}

export default function AdminClient({ users: initialUsers, entities: initialEntities, permissionsByRole: initialPerms, usedDaysMap, initialDaysMap, oneOnOnes: initialOneOnOnes, docRequests: initialDocRequests, salaryRecords: initialSalaryRecords, onboardingItems: initialOnboardingItems, notionTemplateUrl: initialNotionUrl, orgDepts: initialOrgDepts, employeeCards: initialEmployeeCards }: Props) {
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
  const [activeTab, setActiveTab] = useState<'team' | 'entities' | 'permissions' | 'hr' | 'api-usage'>('team')
  const [editingJoinId, setEditingJoinId] = useState<string | null>(null)
  const [joinDateVal, setJoinDateVal] = useState('')
  const [editingInitialId, setEditingInitialId] = useState<string | null>(null)
  const [initialDaysVal, setInitialDaysVal] = useState('')

  // 직원 카드 상태
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [hrDetailTab, setHrDetailTab] = useState<'info' | 'salary_settings' | 'salary' | 'oo' | 'docs' | 'onboarding'>('info')
  const [oneOnOnes, setOneOnOnes] = useState<OneOnOne[]>(initialOneOnOnes)
  const [docRequests, setDocRequests] = useState<DocRequest[]>(initialDocRequests)
  const [ooForm, setOoForm] = useState({ date: '', content: '', action_items: '' })
  const [showOoForm, setShowOoForm] = useState(false)
  const [showLeaveForm, setShowLeaveForm] = useState(false)
  const [leaveForm, setLeaveForm] = useState({ type: '연차', start_date: '', end_date: '', days: '', reason: '' })

  // 직원 이메일 초대 (기존 프로필 매칭)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteLoading, setInviteLoading] = useState(false)
  const [inviteMsg, setInviteMsg] = useState('')

  // 임직원 상세 프로필
  const [editingProfile, setEditingProfile] = useState(false)
  const [profileForm, setProfileForm] = useState({ phone: '', emergency_name: '', emergency_phone: '', bank_name: '', account_number: '', birth_date: '' })
  const [showAccountNumber, setShowAccountNumber] = useState(false)

  // 급여 관리
  const [salaryRecords, setSalaryRecords] = useState<SalaryRecord[]>(initialSalaryRecords)
  const [salaryYear, setSalaryYear] = useState(new Date().getFullYear())
  const [editingSalaryMonth, setEditingSalaryMonth] = useState<number | null>(null)
  const [salaryForm, setSalaryForm] = useState({ base_salary: '', deductions: '', net_salary: '', memo: '' })

  // 급여설정 (employee_cards)
  const [employeeCards, setEmployeeCards] = useState<EmployeeCard[]>(initialEmployeeCards)
  const EMPTY_CARD = {
    id: '', employee_name: '', business_entity: '',
    base_salary: 0, meal_allowance: 0, mileage_allowance: 0, allowances: 0, fixed_bonus: 0,
    national_pension: 0, health_insurance: 0, employment_insurance: 0, income_tax: 0,
    resident_id: '', bank_info: '', dependents: 0, hourly_rate: 0, memo: '', is_active: true,
  }
  const [cardForm, setCardForm] = useState({ ...EMPTY_CARD })
  const [cardDependents, setCardDependents] = useState(0)
  const [cardSaving, setCardSaving] = useState(false)

  // 온보딩
  const [onboardingItems, setOnboardingItems] = useState<OnboardingItem[]>(initialOnboardingItems)
  const [newItemTitle, setNewItemTitle] = useState('')
  const [showNewItemInput, setShowNewItemInput] = useState(false)
  const [notionUrlInput, setNotionUrlInput] = useState(initialNotionUrl)
  const [showNotionInput, setShowNotionInput] = useState(false)
  const [notionImporting, setNotionImporting] = useState(false)

  // 조직도 뷰
  const [orgView, setOrgView] = useState(false)

  // 부서 관리
  const [depts, setDepts] = useState<DeptRow[]>(initialOrgDepts)
  const [editingDeptId, setEditingDeptId] = useState<string | null>(null)
  const [deptEditForm, setDeptEditForm] = useState({ label: '', description: '', color: '#9CA3AF' })
  const [showDeptAddForm, setShowDeptAddForm] = useState(false)
  const [deptAddForm, setDeptAddForm] = useState({ label: '', description: '', color: '#9CA3AF' })
  const [perms, setPerms] = useState(initialPerms)
  const [togglingKey, setTogglingKey] = useState<string | null>(null)
  const [entities, setEntities] = useState(initialEntities)
  useEffect(() => { setEntities(initialEntities) }, [initialEntities])
  const [showEntityForm, setShowEntityForm] = useState(false)
  const EMPTY_ENTITY_FORM = { name: '', business_number: '', representative_name: '', business_type: '', business_item: '', address: '', email: '', phone: '', corporate_number: '', bank_name: '', account_number: '', account_holder: '' }
  const [entityForm, setEntityForm] = useState(EMPTY_ENTITY_FORM)
  const [editingEntityId, setEditingEntityId] = useState<string | null>(null)
  const [editEntityForm, setEditEntityForm] = useState(EMPTY_ENTITY_FORM)

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
    Object.entries(entityForm).forEach(([k, v]) => fd.set(k, v))
    await createEntity(fd)
    setEntityForm(EMPTY_ENTITY_FORM)
    setShowEntityForm(false)
    startTransition(() => router.refresh())
  }

  const handleEntityUpdate = async (id: string) => {
    const fd = new FormData()
    fd.set('id', id)
    Object.entries(editEntityForm).forEach(([k, v]) => fd.set(k, v))
    await updateEntity(fd)
    setEntities(prev => prev.map(e => e.id === id ? {
      ...e,
      name: editEntityForm.name,
      business_number: editEntityForm.business_number || null,
      representative_name: editEntityForm.representative_name || null,
      business_type: editEntityForm.business_type || null,
      business_item: editEntityForm.business_item || null,
      address: editEntityForm.address || null,
      email: editEntityForm.email || null,
      phone: editEntityForm.phone || null,
      corporate_number: editEntityForm.corporate_number || null,
      bank_name: editEntityForm.bank_name || null,
      account_number: editEntityForm.account_number || null,
      account_holder: editEntityForm.account_holder || null,
    } : e))
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
    { label: '매출 건 내부원가',  pageKey: 'cost_internal' },
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
        {([['team', '팀원 관리'], ['hr', '직원 관리'], ['entities', '사업자 관리'], ['permissions', '권한 안내'], ['api-usage', 'API 사용료']] as const).map(([key, label]) => (
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
          <div className="space-y-4">
          {/* 뷰 토글 */}
          <div className="flex justify-end">
            <div className="flex bg-gray-100 p-0.5 rounded-lg text-xs font-medium">
              <button onClick={() => { setOrgView(false); setSelectedUserId(null) }}
                className={`px-3 py-1.5 rounded-md transition-all ${!orgView ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}>
                카드 보기
              </button>
              <button onClick={() => { setOrgView(true); setSelectedUserId(null) }}
                className={`px-3 py-1.5 rounded-md transition-all ${orgView ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}>
                조직도
              </button>
            </div>
          </div>

          {/* 조직도 트리 뷰 */}
          {orgView && (() => {
            const roots = [...depts].filter(d => !d.parent_id).sort((a, b) => a.sort_order - b.sort_order)
            const getChildren = (parentId: string) => [...depts].filter(d => d.parent_id === parentId).sort((a, b) => a.sort_order - b.sort_order)

            const DeptEditForm = ({ dept, onSave, onCancel }: { dept: DeptRow, onSave: (updated: Partial<DeptRow>) => void, onCancel: () => void }) => (
              <div className="space-y-2 mb-3">
                <input type="text" value={deptEditForm.label} onChange={e => setDeptEditForm(f => ({...f, label: e.target.value}))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm" placeholder="이름" />
                <input type="text" value={deptEditForm.description} onChange={e => setDeptEditForm(f => ({...f, description: e.target.value}))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-xs text-gray-500" placeholder="설명 (선택)" />
                <div className="flex items-center gap-1.5 flex-wrap">
                  {DEPT_COLORS.map(c => (
                    <button key={c} onClick={() => setDeptEditForm(f => ({...f, color: c}))}
                      className={`w-5 h-5 rounded-full border-2 transition-all ${deptEditForm.color === c ? 'border-gray-800 scale-110' : 'border-transparent'}`}
                      style={{ backgroundColor: c }} />
                  ))}
                  <input type="color" value={deptEditForm.color} onChange={e => setDeptEditForm(f => ({...f, color: e.target.value}))}
                    className="w-5 h-5 rounded-full cursor-pointer border-0 p-0" />
                </div>
                <div className="flex gap-2">
                  <button onClick={async () => {
                    if (!deptEditForm.label.trim()) return
                    await updateDepartment(dept.id, deptEditForm.label, deptEditForm.description, deptEditForm.color, dept.parent_id ?? undefined)
                    onSave({ label: deptEditForm.label, description: deptEditForm.description || null, color: deptEditForm.color })
                    setEditingDeptId(null)
                  }} className="flex-1 py-1.5 bg-gray-900 text-white text-xs rounded-lg">저장</button>
                  <button onClick={onCancel} className="flex-1 py-1.5 border text-xs rounded-lg text-gray-400">취소</button>
                </div>
              </div>
            )

            const EmployeeChips = ({ deptKey, color }: { deptKey: string, color: string }) => {
              const deptUsers = users.filter(u => u.departments?.includes(deptKey))
              if (deptUsers.length === 0) return <p className="text-xs text-gray-400 italic">소속 직원 없음</p>
              return (
                <div className="flex flex-wrap gap-1.5">
                  {deptUsers.map(u => (
                    <div key={u.id} className="flex items-center gap-1.5 rounded-xl px-2 py-1.5" style={{ backgroundColor: color + '20' }}>
                      <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-gray-600 shrink-0"
                        style={{ backgroundColor: color + '40' }}>
                        {u.name?.[0]}
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-gray-800 leading-none">{u.name}</p>
                        <span className="text-[10px] text-gray-400">{ROLE_LABELS[u.role] ?? u.role}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )
            }

            return (
              <div>
                {roots.map(root => {
                  const children = getChildren(root.id)
                  const isEditingRoot = editingDeptId === root.id
                  return (
                    <div key={root.id}>
                      {/* 모회사 카드 */}
                      <div className="bg-gray-900 text-white rounded-2xl p-5">
                        {isEditingRoot ? (
                          <DeptEditForm dept={root} onSave={u => setDepts(prev => prev.map(d => d.id === root.id ? {...d, ...u} : d))} onCancel={() => setEditingDeptId(null)} />
                        ) : (
                          <div className="flex items-start justify-between mb-4">
                            <div>
                              <div className="flex items-center gap-2 mb-0.5">
                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: root.color }} />
                                <h2 className="text-base font-bold text-white">{root.label}</h2>
                                <span className="text-xs text-gray-400 bg-white/10 px-1.5 py-0.5 rounded-full">모회사</span>
                              </div>
                              {root.description && <p className="text-xs text-gray-400 ml-5">{root.description}</p>}
                            </div>
                            <div className="flex items-center gap-1">
                              <button onClick={() => { setDeptEditForm({ label: root.label, description: root.description ?? '', color: root.color }); setEditingDeptId(root.id) }}
                                className="p-1.5 text-gray-500 hover:text-white text-xs rounded">✏️</button>
                              <button onClick={async () => {
                                if (!confirm(`"${root.label}"을 삭제하시겠어요?`)) return
                                await deleteDepartment(root.id)
                                setDepts(prev => prev.filter(d => d.id !== root.id))
                              }} className="p-1.5 text-gray-500 hover:text-red-400 text-xs rounded">🗑️</button>
                            </div>
                          </div>
                        )}
                        <EmployeeChips deptKey={root.key} color={root.color === '#1F2937' ? '#9CA3AF' : root.color} />
                      </div>

                      {/* 트리 커넥터 */}
                      {children.length > 0 && (
                        <>
                          <div className="flex justify-center">
                            <div className="w-px h-5 bg-gray-300" />
                          </div>
                          {/* 자회사 그리드 */}
                          <div className="relative">
                            {children.length > 1 && (
                              <div className="absolute top-0 left-[8%] right-[8%] h-px bg-gray-300" />
                            )}
                            <div className={`grid gap-3 pt-5 ${
                              children.length >= 4 ? 'grid-cols-2 sm:grid-cols-3' :
                              children.length === 3 ? 'grid-cols-3' :
                              children.length === 2 ? 'grid-cols-2' : 'grid-cols-1 max-w-xs mx-auto'
                            }`}>
                              {children.map((child, cIdx) => {
                                const siblings = children
                                const isEditingChild = editingDeptId === child.id
                                return (
                                  <div key={child.id} className="relative">
                                    {/* 위 연결선 */}
                                    <div className="flex justify-center">
                                      <div className="w-px h-5 bg-gray-300 -mt-5" />
                                    </div>
                                    <div className="bg-white border border-gray-100 rounded-xl p-3 shadow-sm">
                                      {isEditingChild ? (
                                        <DeptEditForm dept={child} onSave={u => setDepts(prev => prev.map(d => d.id === child.id ? {...d, ...u} : d))} onCancel={() => setEditingDeptId(null)} />
                                      ) : (
                                        <div className="flex items-start justify-between mb-2">
                                          <div>
                                            <div className="flex items-center gap-1.5">
                                              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: child.color }} />
                                              <p className="text-sm font-bold text-gray-800">{child.label}</p>
                                            </div>
                                            {child.description && <p className="text-[11px] text-gray-400 ml-4 mt-0.5">{child.description}</p>}
                                          </div>
                                          <div className="flex items-center gap-0.5 shrink-0">
                                            <button disabled={cIdx === 0} onClick={async () => {
                                              const newDepts = [...depts]
                                              const ai = newDepts.findIndex(d => d.id === child.id)
                                              const bi = newDepts.findIndex(d => d.id === siblings[cIdx - 1].id)
                                              ;[newDepts[ai], newDepts[bi]] = [newDepts[bi], newDepts[ai]]
                                              setDepts(newDepts)
                                              await reorderDepartments(newDepts.map(d => d.id))
                                            }} className="p-0.5 text-gray-300 hover:text-gray-600 disabled:opacity-20 text-xs">←</button>
                                            <button disabled={cIdx === siblings.length - 1} onClick={async () => {
                                              const newDepts = [...depts]
                                              const ai = newDepts.findIndex(d => d.id === child.id)
                                              const bi = newDepts.findIndex(d => d.id === siblings[cIdx + 1].id)
                                              ;[newDepts[ai], newDepts[bi]] = [newDepts[bi], newDepts[ai]]
                                              setDepts(newDepts)
                                              await reorderDepartments(newDepts.map(d => d.id))
                                            }} className="p-0.5 text-gray-300 hover:text-gray-600 disabled:opacity-20 text-xs">→</button>
                                            <button onClick={() => { setDeptEditForm({ label: child.label, description: child.description ?? '', color: child.color }); setEditingDeptId(child.id) }}
                                              className="p-1 text-gray-300 hover:text-blue-500 text-[11px] rounded">✏️</button>
                                            <button onClick={async () => {
                                              if (!confirm(`"${child.label}"을 삭제하시겠어요?`)) return
                                              await deleteDepartment(child.id)
                                              setDepts(prev => prev.filter(d => d.id !== child.id))
                                            }} className="p-1 text-gray-300 hover:text-red-400 text-[11px] rounded">🗑️</button>
                                          </div>
                                        </div>
                                      )}
                                      <EmployeeChips deptKey={child.key} color={child.color} />
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  )
                })}

                {/* 부서 추가 */}
                <div className="mt-4">
                  {showDeptAddForm ? (
                    <div className="bg-white border-2 border-dashed border-gray-200 rounded-2xl p-4 space-y-2">
                      <input type="text" value={deptAddForm.label} onChange={e => setDeptAddForm(f => ({...f, label: e.target.value}))}
                        className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm" placeholder="이름 *" autoFocus />
                      <input type="text" value={deptAddForm.description} onChange={e => setDeptAddForm(f => ({...f, description: e.target.value}))}
                        className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-xs text-gray-500" placeholder="설명 (선택)" />
                      <div>
                        <p className="text-xs text-gray-400 mb-1">상위 조직</p>
                        <select value={deptAddForm.color} onChange={() => {}}
                          className="hidden" />
                        <select defaultValue="" className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm bg-white"
                          id="new-dept-parent">
                          <option value="">없음 (최상위)</option>
                          {depts.filter(d => !d.parent_id).map(d => (
                            <option key={d.id} value={d.id}>{d.label}</option>
                          ))}
                        </select>
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {DEPT_COLORS.map(c => (
                          <button key={c} onClick={() => setDeptAddForm(f => ({...f, color: c}))}
                            className={`w-5 h-5 rounded-full border-2 transition-all ${deptAddForm.color === c ? 'border-gray-800 scale-110' : 'border-transparent'}`}
                            style={{ backgroundColor: c }} />
                        ))}
                        <input type="color" value={deptAddForm.color} onChange={e => setDeptAddForm(f => ({...f, color: e.target.value}))}
                          className="w-5 h-5 cursor-pointer border-0 p-0 rounded-full" />
                      </div>
                      <div className="flex gap-2">
                        <button onClick={async () => {
                          if (!deptAddForm.label.trim()) return
                          const parentSel = (document.getElementById('new-dept-parent') as HTMLSelectElement)?.value
                          const newDept = await createDepartment(deptAddForm.label.trim(), deptAddForm.description, deptAddForm.color, parentSel || undefined)
                          if (newDept) setDepts(prev => [...prev, newDept as DeptRow])
                          setDeptAddForm({ label: '', description: '', color: '#9CA3AF' })
                          setShowDeptAddForm(false)
                        }} className="flex-1 py-2 bg-gray-900 text-white text-sm rounded-lg">추가</button>
                        <button onClick={() => { setShowDeptAddForm(false); setDeptAddForm({ label: '', description: '', color: '#9CA3AF' }) }}
                          className="flex-1 py-2 border text-sm rounded-lg text-gray-400">취소</button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => setShowDeptAddForm(true)}
                      className="w-full py-3 border-2 border-dashed border-gray-200 rounded-2xl text-sm text-gray-400 hover:border-gray-300 hover:text-gray-600 transition-colors">
                      + 부서 / 자회사 추가
                    </button>
                  )}
                </div>
              </div>
            )
          })()}

          {/* 카드 + 상세 패널 뷰 */}
          {!orgView && <div className={`flex gap-4 ${selectedUser ? 'items-start' : ''}`}>
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
                  <button key={u.id} onClick={() => { setSelectedUserId(isSelected ? null : u.id); setHrDetailTab('info'); setInviteEmail(''); setInviteMsg('') }}
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
                <div className="flex border-b border-gray-100 overflow-x-auto">
                  {([['info','정보'],['salary_settings','급여설정'],['salary','급여이력'],['oo','원온원'],['docs','서류'],['onboarding','온보딩']] as const).map(([key, label]) => (
                    <button key={key} onClick={() => setHrDetailTab(key as any)}
                      className={`flex-1 min-w-max py-2.5 px-3 text-xs font-medium transition-colors ${hrDetailTab === key ? 'border-b-2 border-gray-900 text-gray-900' : 'text-gray-400 hover:text-gray-600'}`}>
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
                            const val = e.target.value
                            setUsers(prev => prev.map(u => u.id === selectedUser.id ? { ...u, entity_id: val || null } : u))
                            await updateEmployeeEntity(selectedUser.id, val)
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

                      {/* 휴가 수동 추가 */}
                      <div>
                        <button onClick={() => setShowLeaveForm(v => !v)}
                          className="w-full py-2 border border-dashed border-gray-300 rounded-xl text-sm text-gray-500 hover:border-gray-400 hover:text-gray-700 transition-colors">
                          + 휴가 수동 추가
                        </button>
                        {showLeaveForm && (
                          <div className="mt-3 bg-gray-50 rounded-xl p-4 space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="text-xs text-gray-400 mb-1 block">유형</label>
                                <select value={leaveForm.type} onChange={e => setLeaveForm(f => ({...f, type: e.target.value}))}
                                  className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm bg-white">
                                  {['연차','반차(오전)','반차(오후)','병가','경조사','공가','기타'].map(t => <option key={t}>{t}</option>)}
                                </select>
                              </div>
                              <div>
                                <label className="text-xs text-gray-400 mb-1 block">일수</label>
                                <input type="number" min="0.5" max="30" step="0.5" value={leaveForm.days}
                                  onChange={e => setLeaveForm(f => ({...f, days: e.target.value}))}
                                  className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm bg-white" placeholder="1" />
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="text-xs text-gray-400 mb-1 block">시작일</label>
                                <input type="date" value={leaveForm.start_date} onChange={e => setLeaveForm(f => ({...f, start_date: e.target.value}))}
                                  className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm bg-white" />
                              </div>
                              <div>
                                <label className="text-xs text-gray-400 mb-1 block">종료일</label>
                                <input type="date" value={leaveForm.end_date} onChange={e => setLeaveForm(f => ({...f, end_date: e.target.value}))}
                                  className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm bg-white" />
                              </div>
                            </div>
                            <div>
                              <label className="text-xs text-gray-400 mb-1 block">사유 (선택)</label>
                              <input type="text" value={leaveForm.reason} onChange={e => setLeaveForm(f => ({...f, reason: e.target.value}))}
                                className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm bg-white" placeholder="사유 입력..." />
                            </div>
                            <div className="flex gap-2">
                              <button onClick={async () => {
                                if (!leaveForm.start_date || !leaveForm.end_date || !leaveForm.days) return
                                await adminAddLeave(selectedUser.id, leaveForm.type, leaveForm.start_date, leaveForm.end_date, parseFloat(leaveForm.days), leaveForm.reason)
                                setLeaveForm({ type: '연차', start_date: '', end_date: '', days: '', reason: '' })
                                setShowLeaveForm(false)
                                startTransition(() => router.refresh())
                              }} className="flex-1 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-800">저장</button>
                              <button onClick={() => setShowLeaveForm(false)} className="flex-1 py-2 border border-gray-200 text-sm rounded-lg text-gray-500">취소</button>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* 임직원 상세 프로필 */}
                      <div className="border-t border-gray-100 pt-4">
                        <div className="flex items-center justify-between mb-3">
                          <p className="text-xs font-semibold text-gray-500">개인 정보</p>
                          {!editingProfile && (
                            <button onClick={() => {
                              setProfileForm({
                                phone: selectedUser.phone ?? '',
                                emergency_name: selectedUser.emergency_name ?? '',
                                emergency_phone: selectedUser.emergency_phone ?? '',
                                bank_name: selectedUser.bank_name ?? '',
                                account_number: selectedUser.account_number ?? '',
                                birth_date: selectedUser.birth_date ?? '',
                              })
                              setEditingProfile(true)
                            }} className="text-xs text-gray-400 hover:text-blue-500 underline decoration-dashed underline-offset-2">편집</button>
                          )}
                        </div>
                        {editingProfile ? (
                          <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                              {[['phone','연락처','010-0000-0000'],['emergency_name','비상연락처 이름','이름'],['emergency_phone','비상연락처 번호','010-0000-0000'],['birth_date','생년월일','']].map(([field, label, ph]) => (
                                <div key={field}>
                                  <label className="text-xs text-gray-400 mb-1 block">{label}</label>
                                  <input type={field === 'birth_date' ? 'date' : 'text'} value={(profileForm as any)[field]}
                                    onChange={e => setProfileForm(f => ({...f, [field]: e.target.value}))}
                                    className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm bg-white" placeholder={ph} />
                                </div>
                              ))}
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="text-xs text-gray-400 mb-1 block">은행</label>
                                <input type="text" value={profileForm.bank_name} onChange={e => setProfileForm(f => ({...f, bank_name: e.target.value}))}
                                  className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm bg-white" placeholder="국민은행" />
                              </div>
                              <div>
                                <label className="text-xs text-gray-400 mb-1 block">계좌번호</label>
                                <input type="text" value={profileForm.account_number} onChange={e => setProfileForm(f => ({...f, account_number: e.target.value}))}
                                  className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm bg-white" placeholder="000-000-000000" />
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <button onClick={async () => {
                                await updateProfileDetail(selectedUser.id, profileForm)
                                setUsers(prev => prev.map(u => u.id === selectedUser.id ? {...u, ...profileForm, birth_date: profileForm.birth_date || null, phone: profileForm.phone || null, emergency_name: profileForm.emergency_name || null, emergency_phone: profileForm.emergency_phone || null, bank_name: profileForm.bank_name || null, account_number: profileForm.account_number || null } : u))
                                setEditingProfile(false)
                              }} className="flex-1 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-800">저장</button>
                              <button onClick={() => setEditingProfile(false)} className="flex-1 py-2 border border-gray-200 text-sm rounded-lg text-gray-500">취소</button>
                            </div>
                          </div>
                        ) : (
                          <div className="grid grid-cols-2 gap-y-2 text-sm">
                            {[
                              ['연락처', selectedUser.phone],
                              ['생년월일', selectedUser.birth_date],
                              ['비상연락처', selectedUser.emergency_name ? `${selectedUser.emergency_name} ${selectedUser.emergency_phone ?? ''}` : null],
                              ['계좌', selectedUser.bank_name ? `${selectedUser.bank_name} ${showAccountNumber ? selectedUser.account_number : (selectedUser.account_number ? '****' + selectedUser.account_number.slice(-4) : null)}` : null],
                            ].map(([label, value]) => (
                              <div key={label as string}>
                                <p className="text-xs text-gray-400">{label}</p>
                                <p className="text-gray-700 text-sm">
                                  {value ?? <span className="text-gray-300 text-xs">미입력</span>}
                                  {label === '계좌' && selectedUser.account_number && (
                                    <button onClick={() => setShowAccountNumber(v => !v)} className="ml-1.5 text-[10px] text-gray-400 hover:text-gray-600">
                                      {showAccountNumber ? '숨기기' : '보기'}
                                    </button>
                                  )}
                                </p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* 직원카드 매칭 (profile_id 없는 카드가 있을 때) */}
                      {(() => {
                        const linked = employeeCards.find(c => c.profile_id === selectedUser.id)
                        const unlinked = employeeCards.filter(c => !c.profile_id)
                        if (linked || unlinked.length === 0) return null
                        return (
                          <div className="border border-dashed border-amber-200 rounded-xl p-4 bg-amber-50/40">
                            <p className="text-xs font-semibold text-amber-700 mb-1">직원카드 연결</p>
                            <p className="text-xs text-gray-500 mb-3">급여설정에 등록된 직원카드와 이 계정을 연결합니다.</p>
                            <div className="flex gap-2">
                              <select
                                defaultValue=""
                                id={`card-link-${selectedUser.id}`}
                                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
                              >
                                <option value="" disabled>직원카드 선택</option>
                                {unlinked.map(c => (
                                  <option key={c.id} value={c.id}>{c.employee_name}{c.business_entity ? ` (${c.business_entity})` : ''}</option>
                                ))}
                              </select>
                              <button
                                onClick={async () => {
                                  const sel = document.getElementById(`card-link-${selectedUser.id}`) as HTMLSelectElement
                                  if (!sel.value) return
                                  await linkEmployeeCard(sel.value, selectedUser.id)
                                  setEmployeeCards(prev => prev.map(c => c.id === sel.value ? { ...c, profile_id: selectedUser.id } : c))
                                  startTransition(() => router.refresh())
                                }}
                                className="px-3 py-2 bg-amber-500 text-white text-sm rounded-lg hover:bg-amber-600 whitespace-nowrap"
                              >
                                연결
                              </button>
                            </div>
                          </div>
                        )
                      })()}

                      {/* 이메일 초대 (아직 초대 안 된 직원) */}
                      {!selectedUser.email && (
                        <div className="border border-dashed border-blue-200 rounded-xl p-4 bg-blue-50/40">
                          <p className="text-xs font-semibold text-blue-700 mb-2">시스템 초대 발송</p>
                          <p className="text-xs text-gray-500 mb-3">이메일을 입력하면 기존 직원 정보를 유지한 채로 초대 링크를 발송합니다.</p>
                          {inviteMsg && (
                            <p className={`text-xs mb-2 ${inviteMsg.startsWith('오류') ? 'text-red-500' : 'text-green-600'}`}>{inviteMsg}</p>
                          )}
                          <div className="flex gap-2">
                            <input
                              type="email"
                              value={inviteEmail}
                              onChange={e => { setInviteEmail(e.target.value); setInviteMsg('') }}
                              placeholder="이메일 주소"
                              className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
                            />
                            <button
                              disabled={inviteLoading || !inviteEmail}
                              onClick={async () => {
                                setInviteLoading(true)
                                setInviteMsg('')
                                try {
                                  const res = await fetch('/api/admin/invite', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                      email: inviteEmail,
                                      name: selectedUser.name,
                                      departments: selectedUser.departments ?? [],
                                      role: selectedUser.role,
                                      existingProfileId: selectedUser.id,
                                    }),
                                  })
                                  const d = await res.json()
                                  if (!res.ok) {
                                    setInviteMsg(`오류: ${d.error ?? '초대 실패'}`)
                                  } else {
                                    setInviteMsg('초대 메일을 발송했습니다.')
                                    setInviteEmail('')
                                    startTransition(() => router.refresh())
                                  }
                                } catch {
                                  setInviteMsg('오류: 네트워크 오류')
                                } finally {
                                  setInviteLoading(false)
                                }
                              }}
                              className="px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap"
                            >
                              {inviteLoading ? '발송중...' : '초대 발송'}
                            </button>
                          </div>
                        </div>
                      )}
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

                  {/* 급여설정 */}
                  {hrDetailTab === 'salary_settings' && (() => {
                    const userCard = employeeCards.find(c => c.profile_id === selectedUser.id)
                    const isNew = !userCard
                    const cardNumF = (key: keyof typeof cardForm) => ({
                      value: (cardForm[key] as number) === 0 ? '' : (cardForm[key] as number).toLocaleString(),
                      onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
                        setCardForm(f => ({ ...f, [key]: Number(e.target.value.replace(/[^0-9]/g, '')) || 0 })),
                    })
                    function initCard() {
                      if (userCard) {
                        setCardForm({
                          id: userCard.id, employee_name: userCard.employee_name,
                          business_entity: userCard.business_entity ?? '',
                          base_salary: userCard.base_salary, meal_allowance: userCard.meal_allowance,
                          mileage_allowance: userCard.mileage_allowance, allowances: userCard.allowances,
                          fixed_bonus: userCard.fixed_bonus, national_pension: userCard.national_pension,
                          health_insurance: userCard.health_insurance, employment_insurance: userCard.employment_insurance,
                          income_tax: userCard.income_tax, resident_id: userCard.resident_id ?? '',
                          bank_info: userCard.bank_info ?? '', dependents: userCard.dependents,
                          hourly_rate: userCard.hourly_rate ?? 0, memo: userCard.memo ?? '', is_active: userCard.is_active,
                        })
                        setCardDependents(userCard.dependents)
                      } else {
                        setCardForm({ ...EMPTY_CARD, employee_name: selectedUser?.name ?? '' })
                        setCardDependents(0)
                      }
                    }
                    function autoCalc() {
                      const mealTaxFree = Math.min(cardForm.meal_allowance, 200_000)
                      const mileageTaxFree = Math.min(cardForm.mileage_allowance, 200_000)
                      const taxable = cardForm.base_salary + (cardForm.meal_allowance - mealTaxFree)
                        + (cardForm.mileage_allowance - mileageTaxFree) + cardForm.allowances + cardForm.fixed_bonus
                      const total = cardForm.base_salary + cardForm.meal_allowance + cardForm.mileage_allowance + cardForm.allowances + cardForm.fixed_bonus
                      const pension = Math.round(taxable * 0.045 / 10) * 10
                      const healthBase = Math.round(taxable * 0.03545 / 10) * 10
                      const health = healthBase + Math.round(healthBase * 0.1295 / 10) * 10
                      const employment = Math.round(total * 0.009 / 10) * 10
                      // 소득세 간이 계산
                      const annual = taxable * 12
                      let wageDeduction: number
                      if (annual <= 5_000_000) wageDeduction = annual * 0.7
                      else if (annual <= 15_000_000) wageDeduction = 3_500_000 + (annual - 5_000_000) * 0.4
                      else if (annual <= 45_000_000) wageDeduction = 7_500_000 + (annual - 15_000_000) * 0.15
                      else if (annual <= 100_000_000) wageDeduction = 12_000_000 + (annual - 45_000_000) * 0.05
                      else wageDeduction = 14_750_000
                      const earned = annual - wageDeduction
                      const basicDeduction = 1_500_000 * (1 + Math.max(0, cardDependents))
                      const taxBase = Math.max(0, earned - basicDeduction)
                      let tax: number
                      if (taxBase <= 14_000_000) tax = taxBase * 0.06
                      else if (taxBase <= 50_000_000) tax = 840_000 + (taxBase - 14_000_000) * 0.15
                      else if (taxBase <= 88_000_000) tax = 6_240_000 + (taxBase - 50_000_000) * 0.24
                      else tax = 15_360_000 + (taxBase - 88_000_000) * 0.35
                      let taxCredit = tax <= 1_300_000 ? tax * 0.55 : 715_000 + (tax - 1_300_000) * 0.30
                      const creditLimit = annual <= 33_000_000 ? 740_000
                        : annual <= 70_000_000 ? 740_000 - (annual - 33_000_000) * 0.008 : 66_000
                      taxCredit = Math.min(taxCredit, creditLimit)
                      const incomeTax = Math.round(Math.max(0, (tax - taxCredit) / 12) / 10) * 10
                      setCardForm(f => ({ ...f, national_pension: pension, health_insurance: health, employment_insurance: employment, income_tax: incomeTax }))
                    }
                    const gross = cardForm.base_salary + cardForm.meal_allowance + cardForm.mileage_allowance + cardForm.allowances + cardForm.fixed_bonus
                    const ded = cardForm.national_pension + cardForm.health_insurance + cardForm.employment_insurance + cardForm.income_tax
                    return (
                      <div className="space-y-4">
                        {isNew ? (
                          <div className="bg-gray-50 rounded-xl p-4 flex items-center justify-between">
                            <p className="text-sm text-gray-500">아직 급여설정이 없어요.</p>
                            <button onClick={initCard}
                              className="text-sm px-3 py-1.5 rounded-lg font-semibold hover:opacity-80 transition-all"
                              style={{ backgroundColor: '#FFCE00', color: '#121212' }}>설정 시작</button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between">
                            <p className="text-xs text-gray-400">{selectedUser.name} 급여 템플릿</p>
                            <div className="flex gap-2">
                              <button onClick={initCard} className="text-xs text-gray-400 hover:text-gray-600">초기화</button>
                              <button onClick={async () => {
                                if (!confirm('급여설정을 삭제하시겠어요?')) return
                                await deleteEmployeeCard(userCard!.id)
                                setEmployeeCards(prev => prev.filter(c => c.id !== userCard!.id))
                              }} className="text-xs text-red-400 hover:text-red-600">삭제</button>
                            </div>
                          </div>
                        )}

                        {(cardForm.employee_name || !isNew) && (
                          <>
                            {/* 지급항목 */}
                            <div className="border-t border-gray-100 pt-3 space-y-2">
                              <p className="text-xs font-semibold text-gray-600">지급 항목</p>
                              {([
                                { label: '기본급 *', key: 'base_salary' as const },
                                { label: '식대', key: 'meal_allowance' as const },
                                { label: '자가운전', key: 'mileage_allowance' as const },
                                { label: '수당', key: 'allowances' as const },
                                { label: '고정상여', key: 'fixed_bonus' as const },
                              ]).map(({ label, key }) => (
                                <div key={key} className="flex items-center gap-2">
                                  <label className="text-xs text-gray-500 w-20 flex-shrink-0">{label}</label>
                                  <input type="text" inputMode="numeric" {...cardNumF(key)}
                                    className="flex-1 px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm text-right focus:outline-none focus:border-yellow-400" />
                                  <span className="text-xs text-gray-400">원</span>
                                </div>
                              ))}
                            </div>

                            {/* 공제항목 */}
                            <div className="border-t border-gray-100 pt-3 space-y-2">
                              <div className="flex items-center justify-between">
                                <p className="text-xs font-semibold text-gray-600">공제 항목</p>
                                <div className="flex items-center gap-2">
                                  <label className="text-xs text-gray-500">부양가족</label>
                                  <select value={cardDependents} onChange={e => setCardDependents(Number(e.target.value))}
                                    className="text-xs px-2 py-1 border border-gray-200 rounded-lg focus:outline-none bg-white">
                                    {[0,1,2,3,4,5].map(n => <option key={n} value={n}>{n}명{n === 0 ? '(본인)' : ''}</option>)}
                                  </select>
                                  <button type="button" onClick={autoCalc}
                                    className="text-xs px-2.5 py-1 rounded-lg font-semibold hover:opacity-80"
                                    style={{ backgroundColor: '#FFCE00', color: '#121212' }}>자동계산</button>
                                </div>
                              </div>
                              {([
                                { label: '국민연금', key: 'national_pension' as const },
                                { label: '건강보험', key: 'health_insurance' as const },
                                { label: '고용보험', key: 'employment_insurance' as const },
                                { label: '소득세', key: 'income_tax' as const },
                              ]).map(({ label, key }) => (
                                <div key={key} className="flex items-center gap-2">
                                  <label className="text-xs text-gray-500 w-20 flex-shrink-0">{label}</label>
                                  <input type="text" inputMode="numeric" {...cardNumF(key)}
                                    className="flex-1 px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm text-right focus:outline-none focus:border-yellow-400" />
                                  <span className="text-xs text-gray-400">원</span>
                                </div>
                              ))}
                              {gross > 0 && (
                                <div className="bg-gray-50 rounded-lg px-3 py-2 flex justify-between items-center">
                                  <span className="text-xs text-gray-500">월 실수령 예상</span>
                                  <span className="text-sm font-bold text-green-600">{(gross - ded).toLocaleString()}원</span>
                                </div>
                              )}
                            </div>

                            {/* 기준시급 */}
                            <div className="border-t border-gray-100 pt-3">
                              <div className="flex items-center gap-2">
                                <label className="text-xs text-gray-500 w-20 flex-shrink-0">기준 시급</label>
                                <input type="text" inputMode="numeric" {...cardNumF('hourly_rate')}
                                  placeholder="0"
                                  className="w-28 px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm text-right focus:outline-none focus:border-yellow-400" />
                                <span className="text-xs text-gray-400">원</span>
                                {cardForm.hourly_rate > 0 && (
                                  <span className="text-xs text-blue-500">추가수당 {Math.round(cardForm.hourly_rate * 1.5).toLocaleString()}원/h</span>
                                )}
                              </div>
                            </div>

                            {/* 계좌·주민번호 */}
                            <div className="border-t border-gray-100 pt-3 space-y-2">
                              <div className="flex items-center gap-2">
                                <label className="text-xs text-gray-500 w-20 flex-shrink-0">계좌번호</label>
                                <input value={cardForm.bank_info}
                                  onChange={e => setCardForm(f => ({ ...f, bank_info: e.target.value }))}
                                  placeholder="은행 계좌번호"
                                  className="flex-1 px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-yellow-400" />
                              </div>
                              <div className="flex items-center gap-2">
                                <label className="text-xs text-gray-500 w-20 flex-shrink-0">주민번호</label>
                                <input value={cardForm.resident_id}
                                  onChange={e => setCardForm(f => ({ ...f, resident_id: e.target.value }))}
                                  placeholder="000000-0000000"
                                  className="flex-1 px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:border-yellow-400" />
                              </div>
                              <div className="flex items-center gap-2">
                                <label className="text-xs text-gray-500 w-20 flex-shrink-0">메모</label>
                                <input value={cardForm.memo}
                                  onChange={e => setCardForm(f => ({ ...f, memo: e.target.value }))}
                                  className="flex-1 px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-yellow-400" />
                              </div>
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" checked={cardForm.is_active}
                                  onChange={e => setCardForm(f => ({ ...f, is_active: e.target.checked }))} className="rounded" />
                                <span className="text-xs text-gray-600">활성 (월급여 자동생성에 포함)</span>
                              </label>
                            </div>

                            <button onClick={async () => {
                              if (!cardForm.base_salary) return alert('기본급을 입력해주세요.')
                              setCardSaving(true)
                              const saved = await upsertEmployeeCard({
                                ...(cardForm.id ? { id: cardForm.id } : {}),
                                employee_name: selectedUser.name,
                                business_entity: cardForm.business_entity || null,
                                profile_id: selectedUser.id,
                                base_salary: cardForm.base_salary,
                                meal_allowance: cardForm.meal_allowance,
                                mileage_allowance: cardForm.mileage_allowance,
                                allowances: cardForm.allowances,
                                fixed_bonus: cardForm.fixed_bonus,
                                national_pension: cardForm.national_pension,
                                health_insurance: cardForm.health_insurance,
                                employment_insurance: cardForm.employment_insurance,
                                income_tax: cardForm.income_tax,
                                resident_id: cardForm.resident_id || null,
                                bank_info: cardForm.bank_info || null,
                                dependents: cardDependents,
                                hourly_rate: cardForm.hourly_rate || null,
                                memo: cardForm.memo || null,
                                is_active: cardForm.is_active,
                              })
                              setCardSaving(false)
                              startTransition(() => router.refresh())
                            }} disabled={cardSaving}
                              className="w-full py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 hover:opacity-80 transition-all"
                              style={{ backgroundColor: '#FFCE00', color: '#121212' }}>
                              {cardSaving ? '저장 중...' : '저장'}
                            </button>
                          </>
                        )}
                      </div>
                    )
                  })()}

                  {/* 급여이력 */}
                  {hrDetailTab === 'salary' && (() => {
                    const userSalary = salaryRecords.filter(s => s.member_id === selectedUser.id && s.year === salaryYear)
                    const salaryMap = Object.fromEntries(userSalary.map(s => [s.month, s]))
                    const totalBase = userSalary.reduce((a, s) => a + (s.base_salary ?? 0), 0)
                    const totalNet = userSalary.reduce((a, s) => a + (s.net_salary ?? 0), 0)
                    const fmt = (n: number) => n ? n.toLocaleString('ko-KR') + '원' : '-'
                    return (
                      <div className="space-y-3">
                        {/* 연도 선택 */}
                        <div className="flex items-center gap-2">
                          <button onClick={() => setSalaryYear(y => y - 1)} className="p-1 rounded hover:bg-gray-100 text-gray-400">‹</button>
                          <span className="text-sm font-semibold text-gray-800 w-12 text-center">{salaryYear}</span>
                          <button onClick={() => setSalaryYear(y => y + 1)} className="p-1 rounded hover:bg-gray-100 text-gray-400">›</button>
                        </div>
                        {/* 월별 테이블 */}
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="border-b border-gray-100">
                                <th className="text-left py-2 text-gray-400 font-medium w-8">월</th>
                                <th className="text-right py-2 text-gray-400 font-medium">기본급</th>
                                <th className="text-right py-2 text-gray-400 font-medium">공제</th>
                                <th className="text-right py-2 text-gray-400 font-medium">실수령</th>
                                <th className="w-6"></th>
                              </tr>
                            </thead>
                            <tbody>
                              {Array.from({length: 12}, (_, i) => i + 1).map(month => {
                                const rec = salaryMap[month]
                                const isEditing = editingSalaryMonth === month
                                return (
                                  <tr key={month} className="border-b border-gray-50 hover:bg-gray-50">
                                    {isEditing ? (
                                      <td colSpan={5} className="py-2">
                                        <div className="grid grid-cols-2 gap-2 mb-2">
                                          {[['base_salary','기본급'],['deductions','공제'],['net_salary','실수령']].map(([field, label]) => (
                                            <div key={field}>
                                              <label className="text-[10px] text-gray-400 block mb-0.5">{label}</label>
                                              <input type="number" value={(salaryForm as any)[field]}
                                                onChange={e => setSalaryForm(f => ({...f, [field]: e.target.value}))}
                                                className="w-full border border-gray-200 rounded px-2 py-1 text-xs bg-white" placeholder="0" />
                                            </div>
                                          ))}
                                          <div>
                                            <label className="text-[10px] text-gray-400 block mb-0.5">메모</label>
                                            <input type="text" value={salaryForm.memo}
                                              onChange={e => setSalaryForm(f => ({...f, memo: e.target.value}))}
                                              className="w-full border border-gray-200 rounded px-2 py-1 text-xs bg-white" />
                                          </div>
                                        </div>
                                        <div className="flex gap-1.5">
                                          <button onClick={async () => {
                                            await upsertSalary(selectedUser.id, salaryYear, month, Number(salaryForm.base_salary)||0, Number(salaryForm.deductions)||0, Number(salaryForm.net_salary)||0, salaryForm.memo)
                                            const newRec: SalaryRecord = { id: rec?.id ?? Date.now().toString(), member_id: selectedUser.id, year: salaryYear, month, base_salary: Number(salaryForm.base_salary)||0, deductions: Number(salaryForm.deductions)||0, net_salary: Number(salaryForm.net_salary)||0, memo: salaryForm.memo || null }
                                            setSalaryRecords(prev => rec ? prev.map(s => s.id === rec.id ? newRec : s) : [...prev, newRec])
                                            setEditingSalaryMonth(null)
                                          }} className="flex-1 py-1 bg-gray-900 text-white rounded text-xs">저장</button>
                                          <button onClick={() => setEditingSalaryMonth(null)} className="flex-1 py-1 border rounded text-xs text-gray-400">취소</button>
                                          {rec && <button onClick={async () => { await deleteSalary(rec.id); setSalaryRecords(prev => prev.filter(s => s.id !== rec.id)); setEditingSalaryMonth(null) }} className="px-2 py-1 text-red-400 hover:text-red-600 text-xs">삭제</button>}
                                        </div>
                                      </td>
                                    ) : (
                                      <>
                                        <td className="py-2 text-gray-500 font-medium">{month}월</td>
                                        <td className="py-2 text-right text-gray-700">{rec ? fmt(rec.base_salary) : <span className="text-gray-300">-</span>}</td>
                                        <td className="py-2 text-right text-gray-500">{rec ? fmt(rec.deductions) : <span className="text-gray-300">-</span>}</td>
                                        <td className="py-2 text-right font-medium text-gray-800">{rec ? fmt(rec.net_salary) : <span className="text-gray-300">-</span>}</td>
                                        <td className="py-2 text-right">
                                          <button onClick={() => { setSalaryForm({ base_salary: String(rec?.base_salary ?? ''), deductions: String(rec?.deductions ?? ''), net_salary: String(rec?.net_salary ?? ''), memo: rec?.memo ?? '' }); setEditingSalaryMonth(month) }}
                                            className="text-[10px] text-gray-300 hover:text-blue-500">{rec ? '편집' : '+'}</button>
                                        </td>
                                      </>
                                    )}
                                  </tr>
                                )
                              })}
                            </tbody>
                            {userSalary.length > 0 && (
                              <tfoot>
                                <tr className="border-t-2 border-gray-200">
                                  <td className="py-2 text-xs font-bold text-gray-600">합계</td>
                                  <td className="py-2 text-right text-xs font-bold text-gray-700">{fmt(totalBase)}</td>
                                  <td></td>
                                  <td className="py-2 text-right text-xs font-bold text-gray-800">{fmt(totalNet)}</td>
                                  <td></td>
                                </tr>
                              </tfoot>
                            )}
                          </table>
                        </div>
                      </div>
                    )
                  })()}

                  {/* 온보딩 */}
                  {hrDetailTab === 'onboarding' && (() => {
                    const userItems = onboardingItems.filter(o => o.member_id === selectedUser.id).sort((a, b) => a.sort_order - b.sort_order)
                    const completedCount = userItems.filter(o => o.completed).length
                    return (
                      <div className="space-y-3">
                        {/* 진행 현황 바 */}
                        {userItems.length > 0 && (
                          <div>
                            <div className="flex justify-between text-xs text-gray-500 mb-1">
                              <span>온보딩 진행</span>
                              <span className="font-medium">{completedCount} / {userItems.length}</span>
                            </div>
                            <div className="bg-gray-100 rounded-full h-2">
                              <div className="bg-green-400 h-2 rounded-full transition-all"
                                style={{ width: `${Math.round(completedCount / userItems.length * 100)}%` }} />
                            </div>
                          </div>
                        )}

                        {/* Notion 가져오기 */}
                        <div>
                          <button onClick={() => setShowNotionInput(v => !v)}
                            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg px-3 py-1.5 hover:border-gray-300 transition-colors">
                            <span>Notion에서 가져오기</span>
                          </button>
                          {showNotionInput && (
                            <div className="mt-2 bg-gray-50 rounded-xl p-3 space-y-2">
                              <input type="text" value={notionUrlInput} onChange={e => setNotionUrlInput(e.target.value)}
                                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs bg-white"
                                placeholder="Notion 페이지 URL 붙여넣기..." />
                              <div className="flex gap-2">
                                <button disabled={notionImporting} onClick={async () => {
                                  if (!notionUrlInput) return
                                  setNotionImporting(true)
                                  try {
                                    await updateNotionTemplateUrl(notionUrlInput)
                                    const count = await importOnboardingFromNotion(selectedUser.id, notionUrlInput)
                                    startTransition(() => router.refresh())
                                    setShowNotionInput(false)
                                    alert(`${count}개 항목을 가져왔어요.`)
                                  } catch (e: any) {
                                    alert(e.message ?? '가져오기 실패')
                                  } finally {
                                    setNotionImporting(false)
                                  }
                                }} className="flex-1 py-1.5 bg-gray-900 text-white text-xs rounded-lg disabled:opacity-50">
                                  {notionImporting ? '가져오는 중...' : '가져오기'}
                                </button>
                                <button onClick={() => setShowNotionInput(false)} className="flex-1 py-1.5 border text-xs rounded-lg text-gray-400">취소</button>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* 체크리스트 */}
                        {userItems.length === 0 && !showNotionInput && (
                          <p className="text-center text-sm text-gray-400 py-4">온보딩 항목이 없어요.</p>
                        )}
                        <div className="space-y-1">
                          {userItems.map(item => (
                            <div key={item.id} className="flex items-center gap-2.5 group py-1.5">
                              <input type="checkbox" checked={item.completed}
                                onChange={async e => {
                                  const val = e.target.checked
                                  setOnboardingItems(prev => prev.map(o => o.id === item.id ? {...o, completed: val} : o))
                                  await toggleOnboardingItem(item.id, val)
                                }}
                                className="w-4 h-4 rounded border-gray-300 accent-gray-800 shrink-0" />
                              <span className={`flex-1 text-sm ${item.completed ? 'line-through text-gray-300' : 'text-gray-700'}`}>{item.title}</span>
                              {item.source === 'notion' && <span className="text-[10px] text-gray-300 shrink-0">N</span>}
                              <button onClick={async () => {
                                setOnboardingItems(prev => prev.filter(o => o.id !== item.id))
                                await deleteOnboardingItem(item.id)
                              }} className="text-gray-200 hover:text-red-400 opacity-0 group-hover:opacity-100 text-xs shrink-0">×</button>
                            </div>
                          ))}
                        </div>

                        {/* 항목 추가 */}
                        {showNewItemInput ? (
                          <div className="flex gap-2 mt-1">
                            <input type="text" value={newItemTitle} onChange={e => setNewItemTitle(e.target.value)}
                              onKeyDown={async e => {
                                if (e.key === 'Enter' && newItemTitle.trim()) {
                                  const sortOrder = userItems.length
                                  const optimistic: OnboardingItem = { id: Date.now().toString(), member_id: selectedUser.id, title: newItemTitle.trim(), completed: false, completed_at: null, source: 'manual', notion_block_id: null, sort_order: sortOrder }
                                  setOnboardingItems(prev => [...prev, optimistic])
                                  setNewItemTitle('')
                                  setShowNewItemInput(false)
                                  await addOnboardingItem(selectedUser.id, optimistic.title, sortOrder)
                                }
                              }}
                              autoFocus
                              className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white" placeholder="항목 이름..." />
                            <button onClick={async () => {
                              if (!newItemTitle.trim()) { setShowNewItemInput(false); return }
                              const sortOrder = userItems.length
                              const optimistic: OnboardingItem = { id: Date.now().toString(), member_id: selectedUser.id, title: newItemTitle.trim(), completed: false, completed_at: null, source: 'manual', notion_block_id: null, sort_order: sortOrder }
                              setOnboardingItems(prev => [...prev, optimistic])
                              setNewItemTitle('')
                              setShowNewItemInput(false)
                              await addOnboardingItem(selectedUser.id, optimistic.title, sortOrder)
                            }} className="px-3 py-1.5 bg-gray-900 text-white text-xs rounded-lg">추가</button>
                            <button onClick={() => { setShowNewItemInput(false); setNewItemTitle('') }} className="px-2 py-1.5 border text-xs rounded-lg text-gray-400">✕</button>
                          </div>
                        ) : (
                          <button onClick={() => setShowNewItemInput(true)}
                            className="w-full py-2 border border-dashed border-gray-300 rounded-xl text-sm text-gray-500 hover:border-gray-400 hover:text-gray-700 transition-colors">
                            + 항목 추가
                          </button>
                        )}
                      </div>
                    )
                  })()}
                </div>
              </div>
            )}
          </div>}
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
                      <DeptCheckboxes selected={editDepts} onChange={setEditDepts} depts={depts} />
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
            onClick={() => { setShowEntityForm(true); setEditingEntityId(null) }}
            className="px-4 py-2 rounded-lg text-xs font-semibold hover:opacity-80 transition-all"
            style={{ backgroundColor: '#FFCE00', color: '#121212' }}
          >
            + 사업자 추가
          </button>
        </div>

        {/* 추가 폼 */}
        {showEntityForm && (
          <form onSubmit={handleEntityCreate} className="px-6 py-5 border-b border-gray-100 space-y-3">
            <p className="text-xs font-semibold text-gray-700 mb-2">새 사업자 등록</p>
            <div className="grid grid-cols-2 gap-2">
              <input value={entityForm.name} onChange={e => setEntityForm(f => ({ ...f, name: e.target.value }))}
                placeholder="상호명 *" required
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-yellow-400" />
              <input value={entityForm.business_number} onChange={e => setEntityForm(f => ({ ...f, business_number: e.target.value }))}
                placeholder="사업자등록번호"
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:border-yellow-400" />
              <input value={entityForm.representative_name} onChange={e => setEntityForm(f => ({ ...f, representative_name: e.target.value }))}
                placeholder="대표자명"
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-yellow-400" />
              <input value={entityForm.phone} onChange={e => setEntityForm(f => ({ ...f, phone: e.target.value }))}
                placeholder="전화번호"
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-yellow-400" />
              <input value={entityForm.business_type} onChange={e => setEntityForm(f => ({ ...f, business_type: e.target.value }))}
                placeholder="업태 (예: 서비스업)"
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-yellow-400" />
              <input value={entityForm.business_item} onChange={e => setEntityForm(f => ({ ...f, business_item: e.target.value }))}
                placeholder="종목 (예: 교육, 행사운영)"
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-yellow-400" />
              <input value={entityForm.email} onChange={e => setEntityForm(f => ({ ...f, email: e.target.value }))}
                placeholder="이메일 (세금계산서 수신용)" type="email"
                className="col-span-2 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-yellow-400" />
              <input value={entityForm.address} onChange={e => setEntityForm(f => ({ ...f, address: e.target.value }))}
                placeholder="사업장 주소"
                className="col-span-2 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-yellow-400" />
              <input value={entityForm.corporate_number} onChange={e => setEntityForm(f => ({ ...f, corporate_number: e.target.value }))}
                placeholder="법인등록번호 (법인사업자)"
                className="col-span-2 px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:border-yellow-400" />
              <p className="col-span-2 text-xs font-medium text-gray-500 pt-1">계좌 정보</p>
              <input value={entityForm.bank_name} onChange={e => setEntityForm(f => ({ ...f, bank_name: e.target.value }))}
                placeholder="은행명 (예: 농협)"
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-yellow-400" />
              <input value={entityForm.account_holder} onChange={e => setEntityForm(f => ({ ...f, account_holder: e.target.value }))}
                placeholder="예금주"
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-yellow-400" />
              <input value={entityForm.account_number} onChange={e => setEntityForm(f => ({ ...f, account_number: e.target.value }))}
                placeholder="계좌번호"
                className="col-span-2 px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:border-yellow-400" />
            </div>
            <div className="flex gap-2 justify-end pt-1">
              <button type="submit" className="text-xs px-4 py-1.5 rounded-lg font-semibold hover:opacity-80 transition-all" style={{ backgroundColor: '#FFCE00', color: '#121212' }}>추가</button>
              <button type="button" onClick={() => { setShowEntityForm(false); setEntityForm(EMPTY_ENTITY_FORM) }}
                className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors">취소</button>
            </div>
          </form>
        )}

        <div className="divide-y divide-gray-50">
          {entities.length === 0 && !showEntityForm && (
            <p className="px-6 py-4 text-sm text-gray-400">등록된 사업자가 없습니다.</p>
          )}
          {entities.map(entity => (
            <div key={entity.id} className="px-6 py-4">
              {editingEntityId === entity.id ? (
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-gray-700">사업자 정보 수정</p>
                  <div className="grid grid-cols-2 gap-2">
                    <input value={editEntityForm.name} onChange={e => setEditEntityForm(f => ({ ...f, name: e.target.value }))}
                      placeholder="상호명 *"
                      className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-yellow-400" />
                    <input value={editEntityForm.business_number} onChange={e => setEditEntityForm(f => ({ ...f, business_number: e.target.value }))}
                      placeholder="사업자등록번호"
                      className="px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:border-yellow-400" />
                    <input value={editEntityForm.representative_name} onChange={e => setEditEntityForm(f => ({ ...f, representative_name: e.target.value }))}
                      placeholder="대표자명"
                      className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-yellow-400" />
                    <input value={editEntityForm.phone} onChange={e => setEditEntityForm(f => ({ ...f, phone: e.target.value }))}
                      placeholder="전화번호"
                      className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-yellow-400" />
                    <input value={editEntityForm.business_type} onChange={e => setEditEntityForm(f => ({ ...f, business_type: e.target.value }))}
                      placeholder="업태 (예: 서비스업)"
                      className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-yellow-400" />
                    <input value={editEntityForm.business_item} onChange={e => setEditEntityForm(f => ({ ...f, business_item: e.target.value }))}
                      placeholder="종목 (예: 교육, 행사운영)"
                      className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-yellow-400" />
                    <input value={editEntityForm.email} onChange={e => setEditEntityForm(f => ({ ...f, email: e.target.value }))}
                      placeholder="이메일 (세금계산서 수신용)" type="email"
                      className="col-span-2 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-yellow-400" />
                    <input value={editEntityForm.address} onChange={e => setEditEntityForm(f => ({ ...f, address: e.target.value }))}
                      placeholder="사업장 주소"
                      className="col-span-2 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-yellow-400" />
                    <input value={editEntityForm.corporate_number} onChange={e => setEditEntityForm(f => ({ ...f, corporate_number: e.target.value }))}
                      placeholder="법인등록번호 (법인사업자)"
                      className="col-span-2 px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:border-yellow-400" />
                    <p className="col-span-2 text-xs font-medium text-gray-500 pt-1">계좌 정보</p>
                    <input value={editEntityForm.bank_name} onChange={e => setEditEntityForm(f => ({ ...f, bank_name: e.target.value }))}
                      placeholder="은행명 (예: 농협)"
                      className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-yellow-400" />
                    <input value={editEntityForm.account_holder} onChange={e => setEditEntityForm(f => ({ ...f, account_holder: e.target.value }))}
                      placeholder="예금주"
                      className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-yellow-400" />
                    <input value={editEntityForm.account_number} onChange={e => setEditEntityForm(f => ({ ...f, account_number: e.target.value }))}
                      placeholder="계좌번호"
                      className="col-span-2 px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:border-yellow-400" />
                  </div>
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => handleEntityUpdate(entity.id)}
                      className="text-xs px-3 py-1.5 rounded-lg font-semibold hover:opacity-80 transition-all" style={{ backgroundColor: '#FFCE00', color: '#121212' }}>저장</button>
                    <button onClick={() => setEditingEntityId(null)}
                      className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors">취소</button>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-sm font-semibold text-gray-900">{entity.name}</span>
                      {entity.representative_name && <span className="ml-2 text-xs text-gray-500">대표 {entity.representative_name}</span>}
                      {entity.business_number && <span className="ml-2 text-xs text-gray-400 font-mono">{entity.business_number}</span>}
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => {
                          setEditingEntityId(entity.id)
                          setShowEntityForm(false)
                          setEditEntityForm({
                            name: entity.name,
                            business_number: entity.business_number ?? '',
                            representative_name: entity.representative_name ?? '',
                            business_type: entity.business_type ?? '',
                            business_item: entity.business_item ?? '',
                            address: entity.address ?? '',
                            email: entity.email ?? '',
                            phone: entity.phone ?? '',
                            corporate_number: entity.corporate_number ?? '',
                            bank_name: entity.bank_name ?? '',
                            account_number: entity.account_number ?? '',
                            account_holder: entity.account_holder ?? '',
                          })
                        }}
                        className="text-xs text-gray-400 hover:text-yellow-600 transition-colors"
                      >수정</button>
                      <button onClick={() => handleEntityDelete(entity.id, entity.name)}
                        className="text-xs text-gray-300 hover:text-red-400 transition-colors">삭제</button>
                    </div>
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5">
                    {entity.business_type && <span className="text-xs text-gray-400">업태: {entity.business_type}</span>}
                    {entity.business_item && <span className="text-xs text-gray-400">종목: {entity.business_item}</span>}
                    {entity.phone && <span className="text-xs text-gray-400">☎ {entity.phone}</span>}
                    {entity.email && <span className="text-xs text-gray-400">✉ {entity.email}</span>}
                    {entity.corporate_number && <span className="text-xs text-gray-400 font-mono">법인 {entity.corporate_number}</span>}
                    {entity.address && <span className="text-xs text-gray-400 w-full">📍 {entity.address}</span>}
                    {entity.bank_name && <span className="text-xs text-gray-400 w-full">🏦 {entity.bank_name} {entity.account_number}{entity.account_holder ? ` (${entity.account_holder})` : ''}</span>}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>}

      {activeTab === 'api-usage' && <ApiUsageTab />}

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
              <DeptCheckboxes selected={form.departments} onChange={v => setForm(f => ({ ...f, departments: v }))} depts={depts} />
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

function ApiUsageTab() {
  const [data, setData] = useState<{
    monthly: { month: string; cost_usd: number; input_tokens: number; output_tokens: number; requests: number }[]
    byEndpoint: { endpoint: string; cost_usd: number; requests: number }[]
    byModel: { model: string; cost_usd: number; requests: number }[]
    byUser: { user_id: string; name: string; cost_usd: number; requests: number }[]
    total: { cost_usd: number; requests: number; input_tokens: number; output_tokens: number }
  } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/admin/api-usage?months=3')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const KRW_RATE = 1450
  const fmtUsd = (usd: number) => `$${usd.toFixed(3)}`
  const fmtKrw = (usd: number) => `₩${Math.round(usd * KRW_RATE).toLocaleString()}원`
  const fmtNum = (n: number) => n.toLocaleString()

  const MODEL_COLORS: Record<string, string> = {
    'gpt-4o-mini':      'bg-green-100 text-green-700',
    'gpt-4o':           'bg-blue-100 text-blue-700',
    'gpt-4.1':          'bg-blue-100 text-blue-700',
    'claude-sonnet-4-6':'bg-purple-100 text-purple-700',
    'claude-haiku-4-5-20251001': 'bg-pink-100 text-pink-700',
  }
  const modelColor = (model: string) => MODEL_COLORS[model] ?? 'bg-gray-100 text-gray-600'

  const thisMonth = new Date().toISOString().slice(0, 7)
  const thisMonthData = data?.monthly.find(m => m.month === thisMonth)

  if (loading) return <div className="text-sm text-gray-400 py-8 text-center">불러오는 중...</div>
  if (!data) return <div className="text-sm text-red-400 py-8 text-center">데이터 조회 실패</div>

  return (
    <div className="space-y-6">
      {/* 요약 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: '이번 달 비용', value: fmtKrw(thisMonthData?.cost_usd ?? 0), sub: fmtUsd(thisMonthData?.cost_usd ?? 0) },
          { label: '이번 달 요청', value: fmtNum(thisMonthData?.requests ?? 0) + '회', sub: null },
          { label: '3개월 누적', value: fmtKrw(data.total.cost_usd), sub: fmtUsd(data.total.cost_usd) },
          { label: '총 토큰', value: fmtNum(data.total.input_tokens + data.total.output_tokens), sub: `in ${fmtNum(data.total.input_tokens)} / out ${fmtNum(data.total.output_tokens)}` },
        ].map(c => (
          <div key={c.label} className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs text-gray-500 mb-1">{c.label}</p>
            <p className="text-lg font-bold text-gray-900">{c.value}</p>
            {c.sub && <p className="text-xs text-gray-400 mt-0.5">{c.sub}</p>}
          </div>
        ))}
      </div>

      {/* 사용처 + 모델별 현황 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 사용처별 */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-800 mb-3">사용처별 비용</h3>
          {data.byEndpoint.length === 0 ? (
            <p className="text-xs text-gray-300 text-center py-2">데이터 없음</p>
          ) : (
            <div className="space-y-2">
              {data.byEndpoint.map(e => {
                const pct = data.total.cost_usd > 0 ? (e.cost_usd / data.total.cost_usd) * 100 : 0
                const label = e.endpoint === 'channeltalk' ? '채널톡 빵빵이' : e.endpoint === 'chat' ? '시스템 빵빵이' : e.endpoint
                const modelLabel = e.endpoint === 'channeltalk' ? 'gpt-4o-mini' : e.endpoint === 'chat' ? 'gpt-4o' : null
                const barColor = e.endpoint === 'channeltalk' ? 'bg-green-400' : e.endpoint === 'chat' ? 'bg-blue-400' : 'bg-gray-400'
                return (
                  <div key={e.endpoint} className="flex items-center gap-3">
                    <div className="shrink-0 w-28">
                      <p className="text-xs font-medium text-gray-800">{label}</p>
                      {modelLabel && <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${modelColor(modelLabel)}`}>{modelLabel}</span>}
                    </div>
                    <div className="flex-1 bg-gray-100 rounded-full h-2">
                      <div className={`${barColor} h-2 rounded-full`} style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs font-semibold text-gray-900 shrink-0 w-24 text-right">{fmtKrw(e.cost_usd)}</span>
                    <span className="text-xs text-gray-400 shrink-0 w-10 text-right">{fmtNum(e.requests)}회</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* 모델별 */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-800 mb-3">모델별 비용</h3>
          {data.byModel.length === 0 ? (
            <p className="text-xs text-gray-300 text-center py-2">데이터 없음</p>
          ) : (
            <div className="space-y-2">
              {data.byModel.map(m => {
                const pct = data.total.cost_usd > 0 ? (m.cost_usd / data.total.cost_usd) * 100 : 0
                return (
                  <div key={m.model} className="flex items-center gap-3">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 w-28 text-center ${modelColor(m.model)}`}>{m.model}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-2">
                      <div className="bg-blue-400 h-2 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs font-semibold text-gray-900 shrink-0 w-24 text-right">{fmtKrw(m.cost_usd)}</span>
                    <span className="text-xs text-gray-400 shrink-0 w-10 text-right">{fmtNum(m.requests)}회</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 월별 현황 */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-800 mb-3">월별 현황</h3>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-400 border-b border-gray-100">
                <th className="text-left py-1.5">월</th>
                <th className="text-right py-1.5">요청</th>
                <th className="text-right py-1.5">비용(원)</th>
                <th className="text-right py-1.5">USD</th>
              </tr>
            </thead>
            <tbody>
              {data.monthly.length === 0 ? (
                <tr><td colSpan={4} className="text-center text-gray-300 py-4">데이터 없음</td></tr>
              ) : data.monthly.map(m => (
                <tr key={m.month} className="border-b border-gray-50">
                  <td className="py-1.5 text-gray-700">{m.month}</td>
                  <td className="py-1.5 text-right text-gray-600">{fmtNum(m.requests)}</td>
                  <td className="py-1.5 text-right text-gray-900 font-semibold">{fmtKrw(m.cost_usd)}</td>
                  <td className="py-1.5 text-right text-gray-400">{fmtUsd(m.cost_usd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 사용자별 */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-800 mb-3">사용자별 사용량</h3>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-400 border-b border-gray-100">
                <th className="text-left py-1.5">이름</th>
                <th className="text-right py-1.5">요청</th>
                <th className="text-right py-1.5">비용(원)</th>
              </tr>
            </thead>
            <tbody>
              {data.byUser.length === 0 ? (
                <tr><td colSpan={3} className="text-center text-gray-300 py-4">데이터 없음</td></tr>
              ) : data.byUser.map(u => (
                <tr key={u.user_id} className="border-b border-gray-50">
                  <td className="py-1.5 text-gray-700">{u.name}</td>
                  <td className="py-1.5 text-right text-gray-600">{fmtNum(u.requests)}</td>
                  <td className="py-1.5 text-right text-gray-900 font-semibold">{fmtKrw(u.cost_usd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

      </div>
    </div>
  )
}
