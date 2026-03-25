'use client'

import { useEffect, useRef } from 'react'
import dynamic from 'next/dynamic'

const SimpleMDE = dynamic(() => import('react-simplemde-editor'), { ssr: false })

interface RichEditorProps {
  content?: string
  onChange?: (value: string) => void
  placeholder?: string
  editable?: boolean
}

export default function RichEditor({
  content = '',
  onChange,
  placeholder = '내용을 입력하세요... (마크다운 지원)',
  editable = true,
}: RichEditorProps) {
  if (!editable) {
    return (
      <div className="px-4 py-3 text-sm text-gray-700 whitespace-pre-wrap min-h-[100px]">
        {content || <span className="text-gray-400">{placeholder}</span>}
      </div>
    )
  }

  return (
    <>
      <SimpleMDE
        value={content}
        onChange={onChange}
        options={{
          placeholder,
          autofocus: false,
          spellChecker: false,
          toolbar: [
            'bold', 'italic', 'strikethrough', '|',
            'heading-1', 'heading-2', 'heading-3', '|',
            'unordered-list', 'ordered-list', '|',
            'quote', 'code', '|',
            'link', 'image', '|',
            'preview', 'guide',
          ],
          status: false,
          minHeight: '200px',
        }}
      />
      <style>{`
        .EasyMDEContainer .CodeMirror { font-size: 14px; font-family: inherit; border-radius: 0 0 8px 8px; border-color: #e5e7eb; }
        .EasyMDEContainer .editor-toolbar { border-radius: 8px 8px 0 0; border-color: #e5e7eb; background: #f9fafb; }
        .EasyMDEContainer .editor-toolbar button:hover, .EasyMDEContainer .editor-toolbar button.active { background: #FFCE00; border-color: #FFCE00; }
        .EasyMDEContainer .editor-preview { font-size: 14px; font-family: inherit; }
      `}</style>
    </>
  )
}
