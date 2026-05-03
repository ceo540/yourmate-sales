'use client'

// 가벼운 분류 입력 폼 — lead/sale 단계용 (메인유형 + 확장태그만, capability 없음)
// yourmate-company-spec-v2 §5~7 / yourmate-system-functional-spec-v1 §5.1
//
// mode='guessed' = lead 추정/힌트 (라벨 "메인유형 추정", "확장태그 추정")
// mode='final'   = sale 1차 확정 (라벨 "메인유형", "확장태그")

import {
  MAIN_TYPES,
  EXPANSION_TAG_GROUPS,
  suggestMainTypeFromText,
  type MainType,
  type ExpansionTag,
} from '@/lib/project-classification'

const MAIN_TYPE_COLOR: Record<MainType, string> = {
  '학교공연형':   'bg-purple-50 text-purple-700 border-purple-200',
  '교육운영형':   'bg-emerald-50 text-emerald-700 border-emerald-200',
  '복합행사형':   'bg-amber-50 text-amber-700 border-amber-200',
  '렌탈·납품형':  'bg-blue-50 text-blue-700 border-blue-200',
  '콘텐츠제작형': 'bg-pink-50 text-pink-700 border-pink-200',
}

export interface ClassificationFieldsValue {
  main_type: string | null
  expansion_tags: string[]
}

export default function ClassificationFieldsInline({
  value,
  onChange,
  mode = 'final',
  suggestionText,
  disabled,
  compact,
}: {
  value: ClassificationFieldsValue
  onChange: (next: ClassificationFieldsValue) => void
  mode?: 'guessed' | 'final'
  suggestionText?: string                 // AI 추천 시 분석할 텍스트 (서비스명+프로젝트명+초기내용)
  disabled?: boolean
  compact?: boolean
}) {
  const mainLabel = mode === 'guessed' ? '메인유형 추정' : '메인유형'
  const expLabel  = mode === 'guessed' ? '확장태그 추정' : '확장태그'
  const noteHint  = mode === 'guessed' ? '아직 애매해도 OK — sale 단계에서 정리합니다.' : 'sale 단계에서 1차 확정.'

  const applySuggestion = () => {
    if (!suggestionText) {
      alert('추천할 텍스트가 없어요. 서비스명·프로젝트명·초기내용을 먼저 입력해주세요.')
      return
    }
    const guess = suggestMainTypeFromText(suggestionText)
    if (!guess) {
      alert('main_type 후보를 못 찾았어요.')
      return
    }
    onChange({ ...value, main_type: guess })
  }

  return (
    <div className={compact ? 'space-y-2' : 'space-y-3'}>
      {/* 메인유형 */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-xs font-medium text-gray-700">
            {mainLabel}
            <span className="text-[10px] text-gray-400 font-normal ml-1">(1개)</span>
          </label>
          <button
            type="button"
            onClick={applySuggestion}
            disabled={disabled}
            className="text-[10px] px-1.5 py-0.5 rounded border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-700 disabled:opacity-50"
            title="서비스명·프로젝트명 기반 추천"
          >
            ✨ AI 추천
          </button>
        </div>
        <div className="flex flex-wrap gap-1">
          {MAIN_TYPES.map(m => {
            const active = value.main_type === m.key
            return (
              <button
                key={m.key}
                type="button"
                disabled={disabled}
                onClick={() => onChange({ ...value, main_type: active ? null : m.key })}
                className={`text-[11px] px-2 py-0.5 rounded-full border transition-colors disabled:opacity-50 ${
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
      </div>

      {/* 확장태그 */}
      <div>
        <label className="text-xs font-medium text-gray-700 block mb-1">
          {expLabel}
          <span className="text-[10px] text-gray-400 font-normal ml-1">
            ({value.expansion_tags.length}개 선택)
          </span>
        </label>
        <div className="space-y-1.5">
          {EXPANSION_TAG_GROUPS.map(group => (
            <div key={group.label}>
              <p className="text-[10px] text-gray-400 mb-0.5">{group.label}</p>
              <div className="flex flex-wrap gap-1">
                {group.tags.map(tag => {
                  const active = value.expansion_tags.includes(tag)
                  return (
                    <button
                      key={tag}
                      type="button"
                      disabled={disabled}
                      onClick={() => onChange({
                        ...value,
                        expansion_tags: active
                          ? value.expansion_tags.filter(x => x !== tag)
                          : [...value.expansion_tags, tag] as ExpansionTag[],
                      })}
                      className={`text-[11px] px-1.5 py-0.5 rounded-full border transition-colors disabled:opacity-50 ${
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

      {!compact && <p className="text-[10px] text-gray-400">{noteHint}</p>}
    </div>
  )
}
