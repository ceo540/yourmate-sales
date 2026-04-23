import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { readDropboxFile, uploadTextFile } from '@/lib/dropbox'
import { appendAiNote } from '@/lib/brief-generator'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { projectId, note } = await req.json() as { projectId: string; note: string }
  if (!projectId || !note?.trim()) return NextResponse.json({ error: 'projectId, note 필요' }, { status: 400 })

  const admin = createAdminClient()
  const { data: project } = await admin
    .from('projects')
    .select('dropbox_url')
    .eq('id', projectId)
    .single()

  if (!project?.dropbox_url) return NextResponse.json({ error: 'Dropbox 폴더 없음' }, { status: 404 })

  const folderPath = decodeURIComponent(
    (project.dropbox_url as string).replace('https://www.dropbox.com/home', '')
  ).replace(/\/$/, '')

  const existing = await readDropboxFile(`${folderPath}/brief.md`)
  const existingText = 'error' in existing ? '' : existing.text
  const updated = appendAiNote(existingText, note.trim())

  await uploadTextFile({ folderWebUrl: project.dropbox_url, filename: 'brief.md', content: updated })

  return NextResponse.json({ success: true })
}
