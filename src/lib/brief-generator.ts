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

interface LeadBriefParams {
  lead_id: string
  project_name: string | null
  client_org: string | null
  contact_name: string | null
  phone: string | null
  email: string | null
  service_type: string | null
  assignee_name: string | null
  status: string | null
  initial_content: string | null
  inflow_date: string | null
  notes: string | null
  inflow_source: string | null
  channel: string | null
}

export function generateBriefContent(lead: LeadBriefParams): string {
  const today = new Date().toLocaleDateString('ko-KR')
  return [
    `# 프로젝트 Brief`,
    ``,
    `> 자동 생성: ${today} | 리드 ID: ${lead.lead_id}`,
    ``,
    `---`,
    ``,
    `## 기본 정보`,
    ``,
    `- **프로젝트명:** ${lead.project_name || '(미입력)'}`,
    `- **사업부 / 서비스:** ${lead.service_type || '(미지정)'}`,
    `- **담당자:** ${lead.assignee_name || '(미배정)'}`,
    `- **고객 기관명:** ${lead.client_org || '(미입력)'}`,
    `- **고객 담당자:** ${lead.contact_name || '(미입력)'}`,
    `- **연락처:** ${lead.phone || '(미입력)'}`,
    `- **이메일:** ${lead.email || '(미입력)'}`,
    `- **현재 단계:** ${lead.status || '유입'}`,
    `- **유입 경로:** ${lead.inflow_source || '(미입력)'}`,
    `- **유입 채널:** ${lead.channel || '(미입력)'}`,
    `- **유입일:** ${lead.inflow_date || '(미입력)'}`,
    ``,
    `---`,
    ``,
    `## 최초 문의 내용`,
    ``,
    lead.initial_content?.trim() || '(내용 없음)',
    ``,
    `---`,
    ``,
    `## 메모`,
    ``,
    lead.notes?.trim() || '(없음)',
    ``,
    `---`,
    ``,
    `## Claude 협업 가이드`,
    ``,
    `이 파일을 YOURMATE_CLAUDE.md + 해당 서비스 MD 파일과 함께 Claude.ai에 붙여넣으세요.`,
    `서비스별 컨텍스트 파일 위치: ★ DB/0 유어메이트/7 Claude협업/`,
  ].join('\n')
}

// 리드 ID로 DB에서 데이터 조회 후 brief.md 생성·업로드
// 폴더가 없으면 생성, 이미 있으면 brief.md만 덮어쓰기
export async function createOrUpdateLeadBrief(leadId: string): Promise<void> {
  const admin = createAdminClient()

  const { data: lead } = await admin.from('leads').select('*').eq('id', leadId).single()
  if (!lead || !lead.service_type) return

  let assigneeName: string | null = null
  if (lead.assignee_id) {
    const { data: profile } = await admin.from('profiles').select('name').eq('id', lead.assignee_id).single()
    assigneeName = profile?.name ?? null
  }

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

  const content = generateBriefContent({
    lead_id: lead.lead_id as string,
    project_name: lead.project_name,
    client_org: lead.client_org,
    contact_name: lead.contact_name,
    phone: lead.phone,
    email: lead.email,
    service_type: lead.service_type,
    assignee_name: assigneeName,
    status: lead.status,
    initial_content: lead.initial_content,
    inflow_date: lead.inflow_date,
    notes: lead.notes,
    inflow_source: lead.inflow_source,
    channel: lead.channel,
  })

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
