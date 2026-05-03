'use client'

// 소통 퀵 입력 (Flow UX 1차)
// 4개 유형 버튼 + 한 줄 입력 + Enter/저장. lead/sale 모드 분기.
// 기존 createLog/createLeadLog 재사용 (DRY).

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

const TYPES = ['통화', '이메일', '방문', '내부회의'] as const
type LogType = typeof TYPES[number]

type Mode =
  | { mode: 'sale'; saleId: string }
  | { mode: 'lead'; leadId: string }
  | { mode: 'project'; projectId: string }

type Props = Mode & {
  onSaved?: () => void
  defaultType?: LogType
  className?: string
}

export default function QuickLogInput(props: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [type, setType] = useState<LogType>(props.defaultType ?? '통화')
  const [content, setContent] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [savedFlash, setSavedFlash] = useState(false)

  function submit() {
    const text = content.trim()
    if (!text || isPending) return
    setError(null)
    startTransition(async () => {
      try {
        if (props.mode === 'sale') {
          const { createLog } = await import('@/app/(dashboard)/sales/[id]/log-actions')
          await createLog(props.saleId, text, type)
        } else if (props.mode === 'project') {
          const { createProjectLog } = await import('@/app/(dashboard)/projects/[id]/project-actions')
          const category = ['내부회의', '메모'].includes(type) ? '내부' : '외부'
          await createProjectLog(props.projectId, text, type, category)
        } else {
          const { createLeadLog } = await import('@/app/(dashboard)/leads/lead-log-actions')
          await createLeadLog(props.leadId, text, type)
        }
        setContent('')
        setSavedFlash(true)
        setTimeout(() => setSavedFlash(false), 1500)
        props.onSaved?.()
        router.refresh()
      } catch (e) {
        setError(e instanceof Error ? e.message : '저장 실패')
      }
    })
  }

  return (
    <div className={`bg-white border border-gray-200 rounded-lg p-2.5 space-y-1.5 ${props.className ?? ''}`}>
      <div className="flex items-center gap-1 flex-wrap">
        {TYPES.map(t => (
          <button
            key={t}
            type="button"
            onClick={() => setType(t)}
            className={`text-xs px-2 py-1 rounded-full font-medium border transition-colors ${
              type === t
                ? 'bg-blue-100 border-blue-300 text-blue-800'
                : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {t}
          </button>
        ))}
        {savedFlash && <span className="ml-auto text-[11px] text-emerald-600 font-medium">✓ 저장됨</span>}
      </div>
      <div className="flex gap-1.5">
        <input
          value={content}
          onChange={e => setContent(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit() } }}
          placeholder={`${type} 한 줄 메모 (Enter 저장)`}
          disabled={isPending}
          className="flex-1 text-sm border border-gray-200 rounded px-2.5 py-1.5 focus:outline-none focus:border-blue-400 disabled:opacity-50"
        />
        <button
          type="button"
          onClick={submit}
          disabled={isPending || !content.trim()}
          className="text-xs px-3 py-1.5 rounded font-medium bg-blue-600 text-white disabled:opacity-40 hover:bg-blue-700"
        >
          {isPending ? '...' : '저장'}
        </button>
      </div>
      {error && <p className="text-xs text-red-600">⚠ {error}</p>}
    </div>
  )
}
