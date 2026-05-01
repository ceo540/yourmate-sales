// sale ↔ project N:M 헬퍼 (yourmate-spec.md §3.2·§3.3)
// CLAUDE.md FK 조인 금지 패턴 준수 — 별도 쿼리 + JS 수동 조인.

import { createAdminClient } from '@/lib/supabase/admin'
import type { SaleProject, SaleProjectRole } from '@/types'

export type ProjectProfitInput = {
  projectId: string
  // sales (id, revenue) 모음 — 호출자가 미리 로드해서 전달 (수동 조인 패턴)
  sales: { id: string; revenue: number | null }[]
  // sale_costs (sale_id, amount) 모음
  saleCosts: { sale_id: string; amount: number | null }[]
  // sale_projects 매핑
  saleProjects: SaleProject[]
}

export type ProjectProfit = {
  revenue: number       // 회계 매출 (분배 후)
  cost: number          // 외주·외부원가 (분배 후)
  profit: number        // 영업이익
  margin: number        // 이익률 (%)
  breakdown: {
    sale_id: string
    sale_revenue: number
    revenue_share_pct: number
    revenue_attributed: number
    cost_share_pct: number
    cost_attributed: number
  }[]
}

/**
 * 프로젝트 영업이익 = Σ (sale_projects.revenue_share_pct × sale.revenue)
 *                    - Σ (sale_projects.cost_share_pct × sale_costs.amount where sale_id = ...)
 *
 * 1:1 케이스 (revenue_share_pct=100, cost_share_pct=100)에서는 기존 동작과 완전 동일.
 */
export function computeProjectProfit(input: ProjectProfitInput): ProjectProfit {
  const { projectId, sales, saleCosts, saleProjects } = input

  const projectMappings = saleProjects.filter(sp => sp.project_id === projectId)
  const saleMap = new Map(sales.map(s => [s.id, s.revenue ?? 0]))

  let totalRevenue = 0
  let totalCost = 0
  const breakdown: ProjectProfit['breakdown'] = []

  for (const mapping of projectMappings) {
    const saleRevenue = saleMap.get(mapping.sale_id) ?? 0
    const revenueAttributed = saleRevenue * (mapping.revenue_share_pct / 100)

    const saleCostsForSale = saleCosts.filter(c => c.sale_id === mapping.sale_id)
    const totalSaleCost = saleCostsForSale.reduce((s, c) => s + (c.amount ?? 0), 0)
    const costAttributed = totalSaleCost * (mapping.cost_share_pct / 100)

    totalRevenue += revenueAttributed
    totalCost += costAttributed

    breakdown.push({
      sale_id: mapping.sale_id,
      sale_revenue: saleRevenue,
      revenue_share_pct: mapping.revenue_share_pct,
      revenue_attributed: revenueAttributed,
      cost_share_pct: mapping.cost_share_pct,
      cost_attributed: costAttributed,
    })
  }

  const profit = totalRevenue - totalCost
  const margin = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0

  return { revenue: totalRevenue, cost: totalCost, profit, margin, breakdown }
}

/**
 * 프로젝트 ID → 연결된 sale_projects 매핑 조회.
 * 1:1 백필된 기존 데이터(_source_sale_id 기반)도 자동 포함.
 */
export async function getSaleProjectsByProject(projectId: string): Promise<SaleProject[]> {
  const admin = createAdminClient()
  const { data } = await admin.from('sale_projects').select('*').eq('project_id', projectId)
  return (data ?? []) as SaleProject[]
}

/**
 * 계약 ID → 연결된 sale_projects 매핑 조회.
 * 한 계약이 여러 프로젝트에 묶일 수 있음 (1:N).
 */
export async function getSaleProjectsBySale(saleId: string): Promise<SaleProject[]> {
  const admin = createAdminClient()
  const { data } = await admin.from('sale_projects').select('*').eq('sale_id', saleId)
  return (data ?? []) as SaleProject[]
}

/**
 * 균등 분배 비율 제안 — 1 계약이 N 프로젝트에 묶일 때.
 * 100% / N 으로 균등 분배. 사용자가 수정 가능.
 */
export function suggestEqualShare(projectCount: number): number {
  if (projectCount <= 0) return 100
  return Math.round((100 / projectCount) * 100) / 100  // 소수점 2자리
}

export function isValidRole(role: string): role is SaleProjectRole {
  return ['주계약', '부계약', '예산분할', '추가'].includes(role)
}
