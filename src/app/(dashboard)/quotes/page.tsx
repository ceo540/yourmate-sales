import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import QuotesPageClient from './QuotesPageClient'
import type { Quote } from '@/types'

export default async function QuotesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()

  const [
    quotesRes,
    entitiesRes,
    customersRes,
    salesRes,
    projectsRes,
    leadsRes,
  ] = await Promise.all([
    admin.from('quotes').select('*').order('created_at', { ascending: false }).limit(100),
    admin.from('business_entities').select('id, name, short_name').eq('status', 'active').order('name'),
    admin.from('customers').select('id, name').order('name'),
    admin.from('sales').select('id, name, client_org').order('created_at', { ascending: false }).limit(200),
    admin.from('projects').select('id, name, client_org').order('created_at', { ascending: false }).limit(200),
    admin.from('leads').select('id, client_org').order('inflow_date', { ascending: false }).limit(100),
  ])

  const quotes = (quotesRes.data ?? []) as Quote[]
  const entities = (entitiesRes.data ?? []) as Array<{ id: string; name: string; short_name: string | null }>
  const customers = (customersRes.data ?? []) as Array<{ id: string; name: string }>
  const sales = (salesRes.data ?? []) as Array<{ id: string; name: string; client_org: string | null }>
  const projects = (projectsRes.data ?? []) as Array<{ id: string; name: string; client_org: string | null }>
  const leads = (leadsRes.data ?? []) as Array<{ id: string; client_org: string | null }>

  // 수동 조인 (CLAUDE.md: FK 조인 금지)
  const entityMap = new Map(entities.map(e => [e.id, e]))
  const customerMap = new Map(customers.map(c => [c.id, c]))
  const saleMap = new Map(sales.map(s => [s.id, s]))
  const projectMap = new Map(projects.map(p => [p.id, p]))

  const quoteRows = quotes.map(q => ({
    ...q,
    entity_name: entityMap.get(q.entity_id)?.name ?? null,
    entity_short_name: entityMap.get(q.entity_id)?.short_name ?? null,
    sale_name: q.sale_id ? saleMap.get(q.sale_id)?.name ?? null : null,
    project_name_resolved: q.project_id ? projectMap.get(q.project_id)?.name ?? null : null,
    customer_name: q.customer_id ? customerMap.get(q.customer_id)?.name ?? null : null,
  }))

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <QuotesPageClient
        quotes={quoteRows}
        entities={entities}
        customers={customers}
        sales={sales}
        projects={projects}
        leads={leads}
      />
    </div>
  )
}
