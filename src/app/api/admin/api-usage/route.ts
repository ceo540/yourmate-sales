import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const months = parseInt(req.nextUrl.searchParams.get('months') ?? '3')
  const since = new Date()
  since.setMonth(since.getMonth() - months)
  const sinceStr = since.toISOString()

  const admin = createAdminClient()

  const { data: rows, error } = await admin
    .from('api_usage')
    .select('model, endpoint, user_id, input_tokens, output_tokens, cost_usd, created_at')
    .gte('created_at', sinceStr)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const data = rows ?? []

  // 월별 집계
  const monthlyMap: Record<string, { cost_usd: number; input_tokens: number; output_tokens: number; requests: number }> = {}
  for (const r of data) {
    const month = r.created_at.slice(0, 7)
    if (!monthlyMap[month]) monthlyMap[month] = { cost_usd: 0, input_tokens: 0, output_tokens: 0, requests: 0 }
    monthlyMap[month].cost_usd += Number(r.cost_usd)
    monthlyMap[month].input_tokens += r.input_tokens
    monthlyMap[month].output_tokens += r.output_tokens
    monthlyMap[month].requests += 1
  }
  const monthly = Object.entries(monthlyMap)
    .map(([month, v]) => ({ month, ...v }))
    .sort((a, b) => b.month.localeCompare(a.month))

  // 엔드포인트별 집계
  const endpointMap: Record<string, { cost_usd: number; requests: number }> = {}
  for (const r of data) {
    if (!endpointMap[r.endpoint]) endpointMap[r.endpoint] = { cost_usd: 0, requests: 0 }
    endpointMap[r.endpoint].cost_usd += Number(r.cost_usd)
    endpointMap[r.endpoint].requests += 1
  }
  const byEndpoint = Object.entries(endpointMap)
    .map(([endpoint, v]) => ({ endpoint, ...v }))
    .sort((a, b) => b.cost_usd - a.cost_usd)

  // 모델별 집계
  const modelMap: Record<string, { cost_usd: number; requests: number }> = {}
  for (const r of data) {
    if (!modelMap[r.model]) modelMap[r.model] = { cost_usd: 0, requests: 0 }
    modelMap[r.model].cost_usd += Number(r.cost_usd)
    modelMap[r.model].requests += 1
  }
  const byModel = Object.entries(modelMap)
    .map(([model, v]) => ({ model, ...v }))
    .sort((a, b) => b.cost_usd - a.cost_usd)

  // 사용자별 집계
  const userMap: Record<string, { cost_usd: number; requests: number }> = {}
  for (const r of data) {
    const key = r.user_id ?? '(시스템)'
    if (!userMap[key]) userMap[key] = { cost_usd: 0, requests: 0 }
    userMap[key].cost_usd += Number(r.cost_usd)
    userMap[key].requests += 1
  }

  // 사용자 이름 조회
  const userIds = Object.keys(userMap).filter(k => k !== '(시스템)')
  const { data: profiles } = userIds.length > 0
    ? await admin.from('profiles').select('id, name').in('id', userIds)
    : { data: [] }
  const nameMap: Record<string, string> = {}
  for (const p of profiles ?? []) nameMap[p.id] = p.name

  const byUser = Object.entries(userMap)
    .map(([uid, v]) => ({ user_id: uid, name: uid === '(시스템)' ? '(시스템)' : (nameMap[uid] ?? uid.slice(0, 8)), ...v }))
    .sort((a, b) => b.cost_usd - a.cost_usd)

  // 전체 합계
  const total = data.reduce(
    (acc, r) => ({
      cost_usd: acc.cost_usd + Number(r.cost_usd),
      requests: acc.requests + 1,
      input_tokens: acc.input_tokens + r.input_tokens,
      output_tokens: acc.output_tokens + r.output_tokens,
    }),
    { cost_usd: 0, requests: 0, input_tokens: 0, output_tokens: 0 }
  )

  return NextResponse.json({ monthly, byEndpoint, byModel, byUser, total })
}
