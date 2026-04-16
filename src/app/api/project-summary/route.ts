import Anthropic from '@anthropic-ai/sdk'
import { logApiUsage } from '@/lib/api-usage'
import { createClient } from '@/lib/supabase/server'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { sale, tasks, logs } = await req.json()

  const pendingTasks = tasks.filter((t: any) => t.status !== '완료' && t.status !== '보류')
  const urgentTasks = pendingTasks.filter((t: any) => t.priority === '긴급' || t.priority === '높음')

  const prompt = `
당신은 업무 관리 어시스턴트입니다. 아래 프로젝트 현황을 분석해 한국어로 간결하게 요약해주세요.

프로젝트명: ${sale.name}
발주처: ${sale.client_org ?? '-'}
수금 상태: ${sale.payment_status ?? '계약전'}
매출: ${sale.revenue ? Math.round(sale.revenue / 10000) + '만원' : '-'}

업무 현황 (총 ${tasks.length}건):
${tasks.map((t: any) => `- [${t.status}] ${t.title} / 담당: ${t.assignee?.name ?? '-'} / 마감: ${t.due_date ?? '-'} / 중요도: ${t.priority ?? '보통'}`).join('\n')}

최근 소통 내역:
${logs.slice(0, 5).map((l: any) => `- [${l.log_type}] ${l.content} (${l.created_at?.slice(0,10)})`).join('\n') || '없음'}

아래 JSON 형식으로 응답하세요:
{
  "summary": "2-3문장으로 현재 프로젝트 전반 상태 요약",
  "status": "진행중|완료|주의필요|지연위험" 중 하나,
  "recommendations": [
    { "assignee": "담당자명 또는 '팀 전체'", "action": "지금 당장 해야 할 일 (1-2문장, 구체적으로)" },
    ...최대 3개
  ],
  "nextMilestone": "다음 중요 마일스톤 (1문장)"
}
JSON만 응답하세요. 다른 텍스트 없이.
`

  try {
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      messages: [{ role: 'user', content: prompt }],
    })
    logApiUsage({ model: 'claude-haiku-4-5-20251001', endpoint: 'project-summary', userId: null, inputTokens: message.usage.input_tokens, outputTokens: message.usage.output_tokens }).catch(() => {})

    const text = (message.content[0] as any).text?.trim() ?? ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('No JSON in response')
    const result = JSON.parse(jsonMatch[0])
    return Response.json(result)
  } catch {
    return Response.json({
      summary: '프로젝트 요약을 불러오는 중 오류가 발생했습니다.',
      status: '진행중',
      recommendations: [],
      nextMilestone: null,
    })
  }
}
