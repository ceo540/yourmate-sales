import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import OpenAI from 'openai'

// 렌탈 단가표 (구글 시트 품목 탭 기준)
const RENTAL_PRICE_GUIDE = `
[유어메이트 렌탈 주요 단가표]
- 젬베 소형 단기: 20,000원/월
- 젬베 10 (JB) 단기: 30,000원/월
- 젬베 12 (JB) 단기: 35,000원/월
- 카혼 소형 단기: 20,000원/월
- 카혼 중형 단기: 25,000원/월
- 우쿨렐레 소프라노 단기: 15,000원/월
- 기타(어쿠스틱) 단기: 20,000원/월
- 봉고 단기: 25,000원/월
- 실로폰/메탈로폰 단기: 30,000원/월
- 핸드팬/탱드럼 단기: 50,000원/월
- 운송비: 별도 협의
- 보증금: 렌탈금액의 10~30%
`

// 002크리에이티브 주요 단가표
const CREATIVE_PRICE_GUIDE = `
[002크리에이티브 주요 단가표]
- X배너 (거치대 포함): 63,000원
- X배너 (거치대 미포함): 32,000원
- 몽골텐트 3×3: 150,000원
- 캐노피 3×3: 50,000원
- 듀라테이블 1800×750: 13,000원
- 팔걸이의자: 5,000원
- 접의식의자: 8,000원
- POP스탠드 A3: 30,000원
- 아트키움 주강사(3급) 2차시: 150,000원
- 아트키움 운영관리비: 800,000원
- 현수막 제작: 협의
- 행사 운영 인력: 협의
`

let _client: OpenAI | null = null
const getClient = () => {
  if (!_client) _client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  return _client
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { leadId, quoteType } = await req.json()

  // 리드 정보 가져오기
  const { data: lead } = await supabase
    .from('leads')
    .select('client_org, contact_name, service_type, initial_content, notes')
    .eq('id', leadId)
    .single()

  if (!lead) return NextResponse.json({ error: '리드를 찾을 수 없습니다' }, { status: 404 })

  const priceGuide = quoteType === '렌탈' ? RENTAL_PRICE_GUIDE : CREATIVE_PRICE_GUIDE
  const isRental = quoteType === '렌탈'

  const prompt = `당신은 견적서 작성 전문가입니다. 아래 리드 정보와 단가표를 보고 견적서 품목 초안을 JSON으로 작성하세요.

[리드 정보]
- 기관명: ${lead.client_org || ''}
- 서비스 유형: ${lead.service_type || ''}
- 최초 유입 내용: ${lead.initial_content || '없음'}
- 메모: ${lead.notes || '없음'}

${priceGuide}

[출력 형식 - JSON 배열만 출력, 다른 텍스트 없이]
${isRental ? `[
  { "name": "품목명", "detail": "세부내용(선택)", "qty": 수량, "months": 개월수, "price": 단가 }
]` : `[
  { "category": "구분(운영비/디자인/인쇄 및 제작/대여 등)", "name": "품명", "detail": "세부내역(선택)", "qty": 수량, "unit": "단위(식/개/명 등)", "price": 단가 }
]`}

규칙:
- 유입 내용 기반으로 가장 적합한 품목을 3~6개 제안
- 단가는 단가표 기준, 수량/개월은 합리적으로 추정
- 정보가 부족하면 일반적인 견적 기준으로 작성
- JSON 배열만 출력 (마크다운 코드블록 없이)`

  const message = await getClient().chat.completions.create({
    model: 'gpt-4o-mini',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = message.choices[0].message.content?.trim() ?? ''

  let items: object[]
  try {
    // 혹시 코드블록이 있으면 제거
    const cleaned = text.replace(/```json?\n?/g, '').replace(/```/g, '').trim()
    items = JSON.parse(cleaned)
  } catch {
    return NextResponse.json({ error: 'AI 응답 파싱 실패: ' + text }, { status: 500 })
  }

  return NextResponse.json({ items })
}
