'use client'

import { useCreateBlockNote } from '@blocknote/react'
import { BlockNoteView } from '@blocknote/mantine'
import { useEffect, useRef } from 'react'
import '@blocknote/core/fonts/inter.css'
import '@blocknote/mantine/style.css'

interface Props {
  initialMarkdown: string
  onChangeMarkdown: (md: string) => void
  className?: string
}

// 노션 스타일 WYSIWYG 에디터.
// 마크다운 in/out — 기존 마크다운 데이터 호환 + 빵빵이 도구 호환 유지.
// 슬래시(/) 메뉴, 표 셀 직접 편집, 체크박스, 드래그 정렬 모두 기본 지원.
export default function BlockNoteEditor({ initialMarkdown, onChangeMarkdown, className = '' }: Props) {
  const editor = useCreateBlockNote()
  const initRef = useRef(false)

  // 초기 마크다운 → BlockNote blocks 로드 (1회만)
  useEffect(() => {
    if (initRef.current) return
    initRef.current = true
    if (initialMarkdown?.trim()) {
      ;(async () => {
        const blocks = await editor.tryParseMarkdownToBlocks(initialMarkdown)
        editor.replaceBlocks(editor.document, blocks)
      })()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor])

  return (
    <div className={`bn-wrapper ${className}`}>
      <BlockNoteView
        editor={editor}
        theme="light"
        onChange={async () => {
          const md = await editor.blocksToMarkdownLossy(editor.document)
          onChangeMarkdown(md)
        }}
      />
    </div>
  )
}
