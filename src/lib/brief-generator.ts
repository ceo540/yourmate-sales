import { createAdminClient } from './supabase/admin'
import { createSaleFolder, uploadTextFile, readDropboxFile, renameDropboxFile, listDropboxFolder } from './dropbox'

const AI_NOTES_HEADER = '## AI 협업 노트'

// 파일명에 쓸 수 없는 문자 sanitize (Dropbox는 / \ : 등 제한)
function sanitizeFilename(s: string): string {
  return s.replace(/[\/\\:*?"<>|]/g, '_').replace(/\s+/g, ' ').trim()
}

// brief 파일 이름 정책
// - 리드: <건이름>.md (project_name 없으면 lead_id)
// - sale/project: <project_number> <건이름>.md
export function getBriefFilename(opts: {
  project_name?: string | null
  project_number?: string | null
  fallback_id?: string | null
}): string {
  const name = opts.project_name?.trim() || opts.fallback_id?.trim() || 'brief'
  const safeName = sanitizeFilename(name)
  if (opts.project_number) {
    return sanitizeFilename(`${opts.project_number} ${safeName}`) + '.md'
  }
  return safeName + '.md'
}

// 폴더 안에서 brief 파일 후보 찾기 (현재 정책 이름 → 옛 brief.md → 첫 .md 파일)
export async function findExistingBriefFile(
  dropboxUrl: string,
  preferredName: string,
): Promise<string | null> {
  if (!dropboxUrl) return null
  const folderPath = decodeURIComponent(dropboxUrl.replace('https://www.dropbox.com/home', '')).replace(/\/$/, '')
  // 1순위: 정책 이름
  const tryRead = await readDropboxFile(`${folderPath}/${preferredName}`).catch(() => null)
  if (tryRead && !('error' in tryRead)) return preferredName
  // 2순위: brief.md
  const tryBrief = await readDropboxFile(`${folderPath}/brief.md`).catch(() => null)
  if (tryBrief && !('error' in tryBrief)) return 'brief.md'
  // 3순위: 폴더 안 첫 .md 파일
  const files = await listDropboxFolder(folderPath).catch(() => [])
  const md = files.find(f => f.type === 'file' && f.name.endsWith('.md'))
  return md?.name ?? null
}

// 기존 brief.md에서 AI 협업 노트 섹션 추출 (재생성 시 보존용)
function extractAiNotes(content: string): string {
  const idx = content.indexOf(AI_NOTES_HEADER)
  return idx !== -1 ? content.slice(idx).trimEnd() : ''
}

// brief.md에 AI 노트 한 줄 추가 (또는 섹션 신규 생성)
export function appendAiNote(existingContent: string, note: string): string {
  const date = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\. /g, '-').replace('.', '')
  const entry = `- [${date}] ${note}`
  if (existingContent.includes(AI_NOTES_HEADER)) {
    return existingContent.trimEnd() + '\n' + entry + '\n'
  }
  return existingContent.trimEnd() + `\n\n---\n\n${AI_NOTES_HEADER}\n\n${entry}\n`
}

// 마스터 brief — lead/project 모든 정보를 한 파일로 통합. Claude Code @brief 로 바로 컨텍스트 사용 가능.
type LeadDb = {
  id: string; lead_id: string; project_name: string | null; client_org: string | null;
  contact_name: string | null; phone: string | null; email: string | null;
  service_type: string | null; status: string; inflow_source: string | null;
  channel: string | null; inflow_date: string | null; remind_date: string | null;
  initial_content: string | null; notes: string | null; summary_cache: string | null;
  assignee_id: string | null; linked_calendar_events: unknown
}
type LinkedCalEv = { id: string; calendarKey: string; title: string; date: string }

function fmtMoney(n: number) {
  if (n >= 100000000) return `${(n / 100000000).toFixed(1)}억`
  if (n >= 10000) return `${Math.round(n / 10000)}만`
  return n.toLocaleString()
}

// 통합 마스터 brief — lead 또는 project로부터 모든 데이터 모아서 markdown
async function buildMasterBriefContent(opts: { kind: 'lead'; leadId: string } | { kind: 'project'; projectId: string }): Promise<string | null> {
  const admin = createAdminClient()
  const today = new Date().toLocaleDateString('ko-KR')

  if (opts.kind === 'lead') {
    const { data: lead } = await admin.from('leads').select('*').eq('id', opts.leadId).single() as { data: LeadDb | null }
    if (!lead) return null

    const [{ data: profile }, { data: tasks }, { data: logs }] = await Promise.all([
      lead.assignee_id ? admin.from('profiles').select('name').eq('id', lead.assignee_id).maybeSingle() : Promise.resolve({ data: null }),
      admin.from('tasks').select('title, status, priority, due_date, description').eq('lead_id', lead.id).order('created_at'),
      admin.from('project_logs').select('content, log_type, contacted_at, location, participants, outcome').eq('lead_id', lead.id).order('contacted_at', { ascending: false }).limit(20),
    ])

    const calEvents = (lead.linked_calendar_events as LinkedCalEv[] | null) ?? []
    const lines: string[] = [
      `# ${lead.project_name || lead.client_org || '(이름 없음)'}`,
      ``,
      `> 자동 생성 · ${today} · 리드 ${lead.lead_id}`,
      ``,
      `## 📋 기본 정보`,
      `- **고객사:** ${lead.client_org || '—'}`,
      `- **고객 담당자:** ${lead.contact_name || '—'}`,
      `- **연락처:** ${lead.phone || '—'} / ${lead.email || '—'}`,
      `- **서비스:** ${lead.service_type || '—'}`,
      `- **현재 단계:** ${lead.status}`,
      `- **유입 경로:** ${lead.inflow_source || '—'} / 채널: ${lead.channel || '—'} / 유입일: ${lead.inflow_date || '—'}`,
      `- **리마인드:** ${lead.remind_date || '—'}`,
      `- **담당자(yourmate):** ${(profile as { name?: string } | null)?.name ?? '—'}`,
      ``,
    ]

    if (lead.summary_cache) {
      lines.push(`## 🤖 빵빵이 분석 (요약)`, '', lead.summary_cache, '')
    }

    if (lead.initial_content?.trim()) {
      lines.push(`## 💬 최초 문의`, '', lead.initial_content.trim(), '')
    }

    if (lead.notes?.trim()) {
      lines.push(`## 📝 메모`, '', lead.notes.trim(), '')
    }

    if (tasks && tasks.length > 0) {
      const active = tasks.filter(t => t.status !== '완료' && t.status !== '보류')
      const done = tasks.filter(t => t.status === '완료')
      if (active.length > 0) {
        lines.push(`## ✅ 할 일 (${active.length}개)`, '')
        for (const t of active) {
          lines.push(`- [ ] ${t.title}${t.due_date ? ` _(마감: ${t.due_date})_` : ''}${t.priority && t.priority !== '보통' ? ` **[${t.priority}]**` : ''}`)
          if (t.description) lines.push(`  > ${t.description}`)
        }
        lines.push('')
      }
      if (done.length > 0) {
        lines.push(`<details><summary>완료된 할 일 (${done.length}개)</summary>`, '')
        for (const t of done) lines.push(`- [x] ~~${t.title}~~`)
        lines.push('', '</details>', '')
      }
    }

    if (logs && logs.length > 0) {
      lines.push(`## 💬 소통 내역 (최근 ${logs.length}건)`, '')
      for (const l of logs) {
        const date = l.contacted_at?.slice(0, 10) ?? '—'
        lines.push(`### [${l.log_type}] ${date}`)
        if (l.location) lines.push(`📍 ${l.location}`)
        if (l.participants?.length) lines.push(`👥 ${l.participants.join(', ')}`)
        lines.push('', l.content, '')
        if (l.outcome) lines.push(`> **결정:** ${l.outcome}`, '')
      }
    }

    if (calEvents.length > 0) {
      lines.push(`## 📅 캘린더 일정`, '')
      for (const e of calEvents) lines.push(`- ${e.date} — ${e.title} _(${e.calendarKey})_`)
      lines.push('')
    }

    return lines.join('\n')
  }

  // project
  const projectId = opts.projectId
  const [{ data: project }, { data: contracts }, { data: memos }, { data: logs }] = await Promise.all([
    admin.from('projects').select('*').eq('id', projectId).single(),
    admin.from('sales').select('id, name, contract_stage, revenue, payment_date').eq('project_id', projectId).order('created_at'),
    admin.from('project_memos').select('id, title, content, created_at').eq('project_id', projectId).order('created_at', { ascending: false }),
    admin.from('project_logs').select('content, log_type, contacted_at, location, participants, outcome').eq('project_id', projectId).order('contacted_at', { ascending: false }).limit(20),
  ])
  if (!project) return null

  const saleIds = (contracts ?? []).map(c => c.id)
  const { data: tasks } = saleIds.length > 0
    ? await admin.from('tasks').select('title, status, priority, due_date, description').in('project_id', saleIds).order('created_at')
    : { data: [] as { title: string; status: string; priority: string; due_date: string | null; description: string | null }[] }

  let pmName: string | null = null
  if (project.pm_id) {
    const { data: p } = await admin.from('profiles').select('name').eq('id', project.pm_id).maybeSingle()
    pmName = (p as { name?: string } | null)?.name ?? null
  }

  let customerName: string | null = null
  if (project.customer_id) {
    const { data: c } = await admin.from('customers').select('name').eq('id', project.customer_id).maybeSingle()
    customerName = (c as { name?: string } | null)?.name ?? null
  }

  const totalRevenue = (contracts ?? []).reduce((s: number, c) => s + (c.revenue ?? 0), 0)
  const calEvents = (project.linked_calendar_events as LinkedCalEv[] | null) ?? []

  const lines: string[] = [
    `# ${project.project_number ? `${project.project_number} ` : ''}${project.name}`,
    ``,
    `> 자동 생성 · ${today} · 프로젝트 마스터 brief`,
    ``,
    `## 📋 기본 정보`,
    `- **상태:** ${project.status}`,
    `- **고객사:** ${customerName || '—'}`,
    `- **PM:** ${pmName || '—'}`,
    `- **서비스:** ${project.service_type || '—'} / 사업부: ${project.department || '—'}`,
    `- **매출 합계:** ${totalRevenue > 0 ? `${fmtMoney(totalRevenue)}원` : '—'}`,
    `- **계약 ${(contracts ?? []).length}건:** ${(contracts ?? []).map(c => `${c.name} (${c.contract_stage})`).join(' / ') || '—'}`,
    ``,
  ]

  if (project.overview_summary) {
    lines.push(`## 🤖 프로젝트 개요`, '', project.overview_summary, '')
  }

  if (project.pending_discussion) {
    lines.push(`## 💭 협의해야 할 내용`, '', project.pending_discussion, '')
  }

  if (project.notes?.trim()) {
    lines.push(`## ⚠️ 유의사항`, '', project.notes.trim(), '')
  }

  if (project.memo?.trim()) {
    lines.push(`## 📝 일반 메모`, '', project.memo.trim(), '')
  }

  if (memos && memos.length > 0) {
    lines.push(`## 📝 메모 카드 (${memos.length}개)`, '')
    for (const m of memos) {
      lines.push(`### ${m.title || '(제목 없음)'} _${m.created_at?.slice(0, 10) ?? ''}_`, '')
      if (m.content) lines.push(m.content, '')
    }
  }

  if (tasks && tasks.length > 0) {
    const active = tasks.filter(t => t.status !== '완료' && t.status !== '보류')
    const done = tasks.filter(t => t.status === '완료')
    if (active.length > 0) {
      lines.push(`## ✅ 할 일 (${active.length}개)`, '')
      for (const t of active) {
        lines.push(`- [ ] ${t.title}${t.due_date ? ` _(마감: ${t.due_date})_` : ''}${t.priority && t.priority !== '보통' ? ` **[${t.priority}]**` : ''}`)
        if (t.description) lines.push(`  > ${t.description}`)
      }
      lines.push('')
    }
    if (done.length > 0) {
      lines.push(`<details><summary>완료된 할 일 (${done.length}개)</summary>`, '')
      for (const t of done) lines.push(`- [x] ~~${t.title}~~`)
      lines.push('', '</details>', '')
    }
  }

  if (logs && logs.length > 0) {
    lines.push(`## 💬 소통 내역 (최근 ${logs.length}건)`, '')
    for (const l of logs) {
      const date = l.contacted_at?.slice(0, 10) ?? '—'
      lines.push(`### [${l.log_type}] ${date}`)
      if (l.location) lines.push(`📍 ${l.location}`)
      if (l.participants?.length) lines.push(`👥 ${l.participants.join(', ')}`)
      lines.push('', l.content, '')
      if (l.outcome) lines.push(`> **결정:** ${l.outcome}`, '')
    }
  }

  if (calEvents.length > 0) {
    lines.push(`## 📅 캘린더 일정`, '')
    for (const e of calEvents) lines.push(`- ${e.date} — ${e.title} _(${e.calendarKey})_`)
    lines.push('')
  }

  return lines.join('\n')
}

// 프로젝트용 brief 생성·업로드
export async function createOrUpdateProjectBrief(projectId: string): Promise<{ ok: true; filename: string } | { error: string }> {
  const admin = createAdminClient()
  const { data: project } = await admin.from('projects').select('name, project_number, dropbox_url').eq('id', projectId).single()
  if (!project) return { error: '프로젝트를 찾을 수 없음' }

  const folderUrl = project.dropbox_url as string | null
  if (!folderUrl) return { error: 'Dropbox 폴더 URL 없음. 먼저 폴더 연결 필요.' }

  const content = await buildMasterBriefContent({ kind: 'project', projectId })
  if (!content) return { error: 'brief 생성 실패' }

  const targetFilename = getBriefFilename({
    project_name: project.name,
    project_number: project.project_number,
  })

  const folderPath = decodeURIComponent(folderUrl.replace('https://www.dropbox.com/home', '')).replace(/\/$/, '')
  const existingFilename = await findExistingBriefFile(folderUrl, targetFilename)

  let aiNotes = ''
  if (existingFilename) {
    const existing = await readDropboxFile(`${folderPath}/${existingFilename}`).catch(() => null)
    if (existing && !('error' in existing)) aiNotes = extractAiNotes(existing.text)
  }
  const finalContent = aiNotes ? content.trimEnd() + '\n\n---\n\n' + aiNotes : content

  if (existingFilename && existingFilename !== targetFilename) {
    const { renameDropboxFile } = await import('./dropbox')
    await renameDropboxFile(folderUrl, existingFilename, targetFilename).catch(() => null)
  }

  const result = await uploadTextFile({ folderWebUrl: folderUrl, filename: targetFilename, content: finalContent })
  if (!result.ok) return { error: result.error }
  return { ok: true, filename: targetFilename }
}

// 리드 ID로 DB에서 데이터 조회 후 brief.md 생성·업로드
// 폴더가 없으면 생성, 이미 있으면 brief.md만 덮어쓰기
export async function createOrUpdateLeadBrief(leadId: string): Promise<void> {
  const admin = createAdminClient()

  const { data: lead } = await admin.from('leads').select('id, service_type, project_name, client_org, dropbox_url, lead_id, inflow_date').eq('id', leadId).single()
  if (!lead || !lead.service_type) return

  // 폴더 URL이 없으면 생성
  let folderUrl = lead.dropbox_url as string | null
  if (!folderUrl) {
    folderUrl = await createSaleFolder({
      service_type: lead.service_type as string,
      name: (lead.project_name || lead.client_org) as string || '(리드)',
      inflow_date: lead.inflow_date,
    })
    if (folderUrl) {
      await admin.from('leads').update({ dropbox_url: folderUrl, updated_at: new Date().toISOString() }).eq('id', leadId)
    }
  }

  if (!folderUrl) return

  // 마스터 brief 사용 — 할일/소통내역/캘린더 등 모두 포함
  const content = await buildMasterBriefContent({ kind: 'lead', leadId })
  if (!content) return

  // 정책 파일명 (리드: <project_name>.md, project_number 없음)
  const targetFilename = getBriefFilename({
    project_name: lead.project_name,
    fallback_id: lead.lead_id as string,
  })

  // 기존 brief 파일 찾기 (정책이름 → brief.md → 폴더 첫 .md)
  const folderPath = decodeURIComponent(folderUrl.replace('https://www.dropbox.com/home', '')).replace(/\/$/, '')
  const existingFilename = await findExistingBriefFile(folderUrl, targetFilename)

  // 기존 AI 노트 보존
  let aiNotes = ''
  if (existingFilename) {
    const existing = await readDropboxFile(`${folderPath}/${existingFilename}`).catch(() => null)
    if (existing && !('error' in existing)) aiNotes = extractAiNotes(existing.text)
  }
  const finalContent = aiNotes ? content.trimEnd() + '\n\n---\n\n' + aiNotes : content

  // 기존 파일이 다른 이름이면 새 이름으로 rename (마이그레이션)
  if (existingFilename && existingFilename !== targetFilename) {
    await renameDropboxFile(folderUrl, existingFilename, targetFilename).catch(() => null)
  }

  await uploadTextFile({ folderWebUrl: folderUrl, filename: targetFilename, content: finalContent }).catch(() => {})
}
