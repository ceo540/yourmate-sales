import { NextRequest, NextResponse } from 'next/server'
import { generateTaxHandoffXlsxAction } from '@/lib/worker-payments-actions'

// 세무사 핸드오프 .xlsx 다운로드
// GET /api/admin/tax-handoff-xlsx?year_month=2026-05&mark_sent=false
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const ymRaw = searchParams.get('year_month')
  const markSent = searchParams.get('mark_sent') === 'true'

  // 융통성: "2026-05", "2026-5", "2026/05", "202605" 다 허용. 자동 정규화.
  if (!ymRaw) return NextResponse.json({ error: 'year_month 필수 (예: 2026-05)' }, { status: 400 })
  const m = ymRaw.trim().match(/^(\d{4})[\-\/]?(\d{1,2})$/)
  if (!m) return NextResponse.json({ error: `year_month 형식 인식 X: "${ymRaw}". 예: 2026-05, 2026/05, 2026-5` }, { status: 400 })
  const yearMonth = `${m[1]}-${m[2].padStart(2, '0')}`

  const r = await generateTaxHandoffXlsxAction({ year_month: yearMonth, mark_sent: markSent })
  if ('error' in r) {
    return NextResponse.json({ error: r.error }, { status: 400 })
  }

  const buf = Buffer.from(r.xlsx_base64, 'base64')
  return new NextResponse(buf, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(r.filename)}`,
      'X-Total-Amount': String(r.total),
      'X-Row-Count': String(r.row_count),
      'X-Warnings': encodeURIComponent(r.warnings.join('; ')),
    },
  })
}
