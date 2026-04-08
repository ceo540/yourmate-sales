import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export interface QuoteItem {
  category?: string   // 002크리에이티브 구분 (운영비/디자인/인쇄...)
  name: string        // 품목명
  detail?: string     // 세부내용
  qty: number         // 수량
  months?: number     // 개월 (렌탈 전용)
  unit?: string       // 단위 (002크리에이티브 전용)
  price: number       // 단가
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { leadId, quoteType, clientName, issueDate, items, contactPerson } = body as {
    leadId: string
    quoteType: '렌탈' | '002크리에이티브'
    clientName: string
    issueDate: string
    items: QuoteItem[]
    contactPerson?: string
  }

  const scriptUrl = quoteType === '렌탈'
    ? process.env.RENTAL_QUOTE_SCRIPT_URL
    : process.env.CREATIVE_QUOTE_SCRIPT_URL

  if (!scriptUrl) {
    return NextResponse.json({ error: '견적서 스크립트가 설정되지 않았습니다. 관리자에게 문의하세요.' }, { status: 500 })
  }

  // Google Apps Script Web App 호출 (redirect 자동 follow, 60초 타임아웃)
  let gsResult: { success: boolean; url?: string; tabName?: string; error?: string }
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 60_000)
    const gsRes = await fetch(scriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' }, // Apps Script는 application/json이면 preflight 발생
      body: JSON.stringify({ clientName, issueDate, items, contactPerson }),
      redirect: 'follow',
      signal: controller.signal,
    })
    clearTimeout(timer)
    gsResult = await gsRes.json()
  } catch (e: any) {
    const msg = e?.name === 'AbortError' ? '구글 시트 응답 시간 초과 (60초). 잠시 후 다시 시도해주세요.' : '구글 시트 연결 실패: ' + (e?.message ?? String(e))
    return NextResponse.json({ error: msg }, { status: 502 })
  }

  if (!gsResult.success) {
    return NextResponse.json({ error: gsResult.error ?? '알 수 없는 오류' }, { status: 500 })
  }

  // 리드에 견적서 URL 저장
  if (leadId && gsResult.url) {
    await supabase.from('leads').update({ quotation_url: gsResult.url }).eq('id', leadId)
  }

  return NextResponse.json({ url: gsResult.url, tabName: gsResult.tabName })
}
