import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const client = new Anthropic()

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { initial_content, service_type, client_org } = await req.json()
  if (!initial_content?.trim()) return NextResponse.json({ keyword: '' })

  const prompt = `다음 문의 내용에서 이 프로젝트를 한눈에 구분할 수 있는 핵심 키워드를 2~4단어로 추출해줘.
규칙:
- 행사명, 프로그램명, 납품 대상, 특징적인 단어 위주로
- 기관명이나 서비스유형은 포함하지 마 (이미 폴더명에 있음)
- 반드시 2~4단어, 한국어만, 다른 설명 없이 키워드만 출력

기관: ${client_org || '미상'}
서비스: ${service_type || '미상'}
문의내용: ${initial_content}

키워드:`

  const message = await client.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 30,
    messages: [{ role: 'user', content: prompt }],
  })

  const keyword = (message.content[0] as { type: string; text: string }).text.trim()
  return NextResponse.json({ keyword })
}
