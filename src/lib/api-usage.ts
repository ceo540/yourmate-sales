import { createAdminClient } from '@/lib/supabase/admin'

// 모델별 USD 단가 (per 1M tokens)
const PRICING: Record<string, { input: number; output: number }> = {
  'claude-sonnet-4-6':         { input: 3.00,  output: 15.00 },
  'claude-haiku-4-5-20251001': { input: 0.80,  output: 4.00  },
}

export async function logApiUsage({
  model,
  endpoint,
  userId,
  inputTokens,
  outputTokens,
}: {
  model: string
  endpoint: string
  userId?: string | null
  inputTokens: number
  outputTokens: number
}) {
  const price = PRICING[model] ?? { input: 0, output: 0 }
  const costUsd = (inputTokens * price.input + outputTokens * price.output) / 1_000_000

  const adminClient = createAdminClient()
  await adminClient.from('api_usage').insert({
    model,
    endpoint,
    user_id: userId ?? null,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    cost_usd: costUsd,
  })
}
