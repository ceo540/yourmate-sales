import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { listDropboxFolder, readDropboxFile } from '@/lib/dropbox'
import { extractCostsFromPdfTexts } from '@/lib/cost-pdf-extract'

const WEB_BASE = 'https://www.dropbox.com/home'

export async function GET(req: NextRequest) {
  try {
    const projectId = req.nextUrl.searchParams.get('project_id')
    const skipLlm = req.nextUrl.searchParams.get('skip_llm') === '1'
    if (!projectId) return NextResponse.json({ error: 'project_id 필요' }, { status: 400 })

    const admin = createAdminClient()
    const { data: project } = await admin.from('projects').select('id, name, dropbox_url').eq('id', projectId).maybeSingle()
    if (!project?.dropbox_url) return NextResponse.json({ error: 'dropbox_url 없음', project })

    const projectFolderPath = decodeURIComponent(project.dropbox_url.replace(WEB_BASE, '')).replace(/\/$/, '')
    const costFolderPath = `${projectFolderPath}/0 행정/원가`

    const pdfPaths: { name: string; path: string }[] = []
    const seen = new Set<string>()
    async function scan(folderPath: string, prefix: string, depth: number) {
      if (depth > 5) return
      const items = await listDropboxFolder(folderPath).catch(() => [])
      for (const f of items) {
        if (f.type === 'file' && f.name.toLowerCase().endsWith('.pdf')) {
          if (!seen.has(f.path)) {
            seen.add(f.path)
            pdfPaths.push({ name: prefix ? `${prefix}/${f.name}` : f.name, path: f.path })
          }
        } else if (f.type === 'folder') {
          await scan(f.path, prefix ? `${prefix}/${f.name}` : f.name, depth + 1)
        }
      }
    }
    await scan(costFolderPath, '', 0)

    const texts = await Promise.all(
      pdfPaths.map(async p => {
        try {
          const r = await readDropboxFile(p.path)
          if ('error' in r) return { filename: p.name, error: r.error, textLength: 0, textPreview: null }
          return { filename: p.name, error: null, textLength: r.text.length, textPreview: r.text.slice(0, 500), fullText: r.text }
        } catch (e) {
          return { filename: p.name, error: e instanceof Error ? e.message : String(e), textLength: 0, textPreview: null }
        }
      }),
    )

    let llmResult: unknown = null
    if (!skipLlm) {
      const valid = texts
        .filter((t): t is { filename: string; error: null; textLength: number; textPreview: string; fullText: string } =>
          !t.error && 'fullText' in t && !!(t as { fullText?: string }).fullText)
        .map(t => ({ filename: t.filename, text: t.fullText }))
      if (valid.length > 0) {
        try {
          llmResult = await extractCostsFromPdfTexts(valid, {})
        } catch (e) {
          llmResult = { error: e instanceof Error ? e.message : String(e) }
        }
      }
    }

    // fullText 응답에서 제거 (사이즈 줄임)
    const textsClean = texts.map(t => {
      const { ...rest } = t as Record<string, unknown>
      delete rest.fullText
      return rest
    })

    return NextResponse.json({
      project: { id: project.id, name: project.name },
      costFolderPath,
      pdfsScanned: pdfPaths.length,
      pdfPaths,
      texts: textsClean,
      llmResult,
    })
  } catch (e) {
    return NextResponse.json({
      error: 'unhandled',
      message: e instanceof Error ? e.message : String(e),
      stack: e instanceof Error ? e.stack?.slice(0, 1500) : null,
    }, { status: 500 })
  }
}
