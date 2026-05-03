'use client'

// sale 운영 분류 카드 (Phase 4) — main_type + expansion_tags
// project 의 ClassificationCard 보다 가벼운 버전 (capability 없음).

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import ClassificationFieldsInline from '@/components/ClassificationFieldsInline'
import { updateSaleClassification } from '../actions'
import type { MainType } from '@/lib/project-classification'

const MAIN_TYPE_COLOR: Record<MainType, string> = {
  '학교공연형':   'bg-purple-50 text-purple-700 border-purple-200',
  '교육운영형':   'bg-emerald-50 text-emerald-700 border-emerald-200',
  '복합행사형':   'bg-amber-50 text-amber-700 border-amber-200',
  '렌탈·납품형':  'bg-blue-50 text-blue-700 border-blue-200',
  '콘텐츠제작형': 'bg-pink-50 text-pink-700 border-pink-200',
}

export default function SaleClassificationCard({
  saleId,
  saleName,
  serviceType,
  initialMainType,
  initialExpansionTags,
}: {
  saleId: string
  saleName: string | null
  serviceType: string | null
  initialMainType: string | null
  initialExpansionTags: string[] | null
}) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<{ main_type: string | null; expansion_tags: string[] }>({
    main_type: initialMainType,
    expansion_tags: initialExpansionTags ?? [],
  })
  const [pending, startTransition] = useTransition()
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const isEmpty = !initialMainType && (!initialExpansionTags || initialExpansionTags.length === 0)

  const enterEdit = () => {
    setDraft({ main_type: initialMainType, expansion_tags: initialExpansionTags ?? [] })
    setErrorMsg(null)
    setEditing(true)
  }
  const cancelEdit = () => {
    setEditing(false)
    setErrorMsg(null)
  }
  const handleSave = () => {
    startTransition(async () => {
      setErrorMsg(null)
      const r = await updateSaleClassification({
        saleId,
        main_type: draft.main_type,
        expansion_tags: draft.expansion_tags,
      })
      if ('error' in r) {
        setErrorMsg(r.error)
        return
      }
      setEditing(false)
      router.refresh()
    })
  }

  if (!editing) {
    return (
      <section className="bg-white border border-gray-100 rounded-xl overflow-hidden mb-3">
        <header className="px-4 py-2.5 border-b border-gray-100 flex items-center justify-between">
          <p className="text-xs font-semibold text-gray-700">🧭 운영 분류 (sale)</p>
          <div className="flex items-center gap-2">
            {serviceType && (
              <span className="text-[10px] text-gray-400">서비스: <span className="text-gray-600">{serviceType}</span></span>
            )}
            <button onClick={enterEdit} className="text-xs px-2.5 py-1 rounded border border-gray-200 hover:bg-gray-50 text-gray-700">
              {isEmpty ? '+ 분류 입력' : '수정'}
            </button>
          </div>
        </header>
        {isEmpty ? (
          <div className="px-4 py-3 text-xs text-gray-500">
            아직 sale 분류 미설정. lead 에서 추정값을 받아왔거나 사람이 정리할 단계.
          </div>
        ) : (
          <div className="px-4 py-3 space-y-2 text-sm">
            {initialMainType && (
              <div>
                <span className={`inline-block px-2.5 py-0.5 rounded-full font-medium border text-xs ${MAIN_TYPE_COLOR[initialMainType as MainType] ?? 'bg-gray-100 text-gray-700 border-gray-200'}`}>
                  {initialMainType}
                </span>
              </div>
            )}
            {initialExpansionTags && initialExpansionTags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {initialExpansionTags.map(t => (
                  <span key={t} className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 border border-gray-200">{t}</span>
                ))}
              </div>
            )}
          </div>
        )}
      </section>
    )
  }

  return (
    <section className="bg-white border border-gray-100 rounded-xl overflow-hidden mb-3">
      <header className="px-4 py-2.5 border-b border-gray-100 flex items-center justify-between">
        <p className="text-xs font-semibold text-gray-700">🧭 운영 분류 편집 (sale)</p>
      </header>
      <div className="px-4 py-3 space-y-3">
        <ClassificationFieldsInline
          mode="final"
          value={{ main_type: draft.main_type, expansion_tags: draft.expansion_tags }}
          onChange={next => setDraft({ main_type: next.main_type, expansion_tags: next.expansion_tags })}
          suggestionText={`${saleName ?? ''} ${serviceType ?? ''}`}
          disabled={pending}
          compact
        />
        {errorMsg && (
          <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded px-2 py-1.5">
            저장 실패: {errorMsg}
          </div>
        )}
        <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
          <button type="button" onClick={handleSave} disabled={pending} className="text-sm px-3 py-1.5 rounded bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-50">
            {pending ? '저장 중…' : '저장'}
          </button>
          <button type="button" onClick={cancelEdit} disabled={pending} className="text-sm px-3 py-1.5 rounded border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-50">
            취소
          </button>
        </div>
      </div>
    </section>
  )
}
