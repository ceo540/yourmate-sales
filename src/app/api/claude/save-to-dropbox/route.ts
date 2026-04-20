import { NextRequest, NextResponse } from 'next/server'
import { uploadTextFile } from '@/lib/dropbox'

export async function POST(req: NextRequest) {
  const { dropboxUrl, content, filename } = await req.json() as {
    dropboxUrl: string
    content: string
    filename?: string
  }

  if (!dropboxUrl || !content) {
    return NextResponse.json({ error: '필수 파라미터 누락' }, { status: 400 })
  }

  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const finalFilename = filename || `${today}_claude.md`

  const result = await uploadTextFile({ folderWebUrl: dropboxUrl, filename: finalFilename, content })
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 })
  }

  return NextResponse.json({ ok: true, filename: finalFilename, savedPath: (result as any).savedPath })
}
