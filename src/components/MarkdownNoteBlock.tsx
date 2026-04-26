'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import MarkdownText from './MarkdownText'

// BlockNote는 client-only. dynamic import로 SSR 회피.
const BlockNoteEditor = dynamic(() => import('./BlockNoteEditor'), { ssr: false })

// 공용 마크다운 노트 박스 — 제목 + 접기/펼치기 + 인라인 편집 + 툴바 + 단축키
// 프로젝트 메모/유의사항, 리드 메모 등 어디서든 재사용.
interface Props {
  entityId: string
  title: string
  value: string | null
  save: (id: string, v: string) => Promise<unknown>
  emptyText?: string
  accentClass?: string
  headerClass?: string
  rows?: number
  defaultCollapsed?: boolean
}

export default function MarkdownNoteBlock({
  entityId, title, value, save,
  emptyText = '비어 있음',
  accentClass, headerClass,
  rows = 10,
  defaultCollapsed = false,
}: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [editing, setEditing] = useState(false)
  const [collapsed, setCollapsed] = useState(defaultCollapsed)
  const [input, setInput] = useState(value ?? '')

  function handleSave() {
    startTransition(async () => {
      await save(entityId, input)
      setEditing(false)
      router.refresh()
    })
  }

  return (
    <div className={`bg-white border rounded-xl px-5 py-3 ${accentClass ?? 'border-gray-100'}`}>
      <div className="flex items-center justify-between mb-1.5">
        <button
          onClick={() => !editing && setCollapsed(c => !c)}
          className={`flex items-center gap-1.5 text-xs font-semibold hover:opacity-80 ${headerClass ?? 'text-gray-700'}`}
        >
          <span className="text-gray-400 text-[10px]">{collapsed ? '▶' : '▼'}</span>
          {title}
        </button>
        {!editing && !collapsed && (
          <button onClick={() => { setInput(value ?? ''); setEditing(true) }}
            className="text-[11px] text-gray-400 hover:text-gray-700">
            {value ? '편집' : '+ 추가'}
          </button>
        )}
      </div>
      {!collapsed && (
        editing ? (
          <div className="space-y-2">
            <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
              <BlockNoteEditor
                initialMarkdown={input}
                onChangeMarkdown={setInput}
              />
            </div>
            <div className="flex gap-2">
              <button onClick={handleSave}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg hover:opacity-80"
                style={{ backgroundColor: '#FFCE00', color: '#121212' }}>저장</button>
              <button onClick={() => setEditing(false)}
                className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg text-gray-500">취소</button>
              <span className="ml-auto text-[10px] text-gray-400 self-center">/ 슬래시 메뉴 · 표는 셀 직접 편집</span>
            </div>
          </div>
        ) : value ? (
          <MarkdownText className="text-gray-700">{value}</MarkdownText>
        ) : (
          <p className="text-xs text-gray-400 italic">{emptyText}</p>
        )
      )}
    </div>
  )
}
