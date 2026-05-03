'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { renderQuoteHtml, type QuoteData, type QuoteItemInput } from '@/lib/quote-templates'
import { insertQuoteWithNumber } from '@/lib/quote-number'
import { uploadTextFile, ensureSubFolderPath } from '@/lib/dropbox'

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
  // 저장 위치: <dropbox_url>/0 행정/견적/{quote_number}_{client_org}.html
  // 서브폴더 없으면 자동 생성. 실패 시 dropbox_url root에 fallback.
  let htmlPath: string | null = null
  let warning: string | undefined
  if (dropboxUrl) {
    const safeOrg = (clientOrg || '미지정').replace(/[\\/:*?"<>|\n\r\t]/g, '_').slice(0, 60)
    const filename = `${quote.quote_number}_${safeOrg}.html`

    let targetWebUrl = dropboxUrl
    let folderHint = ''
    const subResult = await ensureSubFolderPath(dropboxUrl, '0 행정/견적')
    if (subResult.ok) {
      targetWebUrl = subResult.webUrl
    } else {
      folderHint = ` (서브폴더 자동 생성 실패 — root에 저장: ${subResult.error})`
    }

    const uploadResult = await uploadTextFile({
      folderWebUrl: targetWebUrl,
      filename,
      content: html,
    })
    if (uploadResult.ok) {
      htmlPath = uploadResult.savedPath ?? null
      await admin.from('quotes').update({ html_path: htmlPath }).eq('id', quote.id)
      if (folderHint) warning = folderHint.trim()
    } else {
      warning = `Dropbox 저장 실패 — DB만 저장됨: ${uploadResult.error}${folderHint}`
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
  const { requireUser } = await import('@/lib/auth-guard')
  await requireUser()
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

// ── updateQuote ─────────────────────────────────────────────────
// 발행된 견적의 항목·금액·메모 수정. 새 HTML 다시 렌더링·Dropbox 재저장.

export interface UpdateQuoteInput {
  quote_id: string
  project_name?: string
  client_org?: string
  client_dept?: string
  client_manager?: string
  items?: CreateQuoteItem[]   // 전체 교체. 부분 수정은 list 그대로 다시 보냄
  notes?: string
  vat_included?: boolean
  status?: 'draft' | 'sent' | 'accepted' | 'rejected' | 'cancelled'
}

export type UpdateQuoteResult =
  | { ok: true; quote_id: string; quote_number: string; html_path: string | null; warning?: string }
  | { ok: false; error: string }

export async function updateQuote(input: UpdateQuoteInput): Promise<UpdateQuoteResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: '로그인 필요' }

  const admin = createAdminClient()

  // 1. 기존 견적 + 항목 fetch
  const { data: quote, error: qErr } = await admin
    .from('quotes')
    .select('*')
    .eq('id', input.quote_id)
    .single()
  if (qErr || !quote) return { ok: false, error: `견적 없음: ${input.quote_id}` }

  const { data: existingItems } = await admin
    .from('quote_items')
    .select('*')
    .eq('quote_id', input.quote_id)
    .order('sort_order')

  // 2. entity 정보 fetch (HTML 렌더용)
  const { data: entity } = await admin
    .from('business_entities')
    .select('id, name, short_name, business_number, representative_name, address, bank_name, account_number, account_holder')
    .eq('id', quote.entity_id)
    .single()
  if (!entity?.short_name) return { ok: false, error: '사업자 정보 누락' }

  // 3. 변경된 필드 적용
  const newItems = input.items ?? (existingItems ?? []).map((it: any) => ({
    name: it.name,
    description: it.description ?? undefined,
    qty: Number(it.qty),
    unit_price: Number(it.unit_price),
    amount: Number(it.amount),
    category: it.category ?? undefined,
  }))

  const items = newItems.map(it => ({
    ...it,
    amount: it.amount ?? Math.round(it.qty * it.unit_price),
  }))
  const itemsTotal = items.reduce((s, it) => s + it.amount, 0)
  const vatIncluded = input.vat_included ?? quote.vat_included ?? true
  const supply = vatIncluded ? Math.round(itemsTotal / 1.1) : itemsTotal
  const vat = vatIncluded ? itemsTotal - supply : Math.round(supply * 0.1)
  const total = supply + vat

  // 4. 헤더 update
  const headerPatch: Record<string, unknown> = {
    total_amount: total,
    vat_included: vatIncluded,
  }
  if (input.project_name !== undefined) headerPatch.project_name = input.project_name
  if (input.client_dept !== undefined) headerPatch.client_dept = input.client_dept
  if (input.notes !== undefined) headerPatch.notes = input.notes
  if (input.status !== undefined) headerPatch.status = input.status
  await admin.from('quotes').update(headerPatch).eq('id', input.quote_id)

  // 5. 항목 변경됐으면 전체 교체
  if (input.items) {
    await admin.from('quote_items').delete().eq('quote_id', input.quote_id)
    const itemRows = items.map((it, i) => ({
      quote_id: input.quote_id,
      sort_order: i,
      category: it.category ?? null,
      name: it.name,
      description: it.description ?? null,
      qty: it.qty,
      unit_price: it.unit_price,
      amount: it.amount,
    }))
    await admin.from('quote_items').insert(itemRows)
  }

  // 6. HTML 재렌더 + Dropbox 재저장
  const issueDate = new Date(quote.issue_date)
  const dateStr = `${issueDate.getFullYear()}년 ${issueDate.getMonth() + 1}월 ${issueDate.getDate()}일`
  const clientOrg = input.client_org ?? quote.client_dept ?? '미지정'   // 정확히는 client_org를 별 컬럼에 둬야 하지만 quote에 client_org 컬럼 없음 — sale/project에서 가져와야 함
  // 실제 client_org는 quotes 테이블에 컬럼 X. createQuote 흐름 그대로 fetch 필요.
  let realClientOrg = input.client_org ?? ''
  if (!realClientOrg) {
    if (quote.sale_id) {
      const { data: sale } = await admin.from('sales').select('client_org').eq('id', quote.sale_id).maybeSingle()
      realClientOrg = sale?.client_org ?? ''
    } else if (quote.project_id) {
      const { data: project } = await admin.from('projects').select('client_org').eq('id', quote.project_id).maybeSingle()
      realClientOrg = project?.client_org ?? ''
    } else if (quote.lead_id) {
      const { data: lead } = await admin.from('leads').select('client_org').eq('id', quote.lead_id).maybeSingle()
      realClientOrg = lead?.client_org ?? ''
    }
  }

  const quoteData: QuoteData = {
    quote_number: quote.quote_number,
    date: dateStr,
    client_org: realClientOrg || '미지정',
    client_dept: input.client_dept ?? quote.client_dept ?? undefined,
    client_manager: input.client_manager ?? undefined,
    project_name: input.project_name ?? quote.project_name,
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
    notes: input.notes ?? quote.notes ?? undefined,
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
  const html = renderQuoteHtml({ entityShortName: entity.short_name, data: quoteData })

  // 7. Dropbox 재저장 (있을 때만)
  let htmlPath = quote.html_path
  let warning: string | undefined
  let dropboxUrl: string | null = null
  if (quote.sale_id) {
    const { data: sale } = await admin.from('sales').select('dropbox_url').eq('id', quote.sale_id).maybeSingle()
    dropboxUrl = sale?.dropbox_url ?? null
  } else if (quote.project_id) {
    const { data: project } = await admin.from('projects').select('dropbox_url').eq('id', quote.project_id).maybeSingle()
    dropboxUrl = project?.dropbox_url ?? null
  }

  if (dropboxUrl) {
    const safeOrg = (realClientOrg || '미지정').replace(/[\\/:*?"<>|\n\r\t]/g, '_').slice(0, 60)
    const filename = `${quote.quote_number}_${safeOrg}.html`
    const subResult = await ensureSubFolderPath(dropboxUrl, '0 행정/견적')
    const targetWebUrl = subResult.ok ? subResult.webUrl : dropboxUrl
    const uploadResult = await uploadTextFile({
      folderWebUrl: targetWebUrl,
      filename,
      content: html,
    })
    if (uploadResult.ok) {
      htmlPath = uploadResult.savedPath ?? htmlPath
      await admin.from('quotes').update({ html_path: htmlPath }).eq('id', input.quote_id)
    } else {
      warning = `Dropbox 재저장 실패: ${uploadResult.error}`
    }
  }

  revalidatePath('/quotes')
  if (quote.sale_id) revalidatePath(`/sales/${quote.sale_id}`)
  if (quote.project_id) revalidatePath(`/projects/${quote.project_id}`)
  if (quote.lead_id) revalidatePath(`/leads/${quote.lead_id}`)

  return {
    ok: true,
    quote_id: input.quote_id,
    quote_number: quote.quote_number,
    html_path: htmlPath,
    warning,
  }
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
