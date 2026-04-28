import OpenAI from 'openai'
import { logApiUsage } from './api-usage'

export interface ExtractedCostRow {
  item: string
  amount: number
  vendor_name: string | null
  vendor_business_number: string | null
  due_date: string | null   // YYYY-MM-DD
  source_pdf: string
  doc_type: '견적서' | '세금계산서' | '거래명세서' | '이체확인증' | '기타'
}

export interface PdfTextInput {
  filename: string   // 폴더 상대 경로 포함 (예: "2025/유어메이트_견적서.pdf")
  text: string
}

const MODEL = 'gpt-4o'

export async function extractCostsFromPdfTexts(
  pdfs: PdfTextInput[],
  opts: { userId?: string | null } = {},
): Promise<{ rows: ExtractedCostRow[] } | { error: string }> {
  if (pdfs.length === 0) return { rows: [] }

  const today = new Date().toISOString().slice(0, 10)

  const corpus = pdfs
    .map(p => `[FILE: ${p.filename}]\n${p.text}\n[/FILE]`)
    .join('\n\n')

  const prompt = `오늘: ${today}

아래는 한 프로젝트의 "원가" 폴더에 있는 PDF들에서 추출한 텍스트야.
종류: 견적서·세금계산서·거래명세서·이체확인증 등이 섞여 있어.

같은 거래(같은 거래처·같은 항목)가 여러 PDF에 중복으로 나올 수 있음. 한 건으로 통합해서 출력해.

통합 규칙:
- 견적서를 가장 신뢰. 항목명·금액 기본은 견적서에서.
- 이체확인증·세금계산서가 있으면 due_date(이체일/발행일/지급일)와 실제 금액으로 보강.
- 거래명세서는 항목 분해/금액 검증 보조용.
- 부가세는 PDF에 적힌 총액(공급가액+부가세 합계) 그대로 사용. 별도 분리 X.
- 한 PDF에 여러 항목이 있으면 각각 별 행. (한 줄짜리 단일 거래 PDF면 한 행.)
- 신뢰도 낮은 행(금액·항목 불명확)은 제외.

출력: JSON 객체 한 개. 형식:
{
  "rows": [
    {
      "item": "<항목명. 짧고 명확하게.>",
      "amount": <숫자, 원 단위. VAT 포함 총액.>,
      "vendor_name": "<거래처(공급자) 이름. 없으면 null.>",
      "vendor_business_number": "<공급자 사업자번호 (xxx-xx-xxxxx). 없으면 null.>",
      "due_date": "<지급/입금 예정일 또는 실제 이체일 YYYY-MM-DD. 없으면 null.>",
      "source_pdf": "<통합 근거가 된 대표 PDF 파일명. 입력 [FILE:] 값 그대로.>",
      "doc_type": "견적서|세금계산서|거래명세서|이체확인증|기타"
    }
  ]
}

PDF 텍스트:

${corpus}

답은 JSON 객체 하나만. 마크다운·설명 절대 금지.`

  const client = new OpenAI()

  let raw = ''
  let inputTokens = 0
  let outputTokens = 0

  try {
    const res = await client.chat.completions.create({
      model: MODEL,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0,
    })
    raw = res.choices[0]?.message?.content?.trim() ?? ''
    inputTokens = res.usage?.prompt_tokens ?? 0
    outputTokens = res.usage?.completion_tokens ?? 0
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'LLM 호출 실패' }
  }

  logApiUsage({
    model: MODEL,
    endpoint: 'cost-pdf-extract',
    userId: opts.userId ?? null,
    inputTokens,
    outputTokens,
  }).catch(() => {})

  let parsed: { rows?: unknown }
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { error: 'JSON 파싱 실패: ' + raw.slice(0, 200) }
  }

  if (!parsed || !Array.isArray(parsed.rows)) {
    return { error: 'rows 배열 누락' }
  }

  const rows: ExtractedCostRow[] = []
  for (const r of parsed.rows as Record<string, unknown>[]) {
    const item = String(r.item ?? '').trim()
    const amount = Number(r.amount ?? 0)
    if (!item || !amount || amount <= 0) continue
    const docTypeRaw = String(r.doc_type ?? '기타')
    const doc_type: ExtractedCostRow['doc_type'] =
      docTypeRaw === '견적서' || docTypeRaw === '세금계산서' || docTypeRaw === '거래명세서' || docTypeRaw === '이체확인증'
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

  return { rows }
}
