'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { analyzeCostFolder, bulkInsertCosts, type AnalyzedCostRow, type BulkInsertItem } from './cost-actions'

interface Props {
  saleId: string
  onClose: () => void
}

interface RowState extends AnalyzedCostRow {
  selected: boolean
  // 사용자가 수정 가능한 필드들
  editItem: string
  editAmount: string
  editVendorName: string
  editDueDate: string
}

export default function CostPdfImportModal({ saleId, onClose }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [rows, setRows] = useState<RowState[]>([])
  const [pdfsScanned, setPdfsScanned] = useState(0)
  const [saving, startSaving] = useTransition()
  const [savedMsg, setSavedMsg] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    analyzeCostFolder(saleId).then(r => {
      if (cancelled) return
      setLoading(false)
      if ('error' in r) { setError(r.error); return }
      setPdfsScanned(r.pdfsScanned)
      setRows(r.rows.map(row => ({
        ...row,
        selected: !row.duplicate,
        editItem: row.item,
        editAmount: String(row.amount),
        editVendorName: row.matched_vendor_name ?? row.vendor_name ?? '',
        editDueDate: row.due_date ?? '',
      })))
    })
    return () => { cancelled = true }
  }, [saleId])

  const selectedCount = rows.filter(r => r.selected).length
  const selectedTotal = rows.filter(r => r.selected).reduce((s, r) => s + (Number(r.editAmount) || 0), 0)

  function toggle(i: number) {
    setRows(prev => prev.map((r, idx) => idx === i ? { ...r, selected: !r.selected } : r))
  }
  function updateField(i: number, key: 'editItem' | 'editAmount' | 'editVendorName' | 'editDueDate', value: string) {
    setRows(prev => prev.map((r, idx) => idx === i ? { ...r, [key]: value } : r))
  }

  function handleSave() {
    const items: BulkInsertItem[] = rows
      .filter(r => r.selected && r.editItem.trim() && Number(r.editAmount) > 0)
      .map(r => {
        const trimmedVendorName = r.editVendorName.trim()
        // 매칭된 vendor 이름과 정확히 같으면 매칭된 vendor_id 그대로 사용
        const useMatched = r.matched_vendor_id && r.matched_vendor_name &&
          trimmedVendorName.toLowerCase() === r.matched_vendor_name.toLowerCase()
        return {
          item: r.editItem.trim(),
          amount: Number(r.editAmount),
          vendor_id: useMatched ? r.matched_vendor_id : null,
          new_vendor_name: useMatched ? null : (trimmedVendorName || null),
          new_vendor_business_number: r.vendor_business_number,
          due_date: r.editDueDate || null,
        }
      })
    if (items.length === 0) return
    startSaving(async () => {
      const r = await bulkInsertCosts(saleId, items)
      if ('error' in r) { setError(r.error); return }
      setSavedMsg(`✅ ${r.inserted}건 추가 완료${r.newVendors > 0 ? ` (신규 거래처 ${r.newVendors}개)` : ''}`)
      router.refresh()
      setTimeout(() => { onClose() }, 800)
    })
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-5xl w-full max-h-[90vh] flex flex-col">
        {/* 헤더 */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-gray-900">📎 원가 폴더 PDF 분석</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {loading ? 'Dropbox 스캔 중...' : `PDF ${pdfsScanned}개 분석 → ${rows.length}건 추출`}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-300 hover:text-gray-700 text-xl">✕</button>
        </div>

        {/* 본문 */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading && (
            <div className="flex flex-col items-center justify-center py-16 text-sm text-gray-400">
              <div className="animate-spin h-6 w-6 border-2 border-yellow-400 border-t-transparent rounded-full mb-3" />
              Dropbox에서 PDF 읽는 중... (수십 초 걸릴 수 있어)
            </div>
          )}
          {error && (
            <div className="bg-red-50 border border-red-100 rounded-lg px-4 py-3 text-sm text-red-700 whitespace-pre-wrap">
              {error}
            </div>
          )}
          {!loading && !error && rows.length === 0 && (
            <div className="text-center text-sm text-gray-400 py-12">추출된 원가 항목이 없어.</div>
          )}
          {!loading && !error && rows.length > 0 && (
            <table className="w-full text-sm">
              <thead className="text-[11px] text-gray-400 border-b border-gray-100">
                <tr>
                  <th className="w-8"></th>
                  <th className="text-left font-normal py-2 px-2">항목</th>
                  <th className="text-right font-normal py-2 px-2 w-28">금액</th>
                  <th className="text-left font-normal py-2 px-2 w-44">거래처</th>
                  <th className="text-left font-normal py-2 px-2 w-32">예정일</th>
                  <th className="text-left font-normal py-2 px-2 w-48">출처</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const isDup = r.duplicate
                  return (
                    <tr key={i} className={`border-b border-gray-50 ${isDup && !r.selected ? 'opacity-50 bg-gray-50' : ''}`}>
                      <td className="py-2 px-2 align-top">
                        <input
                          type="checkbox"
                          checked={r.selected}
                          onChange={() => toggle(i)}
                          className="mt-1.5"
                        />
                      </td>
                      <td className="py-2 px-2 align-top">
                        <input
                          type="text"
                          value={r.editItem}
                          onChange={e => updateField(i, 'editItem', e.target.value)}
                          className="w-full text-sm border-0 border-b border-transparent hover:border-gray-200 focus:border-yellow-400 focus:outline-none px-1 py-0.5"
                        />
                        {isDup && (
                          <p className="text-[10px] text-orange-500 mt-1">⚠ 이미 있음 (item·금액·거래처 일치)</p>
                        )}
                        <p className="text-[10px] text-gray-400 mt-0.5">{r.doc_type}</p>
                      </td>
                      <td className="py-2 px-2 align-top text-right">
                        <input
                          type="number"
                          value={r.editAmount}
                          onChange={e => updateField(i, 'editAmount', e.target.value)}
                          className="w-full text-sm text-right border-0 border-b border-transparent hover:border-gray-200 focus:border-yellow-400 focus:outline-none px-1 py-0.5"
                        />
                      </td>
                      <td className="py-2 px-2 align-top">
                        <input
                          type="text"
                          value={r.editVendorName}
                          onChange={e => updateField(i, 'editVendorName', e.target.value)}
                          placeholder="(없음)"
                          className="w-full text-sm border-0 border-b border-transparent hover:border-gray-200 focus:border-yellow-400 focus:outline-none px-1 py-0.5"
                        />
                        {r.matched_vendor_id ? (
                          <p className="text-[10px] text-green-600 mt-0.5">✓ 기존 매칭: {r.matched_vendor_name}</p>
                        ) : r.editVendorName.trim() ? (
                          <p className="text-[10px] text-blue-500 mt-0.5">+ 신규 등록 예정</p>
                        ) : null}
                      </td>
                      <td className="py-2 px-2 align-top">
                        <input
                          type="date"
                          value={r.editDueDate}
                          onChange={e => updateField(i, 'editDueDate', e.target.value)}
                          className="w-full text-sm border-0 border-b border-transparent hover:border-gray-200 focus:border-yellow-400 focus:outline-none px-1 py-0.5"
                        />
                      </td>
                      <td className="py-2 px-2 align-top text-[11px] text-gray-400 truncate" title={r.source_pdf}>
                        {r.source_pdf}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
          {savedMsg && (
            <div className="mt-3 bg-green-50 border border-green-100 rounded-lg px-4 py-3 text-sm text-green-700">
              {savedMsg}
            </div>
          )}
        </div>

        {/* 푸터 */}
        <div className="px-6 py-3 border-t border-gray-100 flex items-center justify-between bg-gray-50">
          <div className="text-xs text-gray-500">
            선택 <span className="font-semibold text-gray-700">{selectedCount}</span>건
            {selectedCount > 0 && (
              <span className="ml-2">합계 <span className="font-semibold text-gray-700">{selectedTotal.toLocaleString()}원</span></span>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-800">
              닫기
            </button>
            <button
              onClick={handleSave}
              disabled={saving || selectedCount === 0 || loading}
              className="px-4 py-2 text-sm font-semibold rounded-lg disabled:opacity-40"
              style={{ backgroundColor: '#FFCE00', color: '#121212' }}
            >
              {saving ? '추가 중...' : `선택 항목 일괄 추가 (${selectedCount})`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
