'use client'

import { RefObject, useCallback } from 'react'

interface Props {
  textareaRef: RefObject<HTMLTextAreaElement | null>
  value: string
  onChange: (next: string) => void
}

// 마크다운 입력 헬퍼 — 선택 영역 감싸기 또는 줄 단위 prefix 삽입
export default function MarkdownToolbar({ textareaRef, value, onChange }: Props) {
  const wrap = useCallback((before: string, after: string = before, placeholder = '') => {
    const ta = textareaRef.current
    if (!ta) return
    const start = ta.selectionStart
    const end = ta.selectionEnd
    const sel = value.slice(start, end) || placeholder
    const next = value.slice(0, start) + before + sel + after + value.slice(end)
    onChange(next)
    requestAnimationFrame(() => {
      ta.focus()
      ta.setSelectionRange(start + before.length, start + before.length + sel.length)
    })
  }, [textareaRef, value, onChange])

  const linePrefix = useCallback((prefix: string) => {
    const ta = textareaRef.current
    if (!ta) return
    const start = ta.selectionStart
    const end = ta.selectionEnd
    const before = value.slice(0, start)
    const lineStart = before.lastIndexOf('\n') + 1
    const sel = value.slice(lineStart, end)
    const lines = sel.split('\n')
    const newSel = lines.map(l => prefix + l).join('\n')
    const next = value.slice(0, lineStart) + newSel + value.slice(end)
    onChange(next)
    requestAnimationFrame(() => {
      ta.focus()
      ta.setSelectionRange(lineStart, lineStart + newSel.length)
    })
  }, [textareaRef, value, onChange])

  const insertAtCursor = useCallback((text: string) => {
    const ta = textareaRef.current
    if (!ta) return
    const start = ta.selectionStart
    const end = ta.selectionEnd
    const next = value.slice(0, start) + text + value.slice(end)
    onChange(next)
    requestAnimationFrame(() => {
      ta.focus()
      ta.setSelectionRange(start + text.length, start + text.length)
    })
  }, [textareaRef, value, onChange])

  const insertTable = () => {
    const tbl = '\n| 항목 | 담당 | 마감 |\n|------|------|------|\n| 내용 | 이름 | YYYY-MM-DD |\n'
    insertAtCursor(tbl)
  }

  const buttonClass = 'px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded transition-colors'

  return (
    <div className="flex flex-wrap items-center gap-0.5 bg-gray-50 border border-gray-200 rounded-t-lg px-1.5 py-1 text-xs">
      <button type="button" onClick={() => wrap('**', '**', '굵게')} className={buttonClass} title="굵게 (⌘+B)"><b>B</b></button>
      <button type="button" onClick={() => wrap('*', '*', '기울임')} className={`${buttonClass} italic`} title="기울임 (⌘+I)">I</button>
      <button type="button" onClick={() => wrap('~~', '~~', '취소선')} className={`${buttonClass} line-through`} title="취소선">S</button>
      <span className="w-px h-4 bg-gray-300 mx-1" />
      <button type="button" onClick={() => linePrefix('# ')} className={buttonClass} title="제목 1">H1</button>
      <button type="button" onClick={() => linePrefix('## ')} className={buttonClass} title="제목 2">H2</button>
      <button type="button" onClick={() => linePrefix('### ')} className={buttonClass} title="제목 3">H3</button>
      <span className="w-px h-4 bg-gray-300 mx-1" />
      <button type="button" onClick={() => linePrefix('- ')} className={buttonClass} title="리스트">• 리스트</button>
      <button type="button" onClick={() => linePrefix('1. ')} className={buttonClass} title="번호 리스트">1. 번호</button>
      <button type="button" onClick={() => linePrefix('- [ ] ')} className={buttonClass} title="체크박스">☐ 체크</button>
      <span className="w-px h-4 bg-gray-300 mx-1" />
      <button type="button" onClick={() => linePrefix('> ')} className={buttonClass} title="인용">❝</button>
      <button type="button" onClick={() => wrap('`', '`', 'code')} className={buttonClass} title="코드">{'</>'}</button>
      <button type="button" onClick={insertTable} className={buttonClass} title="표 삽입">📊 표</button>
      <button type="button" onClick={() => wrap('[', '](url)', '링크 텍스트')} className={buttonClass} title="링크">🔗</button>
    </div>
  )
}

// 단축키 핸들러 — textarea onKeyDown에 부착
export function handleMarkdownShortcut(
  e: React.KeyboardEvent<HTMLTextAreaElement>,
  value: string,
  onChange: (v: string) => void,
): boolean {
  if (!(e.metaKey || e.ctrlKey)) return false
  const ta = e.currentTarget
  const start = ta.selectionStart
  const end = ta.selectionEnd
  const sel = value.slice(start, end)
  const surround = (token: string) => {
    const next = value.slice(0, start) + token + sel + token + value.slice(end)
    onChange(next)
    requestAnimationFrame(() => {
      ta.focus()
      ta.setSelectionRange(start + token.length, start + token.length + sel.length)
    })
  }
  switch (e.key.toLowerCase()) {
    case 'b': e.preventDefault(); surround('**'); return true
    case 'i': e.preventDefault(); surround('*'); return true
    case 'e': e.preventDefault(); surround('`'); return true
    default: return false
  }
}
