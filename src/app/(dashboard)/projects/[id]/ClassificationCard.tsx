'use client'

// 운영 분류 카드 — yourmate-company-spec-v2 §3.4·§5~8 / yourmate-system-functional-spec-v1 §5.3
// service_type(영업용) 위에 main_type + expansion_tags + capability_tags(운영 구조).
//
// Phase 3: localStorage 데모 → DB 저장 (projects 테이블 컬럼).
// 초기값은 server fetch (page.tsx → ProjectV2Client → 카드 props).
// 저장 = updateProjectClassification server action → router.refresh.

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  MAIN_TYPES,
  EXPANSION_TAG_GROUPS,
  CAPABILITY_TAG_GROUPS,
  EMPTY_CLASSIFICATION,
  loadClassification,
  clearClassification,
  suggestMainTypeFromText,
  type ProjectClassification,
  type MainType,
  type ExpansionTag,
  type CapabilityTag,
} from '@/lib/project-classification'
import { updateProjectClassification } from './project-actions'

const MAIN_TYPE_COLOR: Record<MainType, string> = {
  '학교공연형':   'bg-purple-50 text-purple-700 border-purple-200',
  '교육운영형':   'bg-emerald-50 text-emerald-700 border-emerald-200',
  '복합행사형':   'bg-amber-50 text-amber-700 border-amber-200',
  '렌탈·납품형':  'bg-blue-50 text-blue-700 border-blue-200',
  '콘텐츠제작형': 'bg-pink-50 text-pink-700 border-pink-200',
}

export interface ClassificationInitial {
  main_type: string | null
  expansion_tags: string[] | null
  capability_tags: string[] | null
  classification_note: string | null
  classification_confidence: number | null
}

function toClassification(initial: ClassificationInitial | null | undefined): ProjectClassification {
  if (!initial) return EMPTY_CLASSIFICATION
  return {
    main_type: (initial.main_type as MainType | null) ?? null,
    expansion_tags: (initial.expansion_tags as ExpansionTag[] | null) ?? [],
    capability_tags: (initial.capability_tags as CapabilityTag[] | null) ?? [],
    classification_note: initial.classification_note ?? null,
    classification_confidence: initial.classification_confidence ?? null,
  }
}

export default function ClassificationCard({
  projectId,
  serviceType,
  projectName,
  initial,
}: {
  projectId: string
  serviceType: string | null
  projectName: string | null
  initial: ClassificationInitial | null | undefined
}) {
  const router = useRouter()
  const current = toClassification(initial)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<ProjectClassification>(current)
  const [pending, startTransition] = useTransition()
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // 옛 데모(localStorage) 데이터가 있고 DB 가 비어 있으면 1회 import 제안
  const hasLegacyDemo = typeof window !== 'undefined' && !!loadClassification(projectId) && !current.main_type && current.expansion_tags.length === 0 && current.capability_tags.length === 0

  const enterEdit = () => {
    setDraft(current)
    setErrorMsg(null)
    setEditing(true)
  }
  const cancelEdit = () => {
    setDraft(EMPTY_CLASSIFICATION)
    setErrorMsg(null)
    setEditing(false)
  }
  const handleSave = () => {
    startTransition(async () => {
      setErrorMsg(null)
      const r = await updateProjectClassification({
        projectId,
        main_type: draft.main_type,
        expansion_tags: draft.expansion_tags,
        capability_tags: draft.capability_tags,
        classification_note: draft.classification_note,
        classification_confidence: draft.classification_confidence,
      })
      if ('error' in r) {
        setErrorMsg(r.error)
        return
      }
      setEditing(false)
      router.refresh()
    })
  }
  const handleReset = () => {
    if (!confirm('이 프로젝트의 운영 분류를 초기화할까요?')) return
    startTransition(async () => {
      const r = await updateProjectClassification({
        projectId,
        main_type: null,
        expansion_tags: [],
        capability_tags: [],
        classification_note: null,
        classification_confidence: null,
      })
      if ('error' in r) {
        setErrorMsg(r.error)
        return
      }
      setEditing(false)
      router.refresh()
    })
  }
  const importFromDemo = () => {
    const legacy = loadClassification(projectId)
    if (!legacy) return
    if (!confirm('이전 브라우저 데모 값을 가져와 편집창에 채울까요?\n(저장 버튼 누르면 DB 에 저장됩니다.)')) return
    setDraft(legacy)
    setEditing(true)
  }
  const dismissDemo = () => {
    if (!confirm('이전 브라우저 데모 값을 삭제할까요? (DB 영향 없음)')) return
    clearClassification(projectId)
    router.refresh()
  }
  const applySuggestion = () => {
    const guess = suggestMainTypeFromText(`${projectName ?? ''} ${serviceType ?? ''}`)
    if (!guess) {
      alert('서비스명·프로젝트명에서 추천할 main_type 을 찾지 못했어요.')
      return
    }
    setDraft(d => ({ ...d, main_type: guess }))
  }

  const isEmpty = !current.main_type && current.expansion_tags.length === 0 && current.capability_tags.length === 0

  // ──────────── 보기 모드 ────────────
  if (!editing) {
    return (
      <section className="bg-white border border-gray-100 rounded-xl overflow-hidden">
        <header className="px-4 py-2.5 border-b border-gray-100 flex items-center justify-between">
          <p className="text-xs font-semibold text-gray-700">🧭 운영 분류</p>
          <div className="flex items-center gap-2">
            {serviceType && (
              <span className="text-[10px] text-gray-400">
                서비스: <span className="text-gray-600">{serviceType}</span>
              </span>
            )}
            <button
              onClick={enterEdit}
              className="text-xs px-2.5 py-1 rounded border border-gray-200 hover:bg-gray-50 text-gray-700"
            >
              {isEmpty ? '+ 분류 입력' : '수정'}
            </button>
          </div>
        </header>

        {hasLegacyDemo && (
          <div className="px-4 py-2 bg-amber-50 border-b border-amber-100 flex items-center gap-2 text-xs">
            <span className="text-amber-700">이 브라우저에 옛 데모 값이 있어요.</span>
            <button onClick={importFromDemo} className="text-amber-800 underline hover:text-amber-900">불러와서 저장</button>
            <button onClick={dismissDemo} className="ml-auto text-amber-600 hover:text-amber-800">무시·삭제</button>
          </div>
        )}

        {isEmpty ? (
          <div className="px-4 py-4">
            <p className="text-sm text-gray-500">아직 운영 분류 미설정.</p>
            <p className="text-xs text-gray-400 mt-1">
              service_type 은 영업용 이름이고, 실제 운영 구조는 main_type + expansion_tags + capability_tags 로 표현해요.
            </p>
          </div>
        ) : (
          <div className="px-4 py-3 space-y-3 text-sm">
            {current.main_type && (
              <div>
                <p className="text-[11px] text-gray-500 mb-1">메인유형</p>
                <span className={`inline-block px-2.5 py-0.5 rounded-full font-medium border text-xs ${MAIN_TYPE_COLOR[current.main_type]}`}>
                  {current.main_type}
                </span>
              </div>
            )}
            {current.expansion_tags.length > 0 && (
              <div>
                <p className="text-[11px] text-gray-500 mb-1">확장태그 ({current.expansion_tags.length})</p>
                <div className="flex flex-wrap gap-1">
                  {current.expansion_tags.map(t => (
                    <span key={t} className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 border border-gray-200">{t}</span>
                  ))}
                </div>
              </div>
            )}
            {current.capability_tags.length > 0 && (
              <div>
                <p className="text-[11px] text-gray-500 mb-1">역량태그 ({current.capability_tags.length})</p>
                <div className="flex flex-wrap gap-1">
                  {current.capability_tags.map(t => (
                    <span key={t} className="text-[11px] px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">{t}</span>
                  ))}
                </div>
              </div>
            )}
            {current.classification_note && (
              <div>
                <p className="text-[11px] text-gray-500 mb-1">분류 근거</p>
                <p className="text-xs text-gray-700 whitespace-pre-wrap">{current.classification_note}</p>
              </div>
            )}
          </div>
        )}
      </section>
    )
  }

  // ──────────── 편집 모드 ────────────
  return (
    <section className="bg-white border border-gray-100 rounded-xl overflow-hidden">
      <header className="px-4 py-2.5 border-b border-gray-100 flex items-center justify-between">
        <p className="text-xs font-semibold text-gray-700">🧭 운영 분류 편집</p>
        <button
          type="button"
          onClick={applySuggestion}
          disabled={pending}
          className="text-xs px-2 py-1 rounded border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-700 disabled:opacity-50"
          title="프로젝트명·서비스명 기반 main_type 추천"
        >
          ✨ AI 추천
        </button>
      </header>

      <div className="px-4 py-3 space-y-4">
        {/* 메인유형 */}
        <div>
          <p className="text-xs font-medium text-gray-700 mb-1.5">
            메인유형 <span className="text-red-500">*</span>
            <span className="text-[10px] text-gray-400 font-normal ml-1">(1개)</span>
          </p>
          <div className="flex flex-wrap gap-1.5">
            {MAIN_TYPES.map(m => {
              const active = draft.main_type === m.key
              return (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => setDraft(d => ({ ...d, main_type: active ? null : m.key }))}
                  disabled={pending}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-colors disabled:opacity-50 ${
                    active
                      ? `${MAIN_TYPE_COLOR[m.key]} font-medium`
                      : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                  title={m.hint}
                >
                  {m.label}
                </button>
              )
            })}
          </div>
          {draft.main_type && (
            <p className="text-[11px] text-gray-500 mt-1.5 italic">
              {MAIN_TYPES.find(m => m.key === draft.main_type)?.hint}
            </p>
          )}
        </div>

        {/* 확장태그 */}
        <div>
          <p className="text-xs font-medium text-gray-700 mb-1.5">
            확장태그
            <span className="text-[10px] text-gray-400 font-normal ml-1">
              ({draft.expansion_tags.length}개 선택)
            </span>
          </p>
          <div className="space-y-2">
            {EXPANSION_TAG_GROUPS.map(group => (
              <div key={group.label}>
                <p className="text-[10px] text-gray-400 mb-1">{group.label}</p>
                <div className="flex flex-wrap gap-1.5">
                  {group.tags.map(tag => {
                    const active = draft.expansion_tags.includes(tag)
                    return (
                      <button
                        key={tag}
                        type="button"
                        disabled={pending}
                        onClick={() => setDraft(d => ({
                          ...d,
                          expansion_tags: active
                            ? d.expansion_tags.filter(x => x !== tag)
                            : [...d.expansion_tags, tag] as ExpansionTag[],
                        }))}
                        className={`text-[11px] px-2 py-0.5 rounded-full border transition-colors disabled:opacity-50 ${
                          active
                            ? 'bg-gray-700 text-white border-gray-700'
                            : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        {tag}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 역량태그 */}
        <div>
          <p className="text-xs font-medium text-gray-700 mb-1.5">
            역량태그
            <span className="text-[10px] text-gray-400 font-normal ml-1">
              ({draft.capability_tags.length}개 선택)
            </span>
          </p>
          <div className="space-y-2">
            {CAPABILITY_TAG_GROUPS.map(group => (
              <div key={group.label}>
                <p className="text-[10px] text-gray-400 mb-1">{group.label}</p>
                <div className="flex flex-wrap gap-1.5">
                  {group.tags.map(tag => {
                    const active = draft.capability_tags.includes(tag)
                    return (
                      <button
                        key={tag}
                        type="button"
                        disabled={pending}
                        onClick={() => setDraft(d => ({
                          ...d,
                          capability_tags: active
                            ? d.capability_tags.filter(x => x !== tag)
                            : [...d.capability_tags, tag] as CapabilityTag[],
                        }))}
                        className={`text-[11px] px-2 py-0.5 rounded-full border transition-colors disabled:opacity-50 ${
                          active
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        {tag}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 분류 근거 */}
        <div>
          <label className="text-xs font-medium text-gray-700 block mb-1">
            분류 근거 (선택)
            <span className="text-[10px] text-gray-400 font-normal ml-1">왜 이렇게 분류했는지 한두 줄</span>
          </label>
          <textarea
            value={draft.classification_note ?? ''}
            onChange={e => setDraft(d => ({ ...d, classification_note: e.target.value || null }))}
            disabled={pending}
            rows={2}
            className="w-full text-sm border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:border-gray-400 disabled:bg-gray-50"
            placeholder="예: 교육 운영이 본질이며, 발표회 운영과 영상 제작이 부가 범위로 포함됨"
          />
        </div>

        {errorMsg && (
          <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded px-2 py-1.5">
            저장 실패: {errorMsg}
          </div>
        )}

        {/* 액션 */}
        <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
          <button
            type="button"
            onClick={handleSave}
            disabled={pending}
            className="text-sm px-3 py-1.5 rounded bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-50"
          >
            {pending ? '저장 중…' : '저장'}
          </button>
          <button
            type="button"
            onClick={cancelEdit}
            disabled={pending}
            className="text-sm px-3 py-1.5 rounded border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleReset}
            disabled={pending}
            className="ml-auto text-xs text-gray-400 hover:text-red-600 disabled:opacity-50"
          >
            초기화
          </button>
        </div>
      </div>
    </section>
  )
}
