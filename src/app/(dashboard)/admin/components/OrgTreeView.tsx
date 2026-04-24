'use client'

import { createDepartment, updateDepartment, deleteDepartment, reorderDepartments } from '../actions'

const DEPT_COLORS = ['#FBBF24','#60A5FA','#34D399','#A78BFA','#F87171','#FB923C','#38BDF8','#4ADE80','#F472B6','#9CA3AF']
const ROLE_LABELS: Record<string, string> = { admin: '대표', manager: '팀장', member: '팀원' }

export interface DeptRow {
  id: string; key: string; label: string
  description: string | null; color: string; sort_order: number
  parent_id: string | null
}

interface UserProfile {
  id: string; name: string | null; role: string
  departments: string[] | null
}

type DeptForm = { label: string; description: string; color: string }

interface Props {
  users: UserProfile[]
  depts: DeptRow[]
  setDepts: React.Dispatch<React.SetStateAction<DeptRow[]>>
  editingDeptId: string | null
  setEditingDeptId: React.Dispatch<React.SetStateAction<string | null>>
  deptEditForm: DeptForm
  setDeptEditForm: React.Dispatch<React.SetStateAction<DeptForm>>
  showDeptAddForm: boolean
  setShowDeptAddForm: React.Dispatch<React.SetStateAction<boolean>>
  deptAddForm: DeptForm
  setDeptAddForm: React.Dispatch<React.SetStateAction<DeptForm>>
}

export default function OrgTreeView({
  users, depts, setDepts,
  editingDeptId, setEditingDeptId, deptEditForm, setDeptEditForm,
  showDeptAddForm, setShowDeptAddForm, deptAddForm, setDeptAddForm,
}: Props) {
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
}
