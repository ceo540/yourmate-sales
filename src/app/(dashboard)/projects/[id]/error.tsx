'use client'

import { useEffect } from 'react'

export default function ProjectError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[ProjectPage Error]', error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <p className="text-sm text-gray-500">페이지 로딩 중 오류가 발생했습니다.</p>
      {error.digest && (
        <p className="text-xs text-gray-400">코드: {error.digest}</p>
      )}
      <button
        onClick={reset}
        className="px-4 py-2 bg-yellow-400 text-gray-900 text-sm font-medium rounded-lg hover:bg-yellow-300"
      >
        다시 시도
      </button>
    </div>
  )
}
