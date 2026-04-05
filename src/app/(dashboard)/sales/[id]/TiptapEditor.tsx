'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import Underline from '@tiptap/extension-underline'
import TextAlign from '@tiptap/extension-text-align'
import { Table, TableRow, TableHeader, TableCell } from '@tiptap/extension-table'
import { useEffect } from 'react'

interface Props {
  content: string
  onChange: (html: string) => void
  placeholder?: string
  editable?: boolean
  minimal?: boolean  // 업무 설명용 — 표/인용구 없이 간소화
}

export default function TiptapEditor({ content, onChange, placeholder = '여기에 자유롭게 적으세요...', editable = true, minimal = false }: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Placeholder.configure({ placeholder }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Underline,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content,
    editable,
    onUpdate: ({ editor }) => { onChange(editor.getHTML()) },
    editorProps: {
      attributes: {
        class: `prose prose-sm max-w-none focus:outline-none px-1 ${minimal ? 'min-h-[100px]' : 'min-h-[200px]'}`,
      },
    },
  })

  useEffect(() => {
    if (!editor || editable) return
    if (editor.getHTML() !== content) editor.commands.setContent(content)
  }, [content, editor, editable])

  if (!editor) return null

  return (
    <div className="tiptap-wrapper">
      {editable && <Toolbar editor={editor} minimal={minimal} />}
      <EditorContent editor={editor} />
    </div>
  )
}

// ─── 툴바 ─────────────────────────────────────────────────────────────────────
function Toolbar({ editor, minimal }: { editor: any; minimal: boolean }) {
  const btn = (active: boolean) =>
    `px-2 py-1 text-xs rounded transition-colors ${active ? 'bg-gray-800 text-white' : 'text-gray-500 hover:bg-gray-100'}`

  const inTable = editor.isActive('table')

  return (
    <div className="flex items-center gap-0.5 px-1 py-1.5 border-b border-gray-100 flex-wrap mb-1">
      {/* 헤딩 — minimal이면 H2/H3만 */}
      {(minimal ? [2, 3] as const : [1, 2, 3] as const).map(level => (
        <button key={level} type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level }).run()}
          className={btn(editor.isActive('heading', { level }))}>
          H{level}
        </button>
      ))}

      <span className="w-px h-4 bg-gray-200 mx-1" />

      {/* 텍스트 스타일 */}
      <button type="button" onClick={() => editor.chain().focus().toggleBold().run()} className={btn(editor.isActive('bold'))}>
        <strong>B</strong>
      </button>
      <button type="button" onClick={() => editor.chain().focus().toggleItalic().run()} className={btn(editor.isActive('italic'))}>
        <em>I</em>
      </button>
      <button type="button" onClick={() => editor.chain().focus().toggleUnderline().run()} className={btn(editor.isActive('underline'))}>
        <span className="underline">U</span>
      </button>
      <button type="button" onClick={() => editor.chain().focus().toggleStrike().run()} className={btn(editor.isActive('strike'))}>
        <span className="line-through">S</span>
      </button>

      <span className="w-px h-4 bg-gray-200 mx-1" />

      {/* 리스트 */}
      <button type="button" onClick={() => editor.chain().focus().toggleBulletList().run()} className={btn(editor.isActive('bulletList'))}>
        • 목록
      </button>
      <button type="button" onClick={() => editor.chain().focus().toggleOrderedList().run()} className={btn(editor.isActive('orderedList'))}>
        1. 번호
      </button>
      <button type="button" onClick={() => editor.chain().focus().toggleTaskList().run()} className={btn(editor.isActive('taskList'))}>
        ☑ 체크
      </button>

      {!minimal && (
        <>
          <span className="w-px h-4 bg-gray-200 mx-1" />
          <button type="button" onClick={() => editor.chain().focus().toggleBlockquote().run()} className={btn(editor.isActive('blockquote'))}>
            ❝ 인용
          </button>
          <button type="button" onClick={() => editor.chain().focus().toggleCode().run()} className={btn(editor.isActive('code'))}>
            {'</>'}
          </button>
        </>
      )}

      <span className="w-px h-4 bg-gray-200 mx-1" />

      {/* 표 */}
      {!inTable ? (
        <button type="button"
          onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
          className={btn(false)}>
          표 삽입
        </button>
      ) : (
        <>
          <button type="button" onClick={() => editor.chain().focus().addColumnAfter().run()} className={btn(false)} title="열 추가">열+</button>
          <button type="button" onClick={() => editor.chain().focus().deleteColumn().run()} className={btn(false)} title="열 삭제">열−</button>
          <button type="button" onClick={() => editor.chain().focus().addRowAfter().run()} className={btn(false)} title="행 추가">행+</button>
          <button type="button" onClick={() => editor.chain().focus().deleteRow().run()} className={btn(false)} title="행 삭제">행−</button>
          <button type="button" onClick={() => editor.chain().focus().deleteTable().run()} className="px-2 py-1 text-xs rounded text-red-400 hover:bg-red-50 transition-colors">표삭제</button>
        </>
      )}

      {!minimal && (
        <>
          <span className="w-px h-4 bg-gray-200 mx-1" />
          <button type="button" onClick={() => editor.chain().focus().setHorizontalRule().run()} className={btn(false)}>─</button>
        </>
      )}
    </div>
  )
}
