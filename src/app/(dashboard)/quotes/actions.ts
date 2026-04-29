'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { renderQuoteHtml, type QuoteData, type QuoteItemInput } from '@/lib/quote-templates'
import { insertQuoteWithNumber } from '@/lib/quote-number'
import { uploadTextFile } from '@/lib/dropbox'

export interface CreateQuoteItem {
  name: string
  description?: string
  qty: number
  unit_price: number
  amount?: number              // 미지정 시 qty * unit_price
  category?: string
}

export interface CreateQuoteInput {
  sale_id?: string
  project_id?: string
  lead_id?: string
  entity_id: string
  customer_id?: string
  client_org?: string          // 미지정 시 sale/project/lead에서 자동 채움
  client_dept?: string
  client_manager?: string
  project_name: string
  items: CreateQuoteItem[]
  notes?: string
  vat_included?: boolean       // default true (입력 단가가 부가세 포함)
}

export type CreateQuoteResult =
  | { ok: true; quote_id: string; quote_number: string; html_path: string | null; warning?: string }
  | { ok: false; error: string }

export async function createQuote(input: CreateQuoteInput): Promise<CreateQuoteResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: '로그인 필요' }
  if (!input.items?.length) return { ok: false, error: '견적 항목이 비어있어' }

  const admin = createAdminClient()

  // 1. entity (사업자) 정보 fetch
  const { data: entity, error: entityErr } = await admin
    .from('business_entities')
    .select('id, name, short_name, business_number, representative_name, address, bank_name, account_number, account_holder')
    .eq('id', input.entity_id)
    .single()
  if (entityErr || !entity) return { ok: false, error: `사업자 정보 없음: ${input.entity_id}` }
  if (!entity.short_name) return { ok: false, error: `사업자 short_name 미설정 (${entity.name}) — 견적서 템플릿 매칭 불가` }

  // 2. client_org + dropbox_url 자동 채움
  let clientOrg = input.client_org ?? ''
  let dropboxUrl: string | null = null

  if (input.sale_id) {
    const { data: sale } = await admin.from('sales').select('client_org, dropbox_url').eq('id', input.sale_id).single()
    if (sale) {
      if (!clientOrg) clientOrg = sale.client_org ?? ''
      dropboxUrl = sale.dropbox_url ?? null
    }
  } else if (input.project_id) {
    const { data: project } = await admin.from('projects').select('client_org, dropbox_url').eq('id', input.project_id).single()
    if (project) {
      if (!clientOrg) clientOrg = project.client_org ?? ''
      dropboxUrl = project.dropbox_url ?? null
    }
  } else if (input.lead_id) {
    const { data: lead } = await admin.from('leads').select('client_org').eq('id', input.lead_id).single()
    if (lead && !clientOrg) clientOrg = lead.client_org ?? ''
  }

  // 3. 금액 계산
  const items = input.items.map(it => ({
    ...it,
    amount: it.amount ?? Math.round(it.qty * it.unit_price),
  }))
  const itemsTotal = items.reduce((s, it) => s + it.amount, 0)
  const vatIncluded = input.vat_included ?? true
  const supply = vatIncluded ? Math.round(itemsTotal / 1.1) : itemsTotal
  const vat = vatIncluded ? itemsTotal - supply : Math.round(supply * 0.1)
  const total = supply + vat

  // 4. quotes INSERT (race-safe)
  let quote
  try {
    quote = await insertQuoteWithNumber({
      sale_id: input.sale_id ?? null,
      project_id: input.project_id ?? null,
      lead_id: input.lead_id ?? null,
      entity_id: input.entity_id,
      customer_id: input.customer_id ?? null,
      client_dept: input.client_dept ?? null,
      project_name: input.project_name,
      status: 'draft',
      total_amount: total,
      vat_included: vatIncluded,
      notes: input.notes ?? null,
      created_by: user.id,
    })
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : '견적 INSERT 실패' }
  }

  // 5. quote_items INSERT
  const itemRows = items.map((it, i) => ({
    quote_id: quote.id,
    sort_order: i,
    category: it.category ?? null,
    name: it.name,
    description: it.description ?? null,
    qty: it.qty,
    unit_price: it.unit_price,
    amount: it.amount,
  }))
  const { error: itemsErr } = await admin.from('quote_items').insert(itemRows)
  if (itemsErr) {
    // 롤백
    await admin.from('quotes').delete().eq('id', quote.id)
    return { ok: false, error: `견적 항목 INSERT 실패: ${itemsErr.message}` }
  }

  // 6. HTML 렌더
  const issueDate = new Date()
  const dateStr = `${issueDate.getFullYear()}년 ${issueDate.getMonth() + 1}월 ${issueDate.getDate()}일`
  const quoteData: QuoteData = {
    quote_number: quote.quote_number,
    date: dateStr,
    client_org: clientOrg || '미지정',
    client_dept: input.client_dept,
    client_manager: input.client_manager,
    project_name: input.project_name,
    items: items.map<QuoteItemInput>(it => ({
      name: it.name,
      description: it.description,
      qty: it.qty,
      unit_price: it.unit_price,
      amount: it.amount,
    })),
    subtotal: supply,
    vat,
    total,
    notes: input.notes,
    entity: {
      name: entity.name,
      business_number: entity.business_number ?? '',
      representative: entity.representative_name ?? undefined,
      address: entity.address ?? '',
      bank_name: entity.bank_name ?? undefined,
      account_number: entity.account_number ?? undefined,
      account_holder: entity.account_holder ?? undefined,
    },
  }
  let html: string
  try {
    html = renderQuoteHtml({ entityShortName: entity.short_name, data: quoteData })
  } catch (e) {
    return { ok: false, error: `HTML 렌더 실패: ${e instanceof Error ? e.message : ''}` }
  }

  // 7. Dropbox 업로드 (있을 때만)
  let htmlPath: string | null = null
  let warning: string | undefined
  if (dropboxUrl) {
    const safeOrg = (clientOrg || '미지정').replace(/[\\/:*?"<>|\n\r\t]/g, '_').slice(0, 60)
    const filename = `${quote.quote_number}_${safeOrg}.html`
    const uploadResult = await uploadTextFile({
      folderWebUrl: dropboxUrl,
      filename,
      content: html,
    })
    if (uploadResult.ok) {
      htmlPath = uploadResult.savedPath ?? null
      await admin.from('quotes').update({ html_path: htmlPath }).eq('id', quote.id)
    } else {
      warning = `Dropbox 저장 실패 — DB만 저장됨: ${uploadResult.error}`
    }
  } else {
    warning = 'Dropbox 저장 스킵 — sale/project dropbox_url 없음. DB만 저장됨.'
  }

  revalidatePath('/quotes')
  if (input.sale_id) revalidatePath(`/sales/${input.sale_id}`)
  if (input.project_id) revalidatePath(`/projects/${input.project_id}`)
  if (input.lead_id) revalidatePath(`/leads/${input.lead_id}`)

  return {
    ok: true,
    quote_id: quote.id,
    quote_number: quote.quote_number,
    html_path: htmlPath,
    warning,
  }
}

// ── listQuotes ──────────────────────────────────────────────────

export interface ListQuotesFilter {
  sale_id?: string
  project_id?: string
  lead_id?: string
  customer_id?: string
  entity_id?: string
  status?: string
  limit?: number
}

export async function listQuotes(filter: ListQuotesFilter = {}) {
  const admin = createAdminClient()
  let query = admin.from('quotes').select('*').order('created_at', { ascending: false })
  if (filter.sale_id) query = query.eq('sale_id', filter.sale_id)
  if (filter.project_id) query = query.eq('project_id', filter.project_id)
  if (filter.lead_id) query = query.eq('lead_id', filter.lead_id)
  if (filter.customer_id) query = query.eq('customer_id', filter.customer_id)
  if (filter.entity_id) query = query.eq('entity_id', filter.entity_id)
  if (filter.status) query = query.eq('status', filter.status)
  query = query.limit(filter.limit ?? 100)
  const { data, error } = await query
  if (error) throw new Error(`견적 목록 조회 실패: ${error.message}`)
  return data ?? []
}

// ── deleteQuote ─────────────────────────────────────────────────

export async function deleteQuote(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: '로그인 필요' }

  const admin = createAdminClient()
  // 연결 정보 미리 조회 (revalidate용)
  const { data: q } = await admin.from('quotes').select('sale_id, project_id, lead_id').eq('id', id).single()

  const { error } = await admin.from('quotes').delete().eq('id', id)
  if (error) return { ok: false, error: `삭제 실패: ${error.message}` }

  revalidatePath('/quotes')
  if (q?.sale_id) revalidatePath(`/sales/${q.sale_id}`)
  if (q?.project_id) revalidatePath(`/projects/${q.project_id}`)
  if (q?.lead_id) revalidatePath(`/leads/${q.lead_id}`)
  return { ok: true }
}
