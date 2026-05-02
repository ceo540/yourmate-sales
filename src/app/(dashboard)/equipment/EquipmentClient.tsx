'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { EquipmentMaster, EquipmentRental, EquipmentRentalStatus } from '@/types'
import {
  addEquipmentAction,
  addRentalAction,
  updateRentalStatusAction,
  archiveRentalAction,
  updateEquipmentAction,
} from '@/lib/equipment-actions'

const DEPT_OPTIONS: { key: string; label: string }[] = [
  { key: 'school_store', label: '학교상점' },
  { key: '002_creative', label: '002 Creative' },
  { key: 'sound_of_school', label: 'SOS' },
  { key: 'artkiwoom', label: '아트키움' },
  { key: '002_entertainment', label: '002 ent' },
  { key: 'yourmate', label: '본사' },
]
const CATEGORY_OPTIONS = ['음향', '영상', '텐트', '교구', '조명', '의상', '기타']
const RENTAL_STATUS_LABEL: Record<EquipmentRentalStatus, string> = {
  reserved: '예약',
  in_use: '대여중',
  returned: '반납',
  lost: '분실',
  cancelled: '취소',
}

function deptLabel(key: string) {
  return DEPT_OPTIONS.find(d => d.key === key)?.label ?? key
}

export default function EquipmentClient({
  equipment, rentals, projectMap,
}: {
  equipment: EquipmentMaster[]
  rentals: EquipmentRental[]
  projectMap: Record<string, { name: string; number: string | null }>
}) {
  const router = useRouter()
  const [searchQ, setSearchQ] = useState('')
  const [deptFilter, setDeptFilter] = useState<string>('all')
  const [showAddForm, setShowAddForm] = useState(false)
  const [showRentalForm, setShowRentalForm] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const filtered = useMemo(() => {
    return equipment.filter(e => {
      if (e.archive_status === 'archived') return false
      if (deptFilter !== 'all' && e.owning_dept !== deptFilter) return false
      if (searchQ) {
        const q = searchQ.toLowerCase()
        if (!e.name.toLowerCase().includes(q) && !(e.category ?? '').toLowerCase().includes(q)) return false
      }
      return true
    })
  }, [equipment, searchQ, deptFilter])

  const rentalsByEquipment = useMemo(() => {
    const map: Record<string, EquipmentRental[]> = {}
    for (const r of rentals) {
      if (!map[r.equipment_id]) map[r.equipment_id] = []
      map[r.equipment_id].push(r)
    }
    return map
  }, [rentals])

  const handleAdd = (form: HTMLFormElement) => {
    const fd = new FormData(form)
    const name = String(fd.get('name') ?? '').trim()
    if (!name) return alert('이름 필수')
    startTransition(async () => {
      const r = await addEquipmentAction({
        name,
        category: String(fd.get('category') ?? '') || null,
        owning_dept: String(fd.get('owning_dept') ?? 'yourmate'),
        total_qty: Number(fd.get('total_qty') ?? 1),
        unit_price: fd.get('unit_price') ? Number(fd.get('unit_price')) : null,
        serial_no: String(fd.get('serial_no') ?? '') || null,
        storage_location: String(fd.get('storage_location') ?? '') || null,
        notes: String(fd.get('notes') ?? '') || null,
      })
      if ('error' in r) return alert(`실패: ${r.error}`)
      form.reset()
      setShowAddForm(false)
      router.refresh()
    })
  }

  const handleRental = (equipmentId: string, form: HTMLFormElement) => {
    const fd = new FormData(form)
    const date_start = String(fd.get('date_start') ?? '')
    const date_end = String(fd.get('date_end') ?? '')
    if (!date_start || !date_end) return alert('대여 기간 필수')
    startTransition(async () => {
      const r = await addRentalAction({
        equipment_id: equipmentId,
        qty: Number(fd.get('qty') ?? 1),
        project_id: String(fd.get('project_id') ?? '') || null,
        customer_id: String(fd.get('customer_id') ?? '') || null,
        date_start,
        date_end,
        rate: fd.get('rate') ? Number(fd.get('rate')) : null,
        notes: String(fd.get('notes') ?? '') || null,
      })
      if ('error' in r) return alert(`실패: ${r.error}`)
      if (r.overlap_count && r.overlap_count > 0) {
        alert(`⚠️ 같은 장비에 ${r.overlap_count}건 일정 충돌 — 등록은 됨. 확인 필요.`)
      }
      form.reset()
      setShowRentalForm(null)
      router.refresh()
    })
  }

  const handleStatus = (rentalId: string, status: EquipmentRentalStatus) => {
    startTransition(async () => {
      const r = await updateRentalStatusAction({ rental_id: rentalId, status })
      if ('error' in r) return alert(r.error)
      router.refresh()
    })
  }

  const handleArchiveRental = (rentalId: string) => {
    if (!confirm('대여 기록을 취소할까요? (보류 폴더로 이동, 복원 가능)')) return
    startTransition(async () => {
      const r = await archiveRentalAction({ rental_id: rentalId })
      if ('error' in r) return alert(r.error)
      router.refresh()
    })
  }

  const handleArchiveEquipment = (id: string, name: string) => {
    if (!confirm(`장비 "${name}"을(를) 보관 처리할까요?`)) return
    startTransition(async () => {
      const r = await updateEquipmentAction({ id, patch: { archive_status: 'archived' } })
      if ('error' in r) return alert(r.error)
      router.refresh()
    })
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">🎛️ 장비 통합</h1>
          <p className="text-sm text-gray-500 mt-1">사업부 통합 장비 풀 — 등록·대여·충돌 감지 (명세 §5.7)</p>
        </div>
        <button
          onClick={() => setShowAddForm(s => !s)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          disabled={pending}
        >
          {showAddForm ? '닫기' : '+ 장비 등록'}
        </button>
      </header>

      {showAddForm && (
        <form
          onSubmit={(e) => { e.preventDefault(); handleAdd(e.currentTarget) }}
          className="mb-6 p-4 bg-gray-50 rounded-lg border space-y-3"
        >
          <div className="grid grid-cols-2 gap-3">
            <input name="name" placeholder="장비 이름 *" className="border rounded px-3 py-2" required />
            <select name="category" className="border rounded px-3 py-2">
              <option value="">카테고리</option>
              {CATEGORY_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select name="owning_dept" className="border rounded px-3 py-2" defaultValue="yourmate">
              {DEPT_OPTIONS.map(d => <option key={d.key} value={d.key}>{d.label}</option>)}
            </select>
            <input name="total_qty" type="number" min="1" defaultValue="1" placeholder="수량" className="border rounded px-3 py-2" />
            <input name="unit_price" type="number" placeholder="단가 (원)" className="border rounded px-3 py-2" />
            <input name="serial_no" placeholder="시리얼/관리번호 (선택)" className="border rounded px-3 py-2" />
            <input name="storage_location" placeholder="보관 위치" className="border rounded px-3 py-2" />
          </div>
          <textarea name="notes" placeholder="비고" className="w-full border rounded px-3 py-2" rows={2} />
          <div className="flex gap-2">
            <button type="submit" disabled={pending} className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50">저장</button>
            <button type="button" onClick={() => setShowAddForm(false)} className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300">취소</button>
          </div>
        </form>
      )}

      <div className="mb-4 flex gap-2 items-center">
        <input
          type="text" placeholder="검색 (이름·카테고리)"
          value={searchQ} onChange={(e) => setSearchQ(e.target.value)}
          className="flex-1 border rounded px-3 py-2"
        />
        <select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)} className="border rounded px-3 py-2">
          <option value="all">전 사업부</option>
          {DEPT_OPTIONS.map(d => <option key={d.key} value={d.key}>{d.label}</option>)}
        </select>
      </div>

      <div className="space-y-2">
        {filtered.length === 0 && (
          <div className="text-gray-400 text-sm py-8 text-center">장비 없음. + 장비 등록 버튼으로 추가하세요.</div>
        )}
        {filtered.map(e => {
          const myRentals = (rentalsByEquipment[e.id] ?? []).slice(0, 5)
          const showForm = showRentalForm === e.id
          return (
            <div key={e.id} className="bg-white border rounded-lg p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{e.name}</span>
                    {e.category && <span className="text-xs px-2 py-0.5 bg-gray-100 rounded">{e.category}</span>}
                    <span className="text-xs px-2 py-0.5 bg-blue-50 text-blue-700 rounded">{deptLabel(e.owning_dept)}</span>
                    <span className="text-xs text-gray-500">수량 {e.total_qty}</span>
                    {e.unit_price && <span className="text-xs text-gray-500">단가 {(e.unit_price / 10000).toFixed(0)}만원</span>}
                  </div>
                  {(e.serial_no || e.storage_location) && (
                    <div className="text-xs text-gray-500 mt-1">
                      {e.serial_no && <>S/N: {e.serial_no}</>}
                      {e.serial_no && e.storage_location && ' · '}
                      {e.storage_location && <>보관: {e.storage_location}</>}
                    </div>
                  )}
                  {e.notes && <div className="text-sm text-gray-600 mt-1">{e.notes}</div>}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowRentalForm(s => s === e.id ? null : e.id)}
                    className="text-sm px-3 py-1 bg-emerald-600 text-white rounded hover:bg-emerald-700"
                  >+ 대여</button>
                  <button
                    onClick={() => handleArchiveEquipment(e.id, e.name)}
                    className="text-xs text-gray-400 hover:text-red-600"
                  >보관</button>
                </div>
              </div>

              {showForm && (
                <form
                  onSubmit={(ev) => { ev.preventDefault(); handleRental(e.id, ev.currentTarget) }}
                  className="mt-3 p-3 bg-emerald-50 rounded border-emerald-200 border space-y-2"
                >
                  <div className="grid grid-cols-3 gap-2">
                    <input name="date_start" type="date" required className="border rounded px-2 py-1 text-sm" />
                    <input name="date_end" type="date" required className="border rounded px-2 py-1 text-sm" />
                    <input name="qty" type="number" min="1" defaultValue="1" placeholder="수량" className="border rounded px-2 py-1 text-sm" />
                    <select name="project_id" className="border rounded px-2 py-1 text-sm col-span-2">
                      <option value="">프로젝트 선택 (선택)</option>
                      {Object.entries(projectMap).map(([id, p]) => (
                        <option key={id} value={id}>{p.number ? `[${p.number}] ` : ''}{p.name}</option>
                      ))}
                    </select>
                    <input name="rate" type="number" placeholder="대여료" className="border rounded px-2 py-1 text-sm" />
                  </div>
                  <input name="notes" placeholder="비고" className="w-full border rounded px-2 py-1 text-sm" />
                  <div className="flex gap-2">
                    <button type="submit" disabled={pending} className="px-3 py-1 bg-emerald-600 text-white rounded text-sm hover:bg-emerald-700 disabled:opacity-50">대여 등록</button>
                    <button type="button" onClick={() => setShowRentalForm(null)} className="px-3 py-1 bg-gray-200 rounded text-sm">취소</button>
                  </div>
                </form>
              )}

              {myRentals.length > 0 && (
                <div className="mt-3 space-y-1">
                  {myRentals.map(r => (
                    <div key={r.id} className="flex items-center gap-2 text-xs text-gray-600 bg-gray-50 px-2 py-1 rounded">
                      <span className="font-medium">{r.date_start} ~ {r.date_end}</span>
                      <span>×{r.qty}</span>
                      {r.project_id && projectMap[r.project_id] && (
                        <span className="text-blue-600">{projectMap[r.project_id].name}</span>
                      )}
                      <span className="ml-auto flex gap-1">
                        <select
                          value={r.status}
                          onChange={(ev) => handleStatus(r.id, ev.target.value as EquipmentRentalStatus)}
                          className="border rounded px-1 py-0.5 text-xs bg-white"
                        >
                          {Object.entries(RENTAL_STATUS_LABEL).map(([k, v]) => (
                            <option key={k} value={k}>{v}</option>
                          ))}
                        </select>
                        <button onClick={() => handleArchiveRental(r.id)} className="text-gray-400 hover:text-red-600 px-1">✕</button>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
