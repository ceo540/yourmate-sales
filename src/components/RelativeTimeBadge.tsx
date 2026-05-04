'use client'

// 상대 시간 배지 — 1분마다 자동 갱신 (Phase 9.6)
// SSR/CSR mismatch 방지 위해 mount 후에만 표시 (F3 hydration 패턴)

import { useEffect, useState } from 'react'
import { formatRelativeTime, formatAbsoluteTime } from '@/lib/relative-time'

interface Props {
  iso: string | null | undefined
  prefix?: string
  className?: string
  /** 빈 값일 때 표시할 텍스트. 기본 '' (안 보임) */
  emptyLabel?: string
}

export default function RelativeTimeBadge({ iso, prefix, className, emptyLabel }: Props) {
  // 첫 렌더는 빈값 → mount 후 클라이언트 시각으로 채움
  const [mounted, setMounted] = useState(false)
  const [, setTick] = useState(0)
  useEffect(() => {
    setMounted(true)
    // 1분마다 re-render — 상대시간 자동 갱신
    const id = setInterval(() => setTick(t => t + 1), 60_000)
    return () => clearInterval(id)
  }, [])

  if (!mounted) return null
  if (!iso) {
    return emptyLabel ? <span className={className}>{emptyLabel}</span> : null
  }
  const rel = formatRelativeTime(iso)
  const abs = formatAbsoluteTime(iso)
  return (
    <span className={className} title={abs} aria-label={`${prefix ?? ''} ${abs}`}>
      {prefix ? `${prefix} ` : ''}{rel}
    </span>
  )
}
