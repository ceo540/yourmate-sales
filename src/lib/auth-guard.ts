// 서버 액션·라우트 핸들러 공용 인증·권한 가드 (Phase 9.3)
//
// DRY: equipment-actions / deliverables-actions / meetings-actions 등에 복붙되어 있던
// requireUser 패턴을 한 곳으로 모음. 추후 같은 헬퍼 사용으로 통일.

import { createClient } from './supabase/server'
import { createAdminClient } from './supabase/admin'
import { isAdminOrManager } from './permissions'

export type GuardedUser = { id: string; role: string; isAdmin: boolean }

/**
 * 인증 사용자 + role 반환. 미인증이면 throw.
 * 모든 'use server' 액션의 첫 줄에 호출.
 */
export async function requireUser(): Promise<GuardedUser> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized — 로그인이 필요합니다.')

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  const role = profile?.role ?? 'member'
  return { id: user.id, role, isAdmin: isAdminOrManager(role) }
}

/**
 * admin/manager 만 통과. 그 외 throw.
 * 위험 액션(삭제·일괄·관리자 변경)에 사용.
 */
export async function requireAdminOrManager(): Promise<GuardedUser> {
  const u = await requireUser()
  if (!u.isAdmin) {
    throw new Error('Forbidden — 관리자 권한이 필요합니다.')
  }
  return u
}

/**
 * task ownership 검증.
 * - admin/manager: 모든 task
 * - member: 본인 담당(assignee_id) 또는 미배정(assignee_id=null) task
 *
 * 추가 쿼리 1회 (tasks.assignee_id select). 부담 작음.
 */
export async function requireTaskOwnership(taskId: string): Promise<GuardedUser> {
  const u = await requireUser()
  if (u.isAdmin) return u

  const admin = createAdminClient()
  const { data: task, error } = await admin
    .from('tasks')
    .select('assignee_id')
    .eq('id', taskId)
    .maybeSingle()
  if (error || !task) {
    throw new Error('Forbidden — 해당 업무를 찾을 수 없습니다.')
  }
  // 미배정 task는 본인이 잡을 수 있어야 (담당 미설정 → 본인 지정 흐름)
  if (task.assignee_id && task.assignee_id !== u.id) {
    throw new Error('Forbidden — 본인 담당 업무만 변경할 수 있습니다.')
  }
  return u
}

/**
 * project_logs 작성자 또는 admin/manager 검증.
 * 일반 사용자가 다른 사람이 적은 소통 기록을 삭제하는 것을 막는다.
 */
export async function requireLogOwnerOrAdmin(logId: string): Promise<GuardedUser> {
  const u = await requireUser()
  if (u.isAdmin) return u
  const admin = createAdminClient()
  const { data } = await admin.from('project_logs').select('author_id').eq('id', logId).maybeSingle()
  if (!data) throw new Error('Forbidden — 해당 소통 기록을 찾을 수 없습니다.')
  if (data.author_id && data.author_id !== u.id) {
    throw new Error('Forbidden — 본인이 작성한 소통 기록만 삭제할 수 있습니다.')
  }
  return u
}

/**
 * project_memos 작성자 또는 admin/manager 검증.
 */
export async function requireMemoOwnerOrAdmin(memoId: string): Promise<GuardedUser> {
  const u = await requireUser()
  if (u.isAdmin) return u
  const admin = createAdminClient()
  const { data } = await admin.from('project_memos').select('author_id').eq('id', memoId).maybeSingle()
  if (!data) throw new Error('Forbidden — 해당 메모를 찾을 수 없습니다.')
  if (data.author_id && data.author_id !== u.id) {
    throw new Error('Forbidden — 본인이 작성한 메모만 수정·삭제할 수 있습니다.')
  }
  return u
}
