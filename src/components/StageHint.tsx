'use client'

// 단계 역할 안내 띠 (yourmate-company-spec-v2 §3 / functional-spec-v1 §6)
// lead / sale / project 페이지 상단에 한 줄로 "이 단계는 무엇을 하는 곳인지" 안내.
// 사용자가 [✕]로 dismiss 하면 localStorage 에 기억 (per stage).

import { useEffect, useState } from 'react'

export type Stage = 'lead' | 'sale' | 'project'

const STAGE_CONTENT: Record<Stage, {
  icon: string
  title: string
  body: string
  next: string
  bg: string
  border: string
  text: string
  textStrong: string
}> = {
  lead: {
    icon: '📥',
    title: '문의를 잡는 단계',
    body: '정보 정리 + 🧭 운영 분류 추정 (애매하면 비워둬도 OK)',
    next: '다음: [프로젝트 전환 →] 으로 계약 + 프로젝트 자동 생성',
    bg: 'bg-sky-50',
    border: 'border-sky-200',
    text: 'text-sky-700',
    textStrong: 'text-sky-900',
  },
  sale: {
    icon: '📜',
    title: '계약과 운영 구조를 정리하는 단계',
    body: '운영 분류 1차 확정 (메인유형 + 추가 범위) — 어떤 운영 구조로 이어질지 정리',
    next: '다음: 프로젝트로 승계됩니다',
    bg: 'bg-violet-50',
    border: 'border-violet-200',
    text: 'text-violet-700',
    textStrong: 'text-violet-900',
  },
  project: {
    icon: '◈',
    title: '실제 실행과 운영 구조 최종 확정',
    body: '메인유형 + 추가 범위 + 필요 역량까지 — 누가 어떤 능력으로 일할지',
    next: '여기서 모든 실행이 일어나고 결과물·정산이 마무리됩니다',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    text: 'text-amber-700',
    textStrong: 'text-amber-900',
  },
}

const STORAGE_PREFIX = 'yourmate:stage_hint_dismissed:'

export default function StageHint({ stage, className }: { stage: Stage; className?: string }) {
  const [dismissed, setDismissed] = useState(true)  // 초기 hydration 깜빡임 방지

  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(STORAGE_PREFIX + stage) === '1')
    } catch {
      setDismissed(false)
    }
  }, [stage])

  const handleDismiss = () => {
    try {
      localStorage.setItem(STORAGE_PREFIX + stage, '1')
    } catch { /* 무시 */ }
    setDismissed(true)
  }

  const handleReset = () => {
    try {
      localStorage.removeItem(STORAGE_PREFIX + stage)
    } catch { /* 무시 */ }
    setDismissed(false)
  }

  if (dismissed) {
    return (
      <div className={`flex justify-end ${className ?? ''}`}>
        <button
          type="button"
          onClick={handleReset}
          className="text-[10px] text-gray-400 hover:text-gray-700"
          title="단계 안내 다시 보기"
        >
          ⓘ 단계 안내
        </button>
      </div>
    )
  }

  const c = STAGE_CONTENT[stage]
  return (
    <div className={`${c.bg} ${c.border} border rounded-lg px-3 py-2 flex items-start gap-2.5 ${className ?? ''}`}>
      <span className="text-base leading-none mt-0.5">{c.icon}</span>
      <div className="flex-1 min-w-0">
        <p className={`text-xs font-semibold ${c.textStrong}`}>{c.title}</p>
        <p className={`text-[11px] ${c.text} mt-0.5`}>{c.body}</p>
        <p className={`text-[10px] ${c.text} mt-0.5 opacity-80`}>↳ {c.next}</p>
      </div>
      <button
        type="button"
        onClick={handleDismiss}
        className={`text-xs ${c.text} hover:opacity-70 leading-none px-1`}
        title="안내 닫기"
      >
        ✕
      </button>
    </div>
  )
}
