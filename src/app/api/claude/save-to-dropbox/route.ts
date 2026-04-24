import { NextRequest, NextResponse } from 'next/server'
import { uploadTextFile, readDropboxFile } from '@/lib/dropbox'

// 빵빵이와의 대화 내용을 Dropbox에 저장.
// 여러 개의 날짜별 파일이 쌓이는 문제를 해결하기 위해 고정 파일명(ai-협업노트.md)을 쓰고
// 기존 내용이 있으면 날짜 구분선과 함께 append.
// 클라이언트가 filename을 명시하면 그 파일에 append.
export async function POST(req: NextRequest) {
  const { dropboxUrl, content, filename } = await req.json() as {
    dropboxUrl: string
    content: string
    filename?: string
  }

  if (!dropboxUrl || !content) {
    return NextResponse.json({ error: '필수 파라미터 누락' }, { status: 400 })
  }

  const finalFilename = filename || 'ai-협업노트.md'

  // Dropbox 웹 URL에서 폴더 경로 추출 (uploadTextFile이 받는 형식과 동일)
  const WEB_BASE = 'https://www.dropbox.com/home'
  if (!dropboxUrl.startsWith(WEB_BASE)) {
    return NextResponse.json({ error: 'Dropbox URL 형식 오류' }, { status: 400 })
  }
  const folderPath = decodeURIComponent(dropboxUrl.replace(WEB_BASE, ''))
  const filePath = `${folderPath}/${finalFilename}`

  // 기존 파일 읽기 (없으면 빈 문자열)
  const existing = await readDropboxFile(filePath)
  const prevText = 'error' in existing ? '' : existing.text

  const nowKst = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', hour12: false })
  const entry = `\n\n---\n### ${nowKst}\n\n${content.trim()}\n`
  const merged = prevText ? `${prevText.trimEnd()}${entry}` : `# AI 협업 노트\n${entry}`

  const result = await uploadTextFile({ folderWebUrl: dropboxUrl, filename: finalFilename, content: merged })
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 })
  }

  return NextResponse.json({ ok: true, filename: finalFilename, savedPath: (result as { savedPath?: string }).savedPath })
}
