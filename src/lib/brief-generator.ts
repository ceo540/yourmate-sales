import { createAdminClient } from './supabase/admin'
import { createSaleFolder, uploadTextFile } from './dropbox'

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

  await uploadTextFile({ folderWebUrl: folderUrl, filename: 'brief.md', content }).catch(() => {})
}
