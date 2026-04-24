'use client'

import { useState, useRef, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { DEPARTMENT_LABELS, type Department } from '@/types'
import { createEntity, updateEntity, deleteEntity, updateJoinDate, setInitialLeave, createOneOnOne, deleteOneOnOne, updateDocumentStatus, updateEmployeeEntity, adminAddLeave, updateProfileDetail, upsertSalary, deleteSalary, addOnboardingItem, toggleOnboardingItem, deleteOnboardingItem, importOnboardingFromNotion, updateNotionTemplateUrl, createDepartment, updateDepartment, deleteDepartment, reorderDepartments, linkEmployeeCard } from './actions'
import { upsertEmployeeCard, deleteEmployeeCard } from '../payroll/actions'
import PermissionsTab from './components/PermissionsTab'
import EntitiesTab from './components/EntitiesTab'
import TeamTab from './components/TeamTab'
import OnboardingSection from './components/OnboardingSection'
import SalaryHistorySection from './components/SalaryHistorySection'
import SalarySettingsSection from './components/SalarySettingsSection'

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

const DEPT_COLORS = ['#FBBF24','#60A5FA','#34D399','#A78BFA','#F87171','#FB923C','#38BDF8','#4ADE80','#F472B6','#9CA3AF']

export default function AdminClient({ users: initialUsers, entities: initialEntities, permissionsByRole: initialPerms, usedDaysMap, initialDaysMap, oneOnOnes: initialOneOnOnes, docRequests: initialDocRequests, salaryRecords: initialSalaryRecords, onboardingItems: initialOnboardingItems, notionTemplateUrl: initialNotionUrl, orgDepts: initialOrgDepts, employeeCards: initialEmployeeCards }: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [users, setUsers] = useState(initialUsers)

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

  // 급여설정 (employee_cards)
  const [employeeCards, setEmployeeCards] = useState<EmployeeCard[]>(initialEmployeeCards)

  // 온보딩
  const [onboardingItems, setOnboardingItems] = useState<OnboardingItem[]>(initialOnboardingItems)

  // 조직도 뷰
  const [orgView, setOrgView] = useState(false)

  // 부서 관리
  const [depts, setDepts] = useState<DeptRow[]>(initialOrgDepts)
  const [editingDeptId, setEditingDeptId] = useState<string | null>(null)
  const [deptEditForm, setDeptEditForm] = useState({ label: '', description: '', color: '#9CA3AF' })
  const [showDeptAddForm, setShowDeptAddForm] = useState(false)
  const [deptAddForm, setDeptAddForm] = useState({ label: '', description: '', color: '#9CA3AF' })
  const [entities, setEntities] = useState(initialEntities)
  useEffect(() => { setEntities(initialEntities) }, [initialEntities])


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
                  {hrDetailTab === 'salary_settings' && (
                    <SalarySettingsSection selectedUser={{ id: selectedUser.id, name: selectedUser.name }} employeeCards={employeeCards} setEmployeeCards={setEmployeeCards} />
                  )}

                  {/* 급여이력 */}
                  {hrDetailTab === 'salary' && (
                    <SalaryHistorySection userId={selectedUser.id} records={salaryRecords} setRecords={setSalaryRecords} />
                  )}

                  {hrDetailTab === 'onboarding' && (
                    <OnboardingSection userId={selectedUser.id} items={onboardingItems} setItems={setOnboardingItems} initialNotionUrl={initialNotionUrl} />
                  )}
                </div>
              </div>
            )}
          </div>}
          </div>
        )
      })()}

      {/* 권한 안내 탭 */}
      {activeTab === 'permissions' && <PermissionsTab initialPerms={initialPerms} />}

      {activeTab === 'team' && <TeamTab users={users} setUsers={setUsers} depts={depts} />}

      {activeTab === 'entities' && <EntitiesTab entities={entities} setEntities={setEntities} />}

      {activeTab === 'api-usage' && <ApiUsageTab />}

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
