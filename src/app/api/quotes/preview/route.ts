// 견적서 미리보기 — POST { entity_id, data: Partial<QuoteData> } → text/html
//
// QuoteCreateModal의 [미리보기] 버튼이 호출. INSERT 안 함. 단순 렌더.

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { renderQuoteHtml, type QuoteData } from '@/lib/quote-templates'

interface PreviewItem {
  name: string
  description?: string
  qty: number
  unit_price: number
  amount?: number
}

interface PreviewBody {
  entity_id: string
  client_org?: string
  client_dept?: string
  client_manager?: string
  project_name?: string
  items: PreviewItem[]
  notes?: string
  vat_included?: boolean
}

export const maxDuration = 15

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '로그인 필요' }, { status: 401 })

  const body = (await req.json().catch(() => null)) as PreviewBody | null
  if (!body || !body.entity_id || !body.items?.length) {
    return NextResponse.json({ error: 'entity_id + items 필수' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: entity } = await admin
    .from('business_entities')
    .select('id, name, short_name, business_number, representative_name, address, bank_name, account_number, account_holder')
    .eq('id', body.entity_id)
    .single()
  if (!entity) return NextResponse.json({ error: '사업자 정보 없음' }, { status: 404 })
  if (!entity.short_name) return NextResponse.json({ error: '사업자 short_name 미설정' }, { status: 400 })

  const items = body.items.map(it => ({
    ...it,
    amount: it.amount ?? Math.round(it.qty * it.unit_price),
  }))
  const itemsTotal = items.reduce((s, it) => s + it.amount, 0)
  const vatIncluded = body.vat_included ?? true
  const supply = vatIncluded ? Math.round(itemsTotal / 1.1) : itemsTotal
  const vat = vatIncluded ? itemsTotal - supply : Math.round(supply * 0.1)
  const total = supply + vat

  const today = new Date()
  const data: QuoteData = {
    quote_number: '미리보기',
    date: `${today.getFullYear()}년 ${today.getMonth() + 1}월 ${today.getDate()}일`,
    client_org: body.client_org || '미지정',
    client_dept: body.client_dept,
    client_manager: body.client_manager,
    project_name: body.project_name || '(프로젝트명 미지정)',
    items,
    subtotal: supply,
    vat,
    total,
    notes: body.notes,
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

  const html = renderQuoteHtml({ entityShortName: entity.short_name, data })
  return new NextResponse(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}
