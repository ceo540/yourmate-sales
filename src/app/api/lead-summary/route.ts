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

  const prompt = `영업 어시스턴트야. 아래 리드의 소통 내역을 분석해서 아래 형식으로만 답해. 각 항목은 한 문장씩, 없으면 "없음"으로.

최초 유입 내용: ${initial_content || '없음'}

소통 내역 (${logs.length}건):
${logsText}

형식 (이 형식 그대로, 다른 말 없이):
현황: [현재 진행 상황 한 문장]
반응: [고객 반응 또는 온도 한 문장]
다음: [다음에 해야 할 액션 한 문장]`

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
