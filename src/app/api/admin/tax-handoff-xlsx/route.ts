import { NextRequest, NextResponse } from 'next/server'
import { generateTaxHandoffXlsxAction } from '@/lib/worker-payments-actions'

// 세무사 핸드오프 .xlsx 다운로드
// GET /api/admin/tax-handoff-xlsx?year_month=2026-05&mark_sent=false
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const yearMonth = searchParams.get('year_month')
  const markSent = searchParams.get('mark_sent') === 'true'

  if (!yearMonth || !/^\d{4}-\d{2}$/.test(yearMonth)) {
    return NextResponse.json({ error: 'year_month=YYYY-MM 필요' }, { status: 400 })
  }

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
