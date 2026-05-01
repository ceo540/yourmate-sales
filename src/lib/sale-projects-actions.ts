'use server'

// sale ↔ project N:M 매핑 server actions (UI에서 호출)
// 빵빵이 도구(/api/chat·/api/claude/project)와 동일 로직, 'use server' 패턴.
// CLAUDE.md: 'use server' 파일은 async 함수만 export 가능.

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function linkSaleProjectAction(input: {
  sale_id: string
  project_id: string
  role?: string
  revenue_share_pct?: number
  cost_share_pct?: number
  note?: string | null
}): Promise<{ success: true } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '로그인 필요' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('sale_projects')
    .upsert({
      sale_id: input.sale_id,
      project_id: input.project_id,
      role: input.role ?? '주계약',
      revenue_share_pct: input.revenue_share_pct ?? 100,
      cost_share_pct: input.cost_share_pct ?? input.revenue_share_pct ?? 100,
      note: input.note ?? null,
    }, { onConflict: 'sale_id,project_id' })

  if (error) return { error: error.message }
  revalidatePath(`/projects/${input.project_id}`)
  return { success: true }
}

export async function unlinkSaleProjectAction(input: {
  sale_id: string
  project_id: string
}): Promise<{ success: true } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '로그인 필요' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('sale_projects')
    .delete()
    .match({ sale_id: input.sale_id, project_id: input.project_id })

  if (error) return { error: error.message }
  revalidatePath(`/projects/${input.project_id}`)
  return { success: true }
}

export async function updateSaleProjectShareAction(input: {
  sale_id: string
  project_id: string
  revenue_share_pct: number
  cost_share_pct?: number
  role?: string
}): Promise<{ success: true; total_revenue_share_pct: number } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '로그인 필요' }

  const admin = createAdminClient()
  const cost_share = typeof input.cost_share_pct === 'number' ? input.cost_share_pct : input.revenue_share_pct

  const { data: existing } = await admin
    .from('sale_projects')
    .select('id')
    .match({ sale_id: input.sale_id, project_id: input.project_id })
    .maybeSingle()

  if (!existing) {
    const { error } = await admin.from('sale_projects').insert({
      sale_id: input.sale_id,
      project_id: input.project_id,
      role: input.role ?? '주계약',
      revenue_share_pct: input.revenue_share_pct,
      cost_share_pct: cost_share,
    })
    if (error) return { error: error.message }
  } else {
    const updateFields: { revenue_share_pct: number; cost_share_pct: number; role?: string } = {
      revenue_share_pct: input.revenue_share_pct,
      cost_share_pct: cost_share,
    }
    if (input.role) updateFields.role = input.role
    const { error } = await admin
      .from('sale_projects')
      .update(updateFields)
      .match({ sale_id: input.sale_id, project_id: input.project_id })
    if (error) return { error: error.message }
  }

  // 합계 검증 (해당 sale의 모든 매핑)
  const { data: allShares } = await admin
    .from('sale_projects')
    .select('revenue_share_pct')
    .eq('sale_id', input.sale_id)
  const total = (allShares ?? []).reduce((s, x) => s + (x.revenue_share_pct ?? 0), 0)

  revalidatePath(`/projects/${input.project_id}`)
  return { success: true, total_revenue_share_pct: total }
}

export async function searchSalesForLinkAction(
  query: string,
): Promise<{ id: string; name: string; revenue: number | null; project_id: string | null }[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const admin = createAdminClient()
  const { data } = await admin
    .from('sales')
    .select('id, name, revenue, project_id')
    .ilike('name', `%${query}%`)
    .limit(20)

  return ((data ?? []) as { id: string; name: string; revenue: number | null; project_id: string | null }[])
}
