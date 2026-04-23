'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createEntity, updateEntity, deleteEntity } from '../actions'

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

const EMPTY_ENTITY_FORM = {
  name: '', business_number: '', representative_name: '', business_type: '', business_item: '',
  address: '', email: '', phone: '', corporate_number: '',
  bank_name: '', account_number: '', account_holder: '',
}

interface Props {
  entities: BusinessEntity[]
  setEntities: React.Dispatch<React.SetStateAction<BusinessEntity[]>>
}

export default function EntitiesTab({ entities, setEntities }: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [showEntityForm, setShowEntityForm] = useState(false)
  const [entityForm, setEntityForm] = useState(EMPTY_ENTITY_FORM)
  const [editingEntityId, setEditingEntityId] = useState<string | null>(null)
  const [editEntityForm, setEditEntityForm] = useState(EMPTY_ENTITY_FORM)

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

  return (
    <div className="bg-white rounded-xl border border-gray-200">
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
    </div>
  )
}
