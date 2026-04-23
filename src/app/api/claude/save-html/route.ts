import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { uploadTextFile } from '@/lib/dropbox'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { dropboxUrl, html, filename } = await req.json() as {
    dropboxUrl: string
    html: string
    filename?: string
  }

  if (!dropboxUrl || !html) {
    return NextResponse.json({ error: '필수 파라미터 누락' }, { status: 400 })
  }

  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const finalFilename = filename || `${today}_문서.html`

  const result = await uploadTextFile({ folderWebUrl: dropboxUrl, filename: finalFilename, content: html })
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 })
  }

  return NextResponse.json({ ok: true, filename: finalFilename, savedPath: (result as any).savedPath })
}
