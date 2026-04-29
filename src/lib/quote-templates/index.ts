// 견적서 HTML 템플릿 시스템
//
// 사업자(entity)별로 다른 견적서 포맷을 HTML 템플릿으로 관리.
// 항목/구조는 공공이코퍼레이션 기준 포맷으로 통일.
//
// 사업자 정보(이름/번호/주소/계좌 등)는 {{entity_*}} 치환 변수로 동적 주입.
// business_entities 테이블의 short_name으로 템플릿 매핑.

import { createAdminClient } from '@/lib/supabase/admin'
import { GONGGONG_ECO_TEMPLATE } from './gonggong-eco'
import { JIJI_STUDIO_TEMPLATE } from './jiji-studio'
import { DREAM_BNB_TEMPLATE } from './dream-bnb'

// short_name → 템플릿 문자열
const TEMPLATES_BY_SHORT_NAME: Record<string, string> = {
  '공공이코': GONGGONG_ECO_TEMPLATE,
  '지지': JIJI_STUDIO_TEMPLATE,
  '드림비앤비': DREAM_BNB_TEMPLATE,
}

export const SUPPORTED_ENTITY_SHORT_NAMES = Object.keys(TEMPLATES_BY_SHORT_NAME)

// ── 입력 타입 ──────────────────────────────────────────────────

export interface QuoteItemInput {
  name: string
  description?: string
  qty: number
  unit_price: number
  amount: number
}

export interface QuoteEntityInput {
  name: string
  business_number: string
  representative?: string
  address: string
  bank_name?: string
  account_number?: string
  account_holder?: string
}

export interface QuoteData {
  quote_number: string
  date: string                  // 'YYYY-MM-DD' 또는 'YYYY년 M월 D일' 그대로
  client_org: string
  client_dept?: string
  client_manager?: string
  project_name: string
  items: QuoteItemInput[]
  subtotal: number
  vat: number
  total: number
  notes?: string
  entity: QuoteEntityInput
}

export interface RenderQuoteOptions {
  /** 권장 입력. business_entities.short_name 그대로. */
  entityShortName?: string
  /** entityShortName이 없을 때 fallback. business_entities.id로 short_name 조회 후 렌더 (async 헬퍼 resolveEntityShortName 별도 사용 권장). */
  entityId?: string
  data: QuoteData
}

// ── 메인 렌더 함수 (동기) ──────────────────────────────────────

export function renderQuoteHtml({ entityShortName, data }: RenderQuoteOptions): string {
  if (!entityShortName) {
    throw new Error(
      `renderQuoteHtml: entityShortName 필수. (entityId만 받은 경우 resolveEntityShortName으로 변환 후 호출) ` +
        `사용 가능 short_name: ${SUPPORTED_ENTITY_SHORT_NAMES.join(', ')}`,
    )
  }
  const template = TEMPLATES_BY_SHORT_NAME[entityShortName]
  if (!template) {
    throw new Error(
      `견적서 템플릿 없음: short_name='${entityShortName}'. ` +
        `사용 가능: ${SUPPORTED_ENTITY_SHORT_NAMES.join(', ')}`,
    )
  }
  return renderTemplate(template, flattenForMustache(data))
}

// ── entityId → entityShortName 변환 (async, DB lookup) ─────────

export async function resolveEntityShortName(entityId: string): Promise<string | null> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('business_entities')
    .select('short_name')
    .eq('id', entityId)
    .single()
  return data?.short_name ?? null
}

// ── 데이터 평탄화 + 포맷 ───────────────────────────────────────

function flattenForMustache(data: QuoteData): Record<string, unknown> {
  const fmt = (n: number) => '₩' + n.toLocaleString('ko-KR')
  return {
    quote_number: data.quote_number,
    date: data.date,
    client_org: data.client_org,
    client_dept: data.client_dept ?? '',
    client_manager: data.client_manager ?? '',
    project_name: data.project_name,
    items: data.items.map((it, i) => ({
      index: i + 1,
      name: it.name,
      description: it.description ?? '',
      qty: it.qty,
      qty_fmt: it.qty.toLocaleString('ko-KR'),
      unit_price: it.unit_price,
      unit_price_fmt: fmt(it.unit_price),
      amount: it.amount,
      amount_fmt: fmt(it.amount),
    })),
    subtotal: data.subtotal,
    subtotal_fmt: fmt(data.subtotal),
    vat: data.vat,
    vat_fmt: fmt(data.vat),
    total: data.total,
    total_fmt: fmt(data.total),
    notes: data.notes ?? '',
    notes_block: data.notes ? [{}] : [],   // {{#notes_block}}...{{/notes_block}} 켜고 끄기
    entity_name: data.entity.name,
    entity_business_number: data.entity.business_number,
    entity_representative: data.entity.representative ?? '',
    entity_address: data.entity.address,
    entity_bank_name: data.entity.bank_name ?? '',
    entity_account_number: data.entity.account_number ?? '',
    entity_account_holder: data.entity.account_holder ?? '',
    entity_account: [data.entity.bank_name, data.entity.account_number, data.entity.account_holder]
      .filter(Boolean)
      .join(' '),
  }
}

// ── 미니 Mustache 치환기 ───────────────────────────────────────
//
// 지원 문법:
//   {{key}}                         → data[key]
//   {{#arrKey}}...{{/arrKey}}       → 배열 반복 (item 컨텍스트로 내부 치환)
//   {{#flagKey}}...{{/flagKey}}     → flagKey가 빈 배열이면 스킵, 아니면 1회 출력
//
// 외부 의존성 없음 — Mustache 풀 스펙 X. 위 3가지로 충분.

function renderTemplate(template: string, data: Record<string, unknown>): string {
  // 섹션 블록 처리 (반복 또는 조건)
  let result = template.replace(
    /\{\{#(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g,
    (_, key: string, body: string) => {
      const value = data[key]
      if (!Array.isArray(value) || value.length === 0) return ''
      return value
        .map(item => {
          const ctx = typeof item === 'object' && item !== null ? { ...data, ...item } : data
          return replaceVariables(body, ctx as Record<string, unknown>)
        })
        .join('')
    },
  )
  // 단순 변수 치환
  result = replaceVariables(result, data)
  return result
}

function replaceVariables(template: string, data: Record<string, unknown>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    const v = data[key]
    return v == null ? '' : String(v)
  })
}
