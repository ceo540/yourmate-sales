'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  updateProjectName,
  linkProjectCustomer,
  addProjectMember,
  removeProjectMember,
  deleteProject,
  updateProjectDropbox,
  updateProjectServiceType,
} from './project-actions'
import { syncProjectName } from './sync-project-name-action'
import { SERVICE_TO_DEPT } from '@/lib/services'
import CustomerPicker from '@/components/CustomerPicker'

type Profile = { id: string; name: string }
type Customer = { id: string; name: string; type: string | null }
type Member = { profile_id: string; role: string; name: string }

interface Props {
  projectId: string
  projectName: string
  customerId: string | null
  customer: { id: string; name: string } | null
  pmId: string | null
  dropboxUrl: string | null
  serviceType: string | null
  customersAll: Customer[]
  profiles: Profile[]
  members: Member[]
  onClose: () => void
}

export default function ProjectSettingsModal({
  projectId, projectName, customerId, customer, pmId, dropboxUrl, serviceType,
  customersAll, profiles, members, onClose,
}: Props) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // 서비스 종류
  const [svc, setSvc] = useState(serviceType ?? '')
  async function saveSvc() {
    if (svc === (serviceType ?? '')) return
    setBusy('svc'); setError(null)
    const r = await updateProjectServiceType(projectId, svc || null)
    if (r.error) setError(r.error)
    else router.refresh()
    setBusy(null)
  }

  // 프로젝트명
  const [name, setName] = useState(projectName)
  async function saveName() {
    if (!name.trim() || name === projectName) return
    setBusy('name'); setError(null)
    try { await updateProjectName(projectId, name.trim()); router.refresh() }
    catch (e) { setError(e instanceof Error ? e.message : '실패') }
    finally { setBusy(null) }
  }

  // 고객사 — CustomerPicker로 통일
  const [localCustomers, setLocalCustomers] = useState(customersAll)
  async function changeCustomer(id: string | '') {
    setBusy('customer'); setError(null)
    try { await linkProjectCustomer(projectId, id); router.refresh() }
    catch (e) { setError(e instanceof Error ? e.message : '실패') }
    finally { setBusy(null) }
  }

  // Dropbox URL + 동기화
  const [dbxInput, setDbxInput] = useState(dropboxUrl ?? '')
  const [syncMsg, setSyncMsg] = useState<{ ok: boolean; text: string } | null>(null)
  async function saveDropbox() {
    if (dbxInput === (dropboxUrl ?? '')) return
    setBusy('dropbox'); setError(null)
    try { await updateProjectDropbox(projectId, dbxInput); router.refresh() }
    catch (e) { setError(e instanceof Error ? e.message : '실패') }
    finally { setBusy(null) }
  }
  async function syncDropbox() {
    setBusy('sync'); setSyncMsg(null); setError(null)
    const r = await syncProjectName(projectId)
    setSyncMsg({ ok: r.success, text: r.message })
    if (r.success) router.refresh()
    setBusy(null)
  }

  // PM (project_members 테이블에 role='PM'로 저장. 기존 PM 있으면 제거 후 추가)
  const [pmSelect, setPmSelect] = useState(pmId ?? '')
  async function changePm() {
    if (pmSelect === (pmId ?? '')) return
    setBusy('pm'); setError(null)
    try {
      const oldPm = members.find(m => m.role === 'PM')
      if (oldPm) await removeProjectMember(projectId, oldPm.profile_id)
      if (pmSelect) await addProjectMember(projectId, pmSelect, 'PM')
      router.refresh()
    } catch (e) { setError(e instanceof Error ? e.message : '실패') }
    finally { setBusy(null) }
  }

  // 멤버 (PM 외)
  const nonPmMembers = members.filter(m => m.role !== 'PM')
  const [memberSelect, setMemberSelect] = useState('')
  const [memberRole, setMemberRole] = useState('팀원')
  async function addMember() {
    if (!memberSelect) return
    if (members.some(m => m.profile_id === memberSelect)) {
      setError('이미 추가된 멤버야.'); return
    }
    setBusy('member'); setError(null)
    try { await addProjectMember(projectId, memberSelect, memberRole); setMemberSelect(''); router.refresh() }
    catch (e) { setError(e instanceof Error ? e.message : '실패') }
    finally { setBusy(null) }
  }
  async function removeMember(profileId: string) {
    setBusy('member'); setError(null)
    try { await removeProjectMember(projectId, profileId); router.refresh() }
    catch (e) { setError(e instanceof Error ? e.message : '실패') }
    finally { setBusy(null) }
  }

  // 삭제
  async function handleDelete() {
    if (!confirm(`"${projectName}" 프로젝트를 영구 삭제할까? 되돌릴 수 없어.`)) return
    setBusy('delete'); setError(null)
    const r = await deleteProject(projectId)
    if (r.error) { setError(r.error); setBusy(null); return }
    router.push('/projects')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <h2 className="text-base font-semibold">⚙️ 프로젝트 설정</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl leading-none">×</button>
        </div>

        {error && (
          <div className="mx-5 mt-3 px-3 py-2 bg-red-50 border border-red-200 text-red-700 text-xs rounded">
            {error}
          </div>
        )}

        <div className="p-5 space-y-5">
          {/* 0. 서비스 종류 */}
          <section>
            <p className="text-xs font-semibold text-gray-700 mb-1.5">서비스 종류</p>
            <div className="flex gap-2">
              <select value={svc} onChange={e => setSvc(e.target.value)}
                className="flex-1 border border-gray-200 rounded px-2.5 py-1.5 text-sm">
                <option value="">-- 미지정 --</option>
                {Object.keys(SERVICE_TO_DEPT).map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <button onClick={saveSvc} disabled={busy === 'svc' || svc === (serviceType ?? '')}
                className="px-3 py-1.5 text-xs bg-gray-900 text-white rounded disabled:bg-gray-300">저장</button>
            </div>
            <p className="text-[11px] text-gray-400 mt-1">선택 시 사업부도 자동 갱신.</p>
          </section>

          {/* 1. 프로젝트명 */}
          <section>
            <p className="text-xs font-semibold text-gray-700 mb-1.5">프로젝트명</p>
            <div className="flex gap-2">
              <input
                value={name} onChange={e => setName(e.target.value)}
                className="flex-1 border border-gray-200 rounded px-2.5 py-1.5 text-sm"
              />
              <button
                onClick={saveName} disabled={busy === 'name' || !name.trim() || name === projectName}
                className="px-3 py-1.5 text-xs bg-gray-900 text-white rounded disabled:bg-gray-300"
              >저장</button>
            </div>
          </section>

          {/* 2. 고객사 — CustomerPicker 통일 */}
          <section>
            <p className="text-xs font-semibold text-gray-700 mb-1.5">고객사</p>
            <CustomerPicker
              value={customerId ?? ''}
              selectedName={customer?.name ?? ''}
              customers={localCustomers}
              placeholder="🏛 기관 검색 (없으면 + 새 기관 추가)"
              onChange={(id) => changeCustomer(id)}
              onCustomerCreated={(c) => { setLocalCustomers(prev => [...prev, { id: c.id, name: c.name, type: c.type ?? null }]); changeCustomer(c.id) }}
            />
            {customerId && (
              <button onClick={() => changeCustomer('')} className="mt-1.5 text-[11px] text-gray-400 hover:text-red-400 underline">
                연결 해제
              </button>
            )}
          </section>

          {/* Dropbox */}
          <section>
            <p className="text-xs font-semibold text-gray-700 mb-1.5">Dropbox 폴더</p>
            <div className="flex gap-2">
              <input
                value={dbxInput} onChange={e => setDbxInput(e.target.value)}
                placeholder="https://www.dropbox.com/home/..."
                className="flex-1 border border-gray-200 rounded px-2.5 py-1.5 text-sm"
              />
              <button onClick={saveDropbox} disabled={busy === 'dropbox' || dbxInput === (dropboxUrl ?? '')}
                className="px-3 py-1.5 text-xs bg-gray-900 text-white rounded disabled:bg-gray-300">저장</button>
            </div>
            <div className="flex items-center gap-2 mt-1.5">
              {dropboxUrl && (
                <a href={dropboxUrl} target="_blank" rel="noopener noreferrer" className="text-[11px] text-blue-500 hover:underline">현재 폴더 열기 ↗</a>
              )}
              {dropboxUrl && (
                <button onClick={syncDropbox} disabled={busy === 'sync'}
                  className="text-[11px] text-blue-500 hover:underline disabled:opacity-50"
                  title="프로젝트명과 Dropbox 폴더명을 일치시킴">
                  {busy === 'sync' ? '동기화 중...' : '🔄 폴더명 동기화'}
                </button>
              )}
            </div>
            {syncMsg && (
              <p className={`text-[11px] mt-1 ${syncMsg.ok ? 'text-green-600' : 'text-red-500'}`}>{syncMsg.text}</p>
            )}
          </section>

          {/* 3. PM */}
          <section>
            <p className="text-xs font-semibold text-gray-700 mb-1.5">PM</p>
            <div className="flex gap-2">
              <select value={pmSelect} onChange={e => setPmSelect(e.target.value)} className="flex-1 border border-gray-200 rounded px-2.5 py-1.5 text-sm">
                <option value="">-- 미지정 --</option>
                {profiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <button onClick={changePm} disabled={busy === 'pm' || pmSelect === (pmId ?? '')} className="px-3 py-1.5 text-xs bg-gray-900 text-white rounded disabled:bg-gray-300">저장</button>
            </div>
          </section>

          {/* 4. 멤버 */}
          <section>
            <p className="text-xs font-semibold text-gray-700 mb-1.5">멤버</p>
            <div className="space-y-1 mb-2">
              {nonPmMembers.length === 0 && <p className="text-xs text-gray-400">PM 외 멤버 없음</p>}
              {nonPmMembers.map(m => (
                <div key={m.profile_id} className="flex items-center justify-between bg-gray-50 px-3 py-1.5 rounded">
                  <span className="text-sm text-gray-800">{m.name} <span className="text-xs text-gray-400">· {m.role}</span></span>
                  <button onClick={() => removeMember(m.profile_id)} disabled={busy === 'member'} className="text-xs text-red-500 hover:underline">제거</button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <select value={memberSelect} onChange={e => setMemberSelect(e.target.value)} className="flex-1 border border-gray-200 rounded px-2.5 py-1.5 text-sm">
                <option value="">-- 추가할 멤버 --</option>
                {profiles.filter(p => !members.some(m => m.profile_id === p.id)).map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <select value={memberRole} onChange={e => setMemberRole(e.target.value)} className="border border-gray-200 rounded px-2.5 py-1.5 text-sm">
                <option value="팀원">팀원</option>
                <option value="기획">기획</option>
                <option value="운영">운영</option>
                <option value="개발">개발</option>
                <option value="디자인">디자인</option>
              </select>
              <button onClick={addMember} disabled={busy === 'member' || !memberSelect} className="px-3 py-1.5 text-xs bg-gray-900 text-white rounded disabled:bg-gray-300">추가</button>
            </div>
          </section>

          {/* 5. 위험 구역 */}
          <section className="border-t border-red-100 pt-4">
            <p className="text-xs font-semibold text-red-700 mb-1.5">위험 구역</p>
            <button
              onClick={handleDelete} disabled={busy === 'delete'}
              className="w-full px-3 py-2 text-xs bg-red-50 text-red-700 border border-red-200 rounded hover:bg-red-100 disabled:opacity-50"
            >
              {busy === 'delete' ? '삭제 중...' : '🗑 프로젝트 삭제'}
            </button>
            <p className="text-[11px] text-gray-400 mt-1">되돌릴 수 없음. 연결된 매출은 분리됨.</p>
          </section>
        </div>
      </div>
    </div>
  )
}
