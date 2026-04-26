import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const maxDuration = 300 // 5분 (긴 녹음 대비)

// 음성 파일 → Whisper API → 텍스트
// 모바일에서 미팅 녹음 업로드 시 사용.
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'OPENAI_API_KEY 없음' }, { status: 500 })

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: '파일 없음' }, { status: 400 })

    // Whisper API 호출
    const whisperForm = new FormData()
    whisperForm.append('file', file)
    whisperForm.append('model', 'whisper-1')
    whisperForm.append('language', 'ko')
    whisperForm.append('response_format', 'text')

    const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}` },
      body: whisperForm,
    })

    if (!res.ok) {
      const err = await res.text()
      return NextResponse.json({ error: `Whisper 실패: ${err.slice(0, 200)}` }, { status: 500 })
    }

    const text = await res.text()
    return NextResponse.json({ text: text.trim() })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
