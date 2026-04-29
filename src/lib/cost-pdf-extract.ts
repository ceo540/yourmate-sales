import Anthropic from '@anthropic-ai/sdk'
import { logApiUsage } from './api-usage'

export interface ExtractedCostRow {
  item: string
  amount: number
  vendor_name: string | null
  vendor_business_number: string | null
  due_date: string | null   // YYYY-MM-DD
  source_pdf: string
  doc_type: '견적서' | '세금계산서' | '거래명세서' | '이체확인증' | '계약서' | '기타'
}

export interface PdfTextInput {
  filename: string   // 폴더 상대 경로 포함 (예: "2025/유어메이트_견적서.pdf")
  text: string
}

export interface PdfBinaryInput {
  filename: string
  base64: string
}

const MODEL = 'claude-sonnet-4-6'

export interface ExtractStats {
  totalTextLength: number
  perPdfTextLength: { filename: string; length: number }[]
  rawResponseSnippet: string | null
  imagePdfCount: number   // textLength === 0인 PDF 개수
}

// PDF 바이너리(base64)를 Claude에 직접 보내 OCR + 추출 — 이미지 스캔본도 처리 가능
export async function extractCostsFromPdfBinaries(
  pdfs: PdfBinaryInput[],
  opts: { userId?: string | null } = {},
): Promise<{ rows: ExtractedCostRow[]; stats: ExtractStats } | { error: string; stats?: ExtractStats }> {
  const stats: ExtractStats = {
    totalTextLength: 0,   // binary 모드에선 의미 없음. perPdfTextLength.length가 byte 수.
    perPdfTextLength: pdfs.map(p => ({ filename: p.filename, length: Math.round(p.base64.length * 3 / 4) })),
    rawResponseSnippet: null,
    imagePdfCount: 0,
  }
  if (pdfs.length === 0) return { rows: [], stats }

  const today = new Date().toISOString().slice(0, 10)
  const prompt = `오늘: ${today}

첨부된 PDF들은 한 프로젝트의 "원가" 폴더에 있는 문서야.
종류: 견적서·세금계산서·거래명세서·이체확인증·계약서(임대차/외주/용역) 등.

PDF가 이미지 스캔본이라도 OCR로 읽어내. 한국어 문서 다수.

같은 거래(같은 거래처·같은 항목)가 여러 PDF에 중복으로 나올 수 있음. 한 건으로 통합해서 출력해.

통합 규칙:
- 견적서·계약서를 가장 신뢰. 항목명·금액 기본은 여기서.
- 이체확인증·세금계산서가 있으면 due_date(이체일/발행일/지급일)와 실제 금액으로 보강.
- 거래명세서는 항목 분해/금액 검증 보조용.
- 부가세는 PDF에 적힌 총액(공급가액+부가세 합계) 그대로 사용. 별도 분리 X.
- 한 PDF에 여러 항목이 있으면 각각 별 행.
- 계약서에 분할 지급(계약금/중도금/잔금)이 있으면 각 회차를 별 행으로 분리, item에 "OOO 계약금" 식으로 명시.
- 한 건이라도 추출하려고 노력해. 명확한 항목·금액이 있으면 무조건 출력.
- 금액이 본문에 명시 안 됐거나 0원이면 그 행은 제외.

PDF 파일명 매핑 (n번째 첨부 = 아래 n번째 파일명):
${pdfs.map((p, i) => `${i + 1}. ${p.filename}`).join('\n')}

출력: JSON 객체 한 개. 형식:
{
  "rows": [
    {
      "item": "<항목명. 짧고 명확하게.>",
      "amount": <숫자, 원 단위. VAT 포함 총액.>,
      "vendor_name": "<거래처(공급자) 이름. 없으면 null.>",
      "vendor_business_number": "<공급자 사업자번호 (xxx-xx-xxxxx). 없으면 null.>",
      "due_date": "<지급/입금 예정일 또는 실제 이체일 YYYY-MM-DD. 없으면 null.>",
      "source_pdf": "<통합 근거가 된 대표 PDF 파일명. 위 매핑의 파일명 그대로.>",
      "doc_type": "견적서|세금계산서|거래명세서|이체확인증|계약서|기타"
    }
  ]
}

답은 JSON 객체 하나만. 마크다운·설명 절대 금지.`

  const client = new Anthropic()
  const content: Anthropic.ContentBlockParam[] = [
    ...pdfs.map((p): Anthropic.ContentBlockParam => ({
      type: 'document',
      source: { type: 'base64', media_type: 'application/pdf', data: p.base64 },
    })),
    { type: 'text', text: prompt },
  ]

  let raw = ''
  let inputTokens = 0
  let outputTokens = 0

  try {
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 4096,
      messages: [{ role: 'user', content }],
    })
    const textBlock = res.content.find(b => b.type === 'text')
    raw = textBlock && textBlock.type === 'text' ? textBlock.text.trim() : ''
    inputTokens = res.usage.input_tokens
    outputTokens = res.usage.output_tokens
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Claude PDF 호출 실패', stats }
  }

  logApiUsage({
    model: MODEL,
    endpoint: 'cost-pdf-extract-claude',
    userId: opts.userId ?? null,
    inputTokens,
    outputTokens,
  }).catch(() => {})

  stats.rawResponseSnippet = raw.slice(0, 500)

  // Claude 응답에서 JSON만 추출 (앞뒤 설명 있어도 대응)
  let jsonStr = raw
  const fenceMatch = raw.match(/```json\s*([\s\S]*?)```/) || raw.match(/```\s*([\s\S]*?)```/)
  if (fenceMatch) jsonStr = fenceMatch[1].trim()
  const braceStart = jsonStr.indexOf('{')
  const braceEnd = jsonStr.lastIndexOf('}')
  if (braceStart >= 0 && braceEnd > braceStart) jsonStr = jsonStr.slice(braceStart, braceEnd + 1)

  let parsed: { rows?: unknown }
  try {
    parsed = JSON.parse(jsonStr)
  } catch {
    return { error: 'JSON 파싱 실패. Claude 응답: ' + raw.slice(0, 200), stats }
  }
  if (!parsed || !Array.isArray(parsed.rows)) {
    return { error: 'rows 배열 누락. Claude 응답: ' + raw.slice(0, 200), stats }
  }

  const rows: ExtractedCostRow[] = []
  for (const r of parsed.rows as Record<string, unknown>[]) {
    const item = String(r.item ?? '').trim()
    const amount = Number(r.amount ?? 0)
    if (!item || !amount || amount <= 0) continue
    const docTypeRaw = String(r.doc_type ?? '기타')
    const doc_type: ExtractedCostRow['doc_type'] =
      docTypeRaw === '견적서' || docTypeRaw === '세금계산서' || docTypeRaw === '거래명세서' || docTypeRaw === '이체확인증' || docTypeRaw === '계약서'
        ? docTypeRaw : '기타'
    rows.push({
      item,
      amount: Math.round(amount),
      vendor_name: r.vendor_name ? String(r.vendor_name).trim() || null : null,
      vendor_business_number: r.vendor_business_number ? String(r.vendor_business_number).trim() || null : null,
      due_date: r.due_date ? String(r.due_date).slice(0, 10) : null,
      source_pdf: String(r.source_pdf ?? '').trim() || (pdfs[0]?.filename ?? ''),
      doc_type,
    })
  }
  return { rows, stats }
}

// 호환용 래퍼 — debug-cost route만 사용. 실 운영은 extractCostsFromPdfBinaries 사용.
export async function extractCostsFromPdfTexts(
  pdfs: PdfTextInput[],
  _opts: { userId?: string | null } = {},
): Promise<{ rows: ExtractedCostRow[]; stats: ExtractStats } | { error: string; stats?: ExtractStats }> {
  void _opts
  const stats: ExtractStats = {
    totalTextLength: pdfs.reduce((s, p) => s + p.text.length, 0),
    perPdfTextLength: pdfs.map(p => ({ filename: p.filename, length: p.text.length })),
    rawResponseSnippet: null,
    imagePdfCount: pdfs.filter(p => p.text.length === 0).length,
  }
  return { error: 'extractCostsFromPdfTexts deprecated — use extractCostsFromPdfBinaries (Claude PDF, OCR auto)', stats }
}
