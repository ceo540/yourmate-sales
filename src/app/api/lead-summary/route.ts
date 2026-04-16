import Anthropic from '@anthropic-ai/sdk'
import { logApiUsage } from '@/lib/api-usage'
import { createClient } from '@/lib/supabase/server'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { initial_content, logs } = await req.json()

  const logsText = (logs as any[])
    .map((l: any) => `- [${l.log_type}] ${l.content} (${l.contacted_at?.slice(0, 10) || '날짜 없음'})`)
    .join('\n')

  const prompt = `당신은 영업 어시스턴트입니다. 아래 리드(잠재고객)의 소통 내역을 분석해 현재 상황을 2~3문장으로 간결하게 한국어로 요약해주세요.

최초 유입 내용: ${initial_content || '없음'}

소통 내역 (${logs.length}건):
${logsText}

현재 상황, 고객 반응, 다음 단계(있다면)를 포함해 요약하세요. JSON 없이 텍스트만 응답하세요.`

  try {
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 256,
      messages: [{ role: 'user', content: prompt }],
    })
    logApiUsage({
      model: 'claude-haiku-4-5-20251001',
      endpoint: 'lead-summary',
      userId: null,
      inputTokens: message.usage.input_tokens,
      outputTokens: message.usage.output_tokens,
    }).catch(() => {})

    const text = (message.content[0] as any).text?.trim() ?? ''
    return Response.json({ summary: text })
  } catch {
    return Response.json({ summary: null }, { status: 500 })
  }
}
