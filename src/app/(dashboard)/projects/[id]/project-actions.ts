'use server'

import { DISCUSSION_COLUMN, DISCUSSION_LABEL, DISCUSSION_PROMPT_FOCUS, type DiscussionTarget } from './discussion-types'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { renameDropboxFolder, listDropboxFolder, moveDropboxToCancel, moveDropboxFileByPath } from '@/lib/dropbox'
import { createEvent, deleteEvent as deleteGCalEvent, CALENDAR_COLORS } from '@/lib/google-calendar'
import { createProfileNameMap } from '@/lib/utils'
import { isAdminOrManager } from '@/lib/permissions'
import Anthropic from '@anthropic-ai/sdk'
import { logApiUsage } from '@/lib/api-usage'
import {
  requireUser,
  requireAdminOrManager,
  requireLogOwnerOrAdmin,
  requireMemoOwnerOrAdmin,
} from '@/lib/auth-guard'
import { assertNotSensitive } from '@/lib/sensitive-data-policy'
import { recordAudit } from '@/lib/audit'

export async function createProjectLog(
  projectId: string,
  content: string,
  logType: string,
  logCategory: string,
  contactedAt?: string,
  location?: string,
  participants?: string[],
  outcome?: string,
  saleId?: string | null,
) {
  const u = await requireUser()
  await assertNotSensitive({ content, location: location ?? null, outcome: outcome ?? null }, u.role, u.id)

  const admin = createAdminClient()
  const { error } = await admin.from('project_logs').insert({
    project_id: projectId,
    content,
    log_type: logType,
    log_category: logCategory,
    author_id: u.id,
    contacted_at: contactedAt || new Date().toISOString(),
    location: location || null,
    participants: participants?.length ? participants : null,
    outcome: outcome || null,
    sale_id: saleId || null,
  })
  if (error) throw new Error(error.message)

  // 자동 업무표 (§5.4.2)
  const { logActivity } = await import('@/lib/activity-log')
  void logActivity({
    actor_id: u.id,
    action: 'create_log',
    ref_type: 'project',
    ref_id: projectId,
    summary: `소통 로그 (${logType}${logCategory ? '·' + logCategory : ''}): ${content.slice(0, 80)}`,
  })

  void recordAudit({
    actor_id: u.id, actor_role: u.role,
    action: 'LOG_CREATED', entity_type: 'log', entity_id: null,
    after: { project_id: projectId, log_type: logType, log_category: logCategory, content_preview: content.slice(0, 80) },
    summary: `프로젝트 소통 (${logType}) — ${content.slice(0, 80)}`,
  })

  revalidatePath(`/projects/${projectId}`)
}

export async function deleteProjectLog(logId: string, projectId: string) {
  const u = await requireLogOwnerOrAdmin(logId)
  const admin = createAdminClient()
  await admin.from('project_logs').delete().eq('id', logId)
  void recordAudit({
    actor_id: u.id, actor_role: u.role,
    action: 'LOG_DELETED', entity_type: 'log', entity_id: logId,
    after: { project_id: projectId },
    summary: `프로젝트 소통 삭제`,
  })
  revalidatePath(`/projects/${projectId}`)
}

export async function getProjectLogs(projectId: string) {
  await requireUser()  // 인증만 (P1-3)
  const admin = createAdminClient()
  const { data } = await admin
    .from('project_logs')
    .select('id, content, log_type, log_category, contacted_at, created_at, author_id, location, participants, outcome, sale_id')
    .eq('project_id', projectId)
    .order('contacted_at', { ascending: false })
    .limit(100)
  if (!data) return []

  const authorIds = [...new Set(data.map((l: any) => l.author_id).filter(Boolean))]
  let profileMap: Record<string, string> = {}
  if (authorIds.length > 0) {
    const { data: profiles } = await admin.from('profiles').select('id, name').in('id', authorIds)
    profileMap = createProfileNameMap(profiles)
  }
  return data.map((l: any) => ({
    ...l,
    author: l.author_id ? { name: profileMap[l.author_id] ?? '알 수 없음' } : null,
  }))
}

export async function updateProjectMemo(projectId: string, memo: string) {
  const u = await requireUser()
  await assertNotSensitive({ memo }, u.role, u.id)
  const admin = createAdminClient()
  const { error } = await admin
    .from('projects')
    .update({ memo, updated_at: new Date().toISOString() })
    .eq('id', projectId)
  if (error) throw new Error(error.message)
  void recordAudit({
    actor_id: u.id, actor_role: u.role,
    action: 'PROJECT_OVERVIEW_UPDATED', entity_type: 'project', entity_id: projectId,
    after: { memo_length: memo?.length ?? 0 },
    summary: `프로젝트 메모(notes) 수정 — ${memo?.length ?? 0}자`,
  })
  revalidatePath(`/projects/${projectId}`)
}

// project_memos 멀티 메모
export async function createProjectMemo(
  projectId: string,
  data: { title: string; content: string },
): Promise<{ id: string } | { error: string }> {
  let u
  try { u = await requireUser() } catch { return { error: 'Unauthorized' } }
  try { await assertNotSensitive({ title: data.title, content: data.content }, u.role, u.id) }
  catch (e) { return { error: e instanceof Error ? e.message : '민감 정보 차단' } }

  const admin = createAdminClient()
  const { data: row, error } = await admin
    .from('project_memos')
    .insert({
      project_id: projectId,
      title: data.title || null,
      content: data.content || null,
      author_id: u.id,
    })
    .select('id')
    .single()
  if (error) return { error: error.message }
  void recordAudit({
    actor_id: u.id, actor_role: u.role,
    action: 'PROJECT_MEMO_CREATED', entity_type: 'memo', entity_id: row.id,
    after: { project_id: projectId, title: data.title || null, content_length: data.content?.length ?? 0 },
    summary: `프로젝트 메모 생성 — ${data.title || '(제목없음)'}`,
  })
  revalidatePath(`/projects/${projectId}`)
  return { id: row.id }
}

export async function updateProjectMemoCard(
  memoId: string,
  projectId: string,
  data: { title?: string; content?: string },
): Promise<{ error?: string }> {
  // 작성자 본인 또는 admin/manager만 (P1-3)
  let u
  try { u = await requireMemoOwnerOrAdmin(memoId) }
  catch (e) { return { error: e instanceof Error ? e.message : 'Forbidden' } }
  try { await assertNotSensitive({ title: data.title ?? null, content: data.content ?? null }, u.role, u.id) }
  catch (e) { return { error: e instanceof Error ? e.message : '민감 정보 차단' } }

  const admin = createAdminClient()
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (data.title !== undefined) updates.title = data.title || null
  if (data.content !== undefined) updates.content = data.content || null
  const { error } = await admin.from('project_memos').update(updates).eq('id', memoId)
  if (error) return { error: error.message }
  void recordAudit({
    actor_id: u.id, actor_role: u.role,
    action: 'PROJECT_MEMO_UPDATED', entity_type: 'memo', entity_id: memoId,
    after: { project_id: projectId, title: data.title ?? null, content_length: data.content?.length ?? 0 },
    summary: `메모 수정 — ${data.title || memoId.slice(0,8)}`,
  })
  revalidatePath(`/projects/${projectId}`)
  return {}
}

export async function deleteProjectMemo(memoId: string, projectId: string): Promise<{ error?: string }> {
  let u
  try { u = await requireMemoOwnerOrAdmin(memoId) }
  catch (e) { return { error: e instanceof Error ? e.message : 'Forbidden' } }

  const admin = createAdminClient()
  const { error } = await admin.from('project_memos').delete().eq('id', memoId)
  if (error) return { error: error.message }
  void recordAudit({
    actor_id: u.id, actor_role: u.role,
    action: 'PROJECT_MEMO_DELETED', entity_type: 'memo', entity_id: memoId,
    after: { project_id: projectId },
    summary: `메모 삭제`,
  })
  revalidatePath(`/projects/${projectId}`)
  return {}
}

// V2 3박스용 필드 업데이트
export async function updateProjectOverviewSummary(projectId: string, value: string) {
  const u = await requireUser()
  await assertNotSensitive({ overview_summary: value }, u.role, u.id)
  const admin = createAdminClient()
  const { error } = await admin
    .from('projects')
    .update({ overview_summary: value || null, updated_at: new Date().toISOString() })
    .eq('id', projectId)
  if (error) throw new Error(error.message)
  void recordAudit({
    actor_id: u.id, actor_role: u.role,
    action: 'PROJECT_OVERVIEW_UPDATED', entity_type: 'project', entity_id: projectId,
    after: { field: 'overview_summary', length: value?.length ?? 0 },
    summary: `프로젝트 개요(자세한) 수정 — ${value?.length ?? 0}자`,
  })
  revalidatePath(`/projects/${projectId}`)
}

// 짧은 요약 (한눈에 박스. 항상 보임) — 별도 컬럼 short_summary
export async function updateProjectShortSummary(projectId: string, value: string) {
  const u = await requireUser()
  await assertNotSensitive({ short_summary: value }, u.role, u.id)
  const admin = createAdminClient()
  const { error } = await admin
    .from('projects')
    .update({ short_summary: value || null, updated_at: new Date().toISOString() })
    .eq('id', projectId)
  if (error) throw new Error(error.message)
  void recordAudit({
    actor_id: u.id, actor_role: u.role,
    action: 'PROJECT_OVERVIEW_UPDATED', entity_type: 'project', entity_id: projectId,
    after: { field: 'short_summary', length: value?.length ?? 0 },
    summary: `프로젝트 개요(한눈에) 수정 — ${value?.length ?? 0}자`,
  })
  revalidatePath(`/projects/${projectId}`)
}

// 짧은 요약 자동 생성 — 리드 AI 요약 패턴(한줄·현황·반응·다음)
export async function generateAndSaveProjectShortSummary(
  projectId: string,
): Promise<{ summary: string } | { error: string }> {
  const admin = createAdminClient()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { data: project } = await admin
    .from('projects')
    .select('id, name, status, overview_summary, memo, notes, customer_id, pending_discussion_client, pending_discussion_internal, pending_discussion_vendor')
    .eq('id', projectId)
    .single()
  if (!project) return { error: '프로젝트를 찾을 수 없어' }

  // 컨텍스트
  const { data: contracts } = await admin
    .from('sales')
    .select('name, revenue, contract_stage, progress_status, payment_date, inflow_date')
    .eq('project_id', projectId)
  const { data: customer } = project.customer_id
    ? await admin.from('customers').select('name').eq('id', project.customer_id).maybeSingle()
    : { data: null }
  const { data: recentLogs } = await admin
    .from('project_logs')
    .select('content, log_type, contacted_at, outcome')
    .eq('project_id', projectId)
    .order('contacted_at', { ascending: false })
    .limit(5)

  const ctx = `[프로젝트] ${project.name} · 상태: ${project.status}
[고객] ${customer?.name ?? '미연결'}
[계약] ${(contracts ?? []).map((c: any) => `${c.name} (${c.contract_stage ?? '계약'}, 매출 ${c.revenue?.toLocaleString() ?? '-'}원)`).join(' / ') || '없음'}
${project.overview_summary ? `[자세한 개요]\n${project.overview_summary}\n` : ''}${project.pending_discussion_client ? `[클라 협의]\n${project.pending_discussion_client}\n` : ''}${project.pending_discussion_internal ? `[내부 협의]\n${project.pending_discussion_internal}\n` : ''}${project.pending_discussion_vendor ? `[외주 협의]\n${project.pending_discussion_vendor}\n` : ''}${project.memo ? `[메모]\n${project.memo}\n` : ''}${project.notes ? `[유의]\n${project.notes}\n` : ''}[최근 소통 5건]
${(recentLogs ?? []).map((l: any) => `- [${l.log_type}] ${(l.contacted_at ?? '').slice(0, 10)}: ${l.content ?? ''}${l.outcome ? ` → ${l.outcome}` : ''}`).join('\n') || '없음'}`

  const prompt = `너는 프로젝트 매니저 어시스턴트야. 아래 데이터를 보고 *프로젝트 한눈에 요약*을 정확히 아래 형식으로 작성해.

형식 (정확히 지킬 것 — markdown):

**한줄**
[💰 핵심 금액] · [🗓 핵심 날짜] · [👤 핵심 인물] · [🏷 분류]

**현황**
지금 어디까지 진행됐고 무슨 조율 중인지. 2문장 이내.

**반응**
클라이언트의 태도·의견·우려 1문장. 정보 없으면 줄 자체 생략.

**다음**
*언제* *무엇*을 *누가* 해야 하는지 1문장.

★ 한줄 칩 작성 규칙 (가장 중요):
- 각 칩은 **20자 이내**. 핵심 1개만.
- 💰 = 가장 중요한 금액 1개. 여러 금액 나열 X. 예: "16,272천원 (VAT포함)"
- 🗓 = 가장 중요한 날짜 1개. 행사일·마감일 우선. 예: "행사 5/15 · 견적컨펌 5/2"
- 👤 = 가장 자주 소통한 1명 + 소속. 예: "김승희 주무관(용인교육청)"
- 🏷 = 1-2단어. 예: "국제교류 · 인쇄제작"
- 정보 없으면 \`[—]\`

★ 본문 작성 규칙:
- 사실에 기반. 추측·일반론 X.
- 표·헤더 추가 X. 위 4섹션만.
- 마크다운 코드블록 없이.
- *반드시 4섹션 모두 마침표로 완전히 끝맺을 것*. 중간에 자르지 마.

데이터:
${ctx}

출력:`

  const client = new Anthropic()
  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1200,
    messages: [{ role: 'user', content: prompt }],
  })
  logApiUsage({ model: 'claude-sonnet-4-6', endpoint: 'project-short-summary', userId: user.id, inputTokens: message.usage.input_tokens, outputTokens: message.usage.output_tokens }).catch(() => {})

  const summary = ((message.content[0] as any)?.text ?? '').trim()
  if (!summary) return { error: '요약 생성 실패' }

  await admin.from('projects').update({ short_summary: summary, updated_at: new Date().toISOString() }).eq('id', projectId)
  revalidatePath(`/projects/${projectId}`)
  return { summary }
}

export async function updateProjectWorkDescription(projectId: string, value: string) {
  const u = await requireUser()
  await assertNotSensitive({ work_description: value }, u.role, u.id)
  const admin = createAdminClient()
  const { error } = await admin
    .from('projects')
    .update({ work_description: value || null, updated_at: new Date().toISOString() })
    .eq('id', projectId)
  if (error) throw new Error(error.message)
  void recordAudit({
    actor_id: u.id, actor_role: u.role,
    action: 'PROJECT_OVERVIEW_UPDATED', entity_type: 'project', entity_id: projectId,
    after: { field: 'work_description', length: value?.length ?? 0 },
    summary: `프로젝트 업무 범위 수정 — ${value?.length ?? 0}자`,
  })
  revalidatePath(`/projects/${projectId}`)
}

export async function updateProjectPendingDiscussion(
  projectId: string,
  target: DiscussionTarget,
  value: string,
) {
  const u = await requireUser()
  await assertNotSensitive({ pending_discussion: value }, u.role, u.id)
  const admin = createAdminClient()
  const col = DISCUSSION_COLUMN[target]
  if (!col) throw new Error(`잘못된 target: ${target}`)
  const { error } = await admin
    .from('projects')
    .update({ [col]: value || null, updated_at: new Date().toISOString() })
    .eq('id', projectId)
  if (error) throw new Error(error.message)
  void recordAudit({
    actor_id: u.id, actor_role: u.role,
    action: 'PROJECT_PENDING_DISCUSSION_UPDATED', entity_type: 'project', entity_id: projectId,
    after: { target, length: value?.length ?? 0 },
    summary: `협의사항 [${target}] 수정 — ${value?.length ?? 0}자`,
  })
  revalidatePath(`/projects/${projectId}`)
}

// V2 빵빵이 자동 개요 생성 — projects.overview_summary 자동 채움
// 프로젝트 + 계약 + 업무 + 최근 소통을 분석해서 짧은 markdown/plain 개요 생성
export async function generateAndSaveProjectOverview(projectId: string): Promise<{ summary: string } | { error: string }> {
  const admin = createAdminClient()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  // 데이터 fetch
  const [{ data: project }, { data: contracts }, { data: customer }] = await Promise.all([
    admin.from('projects').select('id, name, service_type, department, status, memo, notes').eq('id', projectId).single(),
    admin.from('sales').select('id, name, revenue, contract_stage').eq('project_id', projectId),
    admin.from('projects').select('customer_id, customers(name, type)').eq('id', projectId).maybeSingle(),
  ])
  if (!project) return { error: '프로젝트를 찾을 수 없습니다' }

  const contractIds = (contracts ?? []).map(c => c.id)
  const [{ data: tasks }, { data: logs }] = await Promise.all([
    contractIds.length > 0
      ? admin.from('tasks').select('title, status, priority, due_date').in('project_id', contractIds).limit(30)
      : Promise.resolve({ data: [] }),
    admin.from('project_logs')
      .select('content, log_type, contacted_at')
      .eq('project_id', projectId)
      .order('contacted_at', { ascending: false })
      .limit(15),
  ])

  const totalRevenue = (contracts ?? []).reduce((s: number, c: any) => s + (c.revenue ?? 0), 0)
  const customerName = (customer as any)?.customers?.name ?? null

  const taskSummary = (tasks ?? []).map((t: any) =>
    `- [${t.status}${t.priority ? ` · ${t.priority}` : ''}] ${t.title}${t.due_date ? ` (${t.due_date.slice(5)})` : ''}`
  ).join('\n')
  const logSummary = (logs ?? []).slice(0, 15).map((l: any) =>
    `- [${l.log_type}] ${(l.contacted_at ?? '').slice(0, 10)}: ${l.content ?? ''}${l.outcome ? `\n    → 결정: ${l.outcome}` : ''}${l.location ? ` 📍${l.location}` : ''}${l.participants?.length ? ` 참석:${l.participants.join(',')}` : ''}`
  ).join('\n')

  const prompt = `다음 데이터로 프로젝트 종합 개요를 markdown으로 작성해. 제3자가 이 한 페이지만 봐도 프로젝트 전체를 파악할 수 있게 풍부하게 정리해.

[프로젝트]
- 이름: ${project.name}
- 고객사: ${customerName ?? '미연결'}
- 서비스: ${project.service_type ?? '미입력'}
- 진행 상태: ${project.status}
- 매출 합계: ${totalRevenue > 0 ? `${(totalRevenue / 10000).toFixed(0)}만원` : '미입력'}
- 계약 ${(contracts ?? []).length}건${(contracts ?? []).map((c: any) => ` / ${c.contract_stage ?? '계약'}`).join('')}
${project.memo ? `- 메모: ${project.memo}` : ''}
${project.notes ? `- 유의사항: ${project.notes}` : ''}

[업무 (${(tasks ?? []).length}개)]
${taskSummary || '없음'}

[최근 소통·회의록]
${logSummary || '없음'}

작성 가이드:
- 충분히 디테일하게. 짧게 줄이지 말고, 데이터에 있는 사실은 다 살려서 정리.
- 다음 섹션을 markdown으로:

**한줄 요약**
이 프로젝트가 무엇이고 지금 어떤 상태인지 1~2문장.

**📋 프로젝트 정보**
- 고객사·서비스·매출·계약 단계 등 핵심 정보 정리

**✅ 확정 사항**
- 합의·결정·완료된 것들 (최근 소통의 결정사항, 완료된 업무 활용)

**⏳ 진행 중**
- 현재 작업 중인 항목들

**🔴 즉시 처리 필요**
- 마감 임박·미결·고객 답변 대기 등

**📌 일정·중요 날짜**
- 행사일, 납기, 마감 등

**💡 빵빵이 제안 (사람이 놓치기 쉬운 것)**
- 데이터를 보고 *PM이 놓쳤을 만한* 항목 짚기. 예: 답변 안 한 메시지·미확인 일정·계약 단계와 진행 상태 불일치·메모와 실제 진행의 어긋남·일정 위험 등
- 추측·일반론 X. 데이터에 근거한 항목만. 없으면 섹션 생략.

해당 섹션 데이터 없으면 그 섹션은 빼. 표가 효과적이면 markdown 표 사용.

**가독성 가이드**:
- 각 섹션 사이 빈 줄 1개
- bullet 문장은 짧고 명확. 한 줄에 한 개 사실.
- 핵심 숫자·날짜·이름은 \`**굵게**\` 강조`

  const client = new Anthropic()
  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2000,
    messages: [{ role: 'user', content: prompt }],
  })
  logApiUsage({ model: 'claude-sonnet-4-6', endpoint: 'project-overview', userId: user.id, inputTokens: message.usage.input_tokens, outputTokens: message.usage.output_tokens }).catch(() => {})

  const summary = ((message.content[0] as any)?.text ?? '').trim()
  if (!summary) return { error: '개요 생성 실패' }

  await admin.from('projects').update({ overview_summary: summary, updated_at: new Date().toISOString() }).eq('id', projectId)
  revalidatePath(`/projects/${projectId}`)

  return { summary }
}

// V2 빵빵이가 할 일 자동 추천 — tasks에 bbang_suggested=true로 일괄 생성
// 프로젝트·계약·기존 업무·최근 소통 분석 → 누락된 할 일 N개 제안 후 즉시 추가
export async function generateAndSuggestTasks(projectId: string): Promise<{ added: number; titles: string[] } | { error: string }> {
  const admin = createAdminClient()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const [{ data: project }, { data: contracts }] = await Promise.all([
    admin.from('projects').select('id, name, service_type, status').eq('id', projectId).single(),
    admin.from('sales').select('id, name, contract_stage').eq('project_id', projectId),
  ])
  if (!project) return { error: '프로젝트를 찾을 수 없습니다' }
  const firstContract = (contracts ?? [])[0]
  if (!firstContract) return { error: '계약이 1건 이상 있어야 할 일을 추가할 수 있어요' }

  const contractIds = (contracts ?? []).map(c => c.id)
  const [{ data: tasks }, { data: logs }] = await Promise.all([
    admin.from('tasks').select('title, status').in('project_id', contractIds).limit(50),
    admin.from('project_logs')
      .select('content, log_type, contacted_at, outcome')
      .eq('project_id', projectId)
      .order('contacted_at', { ascending: false })
      .limit(15),
  ])

  const existingTaskTitles = (tasks ?? []).map((t: any) => t.title).join('\n - ')
  const logSummary = (logs ?? []).slice(0, 8).map((l: any) =>
    `- ${(l.contacted_at ?? '').slice(0, 10)} [${l.log_type}] ${(l.content ?? '').slice(0, 80)}${l.outcome ? ` → ${l.outcome.slice(0, 50)}` : ''}`
  ).join('\n')

  const prompt = `너는 프로젝트 매니저 어시스턴트야. 아래 프로젝트에서 **누락된 할 일**을 추천해줘.

[프로젝트]
- 이름: ${project.name}
- 서비스: ${project.service_type ?? '미입력'}
- 상태: ${project.status}
- 계약 단계: ${(contracts ?? []).map((c: any) => c.contract_stage ?? '계약').join(', ')}

[기존 업무 (이미 등록됨, 중복 제안 금지)]
 - ${existingTaskTitles || '(없음)'}

[최근 소통]
${logSummary || '없음'}

추천 기준:
1. 서비스 타입 표준 워크플로우 누락 항목 (예: 행사대여면 답사·물품체크·운반·세팅·수거)
2. 최근 소통에서 약속한 후속 조치
3. 계약 단계 진전 위해 필요한 작업
4. 기존 업무 중복은 절대 금지

JSON 배열로 반환 (3~6개):
[{"title": "할 일 제목", "priority": "긴급|높음|보통|낮음", "due_date": "YYYY-MM-DD 또는 null"}]

JSON만 반환. 마크다운 코드블록 없이.`

  const client = new Anthropic()
  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 800,
    messages: [{ role: 'user', content: prompt }],
  })
  logApiUsage({ model: 'claude-haiku-4-5-20251001', endpoint: 'project-task-suggest', userId: user.id, inputTokens: message.usage.input_tokens, outputTokens: message.usage.output_tokens }).catch(() => {})

  const raw = ((message.content[0] as any)?.text ?? '').trim()
  const jsonMatch = raw.match(/\[[\s\S]*\]/)
  if (!jsonMatch) return { error: 'AI 응답 파싱 실패' }

  let suggestions: { title: string; priority?: string; due_date?: string | null }[] = []
  try {
    suggestions = JSON.parse(jsonMatch[0])
  } catch {
    return { error: 'JSON 파싱 실패' }
  }

  if (!Array.isArray(suggestions) || suggestions.length === 0) {
    return { error: '추천된 할 일이 없습니다' }
  }

  const titles: string[] = []
  const errors: string[] = []
  for (const s of suggestions) {
    if (!s.title?.trim()) continue
    const validPriority = ['긴급', '높음', '보통', '낮음'].includes(s.priority ?? '') ? s.priority : '보통'
    const { error: insertErr } = await admin.from('tasks').insert({
      project_id: firstContract.id,
      title: s.title.trim(),
      status: '할 일',
      priority: validPriority,
      due_date: s.due_date || null,
      bbang_suggested: true,
    })
    if (insertErr) {
      console.error('[generateAndSuggestTasks] insert error:', insertErr, 'title:', s.title)
      errors.push(`${s.title}: ${insertErr.message}`)
    } else {
      titles.push(s.title.trim())
    }
  }

  if (titles.length === 0 && errors.length > 0) {
    return { error: `Insert 실패 (${errors.length}건): ${errors[0]}` }
  }

  revalidatePath(`/projects/${projectId}`)

  return { added: titles.length, titles }
}

// V2 빵빵이 협의·미결 사항 자동 분석 — projects.pending_discussion 자동 채움
// 최근 소통·미완 업무 분석해서 "지금 협의해야 할 사항" 추출
export async function generateAndSavePendingDiscussion(
  projectId: string,
  target: DiscussionTarget = 'client',
): Promise<{ summary: string } | { error: string }> {
  const admin = createAdminClient()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  // (Phase 9.2) 입력 데이터 확장 — 협의사항 품질 강화
  const [{ data: project }, { data: contracts }] = await Promise.all([
    admin.from('projects')
      .select('id, name, status, memo, notes, overview_summary, short_summary, work_description, customer_id, project_number, service_type')
      .eq('id', projectId).single(),
    admin.from('sales')
      .select('id, name, contract_stage, revenue, payment_schedules(label, amount, due_date, is_received)')
      .eq('project_id', projectId),
  ])
  if (!project) return { error: '프로젝트를 찾을 수 없습니다' }

  const contractIds = (contracts ?? []).map((c: { id: string }) => c.id)
  const [{ data: tasks }, { data: logs }, { data: customer }, { data: profiles }] = await Promise.all([
    contractIds.length > 0
      ? admin.from('tasks')
          .select('id, title, status, priority, due_date, description, assignee_id, created_at')
          .in('project_id', contractIds)
          .limit(60)
      : Promise.resolve({ data: [] as Array<{ id: string; title: string; status: string; priority: string | null; due_date: string | null; description: string | null; assignee_id: string | null; created_at: string }> }),
    admin.from('project_logs')
      .select('id, content, log_type, log_category, contacted_at, outcome, participants, location')
      .eq('project_id', projectId)
      .order('contacted_at', { ascending: false })
      .limit(20),
    project.customer_id
      ? admin.from('customers').select('name, contact_name, contact_phone, contact_email, type').eq('id', project.customer_id).maybeSingle()
      : Promise.resolve({ data: null }),
    admin.from('profiles').select('id, name'),
  ])

  const profileMap = Object.fromEntries((profiles ?? []).map((p: { id: string; name: string | null }) => [p.id, p.name ?? '?']))

  // 마감 임박 = 7일 이내 (오늘 포함)
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const dueSoonCutoff = new Date(today.getTime() + 7 * 86400000)

  const pendingTasks = (tasks ?? []).filter((t) => t.status !== '완료' && t.status !== '보류')
  const overdueTasks = pendingTasks.filter(t => t.due_date && new Date(t.due_date) < today)
  const dueSoonTasks = pendingTasks.filter(t => t.due_date && new Date(t.due_date) >= today && new Date(t.due_date) <= dueSoonCutoff)

  const taskSummary = pendingTasks.map((t) => {
    const assigneeName = t.assignee_id ? (profileMap[t.assignee_id] ?? '미배정') : '미배정'
    return `- [${t.status}${t.priority ? ` · ${t.priority}` : ''}] ${t.title} / 담당: ${assigneeName}${t.due_date ? ` / 마감: ${t.due_date}` : ''}${t.description ? `\n    상세: ${t.description}` : ''}`
  }).join('\n')

  const logSummary = (logs ?? []).map((l) => {
    const parts = [
      `[${l.log_type}${l.log_category ? `·${l.log_category}` : ''}]`,
      (l.contacted_at ?? '').slice(0, 10),
      `: ${l.content ?? ''}`,
    ].join(' ')
    const meta: string[] = []
    if (l.participants) meta.push(`참석: ${Array.isArray(l.participants) ? l.participants.join(', ') : l.participants}`)
    if (l.location) meta.push(`장소: ${l.location}`)
    if (l.outcome) meta.push(`결과: ${l.outcome}`)
    return `- ${parts}${meta.length > 0 ? `\n    (${meta.join(' / ')})` : ''}`
  }).join('\n')

  // 결제 일정 (목록형) — 결제 협의 컨텍스트
  const paymentLines: string[] = []
  for (const c of contracts ?? []) {
    const schedules = ((c as { payment_schedules?: Array<{ label: string | null; amount: number | null; due_date: string | null; is_received: boolean | null }> }).payment_schedules ?? [])
    for (const p of schedules) {
      paymentLines.push(`  - ${c.name}: ${p.label ?? '-'} ${(p.amount ?? 0).toLocaleString()}원 / 마감 ${p.due_date ?? '-'} / ${p.is_received ? '입금완료' : '미입금'}`)
    }
  }

  const customerLine = customer
    ? `\n[고객 정보]\n- 기관명: ${customer.name}\n- 담당자: ${customer.contact_name ?? '(미입력)'}${customer.contact_phone ? ` / ${customer.contact_phone}` : ''}${customer.contact_email ? ` / ${customer.contact_email}` : ''}\n- 유형: ${customer.type ?? '미지정'}\n`
    : ''

  const projectBody = [
    project.short_summary ? `[한 눈에 요약]\n${project.short_summary}` : '',
    project.overview_summary ? `[프로젝트 개요]\n${project.overview_summary}` : '',
    project.work_description ? `[업무 범위·계약 내용]\n${project.work_description}` : '',
    project.memo ? `[메모]\n${project.memo}` : '',
    project.notes ? `[유의사항]\n${project.notes}` : '',
  ].filter(Boolean).join('\n\n')

  const todayIso = today.toISOString().slice(0, 10)

  const prompt = `너는 시니어 프로젝트 매니저 어시스턴트야. 아래 *실제 데이터*를 보고 *${DISCUSSION_LABEL[target]}* 관련 협의 항목을 빠짐없이 정리해.

${DISCUSSION_PROMPT_FOCUS[target]}

# 🔴 절대 규칙 (위반 시 출력 무효)
1. **데이터에 없는 내용 추측·창작 금지**. 정보가 없으면 "(데이터 없음)"이라고 명시.
2. **각 항목마다 명시 필수**: 누구(담당자명/기관 담당자명) · 무엇 · 언제까지(가능하면 날짜).
3. **모호한 표현 금지**: "조만간" / "추후" / "필요 시" / "검토" — 이런 표현 보이면 구체화하거나 "협의 필요" 섹션으로 옮길 것.
4. *${DISCUSSION_LABEL[target]}* 범위 외(${target === 'client' ? '내부·외주사' : target === 'internal' ? '클라이언트·외주사' : '클라이언트·내부'}) 항목은 *완전 생략*.
5. 마크다운, 코드블록 없이. 섹션 헤더는 굵게(**...**).

# 분류 기준 (반드시 이 정의대로)
- **🔥 빠르게 해결**: 오늘(${todayIso}) ~ 내일까지 처리 가능, 의존성 없음
- **❓ 협의·결정 필요**: 우리가 답을 줄 수 없음. 클라이언트/내부/외주사 답변·결정 대기 중이거나 받아야 함
- **📌 답변 대기**: 우리가 이미 요청·발송한 상태로 상대 답변 기다리는 중 (logs.outcome 또는 발송 사실 있어야 함)
- **⚠️ 마감 임박·지연**: 마감일 ${todayIso} 기준 *과거*(지연) 또는 7일 이내 미완료

# 자동 추출 신호 (놓치지 마)
- pending_task.due_date < 오늘 → 반드시 ⚠️
- pending_task.due_date 7일 이내 → ⚠️ 또는 🔥
- log.outcome에 "보냄/전달함/요청함" 같은 표현 → 📌 후보
- log.outcome에 "협의 필요/결정 필요/확인 부탁" → ❓ 필수
- task.assignee_id IS NULL → ❓ "담당 미배정"

# 입력 데이터

[프로젝트 기본]
- 이름: ${project.name}${project.project_number ? ` (${project.project_number})` : ''}
- 서비스: ${project.service_type ?? '(미지정)'}
- 상태: ${project.status}
- 계약 단계 모음: ${(contracts ?? []).map((c) => `${c.name}=${c.contract_stage ?? '계약'}`).join(' / ') || '없음'}
${customerLine}

${projectBody || '[프로젝트 본문] (데이터 없음)'}

[진행중·검토중 업무 ${pendingTasks.length}건${overdueTasks.length > 0 ? ` · 지연 ${overdueTasks.length}` : ''}${dueSoonTasks.length > 0 ? ` · 7일내 ${dueSoonTasks.length}` : ''}]
${taskSummary || '(없음)'}

[최근 소통·결과 ${(logs ?? []).length}건]
${logSummary || '(없음)'}

[결제 일정]
${paymentLines.join('\n') || '(없음)'}

# 출력 형식 (마크다운, 코드블록 X)

**🔥 빠르게 해결**
- 각 항목 1~2줄: 무엇을 / 누가(담당자명) / 언제까지

**❓ 협의·결정 필요**
- 각 항목: 누구(클라이언트 담당자명/내부 직원명/외주사명)와 무엇을 / 왜 결정 필요한지 / 언제까지 결정해야 하는지

**📌 답변 대기**
- 각 항목: 누구에게 / 무엇을 / 언제 보냈는지 / 언제까지 답변 받아야 하는지

**⚠️ 마감 임박·지연**
- 각 항목: 무엇이 / 마감일 / 담당자 / 지연 일수 또는 D-N

각 섹션에 해당 항목이 0건이면 그 섹션 통째로 빼. 본 분류(${DISCUSSION_LABEL[target]}) 항목이 아예 없으면 "해당 없음" 한 줄만 출력.`

  const client = new Anthropic()
  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2000,
    messages: [{ role: 'user', content: prompt }],
  })
  logApiUsage({ model: 'claude-sonnet-4-6', endpoint: 'project-pending', userId: user.id, inputTokens: message.usage.input_tokens, outputTokens: message.usage.output_tokens }).catch(() => {})

  const summary = ((message.content[0] as { type: string; text?: string })?.text ?? '').trim()
  if (!summary) return { error: '협의사항 분석 실패' }

  const targetCol = DISCUSSION_COLUMN[target]
  await admin.from('projects').update({ [targetCol]: summary, updated_at: new Date().toISOString() }).eq('id', projectId)
  revalidatePath(`/projects/${projectId}`)

  return { summary }
}

export async function addProjectMember(projectId: string, profileId: string, role: string) {
  const u = await requireAdminOrManager()
  const admin = createAdminClient()
  const { error } = await admin
    .from('project_members')
    .insert({ project_id: projectId, profile_id: profileId, role })
  if (error) throw new Error(error.message)
  if (role === 'PM') {
    await admin.from('projects').update({ pm_id: profileId, updated_at: new Date().toISOString() }).eq('id', projectId)
    revalidatePath('/projects')
  }
  void recordAudit({
    actor_id: u.id, actor_role: u.role,
    action: role === 'PM' ? 'PROJECT_PM_CHANGED' : 'PROJECT_MEMBER_ADDED',
    entity_type: 'project', entity_id: projectId,
    after: { profile_id: profileId, role },
    summary: `${role === 'PM' ? 'PM' : '멤버'} 추가 — ${profileId.slice(0,8)}`,
  })
  revalidatePath(`/projects/${projectId}`)
}

export async function removeProjectMember(projectId: string, profileId: string) {
  const u = await requireAdminOrManager()
  const admin = createAdminClient()
  // 기존 PM 여부 확인 (제거 후 projects.pm_id 동기화 판단용)
  const { data: existing } = await admin
    .from('project_members')
    .select('role')
    .eq('project_id', projectId)
    .eq('profile_id', profileId)
    .maybeSingle()
  await admin
    .from('project_members')
    .delete()
    .eq('project_id', projectId)
    .eq('profile_id', profileId)
  // PM이 제거되면 projects.pm_id도 NULL
  if (existing?.role === 'PM') {
    await admin.from('projects').update({ pm_id: null, updated_at: new Date().toISOString() }).eq('id', projectId)
    revalidatePath('/projects')
  }
  void recordAudit({
    actor_id: u.id, actor_role: u.role,
    action: existing?.role === 'PM' ? 'PROJECT_PM_CHANGED' : 'PROJECT_MEMBER_REMOVED',
    entity_type: 'project', entity_id: projectId,
    after: { profile_id: profileId, removed_role: existing?.role ?? null },
    summary: `${existing?.role === 'PM' ? 'PM 해제' : '멤버 제거'} — ${profileId.slice(0,8)}`,
  })
  revalidatePath(`/projects/${projectId}`)
}

export async function updateProjectStatus(projectId: string, status: string): Promise<{ cancelMsg?: string }> {
  // status 변경 정책 (P1-3 hotfix):
  // - 일상 변경(기획중·진행중·완료·보류): 모든 인증 사용자
  // - '취소': admin/manager만 (dropbox 폴더 999999.취소 이동 등 위험 액션)
  const u = status === '취소' ? await requireAdminOrManager() : await requireUser()
  const admin = createAdminClient()
  // before snapshot
  const { data: prev } = await admin.from('projects').select('status, name').eq('id', projectId).maybeSingle()
  const { error } = await admin
    .from('projects')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', projectId)
  if (error) throw new Error(error.message)
  void recordAudit({
    actor_id: u.id, actor_role: u.role,
    action: status === '취소' ? 'PROJECT_CANCELED' : 'PROJECT_STATUS_CHANGED',
    entity_type: 'project', entity_id: projectId,
    before: { status: prev?.status ?? null },
    after: { status },
    summary: `프로젝트 '${prev?.name ?? projectId.slice(0,8)}' ${prev?.status ?? '?'}→${status}`,
  })

  // 취소 상태로 변경 시 드롭박스 폴더를 999999.취소 폴더로 이동
  if (status === '취소') {
    const diagnostics: string[] = []
    const { data: project } = await admin.from('projects').select('dropbox_url').eq('id', projectId).single()

    if (project?.dropbox_url) {
      const result = await moveDropboxToCancel(project.dropbox_url)
      if ('newUrl' in result) {
        await admin.from('projects').update({ dropbox_url: result.newUrl }).eq('id', projectId)
        diagnostics.push('프로젝트 폴더 이동 완료')
      } else {
        diagnostics.push(`프로젝트 폴더 이동 실패: ${result.error}`)
      }
    } else {
      diagnostics.push('프로젝트 자체 Dropbox URL 없음 (projects.dropbox_url = null)')
    }

    const { data: linkedSales } = await admin.from('sales').select('id, name, dropbox_url').eq('project_id', projectId)
    diagnostics.push(`연결 매출 ${linkedSales?.length ?? 0}건`)
    for (const sale of linkedSales ?? []) {
      if (!sale.dropbox_url) {
        diagnostics.push(`  · ${sale.name}: Dropbox URL 없음`)
        continue
      }
      const result = await moveDropboxToCancel(sale.dropbox_url)
      if ('newUrl' in result) {
        await admin.from('sales').update({ dropbox_url: result.newUrl }).eq('id', sale.id)
        diagnostics.push(`  · ${sale.name}: 이동 완료`)
      } else {
        diagnostics.push(`  · ${sale.name}: 실패 - ${result.error}`)
      }
    }

    revalidatePath(`/projects/${projectId}`)
    return { cancelMsg: diagnostics.join('\n') }
  }

  revalidatePath(`/projects/${projectId}`)
  return {}
}

export async function linkProjectCustomer(projectId: string, customerId: string) {
  const u = await requireUser()
  const admin = createAdminClient()
  // customer 변경 시 contact_person_id도 리셋 (옛 customer의 person이 잘못 연결되는 것 방지)
  await admin.from('projects').update({ customer_id: customerId || null, contact_person_id: null }).eq('id', projectId)
  void recordAudit({
    actor_id: u.id, actor_role: u.role,
    action: 'PROJECT_CUSTOMER_LINKED', entity_type: 'project', entity_id: projectId,
    after: { customer_id: customerId || null },
    summary: customerId ? `고객사 연결 — ${customerId.slice(0,8)}` : '고객사 연결 해제',
  })
  revalidatePath(`/projects/${projectId}`)
}

// 프로젝트별 담당자(person) 명시 지정. NULL이면 customer의 is_current=true person으로 fallback.
export async function updateProjectContactPerson(projectId: string, personId: string | null) {
  await requireUser()
  const admin = createAdminClient()
  await admin.from('projects').update({ contact_person_id: personId }).eq('id', projectId)
  revalidatePath(`/projects/${projectId}`)
}

// customer 안에 새 person 등록 + person_org_relations 연결 + 그 person을 프로젝트 담당자로 지정.
// PersonPicker [+ 새 담당자 등록] 흐름.
export async function createPersonAndLinkToProject(params: {
  projectId: string
  customerId: string
  name: string
  phone?: string
  email?: string
  dept?: string
  title?: string
}): Promise<{ ok: true; personId: string } | { ok: false; error: string }> {
  if (!params.name.trim()) return { ok: false, error: '이름 필수' }
  let u
  try { u = await requireUser() } catch { return { ok: false, error: 'Unauthorized' } }
  try {
    await assertNotSensitive({
      name: params.name,
      dept: params.dept ?? null,
      title: params.title ?? null,
    }, u.role, u.id)
  } catch (e) { return { ok: false, error: e instanceof Error ? e.message : '민감 정보 차단' } }

  const admin = createAdminClient()

  const { data: person, error: personErr } = await admin
    .from('persons')
    .insert({
      name: params.name.trim(),
      phone: params.phone?.trim() || null,
      email: params.email?.trim() || null,
    })
    .select('id')
    .single()
  if (personErr || !person) return { ok: false, error: `person 생성 실패: ${personErr?.message ?? ''}` }

  const { error: relErr } = await admin.from('person_org_relations').insert({
    customer_id: params.customerId,
    person_id: person.id,
    dept: params.dept?.trim() || null,
    title: params.title?.trim() || null,
    is_current: false,
  })
  if (relErr) {
    // person은 생성됨. 관계 생성 실패는 비치명적이지만 사용자에게 알림.
    return { ok: false, error: `person_org_relations 생성 실패: ${relErr.message}` }
  }

  await admin.from('projects').update({ contact_person_id: person.id }).eq('id', params.projectId)
  revalidatePath(`/projects/${params.projectId}`)
  return { ok: true, personId: person.id }
}

export async function updateProjectServiceType(projectId: string, serviceType: string | null): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '인증 필요' }
  const { SERVICE_TO_DEPT } = await import('@/lib/services')
  const admin = createAdminClient()
  const department = serviceType ? SERVICE_TO_DEPT[serviceType] ?? null : null
  const { error } = await admin.from('projects')
    .update({ service_type: serviceType || null, department, updated_at: new Date().toISOString() })
    .eq('id', projectId)
  if (error) return { error: error.message }
  revalidatePath(`/projects/${projectId}`)
  return {}
}

export async function createAndLinkCustomer(
  projectId: string,
  data: { name: string; type: string; contact_name: string; phone: string; contact_email: string },
): Promise<{ error?: string; id?: string }> {
  let u
  try { u = await requireUser() } catch { return { error: 'Unauthorized' } }
  try { await assertNotSensitive({ name: data.name, contact_name: data.contact_name }, u.role, u.id) }
  catch (e) { return { error: e instanceof Error ? e.message : '민감 정보 차단' } }

  const admin = createAdminClient()
  const { data: created, error: ce } = await admin
    .from('customers')
    .insert({ name: data.name, type: data.type || '기타', status: '활성', contact_name: data.contact_name || null, phone: data.phone || null, contact_email: data.contact_email || null })
    .select('id')
    .single()
  if (ce) return { error: ce.message }
  await admin.from('projects').update({ customer_id: created.id }).eq('id', projectId)
  revalidatePath(`/projects/${projectId}`)
  return { id: created.id }
}

export async function updateProjectName(
  projectId: string,
  name: string,
): Promise<{ newDropboxUrl?: string | null }> {
  const admin = createAdminClient()
  const { data: project } = await admin.from('projects').select('dropbox_url').eq('id', projectId).single()

  let newDropboxUrl: string | null = null
  if (project?.dropbox_url) {
    const result = await renameDropboxFolder(project.dropbox_url, name)
    if ('newUrl' in result) newDropboxUrl = result.newUrl
  }

  await admin.from('projects').update({
    name,
    ...(newDropboxUrl ? { dropbox_url: newDropboxUrl } : {}),
    updated_at: new Date().toISOString(),
  }).eq('id', projectId)

  revalidatePath(`/projects/${projectId}`)
  revalidatePath('/projects')
  return { newDropboxUrl }
}

// service_type 기반으로 Dropbox 폴더 자동 생성하고 projects.dropbox_url에 연결.
// service_type이 늦게 채워진 옛 프로젝트(예: 26-079) 단발 처리용.
// brief.md도 같이 생성.
export async function createProjectDropboxFolder(projectId: string): Promise<{ ok: true; webUrl: string; brief?: string } | { error: string }> {
  const admin = createAdminClient()
  const { data: project } = await admin
    .from('projects')
    .select('id, name, service_type, dropbox_url, created_at')
    .eq('id', projectId)
    .maybeSingle()
  if (!project) return { error: '프로젝트를 찾을 수 없음' }
  if (project.dropbox_url) return { error: '이미 Dropbox 폴더가 연결돼 있어' }
  if (!project.service_type) return { error: '서비스 종류 먼저 지정해야 폴더 위치를 정함' }

  const { createSaleFolder } = await import('@/lib/dropbox')
  const folderUrl = await createSaleFolder({
    service_type: project.service_type,
    name: project.name,
    inflow_date: project.created_at?.slice(0, 10) ?? null,
  })
  if (!folderUrl) return { error: 'Dropbox 폴더 생성 실패 (서비스 폴더 매핑 확인)' }

  const { error: updErr } = await admin
    .from('projects')
    .update({ dropbox_url: folderUrl, updated_at: new Date().toISOString() })
    .eq('id', projectId)
  if (updErr) return { error: `폴더는 만들었는데 DB 저장 실패: ${updErr.message}` }

  let briefFilename: string | undefined
  try {
    const { createOrUpdateProjectBrief } = await import('@/lib/brief-generator')
    const r = await createOrUpdateProjectBrief(projectId)
    if ('ok' in r) briefFilename = r.filename
  } catch { /* brief 실패는 무시 — 폴더는 OK */ }

  revalidatePath(`/projects/${projectId}`)
  return { ok: true, webUrl: folderUrl, brief: briefFilename }
}

export async function updateProjectDropbox(projectId: string, dropboxUrl: string): Promise<{ error?: string }> {
  if (dropboxUrl.trim()) {
    const { validateDropboxUrl } = await import('@/lib/dropbox')
    const v = validateDropboxUrl(dropboxUrl)
    if (!v.ok) return { error: v.error }
  }
  const admin = createAdminClient()
  await admin.from('projects').update({ dropbox_url: dropboxUrl || null }).eq('id', projectId)
  revalidatePath(`/projects/${projectId}`)
  return {}
}

export async function linkSaleToProject(projectId: string, saleId: string) {
  const admin = createAdminClient()
  await admin.from('sales').update({ project_id: projectId }).eq('id', saleId)
  revalidatePath(`/projects/${projectId}`)
}

// 프로젝트 내에서 새 매출(계약) 직접 생성 — 수의계약 분리 등
// 프로젝트의 service_type/department/customer를 상속해서 채움.
// 건명 미입력 시 프로젝트명 그대로 사용. 유입일은 오늘 자동.
export async function createSaleForProject(projectId: string, data: {
  name: string
  revenue: number
  customer_id: string                  // 필수 — 정합성 강제
  entity_id?: string | null
  contract_stage?: string
  contract_type?: string | null
  contract_split_reason?: string | null
  client_dept?: string | null
}): Promise<{ sale: any } | { error: string }> {
  if (!data.customer_id) return { error: '기관(customer)이 선택되지 않았어' }
  const admin = createAdminClient()
  const [{ data: project }, { data: customer }] = await Promise.all([
    admin.from('projects')
      .select('name, service_type, department, customer_id, pm_id, project_number, dropbox_url')
      .eq('id', projectId).single(),
    admin.from('customers').select('id, name').eq('id', data.customer_id).single(),
  ])
  if (!customer) return { error: '선택한 기관을 찾을 수 없음' }

  const finalName = data.name.trim() || project?.name || '(이름 없음)'
  const today = new Date().toISOString().slice(0, 10)

  // 사업자 정보 + 자동 폴더 생성
  let saleDropboxUrl: string | null = null
  if (data.entity_id && project?.dropbox_url) {
    const { data: entity } = await admin
      .from('business_entities')
      .select('short_name, name')
      .eq('id', data.entity_id)
      .single()
    if (entity?.name) {
      const cleanName = entity.name.replace(/㈜|\(주\)|주식회사|유한회사|\(유\)/g, '').trim() || (entity.short_name ?? '')
      // 같은 프로젝트 내 계약 순서 — 새 계약은 (현재 개수 + 1)
      const { count } = await admin.from('sales').select('id', { count: 'exact', head: true }).eq('project_id', projectId)
      const sequence = (count ?? 0) + 1
      const { createContractFolder } = await import('@/lib/dropbox')
      const r = await createContractFolder({
        projectFolderWebUrl: project.dropbox_url,
        entityFullName: cleanName,
        revenue: data.revenue ?? null,
        saleSequence: sequence,
      })
      if ('webUrl' in r) saleDropboxUrl = r.webUrl
      // 폴더 생성 실패해도 계약 row는 만들어짐 (사용자가 [📁 생성] 버튼으로 재시도 가능)
    }
  }

  const { data: sale, error } = await admin.from('sales').insert({
    name: finalName,
    project_id: projectId,
    service_type: project?.service_type ?? null,
    department: project?.department ?? null,
    customer_id: data.customer_id,        // 검색 select에서 받은 customer (정합성 보장)
    assignee_id: project?.pm_id ?? null,
    project_number: project?.project_number ?? null,
    entity_id: data.entity_id ?? null,
    revenue: data.revenue,
    contract_stage: data.contract_stage ?? '계약',
    contract_type: data.contract_type ?? null,
    contract_split_reason: data.contract_split_reason ?? null,
    client_org: customer.name,            // customer 이름 미러링 (legacy 호환 + 빠른 표시용)
    client_dept: data.client_dept ?? null,
    dropbox_url: saleDropboxUrl,
    inflow_date: today,
  }).select('*, payment_schedules(*)').single()

  if (error) return { error: error.message }

  revalidatePath(`/projects/${projectId}`)
  return { sale }
}

// entity_id가 나중에 채워진 케이스 / 폴더 생성 실패 후 재시도용
// 계약(sale)에 연결된 폴더의 PDF 목록 반환 (depth 2 재귀, sale + project 폴더 둘 다 시도)
// 옛 sale.dropbox_url이 다른 사용자 절대 경로로 박힌 케이스 폴백 위해 project.dropbox_url도 시도.
export async function listSaleFolderPdfs(saleId: string): Promise<{ pdfs: { name: string; path: string }[] } | { error: string }> {
  const admin = createAdminClient()
  // FK 조인 회피 — 두 번 query
  const { data: sale } = await admin
    .from('sales')
    .select('dropbox_url, project_id')
    .eq('id', saleId)
    .maybeSingle()
  if (!sale) return { error: '계약을 찾을 수 없음' }

  let projectDropboxUrl: string | null = null
  if (sale.project_id) {
    const { data: p } = await admin.from('projects').select('dropbox_url').eq('id', sale.project_id).maybeSingle()
    projectDropboxUrl = p?.dropbox_url ?? null
  }

  const candidates: string[] = []
  if (sale.dropbox_url) candidates.push(sale.dropbox_url)
  if (projectDropboxUrl && projectDropboxUrl !== sale.dropbox_url) candidates.push(projectDropboxUrl)
  if (candidates.length === 0) return { error: '연결된 Dropbox 폴더가 없음' }

  const { listDropboxFolder } = await import('@/lib/dropbox')
  const WEB_BASE = 'https://www.dropbox.com/home'
  const seen = new Set<string>()
  const pdfs: { name: string; path: string }[] = []

  // depth 2 재귀 — 0 행정 / 0 행정/0 외주 같이 더 깊은 PDF 잡기
  async function scan(folderPath: string, prefix: string, depth: number) {
    if (depth > 2) return
    const items = await listDropboxFolder(folderPath).catch(() => [])
    for (const f of items) {
      if (f.type === 'file' && f.name.toLowerCase().endsWith('.pdf')) {
        if (!seen.has(f.path)) {
          seen.add(f.path)
          pdfs.push({ name: prefix ? `${prefix}/${f.name}` : f.name, path: f.path })
        }
      } else if (f.type === 'folder') {
        await scan(`${folderPath}/${f.name}`, prefix ? `${prefix}/${f.name}` : f.name, depth + 1)
      }
    }
  }

  for (const url of candidates) {
    const folderPath = decodeURIComponent(url.replace(WEB_BASE, '')).replace(/\/$/, '')
    await scan(folderPath, '', 0)
  }

  return { pdfs }
}

// 프로젝트 폴더의 PDF 목록 — [+ PDF로 계약 추가] 흐름에서 사용
export async function listProjectFolderPdfs(projectId: string): Promise<{ pdfs: { name: string; path: string }[] } | { error: string }> {
  const admin = createAdminClient()
  const { data: project } = await admin.from('projects').select('dropbox_url').eq('id', projectId).maybeSingle()
  if (!project?.dropbox_url) return { error: '프로젝트 Dropbox 폴더 없음' }

  const { listDropboxFolder } = await import('@/lib/dropbox')
  const WEB_BASE = 'https://www.dropbox.com/home'
  const folderPath = decodeURIComponent(project.dropbox_url.replace(WEB_BASE, '')).replace(/\/$/, '')

  const seen = new Set<string>()
  const pdfs: { name: string; path: string }[] = []
  async function scan(p: string, prefix: string, depth: number) {
    if (depth > 2) return
    const items = await listDropboxFolder(p).catch(() => [])
    for (const f of items) {
      if (f.type === 'file' && f.name.toLowerCase().endsWith('.pdf')) {
        if (!seen.has(f.path)) {
          seen.add(f.path)
          pdfs.push({ name: prefix ? `${prefix}/${f.name}` : f.name, path: f.path })
        }
      } else if (f.type === 'folder') {
        await scan(`${p}/${f.name}`, prefix ? `${prefix}/${f.name}` : f.name, depth + 1)
      }
    }
  }
  await scan(folderPath, '', 0)
  return { pdfs }
}

// PDF 경로만 받아 단독 분석 — 새 계약 만들기 전 미리 분석할 때 사용
export async function analyzePdfByPath(dropboxPath: string): Promise<{ analysis: QuoteAnalysis } | { error: string }> {
  const { readDropboxFile } = await import('@/lib/dropbox')
  const pdfRes = await readDropboxFile(dropboxPath)
  if ('error' in pdfRes) return { error: `PDF 읽기 실패: ${pdfRes.error}` }

  const Anthropic = (await import('@anthropic-ai/sdk')).default
  const client = new Anthropic()
  const today = new Date().toISOString().slice(0, 10)
  const prompt = `다음은 계약 견적서 PDF에서 추출한 텍스트야. JSON으로만 답해.

오늘 날짜: ${today}

견적서 본문:
"""
${pdfRes.text}
"""

다음 정보를 추출해서 JSON으로:
{
  "revenue": <부가세 포함 총 금액 숫자, 원 단위. 명확한 총액만. 항목별 합계 아님. 부가세 별도면 110% 곱해. 못 찾으면 null>,
  "client_org": "<발주처(고객사) 정식 명칭. 견적서 '발주자' 줄. 보통 학교명·연구소명·기관명. 못 찾으면 null>",
  "client_dept": "<발주처 안의 부서명·담당팀명. 본부·과 등. 못 찾으면 null>",
  "supplier_name": "<공급자 = 우리 측 사업자명. 견적서 '공급자' 줄. 못 찾으면 null>",
  "payment_schedules": [
    { "label": "선금|중도금|잔금|계산서|기타", "amount": <숫자>, "due_date": "<YYYY-MM-DD 또는 null>" }
  ],
  "notes": "<견적서 특이사항·메모 1~2줄. 없으면 null>"
}

규칙:
- revenue: "총 견적 금액" 또는 "총계" 명시된 금액. 부가세 포함 금액.
- client_org: 발주자 줄 (공급자=우리 회사는 절대 X). 정식 명칭 그대로.
- client_dept: 부서명. 없을 수 있음.
- supplier_name: 공급자 = 우리 사업자. 발주자와 절대 헷갈리지 마.
- payment_schedules: 명시 안 됐으면 빈 배열.
- 답변은 JSON 객체 하나만.`

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    })
    const { logApiUsage } = await import('@/lib/api-usage')
    logApiUsage({ model: 'claude-sonnet-4-6', endpoint: 'quote-analysis-pre', userId: null, inputTokens: message.usage.input_tokens, outputTokens: message.usage.output_tokens }).catch(() => {})
    const textBlock = message.content.find(b => b.type === 'text')
    const text = textBlock && textBlock.type === 'text' ? textBlock.text : ''
    const m = text.match(/\{[\s\S]*\}/)
    if (!m) return { error: 'JSON 추출 실패' }
    const parsed = JSON.parse(m[0]) as Omit<QuoteAnalysis, 'matched_customer_id' | 'matched_customer_name' | 'matched_entity_id' | 'matched_entity_name'>

    const admin = createAdminClient()
    let matched_customer_id: string | null = null
    let matched_customer_name: string | null = null
    if (parsed.client_org?.trim()) {
      const { data: c } = await admin.from('customers').select('id, name').ilike('name', parsed.client_org.trim()).limit(1).maybeSingle()
      if (c) { matched_customer_id = c.id; matched_customer_name = c.name }
    }

    let matched_entity_id: string | null = null
    let matched_entity_name: string | null = null
    if (parsed.supplier_name?.trim()) {
      const sup = parsed.supplier_name.trim()
      const norm = (s: string) => s.replace(/㈜|\(주\)|주식회사|유한회사|\(유\)/g, '').replace(/\s+/g, '').toLowerCase()
      const normSup = norm(sup)
      const { data: entities } = await admin.from('business_entities').select('id, name, short_name, status').eq('status', 'active')
      const match = (entities ?? []).find(e =>
        norm(e.name).includes(normSup) || normSup.includes(norm(e.name)) ||
        (e.short_name && norm(e.short_name) === normSup) ||
        (e.short_name && normSup.includes(norm(e.short_name)))
      )
      if (match) { matched_entity_id = match.id; matched_entity_name = match.short_name || match.name }
    }

    return { analysis: { ...parsed, matched_customer_id, matched_customer_name, matched_entity_id, matched_entity_name } }
  } catch (e) {
    return { error: e instanceof Error ? e.message : '분석 실패' }
  }
}

// 분석 결과 + 사용자 보강 정보로 새 계약을 생성 + 폴더 자동 생성 + final_quote 매핑까지 한 번에
export async function createSaleFromQuote(projectId: string, data: {
  pdf_path: string
  name: string
  revenue: number
  customer_id: string
  entity_id?: string | null
  client_dept?: string | null
  payment_schedules?: { label: string; amount: number; due_date: string | null }[]
}): Promise<{ sale_id: string; folder_created?: string; pdf_move_error?: string } | { error: string }> {
  if (!data.customer_id) return { error: '기관(customer)이 선택되지 않았어' }
  const admin = createAdminClient()
  const [{ data: project }, { data: customer }] = await Promise.all([
    admin.from('projects').select('name, service_type, department, customer_id, pm_id, project_number, dropbox_url').eq('id', projectId).single(),
    admin.from('customers').select('id, name').eq('id', data.customer_id).single(),
  ])
  if (!customer) return { error: '선택한 기관을 찾을 수 없음' }

  const today = new Date().toISOString().slice(0, 10)
  const finalName = data.name.trim() || project?.name || '(이름 없음)'

  const { data: sale, error } = await admin.from('sales').insert({
    name: finalName,
    project_id: projectId,
    service_type: project?.service_type ?? null,
    department: project?.department ?? null,
    customer_id: data.customer_id,
    assignee_id: project?.pm_id ?? null,
    project_number: project?.project_number ?? null,
    entity_id: data.entity_id ?? null,
    revenue: data.revenue,
    contract_stage: '계약',
    client_org: customer.name,
    client_dept: data.client_dept ?? null,
    final_quote_dropbox_path: data.pdf_path,
    inflow_date: today,
  }).select('id').single()
  if (error || !sale) return { error: error?.message ?? '계약 생성 실패' }

  // payment_schedules 같이 추가
  if (data.payment_schedules && data.payment_schedules.length > 0) {
    const rows = data.payment_schedules.map((p, i) => ({
      sale_id: sale.id,
      label: p.label,
      amount: p.amount,
      due_date: p.due_date,
      is_received: false,
      sort_order: i,
    }))
    await admin.from('payment_schedules').insert(rows)
  }

  // entity 있으면 폴더 자동 생성 + 견적 PDF를 해당 폴더로 이동
  let folderCreated: string | undefined
  let pdfMoveError: string | undefined
  if (data.entity_id) {
    const r = await ensureContractFolder(sale.id)
    if ('webUrl' in r) {
      folderCreated = r.webUrl
      const WEB_BASE = 'https://www.dropbox.com/home'
      const folderPath = decodeURIComponent(r.webUrl.replace(WEB_BASE, ''))
      const pdfName = data.pdf_path.split('/').pop() ?? 'estimate.pdf'
      console.log('[createSaleFromQuote] moving pdf from:', data.pdf_path, '→ to:', `${folderPath}/${pdfName}`)
      const moved = await moveDropboxFileByPath(data.pdf_path, `${folderPath}/${pdfName}`).catch(e => ({ error: String(e) }))
      if (moved && 'ok' in moved) {
        await admin.from('sales').update({ final_quote_dropbox_path: moved.finalPath }).eq('id', sale.id)
      } else if (moved && 'error' in moved) {
        pdfMoveError = moved.error
        console.error('[createSaleFromQuote] pdf move failed:', moved.error)
      }
    }
  }

  revalidatePath(`/projects/${projectId}`)
  return { sale_id: sale.id, folder_created: folderCreated, pdf_move_error: pdfMoveError }
}

export async function setSaleFinalQuote(saleId: string, dropboxPath: string | null, projectId: string): Promise<{ error?: string }> {
  const admin = createAdminClient()
  const { error } = await admin
    .from('sales')
    .update({ final_quote_dropbox_path: dropboxPath, updated_at: new Date().toISOString() })
    .eq('id', saleId)
  if (error) return { error: error.message }
  revalidatePath(`/projects/${projectId}`)
  return {}
}

// 매핑된 최종 견적 PDF를 빵빵이로 분석해 계약 정보 추출.
// 자동 적용은 안 하고 분석 결과만 반환 — 사용자 컨펌 후 applyQuoteAnalysis로 적용.
export interface QuoteAnalysis {
  revenue: number | null
  client_org: string | null
  client_dept: string | null
  supplier_name: string | null
  payment_schedules: { label: string; amount: number; due_date: string | null }[]
  matched_customer_id: string | null
  matched_customer_name: string | null
  matched_entity_id: string | null
  matched_entity_name: string | null
  notes: string | null
}

export async function analyzeFinalQuotePdf(saleId: string): Promise<{ analysis: QuoteAnalysis } | { error: string }> {
  const admin = createAdminClient()
  const { data: sale } = await admin
    .from('sales')
    .select('id, final_quote_dropbox_path')
    .eq('id', saleId)
    .maybeSingle()
  if (!sale) return { error: '계약을 찾을 수 없음' }
  if (!sale.final_quote_dropbox_path) return { error: '먼저 [📎 최종 견적 PDF 매핑]을 해줘' }

  const { readDropboxFile } = await import('@/lib/dropbox')
  const pdfRes = await readDropboxFile(sale.final_quote_dropbox_path)
  if ('error' in pdfRes) return { error: `PDF 읽기 실패: ${pdfRes.error}` }

  const Anthropic = (await import('@anthropic-ai/sdk')).default
  const client = new Anthropic()
  const today = new Date().toISOString().slice(0, 10)
  const prompt = `다음은 계약 견적서 PDF에서 추출한 텍스트야. JSON으로만 답해.

오늘 날짜: ${today}

견적서 본문:
"""
${pdfRes.text}
"""

다음 정보를 추출해서 JSON으로:
{
  "revenue": <부가세 포함 총 금액 숫자, 원 단위. 명확한 총액만. 항목별 합계 아님. 부가세 별도면 110% 곱해. 못 찾으면 null>,
  "client_org": "<발주처(고객사) 정식 명칭. 견적서 '발주자' 줄. 보통 학교명·연구소명·기관명. 못 찾으면 null>",
  "client_dept": "<발주처 안의 부서명·담당팀명. 본부·과 등. 못 찾으면 null>",
  "supplier_name": "<공급자 = 우리 측 사업자명 (유어메이트/공공이코퍼레이션/공공이크리에이티브 등). 견적서 '공급자' 줄. 못 찾으면 null>",
  "payment_schedules": [
    { "label": "선금|중도금|잔금|계산서|기타", "amount": <숫자>, "due_date": "<YYYY-MM-DD 또는 null>" }
  ],
  "notes": "<견적서 특이사항·메모 1~2줄. 없으면 null>"
}

규칙:
- revenue: "총 견적 금액" 또는 "총계" 명시된 금액. 부가세 포함 금액. 보통 PDF 상단에 큰 글씨.
- client_org: 발주자 줄 (공급자=우리 회사는 절대 X). 정식 명칭 그대로.
- client_dept: "교육과", "학생지원과", "OO팀" 같은 부서명. 없을 수 있음.
- supplier_name: 공급자 = 매출 발생시키는 우리 사업자. "유어메이트" 또는 법인명 (㈜공공이코퍼레이션 등). 발주자(client_org)와 절대 헷갈리지 마.
- payment_schedules: 견적서에 결제 일정 명시 안 됐으면 빈 배열. 추측 금지.
- 답변은 JSON 객체 하나만. 다른 설명 절대 금지.`

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    })
    const { logApiUsage } = await import('@/lib/api-usage')
    logApiUsage({ model: 'claude-sonnet-4-6', endpoint: 'quote-analysis', userId: null, inputTokens: message.usage.input_tokens, outputTokens: message.usage.output_tokens }).catch(() => {})

    const textBlock = message.content.find(b => b.type === 'text')
    const text = textBlock && textBlock.type === 'text' ? textBlock.text : ''
    const m = text.match(/\{[\s\S]*\}/)
    if (!m) return { error: 'JSON 추출 실패' }
    const parsed = JSON.parse(m[0]) as Omit<QuoteAnalysis, 'matched_customer_id' | 'matched_customer_name' | 'matched_entity_id' | 'matched_entity_name'>

    // client_org → customers 정확 매칭
    let matched_customer_id: string | null = null
    let matched_customer_name: string | null = null
    if (parsed.client_org?.trim()) {
      const { data: c } = await admin
        .from('customers')
        .select('id, name')
        .ilike('name', parsed.client_org.trim())
        .limit(1)
        .maybeSingle()
      if (c) { matched_customer_id = c.id; matched_customer_name = c.name }
    }

    // supplier_name → business_entities 매칭 (정식명·약칭 모두 시도)
    let matched_entity_id: string | null = null
    let matched_entity_name: string | null = null
    if (parsed.supplier_name?.trim()) {
      const sup = parsed.supplier_name.trim()
      // ㈜·(주)·주식회사 등 제거 후 비교
      const norm = (s: string) => s.replace(/㈜|\(주\)|주식회사|유한회사|\(유\)/g, '').replace(/\s+/g, '').toLowerCase()
      const normSup = norm(sup)
      const { data: entities } = await admin
        .from('business_entities')
        .select('id, name, short_name, status')
        .eq('status', 'active')
      const match = (entities ?? []).find(e =>
        norm(e.name).includes(normSup) ||
        normSup.includes(norm(e.name)) ||
        (e.short_name && norm(e.short_name) === normSup) ||
        (e.short_name && normSup.includes(norm(e.short_name)))
      )
      if (match) { matched_entity_id = match.id; matched_entity_name = match.short_name || match.name }
    }

    return {
      analysis: {
        ...parsed,
        matched_customer_id,
        matched_customer_name,
        matched_entity_id,
        matched_entity_name,
      }
    }
  } catch (e) {
    return { error: e instanceof Error ? e.message : '분석 실패' }
  }
}

interface ApplyQuoteInput {
  revenue?: number | null
  client_org?: string | null
  client_dept?: string | null
  customer_id?: string | null   // null이면 변경 안 함
  entity_id?: string | null     // 우리 측 사업자 (business_entities.id)
  payment_schedules?: { label: string; amount: number; due_date: string | null }[]   // 빈 배열 = 변경 안 함
  replace_schedules?: boolean   // true면 기존 모두 삭제 후 새로 추가, false면 추가만
}

export async function applyQuoteAnalysis(saleId: string, data: ApplyQuoteInput, projectId: string): Promise<{ ok: true; folder_created?: string; folder_error?: string } | { error: string }> {
  const admin = createAdminClient()
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (data.revenue !== undefined && data.revenue !== null) updates.revenue = data.revenue
  if (data.client_org !== undefined) updates.client_org = data.client_org
  if (data.client_dept !== undefined) updates.client_dept = data.client_dept
  if (data.customer_id) updates.customer_id = data.customer_id
  if (data.entity_id) updates.entity_id = data.entity_id

  if (Object.keys(updates).length > 1) {
    const { error } = await admin.from('sales').update(updates).eq('id', saleId)
    if (error) return { error: error.message }
    // project.customer_id도 같이 갱신 (계약별 customer가 명확해진 경우)
    if (data.customer_id) {
      const { data: sale } = await admin.from('sales').select('project_id').eq('id', saleId).maybeSingle()
      if (sale?.project_id) {
        const { data: proj } = await admin.from('projects').select('customer_id').eq('id', sale.project_id).maybeSingle()
        if (proj && !proj.customer_id) {
          await admin.from('projects').update({ customer_id: data.customer_id }).eq('id', sale.project_id)
        }
      }
    }
  }

  if (data.payment_schedules && data.payment_schedules.length > 0) {
    if (data.replace_schedules) {
      await admin.from('payment_schedules').delete().eq('sale_id', saleId)
    }
    const { data: existing } = await admin.from('payment_schedules').select('sort_order').eq('sale_id', saleId).order('sort_order', { ascending: false }).limit(1)
    let nextSort = (existing?.[0]?.sort_order ?? -1) + 1
    const rows = data.payment_schedules.map(p => ({
      sale_id: saleId,
      label: p.label,
      amount: p.amount,
      due_date: p.due_date,
      is_received: false,
      sort_order: nextSort++,
    }))
    const { error } = await admin.from('payment_schedules').insert(rows)
    if (error) return { error: `결제 일정 추가 실패: ${error.message}` }
  }

  // entity가 정해지면 사업자별 계약 폴더 자동 생성
  let folderCreated: string | undefined
  let folderError: string | undefined
  if (data.entity_id) {
    const r = await ensureContractFolder(saleId)
    if ('webUrl' in r) folderCreated = r.webUrl
    else folderError = r.error
  }

  revalidatePath(`/projects/${projectId}`)
  return { ok: true, folder_created: folderCreated, folder_error: folderError }
}

// 계약 삭제 — sales 행 + 연결된 payment_schedules 같이 삭제.
// 같은 프로젝트의 다른 계약이 있어야 통과 (마지막 계약은 프로젝트 보호 위해 차단).
// Dropbox 폴더는 삭제 안 함 (옛 자료 보호 정책).
export async function deleteContract(saleId: string, projectId: string): Promise<{ ok: true } | { error: string }> {
  const admin = createAdminClient()
  const { count } = await admin.from('sales').select('id', { count: 'exact', head: true }).eq('project_id', projectId)
  if ((count ?? 0) <= 1) {
    return { error: '프로젝트의 마지막 계약은 삭제할 수 없어. 프로젝트 자체를 삭제하려면 [프로젝트 설정] → [삭제]를 사용해.' }
  }
  // payment_schedules는 ON DELETE CASCADE 가능성 있지만 명시적 삭제로 안전 보장
  await admin.from('payment_schedules').delete().eq('sale_id', saleId)
  await admin.from('sale_costs').delete().eq('sale_id', saleId)
  // tasks.project_id가 sale.id를 가리키니 같이 삭제 또는 분리. 단순 삭제는 위험 → 분리(project_id NULL).
  await admin.from('tasks').update({ project_id: null }).eq('project_id', saleId)
  const { error } = await admin.from('sales').delete().eq('id', saleId)
  if (error) return { error: error.message }
  revalidatePath(`/projects/${projectId}`)
  return { ok: true }
}

export async function ensureContractFolder(saleId: string): Promise<{ ok: true; webUrl: string } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '인증 필요' }

  const admin = createAdminClient()
  const { data: sale } = await admin
    .from('sales')
    .select('id, name, entity_id, project_id, dropbox_url, revenue, created_at')
    .eq('id', saleId)
    .single()
  if (!sale) return { error: '계약을 찾을 수 없음' }
  if (!sale.entity_id) return { error: '사업자(entity_id)가 지정되지 않음. 먼저 사업자 선택 필요.' }
  if (!sale.project_id) return { error: '프로젝트에 연결되지 않음' }

  const [{ data: entity }, { data: project }, { data: siblings }] = await Promise.all([
    admin.from('business_entities').select('short_name, name').eq('id', sale.entity_id).single(),
    admin.from('projects').select('dropbox_url').eq('id', sale.project_id).single(),
    admin.from('sales').select('id, created_at').eq('project_id', sale.project_id).order('created_at'),
  ])
  if (!project?.dropbox_url) return { error: '프로젝트 Dropbox 폴더 없음' }

  const cleanName = (entity?.name ?? '').replace(/㈜|\(주\)|주식회사|유한회사|\(유\)/g, '').trim()
  const entityKey = cleanName || entity?.short_name || ''
  if (!entityKey) return { error: '사업자 이름 없음' }

  // 같은 프로젝트 내 계약 순서 (created_at 기준)
  const idx = (siblings ?? []).findIndex(s => s.id === sale.id)
  const sequence = idx >= 0 ? idx + 1 : 1

  // sale.dropbox_url 이미 있고 프로젝트 폴더와 다르면 (= 별도 계약 폴더) 그대로
  if (sale.dropbox_url && sale.dropbox_url !== project.dropbox_url) {
    return { ok: true, webUrl: sale.dropbox_url }
  }

  const { createContractFolder } = await import('@/lib/dropbox')
  const r = await createContractFolder({
    projectFolderWebUrl: project.dropbox_url,
    entityFullName: entityKey,
    revenue: sale.revenue ?? null,
    saleSequence: sequence,
  })
  if ('error' in r) return r

  await admin.from('sales').update({ dropbox_url: r.webUrl }).eq('id', saleId)
  revalidatePath(`/projects/${sale.project_id}`)
  return { ok: true, webUrl: r.webUrl }
}

export async function updateProjectNotes(projectId: string, notes: string) {
  const admin = createAdminClient()
  await admin.from('projects').update({ notes: notes || null, updated_at: new Date().toISOString() }).eq('id', projectId)
  revalidatePath(`/projects/${projectId}`)
}

export async function togglePaymentReceived(scheduleId: string, isReceived: boolean, projectId: string) {
  const admin = createAdminClient()
  await admin.from('payment_schedules').update({
    is_received: isReceived,
    received_date: isReceived ? new Date().toISOString().slice(0, 10) : null,
  }).eq('id', scheduleId)
  revalidatePath(`/projects/${projectId}`)
}

export async function addPaymentSchedule(
  saleId: string, label: string, amount: number, dueDate: string | null, projectId: string,
): Promise<{ id: string; label: string; amount: number; is_received: boolean; due_date: string | null } | null> {
  const admin = createAdminClient()
  const { data: existing } = await admin.from('payment_schedules').select('sort_order').eq('sale_id', saleId).order('sort_order', { ascending: false }).limit(1)
  const sortOrder = (existing?.[0]?.sort_order ?? -1) + 1
  const { data } = await admin.from('payment_schedules').insert({ sale_id: saleId, label, amount, due_date: dueDate || null, is_received: false, sort_order: sortOrder }).select('id, label, amount, is_received, due_date').single()
  revalidatePath(`/projects/${projectId}`)
  return data
}

export async function deletePaymentSchedule(scheduleId: string, projectId: string) {
  const admin = createAdminClient()
  await admin.from('payment_schedules').delete().eq('id', scheduleId)
  revalidatePath(`/projects/${projectId}`)
}

export async function addSaleCost(
  saleId: string, item: string, amount: number, category: string, projectId: string,
): Promise<{ id: string; item: string; amount: number; category: string; sale_id: string } | null> {
  const admin = createAdminClient()
  const { data } = await admin.from('sale_costs').insert({ sale_id: saleId, item, amount, category }).select('id, item, amount, category, sale_id').single()
  revalidatePath(`/projects/${projectId}`)
  return data
}

export async function deleteSaleCost(costId: string, projectId: string) {
  const admin = createAdminClient()
  await admin.from('sale_costs').delete().eq('id', costId)
  revalidatePath(`/projects/${projectId}`)
}

export async function updateContractStage(saleId: string, stage: string, projectId: string) {
  const admin = createAdminClient()
  await admin.from('sales').update({ contract_stage: stage, updated_at: new Date().toISOString() }).eq('id', saleId)
  revalidatePath(`/projects/${projectId}`)
}

export async function updateContractProgressStatus(saleId: string, status: string, projectId: string) {
  const admin = createAdminClient()
  await admin.from('sales').update({ progress_status: status, updated_at: new Date().toISOString() }).eq('id', saleId)
  revalidatePath(`/projects/${projectId}`)
}

export async function updateContractInfo(
  saleId: string,
  data: { name?: string; revenue?: number; contract_split_reason?: string | null; entity_id?: string | null; inflow_date?: string | null; payment_date?: string | null; client_org?: string | null; dropbox_url?: string | null },
  projectId: string,
) {
  const admin = createAdminClient()
  await admin.from('sales').update({ ...data, updated_at: new Date().toISOString() }).eq('id', saleId)
  revalidatePath(`/projects/${projectId}`)
}

export async function createTaskForProject(
  contractId: string | null, title: string, assigneeId: string | null, dueDate: string | null, priority: string, description: string | null,
): Promise<
  | { id: string; title: string; status: string; priority: string | null; due_date: string | null; assignee: { id: string; name: string } | null; project_id: string | null; description: string | null }
  | { error: string }
> {
  const admin = createAdminClient()
  const { data, error } = await admin.from('tasks').insert({
    project_id: contractId || null, title, status: '할 일', priority, assignee_id: assigneeId || null, due_date: dueDate || null, description: description || null,
  }).select('id, title, status, priority, due_date, project_id, description, assignee_id').single()
  if (error) {
    console.error('[createTaskForProject] insert error:', error)
    return { error: error.message }
  }
  if (!data) return { error: 'task insert returned no data' }
  let assignee: { id: string; name: string } | null = null
  if (data.assignee_id) {
    const { data: p } = await admin.from('profiles').select('id, name').eq('id', data.assignee_id).single()
    if (p) assignee = { id: p.id, name: p.name }
  }
  // 진짜 project_id 찾아서 정확한 path revalidate (contractId는 sale.id임)
  if (contractId) {
    const { data: sale } = await admin.from('sales').select('project_id').eq('id', contractId).single()
    if (sale?.project_id) {
      revalidatePath(`/projects/${sale.project_id}`)
    }
    revalidatePath(`/sales/${contractId}`)
  }
  revalidatePath('/tasks')
  return { ...data, assignee }
}

type LinkedCalEvent = { id: string; calendarKey: string; title: string; date: string; color: string }

export async function linkCalendarEvent(projectId: string, event: LinkedCalEvent) {
  const admin = createAdminClient()
  const { data: p } = await admin.from('projects').select('linked_calendar_events').eq('id', projectId).single()
  const current: LinkedCalEvent[] = (p?.linked_calendar_events as LinkedCalEvent[]) ?? []
  if (current.find(e => e.id === event.id)) return
  await admin.from('projects').update({ linked_calendar_events: [...current, event] }).eq('id', projectId)
  revalidatePath(`/projects/${projectId}`)
}

export async function unlinkCalendarEvent(projectId: string, eventId: string) {
  const admin = createAdminClient()
  const { data: p } = await admin.from('projects').select('linked_calendar_events').eq('id', projectId).single()
  const current: LinkedCalEvent[] = (p?.linked_calendar_events as LinkedCalEvent[]) ?? []
  await admin.from('projects').update({ linked_calendar_events: current.filter(e => e.id !== eventId) }).eq('id', projectId)
  revalidatePath(`/projects/${projectId}`)
}

// 연결 해제 + Google Calendar 이벤트도 완전 삭제
// "Not Found"는 이미 삭제된 것으로 간주하고 unlink는 진행
export async function unlinkAndDeleteCalendarEvent(
  projectId: string,
  eventId: string,
  calendarKey: string,
): Promise<{ error?: string }> {
  try {
    await deleteGCalEvent(calendarKey, eventId)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    const alreadyGone = /not found|404|resource.*has been deleted/i.test(msg)
    if (!alreadyGone) return { error: msg }
    // Not Found → Google Calendar에 없음. 프로젝트 연결 해제는 계속 진행.
  }
  const admin = createAdminClient()
  const { data: p } = await admin.from('projects').select('linked_calendar_events').eq('id', projectId).single()
  const current: LinkedCalEvent[] = (p?.linked_calendar_events as LinkedCalEvent[]) ?? []
  await admin.from('projects').update({ linked_calendar_events: current.filter(e => e.id !== eventId) }).eq('id', projectId)
  revalidatePath(`/projects/${projectId}`)
  return {}
}

export async function createAndLinkCalendarEvent(
  projectId: string,
  calendarKey: string,
  data: { title: string; date: string; startTime?: string; endTime?: string; description?: string; isAllDay?: boolean }
): Promise<{ error?: string }> {
  try {
    const ev = await createEvent(calendarKey, data)
    await linkCalendarEvent(projectId, {
      id: ev.id ?? `ev-${Date.now()}`,
      calendarKey,
      title: data.title,
      date: data.date,
      color: CALENDAR_COLORS[calendarKey] ?? '#3B82F6',
    })
    return {}
  } catch (e: unknown) {
    return { error: e instanceof Error ? e.message : String(e) }
  }
}

export async function listProjectDropboxFiles(
  dropboxUrl: string
): Promise<{ name: string; path: string; type: 'file' | 'folder' }[]> {
  const WEB_BASE = 'https://www.dropbox.com/home'
  if (!dropboxUrl.startsWith(WEB_BASE)) return []
  const relativePath = decodeURIComponent(dropboxUrl.replace(WEB_BASE, ''))
  return listDropboxFolder(relativePath)
}

export async function getProjectBriefContent(projectId: string): Promise<{ content: string; filename: string } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '인증 필요' }
  const admin = createAdminClient()
  const { data: project } = await admin.from('projects').select('name, project_number, dropbox_url').eq('id', projectId).single()
  if (!project) return { error: '프로젝트 없음' }
  if (!project.dropbox_url) return { error: 'Dropbox URL 없음 — ⚙️ 설정에서 폴더 연결 필요' }
  const { getBriefFilename, findExistingBriefFile } = await import('@/lib/brief-generator')
  const { readDropboxFile } = await import('@/lib/dropbox')
  const targetFilename = getBriefFilename({ project_name: project.name, project_number: project.project_number })
  const folderPath = decodeURIComponent(project.dropbox_url.replace('https://www.dropbox.com/home', '')).replace(/\/$/, '')
  const existing = await findExistingBriefFile(project.dropbox_url, targetFilename)
  if (!existing) return { error: 'brief 파일이 아직 없음 — [📄 Brief 갱신] 먼저 눌러줘' }
  const r = await readDropboxFile(`${folderPath}/${existing}`)
  if ('error' in r) return { error: r.error }
  return { content: r.text, filename: existing }
}

export async function regenerateProjectBrief(projectId: string): Promise<{ ok: true; filename: string } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '인증 필요' }
  const { createOrUpdateProjectBrief } = await import('@/lib/brief-generator')
  const result = await createOrUpdateProjectBrief(projectId)
  if ('error' in result) return result
  revalidatePath(`/projects/${projectId}`)
  return result
}

export async function deleteProject(projectId: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single()
  const isAdminRole = isAdminOrManager(profile?.role)

  if (!isAdminRole) {
    const { data: membership } = await admin
      .from('project_members')
      .select('role')
      .eq('project_id', projectId)
      .eq('profile_id', user.id)
      .single()
    if (membership?.role !== 'PM') return { error: '관리자 또는 PM만 삭제 가능합니다' }
  }

  // 연관 데이터 정리 — 각 단계 실패 시 명확한 메시지 반환
  const { error: memErr } = await admin.from('project_members').delete().eq('project_id', projectId)
  if (memErr) return { error: `멤버 정리 실패: ${memErr.message}` }

  const { error: logErr } = await admin.from('project_logs').delete().eq('project_id', projectId)
  if (logErr) return { error: `로그 정리 실패: ${logErr.message}` }

  const { error: saleErr } = await admin.from('sales').update({ project_id: null }).eq('project_id', projectId)
  if (saleErr) return { error: `매출 연결 해제 실패: ${saleErr.message}` }

  const { error: leadErr } = await admin.from('leads').update({ project_id: null }).eq('project_id', projectId)
  if (leadErr) return { error: `리드 연결 해제 실패: ${leadErr.message}` }

  const { error: projErr } = await admin.from('projects').delete().eq('id', projectId)
  if (projErr) return { error: `프로젝트 삭제 실패: ${projErr.message}` }

  revalidatePath('/projects')
  return {}
}

export async function updateCustomerContact(
  customerId: string,
  projectId: string,
  contactName: string,
  phone: string,
  contactEmail: string,
) {
  const admin = createAdminClient()
  await admin.from('customers').update({
    contact_name: contactName || null,
    phone: phone || null,
    contact_email: contactEmail || null,
  }).eq('id', customerId)
  revalidatePath(`/projects/${projectId}`)
}

// Dropbox 폴더 재시도 (Phase 7) — 미연결 project 에서 다시 시도
// 1순위: 연결된 sale 에 dropbox_url 있으면 거기서 가져와 동기화
// 2순위: 첫 sale 의 service_type 으로 createSaleFolder 신규
export async function retryProjectDropboxFolder(projectId: string): Promise<{ ok: true; url: string; source: 'from_sale' | 'new' } | { error: string }> {
  if (!projectId) return { error: '잘못된 요청' }
  const admin = createAdminClient()
  const { data: project } = await admin.from('projects').select('id, name, service_type, dropbox_url').eq('id', projectId).maybeSingle()
  if (!project) return { error: '프로젝트를 찾을 수 없어요' }
  if (project.dropbox_url) return { error: '이미 폴더가 연결되어 있어요' }

  // 1순위: 연결된 sale 에서 url 끌어오기
  const { data: sales } = await admin
    .from('sales')
    .select('id, dropbox_url, service_type, name, inflow_date')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true })

  const saleWithUrl = (sales ?? []).find(s => s.dropbox_url && s.dropbox_url.trim())
  if (saleWithUrl) {
    await admin.from('projects').update({ dropbox_url: saleWithUrl.dropbox_url, updated_at: new Date().toISOString() }).eq('id', projectId)
    revalidatePath(`/projects/${projectId}`)
    revalidatePath(`/projects/${projectId}/v2`)
    return { ok: true, url: saleWithUrl.dropbox_url as string, source: 'from_sale' }
  }

  // 2순위: 첫 sale 또는 project 자체 service_type 으로 신규 생성
  const baseSale = sales?.[0]
  const serviceType = (baseSale?.service_type as string | null) ?? (project.service_type as string | null)
  if (!serviceType) return { error: '서비스를 먼저 정해야 폴더를 만들 수 있어요' }

  const name = (baseSale?.name as string | null) ?? project.name
  const inflowDate = (baseSale?.inflow_date as string | null) ?? null

  let newUrl: string | null = null
  try {
    const { createSaleFolder } = await import('@/lib/dropbox')
    newUrl = await createSaleFolder({ service_type: serviceType, name, inflow_date: inflowDate })
  } catch (e) {
    console.error('[retryProjectDropboxFolder] throw', e instanceof Error ? e.message : e, { projectId })
    return { error: '폴더 생성이 바로 되지 않았어요. 잠시 후 다시 시도해주세요.' }
  }
  if (!newUrl) {
    return { error: '폴더 생성이 바로 되지 않았어요. 서비스를 다시 확인하거나 관리자에게 알려주세요.' }
  }

  await admin.from('projects').update({ dropbox_url: newUrl, updated_at: new Date().toISOString() }).eq('id', projectId)
  // 첫 sale 도 비어있으면 같이 채움
  if (baseSale && !baseSale.dropbox_url) {
    await admin.from('sales').update({ dropbox_url: newUrl, updated_at: new Date().toISOString() }).eq('id', baseSale.id)
  }
  revalidatePath(`/projects/${projectId}`)
  revalidatePath(`/projects/${projectId}/v2`)
  return { ok: true, url: newUrl, source: 'new' }
}

// 운영 분류 저장 (yourmate-company-spec-v2 §5~8) — Phase 3
// localStorage 데모 단계를 DB 저장으로 승격.
export async function updateProjectClassification(input: {
  projectId: string
  main_type: string | null
  expansion_tags: string[]
  capability_tags: string[]
  classification_note: string | null
  classification_confidence?: number | null
}): Promise<{ ok: true } | { error: string }> {
  if (!input.projectId) return { error: 'projectId 필수' }

  const admin = createAdminClient()
  const note = input.classification_note?.trim() || null
  const { error } = await admin
    .from('projects')
    .update({
      main_type: input.main_type || null,
      expansion_tags: input.expansion_tags ?? [],
      capability_tags: input.capability_tags ?? [],
      classification_note: note,
      classification_confidence: input.classification_confidence ?? null,
    })
    .eq('id', input.projectId)
  if (error) return { error: error.message }

  revalidatePath(`/projects/${input.projectId}`)
  revalidatePath(`/projects/${input.projectId}/v2`)
  return { ok: true }
}
