'use client'

// Dropbox 폴더 재시도 버튼 — lead/sale/project 공용
// 운영 언어로 결과 표시. 기술 오류 그대로 노출 X.

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

export type RetryStage = 'lead' | 'sale' | 'project'

export default function DropboxRetryButton({
  stage,
  id,
  disabled,
  className,
}: {
  stage: RetryStage
  id: string
  disabled?: boolean
  className?: string
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [feedback, setFeedback] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null)

  const handleClick = () => {
    setFeedback(null)
    startTransition(async () => {
      try {
        if (stage === 'lead') {
          const { createLeadFolder } = await import('@/app/(dashboard)/leads/actions')
          const r = await createLeadFolder(id)
          if (r.error || !r.url) {
            setFeedback({ kind: 'err', msg: r.error?.includes('서비스 타입') ? '서비스를 먼저 정해야 폴더를 만들 수 있어요.' : '폴더 생성이 바로 되지 않았어요. 잠시 후 다시 시도해주세요.' })
            return
          }
          setFeedback({ kind: 'ok', msg: '자료 폴더를 다시 연결했어요.' })
          router.refresh()
          return
        }
        if (stage === 'sale') {
          const { retrySaleDropboxFolder } = await import('@/app/(dashboard)/sales/actions')
          const r = await retrySaleDropboxFolder(id)
          if ('error' in r) {
            setFeedback({ kind: 'err', msg: r.error })
            return
          }
          setFeedback({ kind: 'ok', msg: '자료 폴더를 다시 연결했어요.' })
          router.refresh()
          return
        }
        // project
        const { retryProjectDropboxFolder } = await import('@/app/(dashboard)/projects/[id]/project-actions')
        const r = await retryProjectDropboxFolder(id)
        if ('error' in r) {
          setFeedback({ kind: 'err', msg: r.error })
          return
        }
        const msg = r.source === 'from_sale'
          ? '계약 폴더에서 가져와 연결했어요.'
          : '자료 폴더를 새로 만들어 연결했어요.'
        setFeedback({ kind: 'ok', msg })
        router.refresh()
      } catch (e) {
        console.error('[DropboxRetryButton] unexpected', e instanceof Error ? e.message : e)
        setFeedback({ kind: 'err', msg: '예상치 못한 문제로 실패했어요. 관리자에게 알려주세요.' })
      }
    })
  }

  return (
    <span className={`inline-flex items-center gap-1.5 ${className ?? ''}`}>
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled || pending}
        className="text-[10px] px-2 py-0.5 rounded border border-amber-300 bg-white hover:bg-amber-50 text-amber-800 disabled:opacity-50 font-medium"
      >
        {pending ? '연결 중…' : '🔄 폴더 다시 연결'}
      </button>
      {feedback && (
        <span className={`text-[10px] ${feedback.kind === 'ok' ? 'text-emerald-700' : 'text-red-600'}`}>
          {feedback.kind === 'ok' ? '✓' : '⚠'} {feedback.msg}
        </span>
      )}
    </span>
  )
}
