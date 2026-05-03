'use client'

// Dropbox 연결 상태 배지 — lead / sale / project 공용
// 운영 언어로 표시. 기술 메시지(token error / path mismatch 등) 노출 X.
//
// 상태 결정 규칙 (간단):
//  - dropbox_url 있음 → 연결됨
//  - lead + service_type 없음 → 서비스 선택 전
//  - lead + service_type 있음 → 생성 확인 필요
//  - sale/project + url 없음 → 미연결

export type DropboxStage = 'lead' | 'sale' | 'project'

export type DropboxStatusKind =
  | 'connected'
  | 'check_needed'
  | 'service_required'
  | 'not_connected'

export interface DropboxStatusInput {
  dropbox_url: string | null | undefined
  service_type?: string | null
  stage: DropboxStage
}

export interface DropboxStatusInfo {
  kind: DropboxStatusKind
  label: string
  hint: string | null
  tone: 'green' | 'amber' | 'gray' | 'red'
  icon: string
}

export function resolveDropboxStatus(input: DropboxStatusInput): DropboxStatusInfo {
  const url = (input.dropbox_url ?? '').trim()
  if (url) {
    return {
      kind: 'connected',
      label: input.stage === 'project' ? '자료 폴더 연결됨' : 'Dropbox 연결됨',
      hint: null,
      tone: 'green',
      icon: '📁',
    }
  }
  if (input.stage === 'lead' && !input.service_type) {
    return {
      kind: 'service_required',
      label: '서비스 선택 전',
      hint: '서비스를 정하면 폴더가 자동 생성됩니다.',
      tone: 'gray',
      icon: '⏳',
    }
  }
  if (input.stage === 'lead') {
    return {
      kind: 'check_needed',
      label: '생성 확인 필요',
      hint: '서비스는 정해졌지만 폴더가 아직 보이지 않아요. [폴더 생성] 다시 시도 가능.',
      tone: 'amber',
      icon: '⚠️',
    }
  }
  return {
    kind: 'not_connected',
    label: input.stage === 'project' ? '운영 자료 미연결' : 'Dropbox 미연결',
    hint: '폴더가 아직 연결되지 않았어요.',
    tone: 'red',
    icon: '❌',
  }
}

const TONE_CLS: Record<DropboxStatusInfo['tone'], string> = {
  green: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  amber: 'bg-amber-50 text-amber-700 border-amber-200',
  gray:  'bg-gray-50 text-gray-600 border-gray-200',
  red:   'bg-red-50 text-red-700 border-red-200',
}

export default function DropboxStatusBadge({
  dropbox_url,
  service_type,
  stage,
  showHint = false,
  size = 'sm',
  className,
}: {
  dropbox_url: string | null | undefined
  service_type?: string | null
  stage: DropboxStage
  showHint?: boolean
  size?: 'sm' | 'md'
  className?: string
}) {
  const status = resolveDropboxStatus({ dropbox_url, service_type, stage })
  const sizeCls = size === 'md' ? 'text-xs px-2.5 py-1' : 'text-[11px] px-2 py-0.5'
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border font-medium ${TONE_CLS[status.tone]} ${sizeCls} ${className ?? ''}`}
      title={status.hint ?? undefined}
    >
      <span>{status.icon}</span>
      <span>{status.label}</span>
      {showHint && status.hint && (
        <span className="text-[10px] font-normal opacity-80 ml-1">— {status.hint}</span>
      )}
      {status.kind === 'connected' && dropbox_url && (
        <a
          href={dropbox_url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[10px] underline ml-1 opacity-80 hover:opacity-100"
          onClick={e => e.stopPropagation()}
        >
          열기 ↗
        </a>
      )}
    </span>
  )
}
