// 자동 업무표 (yourmate-spec.md §5.4.2)
// 직원별 일일/주간 활동 자동 추출. activity_logs 기반.

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { isAdminOrManager } from '@/lib/permissions'
import ActivityClient from './ActivityClient'

export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ actor?: string; from?: string; to?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const params = await searchParams
  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('id, role, name').eq('id', user.id).single()
  const isAdmin = isAdminOrManager(profile?.role)
  if (!isAdmin) {
    return <div className="p-8 text-gray-500">관리자만 접근 가능 (자동 업무표는 검증 단계라 admin 한정)</div>
  }

  // 기간 — 기본 최근 7일
  const today = new Date()
  const weekAgo = new Date(today.getTime() - 6 * 86400000)
  const fromDate = params.from || weekAgo.toISOString().slice(0, 10)
  const toDate = params.to || today.toISOString().slice(0, 10)

  // 대상 직원 — admin은 전체, member는 본인만
  const actorId = isAdmin ? (params.actor || user.id) : user.id

  const { data: profiles } = await admin
    .from('profiles')
    .select('id, name')
    .order('name')

  const fromIso = `${fromDate}T00:00:00Z`
  const toIso = `${toDate}T23:59:59Z`

  const { data: logs } = await admin
    .from('activity_logs')
    .select('id, source, action, ref_type, ref_id, summary, occurred_at')
    .eq('actor_id', actorId)
    .gte('occurred_at', fromIso)
    .lte('occurred_at', toIso)
    .order('occurred_at', { ascending: true })
    .limit(500)

  // ref_id 매핑 — 프로젝트·리드·계약 이름 조회
  const refIds = {
    project: [...new Set((logs ?? []).filter(l => l.ref_type === 'project' && l.ref_id).map(l => l.ref_id as string))],
    lead: [...new Set((logs ?? []).filter(l => l.ref_type === 'lead' && l.ref_id).map(l => l.ref_id as string))],
    sale: [...new Set((logs ?? []).filter(l => l.ref_type === 'sale' && l.ref_id).map(l => l.ref_id as string))],
  }

  const [{ data: prjs }, { data: lds }, { data: sls }] = await Promise.all([
    refIds.project.length > 0
      ? admin.from('projects').select('id, name, project_number').in('id', refIds.project)
      : Promise.resolve({ data: [] }),
    refIds.lead.length > 0
      ? admin.from('leads').select('id, lead_id, project_name, client_org').in('id', refIds.lead)
      : Promise.resolve({ data: [] }),
    refIds.sale.length > 0
      ? admin.from('sales').select('id, name').in('id', refIds.sale)
      : Promise.resolve({ data: [] }),
  ])

  const refNameMap = new Map<string, string>()
  for (const p of (prjs ?? [])) refNameMap.set(p.id, p.project_number ? `${p.project_number} ${p.name}` : p.name)
  for (const l of (lds ?? [])) refNameMap.set(l.id, l.project_name || l.client_org || l.lead_id || '리드')
  for (const s of (sls ?? [])) refNameMap.set(s.id, s.name)

  return (
    <ActivityClient
      logs={(logs ?? []).map(l => ({
        id: l.id,
        source: l.source,
        action: l.action,
        ref_type: l.ref_type,
        ref_id: l.ref_id,
        ref_name: l.ref_id ? (refNameMap.get(l.ref_id) ?? null) : null,
        summary: l.summary,
        occurred_at: l.occurred_at,
      }))}
      actorId={actorId}
      actorName={(profiles ?? []).find(p => p.id === actorId)?.name ?? '?'}
      fromDate={fromDate}
      toDate={toDate}
      profiles={(profiles ?? []).map(p => ({ id: p.id, name: p.name }))}
      isAdmin={isAdmin}
    />
  )
}
