import Anthropic from '@anthropic-ai/sdk'
import { logApiUsage } from '@/lib/api-usage'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// 리드 요약 생성/조회.
// - GET-like (force=false 기본): leads.summary_cache 반환. 캐시가 logs보다 옛날이면 새로 생성.
// - force=true: 무조건 재생성 + DB 저장.
export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { lead_id, initial_content, logs, force } = body as {
    lead_id?: string
    initial_content: string | null
    logs: { content: string; log_type: string; contacted_at: string | null }[]
    force?: boolean
  }

  const admin = createAdminClient()

  // 캐시 확인 (force 아닐 때)
  if (lead_id && !force) {
    const { data: lead } = await admin
      .from('leads')
      .select('summary_cache, summary_updated_at')
      .eq('id', lead_id)
      .maybeSingle()
    if (lead?.summary_cache) {
      // 가장 최근 log 시각과 비교 — log가 더 새것이면 무효화
      const latestLogTime = logs
        .map(l => l.contacted_at)
        .filter(Boolean)
        .sort()
        .pop()
      const cacheTime = lead.summary_updated_at
      const stale = latestLogTime && cacheTime && new Date(latestLogTime) > new Date(cacheTime)
      if (!stale) {
        return Response.json({ summary: lead.summary_cache, cached: true })
      }
    }
  }

  // 새로 생성
  const logsText = logs
    .map(l => `- [${l.log_type}] ${l.content} (${l.contacted_at?.slice(0, 10) || '날짜 없음'})`)
    .join('\n')

  const prompt = `너는 yourmate 영업 어시스턴트야. 아래 리드를 분석해서 정확히 아래 형식으로만 답해.

[입력]
최초 유입: ${initial_content || '없음'}

소통 내역 (${logs.length}건):
${logsText || '없음'}

[출력 형식 — 이 형식 그대로, 다른 말 없이]
한줄: [💰 예산 단서] · [🗓 핵심 일정] · [👤 의사결정자] · [🏷 경쟁/단독]
현황: [현재 진행 상황 1~2 문장]
반응: [고객 반응·온도 1 문장]
다음: [다음 액션 1~2 문장]

작성 규칙:
- 정보 없는 항목은 "—"로 표기 (예: 💰 — · 🗓 5/18 · 👤 — · 🏷 —)
- 추측 금지. 데이터에 있는 사실만.
- 짧고 명확하게.`

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 400,
      messages: [{ role: 'user', content: prompt }],
    })
    logApiUsage({
      model: 'claude-sonnet-4-6',
      endpoint: 'lead-summary',
      userId: user.id,
      inputTokens: message.usage.input_tokens,
      outputTokens: message.usage.output_tokens,
    }).catch(() => {})

    const text = ((message.content[0] as { type: string; text?: string }).text ?? '').trim()

    // DB 저장 (lead_id 있을 때)
    if (lead_id && text) {
      await admin.from('leads')
        .update({ summary_cache: text, summary_updated_at: new Date().toISOString() })
        .eq('id', lead_id)
    }

    return Response.json({ summary: text, cached: false })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return Response.json({ summary: null, error: msg }, { status: 500 })
  }
}
