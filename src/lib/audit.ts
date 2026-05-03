// 운영 추적성·보안 분석용 audit log 기록 헬퍼 (P2-4)
//
// fire-and-forget 패턴 — audit insert 실패해도 본 액션 흐름은 계속 진행.
// summary는 헬퍼에서 자동 truncate (DB CHECK 120자 안전망과 이중 보호).
// ip는 헤더에서 자동 추출 (x-forwarded-for 우선).

import 'server-only'
import { headers } from 'next/headers'
import { createAdminClient } from './supabase/admin'

// =============================================================
// Action taxonomy (23개 — DB는 enum 강제 X, 이 타입이 단일 진실)
// =============================================================
export type AuditAction =
  // Task (7)
  | 'TASK_CREATED' | 'TASK_UPDATED' | 'TASK_REASSIGNED'
  | 'TASK_STATUS_CHANGED' | 'TASK_COMPLETED' | 'TASK_REOPENED' | 'TASK_DELETED'
  // Project (12)
  | 'PROJECT_STATUS_CHANGED' | 'PROJECT_CANCELED'
  | 'PROJECT_MEMBER_ADDED' | 'PROJECT_MEMBER_REMOVED' | 'PROJECT_PM_CHANGED'
  | 'PROJECT_MEMO_CREATED' | 'PROJECT_MEMO_UPDATED' | 'PROJECT_MEMO_DELETED'
  | 'PROJECT_OVERVIEW_UPDATED' | 'PROJECT_PENDING_DISCUSSION_UPDATED'
  | 'PROJECT_CUSTOMER_LINKED'
  // Communication Log (2)
  | 'LOG_CREATED' | 'LOG_DELETED'
  // Bbang (1)
  | 'BBANG_TOOL_INVOKED'
  // Security (2)
  | 'POLICY_BLOCKED_SENSITIVE_INPUT' | 'AUTH_FORBIDDEN'

export type AuditEntityType =
  | 'task' | 'project' | 'lead' | 'sale' | 'log' | 'memo'
  | 'customer' | 'person' | 'quote' | 'rental' | 'auth' | 'policy'

export type AuditSource = 'ui' | 'bbang_chat' | 'bbang_project' | 'cron' | 'api'

export interface AuditPayload {
  actor_id: string | null
  actor_role?: string | null
  action: AuditAction
  entity_type: AuditEntityType
  entity_id?: string | null
  before?: Record<string, unknown> | null
  after?: Record<string, unknown> | null
  source?: AuditSource
  summary?: string | null
  ip?: string | null
}

const SUMMARY_MAX = 120

function truncateSummary(s: string | null | undefined): string | null {
  if (!s) return null
  const trimmed = s.trim()
  if (trimmed.length <= SUMMARY_MAX) return trimmed
  return trimmed.slice(0, SUMMARY_MAX - 1) + '…'
}

/**
 * 클라 IP 추출. x-forwarded-for 우선 → cf-connecting-ip → x-real-ip.
 * (Vercel은 x-forwarded-for 표준. Cloudflare 통과 시 cf-connecting-ip)
 */
async function extractIp(): Promise<string | null> {
  try {
    const h = await headers()
    const xff = h.get('x-forwarded-for')
    if (xff) return xff.split(',')[0].trim()
    return h.get('cf-connecting-ip') || h.get('x-real-ip') || null
  } catch {
    // 헤더 컨텍스트 없음 (예: cron, 백그라운드)
    return null
  }
}

/**
 * Audit log 기록. fire-and-forget — 실패해도 본 액션 막지 않음.
 */
export async function recordAudit(payload: AuditPayload): Promise<void> {
  try {
    const ip = payload.ip ?? await extractIp()
    const summary = truncateSummary(payload.summary)
    const admin = createAdminClient()
    const { error } = await admin.from('audit_logs').insert({
      actor_id: payload.actor_id,
      actor_role: payload.actor_role ?? null,
      action: payload.action,
      entity_type: payload.entity_type,
      entity_id: payload.entity_id ?? null,
      before: payload.before ?? null,
      after: payload.after ?? null,
      source: payload.source ?? 'ui',
      summary,
      ip,
    })
    if (error) {
      console.error('[audit] insert error:', error.message, payload.action)
    }
  } catch (e) {
    console.error('[audit] failed:', e instanceof Error ? e.message : e)
  }
}

/**
 * 변경된 필드만 추출 (payload 절약).
 * 사용 예: diffSnapshot(oldTask, newTask, ['status', 'assignee_id', 'priority'])
 */
export function diffSnapshot<T extends Record<string, unknown>>(
  before: T | null | undefined,
  after: T | null | undefined,
  keys: (keyof T & string)[],
): { before: Record<string, unknown>; after: Record<string, unknown> } {
  const b: Record<string, unknown> = {}
  const a: Record<string, unknown> = {}
  for (const k of keys) {
    if (before?.[k] !== after?.[k]) {
      b[k] = before?.[k] ?? null
      a[k] = after?.[k] ?? null
    }
  }
  return { before: b, after: a }
}

// =============================================================
// 자동 기록 헬퍼 (DRY — auth-guard / sensitive-data-policy 에서 호출)
// =============================================================

/**
 * 권한 거부 자동 기록. require* 헬퍼들이 throw 직전 호출.
 */
export async function auditAuthFail(params: {
  actor_id: string | null
  actor_role?: string | null
  attempted_action: string         // 'requireAdminOrManager' 등
  entity_type?: AuditEntityType
  entity_id?: string | null
  reason: string
  source?: AuditSource
}) {
  await recordAudit({
    actor_id: params.actor_id,
    actor_role: params.actor_role,
    action: 'AUTH_FORBIDDEN',
    entity_type: params.entity_type ?? 'auth',
    entity_id: params.entity_id ?? null,
    after: { attempted: params.attempted_action, reason: params.reason },
    source: params.source ?? 'ui',
    summary: `${params.attempted_action} 차단 — ${params.reason}`,
  })
}

/**
 * 민감 입력 차단 자동 기록. assertNotSensitive 가 throw 직전 호출.
 * 실제 민감 *값*은 저장 안 함 — 필드명·길이만.
 */
export async function auditSensitiveBlock(params: {
  actor_id: string | null
  actor_role?: string | null
  fields: Record<string, unknown>
  source?: AuditSource
}) {
  const fieldHint: Record<string, string> = {}
  for (const [k, v] of Object.entries(params.fields)) {
    if (typeof v === 'string') fieldHint[k] = `len=${v.length}`
    else fieldHint[k] = '(non-string)'
  }
  await recordAudit({
    actor_id: params.actor_id,
    actor_role: params.actor_role,
    action: 'POLICY_BLOCKED_SENSITIVE_INPUT',
    entity_type: 'policy',
    after: { fields: fieldHint },
    source: params.source ?? 'ui',
    summary: `민감 입력 차단 — 필드 ${Object.keys(params.fields).join(',')}`,
  })
}
