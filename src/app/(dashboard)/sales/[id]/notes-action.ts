'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import Anthropic from '@anthropic-ai/sdk'
import { logApiUsage } from '@/lib/api-usage'

export async function saveNotes(saleId: string, notes: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const admin = createAdminClient()
  await admin.from('sales').update({ notes, updated_at: new Date().toISOString() }).eq('id', saleId)
  revalidatePath(`/sales/${saleId}`)
  revalidatePath('/departments')
}

export async function saveProjectOverview(saleId: string, overview: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const admin = createAdminClient()
  await admin.from('sales').update({ project_overview: overview, updated_at: new Date().toISOString() }).eq('id', saleId)
  revalidatePath(`/sales/${saleId}`)
  revalidatePath('/departments')
}

// AI로 프로젝트 개요 생성
export async function generateProjectOverview(data: {
  sale: { name: string; client_org: string | null; service_type: string | null; revenue: number | null; payment_status: string | null; memo: string | null }
  tasks: { title: string; status: string; priority: string | null; assignee: string | null; due_date: string | null; description: string | null }[]
  logs: { content: string; log_type: string; created_at: string; author: string | null }[]
  notes: string
}): Promise<string> {
  const client = new Anthropic()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const taskSummary = data.tasks.map(t =>
    `- [${t.status}] ${t.title}${t.assignee ? ` (${t.assignee})` : ''}${t.due_date ? ` ~${t.due_date.slice(5)}` : ''}${t.description ? `: ${t.description.slice(0, 50)}` : ''}`
  ).join('\n')

  const logSummary = data.logs.slice(0, 10).map(l =>
    `- [${l.log_type}] ${l.created_at.slice(0, 10)} ${l.author ?? ''}: ${l.content.slice(0, 80)}`
  ).join('\n')

  const notesText = data.notes ? `\n\n[자유 노트]\n${data.notes.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 500)}` : ''

  const prompt = `다음 프로젝트 정보를 바탕으로 "프로젝트 개요 문서"를 HTML로 작성해줘.

[프로젝트 기본 정보]
- 프로젝트명: ${data.sale.name}
- 발주처: ${data.sale.client_org ?? '미입력'}
- 서비스: ${data.sale.service_type ?? '미입력'}
- 매출: ${data.sale.revenue ? `${(data.sale.revenue / 10000).toFixed(0)}만원` : '미입력'}
- 결제 상태: ${data.sale.payment_status ?? '계약전'}
${data.sale.memo ? `- 메모: ${data.sale.memo}` : ''}

[업무 목록 (${data.tasks.length}개)]
${taskSummary || '없음'}

[소통 내역 (최근 ${data.logs.length}개)]
${logSummary || '없음'}
${notesText}

아래 HTML 구조로 작성해줘. prose 클래스가 적용되므로 순수 HTML 태그만 사용:
- <h2>프로젝트 개요</h2> 섹션: 프로젝트 한 줄 설명, 발주처, 기간, 과업 범위
- <h2>현재 상태</h2> 섹션: 진행 상황 요약, 완료/진행 중/남은 업무
- <h2>주요 할 일</h2> 섹션: 우선순위 높은 업무 <ul><li> 형태
- <h2>특이사항 / 리스크</h2> 섹션: 소통 내역에서 보이는 주요 이슈나 확인 필요 항목

제3자가 읽어도 이 프로젝트가 뭔지 바로 파악할 수 있게 명확하게 작성해줘.
HTML만 반환하고 마크다운 코드블록(\`\`\`) 없이 줘.`

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  })
  logApiUsage({ model: 'claude-haiku-4-5-20251001', endpoint: 'notes-action', userId: user?.id, inputTokens: message.usage.input_tokens, outputTokens: message.usage.output_tokens }).catch(() => {})

  return (message.content[0] as any).text ?? ''
}

// AI와 노트 내에서 대화
export async function chatInNotes(data: {
  message: string
  notes: string
  saleName: string
  tasks: { title: string; status: string }[]
  logs: { content: string; created_at: string }[]
}): Promise<string> {
  const client = new Anthropic()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const context = `
[프로젝트: ${data.saleName}]
[현재 노트 내용]
${data.notes ? data.notes.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 800) : '(비어있음)'}
[업무] ${data.tasks.map(t => `${t.title}(${t.status})`).join(', ')}
[최근 소통] ${data.logs.slice(0, 5).map(l => l.content.slice(0, 60)).join(' / ')}
`

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 800,
    system: `당신은 프로젝트 매니저를 돕는 AI 어시스턴트입니다. 주어진 프로젝트 컨텍스트를 바탕으로 PM의 질문에 답하거나 내용 정리를 도와주세요. 한국어로 간결하게 답하세요.`,
    messages: [{ role: 'user', content: `${context}\n\nPM 질문/요청: ${data.message}` }],
  })
  logApiUsage({ model: 'claude-haiku-4-5-20251001', endpoint: 'notes-action', userId: user?.id, inputTokens: message.usage.input_tokens, outputTokens: message.usage.output_tokens }).catch(() => {})

  return (message.content[0] as any).text ?? ''
}

// 대상별 문서 생성
export async function generateDocument(data: {
  target: 'client' | 'internal' | 'freelancer'
  sale: { name: string; client_org: string | null; service_type: string | null; revenue: number | null }
  tasks: { title: string; status: string; priority: string | null; assignee: string | null; due_date: string | null; description: string | null }[]
  logs: { content: string; log_type: string; created_at: string }[]
  notes: string
  overview: string
}): Promise<string> {
  const client = new Anthropic()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const targetLabel = { client: '클라이언트', internal: '내부 실무팀', freelancer: '프리랜서' }[data.target]
  const targetGuide = {
    client: '클라이언트가 읽을 문서. 확정된 과업 내용, 행사/프로젝트 흐름, 요청/확인사항 위주. 내부 비용·인력 조율 내용 제외.',
    internal: '내부 팀원용. 담당자별 TO-DO, 구매/준비 목록, 주의사항, 일정 중심. 클라이언트 단가 제외.',
    freelancer: '외주 프리랜서용. 프로젝트 개요, 담당 역할, 스케줄, 준비물, 현장 주의사항. 전체 계약 규모 제외.',
  }[data.target]

  const prompt = `다음 프로젝트 정보로 "${targetLabel}용 문서"를 HTML로 작성해줘.

[작성 지침]
${targetGuide}

[프로젝트]
- 이름: ${data.sale.name}
- 발주처: ${data.sale.client_org ?? ''}
- 서비스: ${data.sale.service_type ?? ''}

[업무]
${data.tasks.map(t => `- [${t.status}] ${t.title}${t.assignee ? ` (${t.assignee})` : ''}${t.due_date ? ` ~${t.due_date.slice(5)}` : ''}${t.description ? `: ${t.description.slice(0,60)}` : ''}`).join('\n')}

[소통내역]
${data.logs.slice(0, 8).map(l => `- ${l.created_at.slice(0,10)} [${l.log_type}]: ${l.content.slice(0,80)}`).join('\n')}

[노트]
${data.notes ? data.notes.replace(/<[^>]+>/g, ' ').trim().slice(0, 600) : '없음'}

[기존 개요]
${data.overview ? data.overview.replace(/<[^>]+>/g, ' ').trim().slice(0, 400) : '없음'}

HTML 태그만 반환 (마크다운 코드블록 없이). 깔끔하고 읽기 좋게 작성해줘.`

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1200,
    messages: [{ role: 'user', content: prompt }],
  })
  logApiUsage({ model: 'claude-haiku-4-5-20251001', endpoint: 'notes-action', userId: user?.id, inputTokens: message.usage.input_tokens, outputTokens: message.usage.output_tokens }).catch(() => {})

  return (message.content[0] as any).text ?? ''
}
