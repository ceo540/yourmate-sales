import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { YOURMATE_CONTEXT, getServiceContext } from '@/lib/service-contexts'
import { listDropboxFolder, readDropboxFile } from '@/lib/dropbox'
import { revalidatePath } from 'next/cache'

const client = new Anthropic()
const WEB_BASE = 'https://www.dropbox.com/home'

const LEAD_STATUSES = ['유입', '회신대기', '견적발송', '조율중', '진행중', '완료', '취소']
const CONTRACT_STAGES = ['계약', '착수', '선금', '중도금', '완수', '계산서발행', '잔금']
const LOG_TYPES = ['통화', '이메일', '방문', '내부회의', '메모', '기타']

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { leadId, saleId, projectId, dropboxUrl, messages } = await req.json() as {
    leadId?: string
    saleId?: string
    projectId?: string
    dropboxUrl?: string | null
    messages: { role: 'user' | 'assistant'; content: string }[]
  }

  const admin = createAdminClient()
  let projectContext = ''
  let serviceType: string | null = null

  if (leadId) {
    const { data: lead } = await admin.from('leads').select('*').eq('id', leadId).single()
    if (lead) {
      serviceType = lead.service_type as string | null
      let assigneeName: string | null = null
      if (lead.assignee_id) {
        const { data: profile } = await admin.from('profiles').select('name').eq('id', lead.assignee_id).single()
        assigneeName = profile?.name ?? null
      }
      const { data: logs } = await admin
        .from('project_logs').select('content, log_type, contacted_at')
        .eq('lead_id', leadId).order('contacted_at', { ascending: false }).limit(3)

      projectContext = `## 현재 리드 정보
- 리드 ID: ${lead.lead_id || ''}
- 프로젝트명: ${lead.project_name || '(미입력)'}
- 고객 기관: ${lead.client_org || '(미입력)'}
- 담당자: ${lead.contact_name || '(미입력)'} / ${lead.phone || ''} / ${lead.email || ''}
- 서비스: ${lead.service_type || '(미지정)'}
- 담당 팀원: ${assigneeName || '(미배정)'}
- 현재 단계: ${lead.status || '유입'}
- 유입 경로: ${lead.inflow_source || ''} / 채널: ${lead.channel || ''}
- 유입일: ${lead.inflow_date || ''}
- 최초 문의: ${lead.initial_content || '(없음)'}
- 메모: ${lead.notes || '(없음)'}
${logs && logs.length > 0 ? `\n## 최근 소통내역\n${logs.map(l => `- [${l.log_type}] ${l.contacted_at?.slice(0, 10)}: ${l.content}`).join('\n')}` : ''}`
    }
  } else if (saleId) {
    const { data: sale } = await admin.from('sales').select('*').eq('id', saleId).single()
    if (sale) {
      serviceType = sale.service_type as string | null
      let assigneeName: string | null = null
      if (sale.assignee_id) {
        const { data: profile } = await admin.from('profiles').select('name').eq('id', sale.assignee_id).single()
        assigneeName = profile?.name ?? null
      }
      const { data: tasks } = await admin
        .from('tasks').select('title, status, due_date')
        .eq('project_id', saleId).neq('status', '완료').limit(5)
      const { data: logs } = await admin
        .from('project_logs').select('content, log_type, contacted_at')
        .eq('sale_id', saleId).order('contacted_at', { ascending: false }).limit(3)

      projectContext = `## 현재 매출/계약 정보
- 프로젝트명: ${sale.name || ''}
- 고객 기관: ${sale.client_org || '(미입력)'}
- 서비스: ${sale.service_type || '(미지정)'}
- 담당 팀원: ${assigneeName || '(미배정)'}
- 계약 단계: ${sale.contract_stage || ''}
- 매출: ${sale.revenue ? sale.revenue.toLocaleString() + '원' : '(미입력)'}
- 유입일: ${sale.inflow_date || ''}
- 메모: ${sale.memo || '(없음)'}
${tasks && tasks.length > 0 ? `\n## 미완료 태스크\n${tasks.map(t => `- [${t.status}] ${t.title}${t.due_date ? ' (마감: ' + t.due_date + ')' : ''}`).join('\n')}` : ''}
${logs && logs.length > 0 ? `\n## 최근 소통내역\n${logs.map(l => `- [${l.log_type}] ${l.contacted_at?.slice(0, 10)}: ${l.content}`).join('\n')}` : ''}`
    }
  } else if (projectId) {
    const { data: project } = await admin.from('projects').select('*').eq('id', projectId).single()
    if (project) {
      serviceType = project.service_type as string | null
      let pmName: string | null = null
      if (project.pm_id) {
        const { data: profile } = await admin.from('profiles').select('name').eq('id', project.pm_id).single()
        pmName = profile?.name ?? null
      }
      const { data: linkedSales } = await admin
        .from('sales').select('id, name, contract_stage, revenue, client_org')
        .eq('project_id', projectId)
      const { data: logs } = await admin
        .from('project_logs').select('content, log_type, contacted_at')
        .eq('project_id', projectId).order('contacted_at', { ascending: false }).limit(3)

      projectContext = `## 현재 프로젝트 정보
- 프로젝트명: ${project.name || '(미입력)'}
- 서비스: ${project.service_type || '(미지정)'}
- 사업부: ${project.department || '(미지정)'}
- 상태: ${project.status || '진행중'}
- PM: ${pmName || '(미배정)'}
- Dropbox 폴더: ${project.dropbox_url ? '연결됨 (list_project_files로 조회 가능)' : '(없음)'}
- 메모: ${project.memo || '(없음)'}
${linkedSales && linkedSales.length > 0 ? `\n## 연결된 계약 (${linkedSales.length}건)\n${linkedSales.map(s => `- ${s.name} · 단계: ${s.contract_stage ?? '-'} · 매출: ${s.revenue ? s.revenue.toLocaleString() + '원' : '-'}${s.client_org ? ' · 고객: ' + s.client_org : ''}`).join('\n')}` : ''}
${logs && logs.length > 0 ? `\n## 최근 소통내역\n${logs.map(l => `- [${l.log_type}] ${l.contacted_at?.slice(0, 10)}: ${l.content}`).join('\n')}` : ''}`
    }
  }

  const serviceContext = getServiceContext(serviceType)

  // 이전 저장된 claude 작업 파일 읽기 (최근 3개)
  let savedWorkContext = ''
  if (dropboxUrl?.startsWith(WEB_BASE)) {
    try {
      const folderPath = decodeURIComponent(dropboxUrl.replace(WEB_BASE, ''))
      const files = await listDropboxFolder(folderPath)
      const claudeFiles = files
        .filter(f => f.type === 'file' && f.name.endsWith('_claude.md'))
        .sort((a, b) => b.name.localeCompare(a.name))
        .slice(0, 3)
      const fileContents = await Promise.all(
        claudeFiles.map(async f => {
          const result = await readDropboxFile(f.path)
          return 'error' in result ? null : `### ${f.name}\n${result.text}`
        })
      )
      const valid = fileContents.filter(Boolean)
      if (valid.length > 0) {
        savedWorkContext = `## 이전 저장된 Claude 협업 내용 (최근 ${valid.length}건)\n\n${valid.join('\n\n---\n\n')}`
      }
    } catch { /* 읽기 실패 무시 */ }
  }

  const systemBlocks = [
    { type: 'text' as const, text: YOURMATE_CONTEXT, cache_control: { type: 'ephemeral' as const } },
    ...(serviceContext ? [{ type: 'text' as const, text: serviceContext, cache_control: { type: 'ephemeral' as const } }] : []),
    ...(savedWorkContext ? [{ type: 'text' as const, text: savedWorkContext }] : []),
    ...(projectContext ? [{ type: 'text' as const, text: projectContext }] : []),
  ]

  const hasDropbox = !!dropboxUrl?.startsWith(WEB_BASE)

  const tools: Anthropic.Tool[] = [
    // ── Dropbox 읽기 툴 ──
    ...(hasDropbox ? [
      {
        name: 'list_project_files',
        description: '이 프로젝트의 Dropbox 폴더 내 파일 및 하위 폴더 목록을 가져옵니다. subfolder를 지정하면 하위 폴더 내용을 조회합니다.',
        input_schema: {
          type: 'object' as const,
          properties: {
            subfolder: { type: 'string', description: '조회할 하위 폴더 이름 (예: "0 행정"). 비워두면 메인 폴더.' },
          },
          required: [],
        },
      },
      {
        name: 'read_project_file',
        description: '이 프로젝트 Dropbox 폴더 내 특정 파일을 읽습니다. PDF, txt, csv, md 형식 지원.',
        input_schema: {
          type: 'object' as const,
          properties: {
            filename: { type: 'string', description: '읽을 파일명 (예: 견적서.pdf, brief.md)' },
          },
          required: ['filename'],
        },
      },
    ] as Anthropic.Tool[] : []),

    // ── DB 쓰기 툴 ──
    {
      name: 'add_communication_log',
      description: '소통 내역(통화, 이메일, 메모 등)을 이 프로젝트에 실제로 기록합니다.',
      input_schema: {
        type: 'object' as const,
        properties: {
          content: { type: 'string', description: '소통 내용' },
          log_type: {
            type: 'string',
            enum: LOG_TYPES,
            description: '소통 유형: 통화 / 이메일 / 방문 / 내부회의 / 메모 / 기타',
          },
        },
        required: ['content', 'log_type'],
      },
    },
    {
      name: 'update_status',
      description: `현재 단계를 변경합니다. 리드: ${LEAD_STATUSES.join('/')} 중 하나. 계약: ${CONTRACT_STAGES.join('/')} 중 하나.`,
      input_schema: {
        type: 'object' as const,
        properties: {
          status: { type: 'string', description: '변경할 단계 값' },
        },
        required: ['status'],
      },
    },
    {
      name: 'update_notes',
      description: '리드 메모 또는 계약 메모를 업데이트합니다. 기존 내용을 대체합니다.',
      input_schema: {
        type: 'object' as const,
        properties: {
          notes: { type: 'string', description: '새로운 메모 내용' },
        },
        required: ['notes'],
      },
    },
    {
      name: 'create_task',
      description: '이 프로젝트에 새로운 태스크(업무)를 생성합니다. 계약 건에만 사용 가능.',
      input_schema: {
        type: 'object' as const,
        properties: {
          title: { type: 'string', description: '태스크 제목' },
          due_date: { type: 'string', description: '마감일 YYYY-MM-DD (선택)' },
        },
        required: ['title'],
      },
    },
  ]

  const encoder = new TextEncoder()

  const readable = new ReadableStream({
    async start(controller) {
      const send = (text: string) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(text)}\n\n`))
      const revalidate = () =>
        controller.enqueue(encoder.encode('data: [REVALIDATE]\n\n'))

      try {
        const history: Anthropic.MessageParam[] = messages.map(m => ({
          role: m.role,
          content: m.content,
        }))

        while (true) {
          let stream: ReturnType<typeof client.messages.stream>
          let retries = 0
          while (true) {
            try {
              stream = client.messages.stream({
                model: 'claude-sonnet-4-6',
                max_tokens: 2048,
                system: systemBlocks,
                tools,
                messages: history,
              })
              for await (const chunk of stream) {
                if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
                  send(chunk.delta.text)
                }
              }
              break
            } catch (err) {
              const isOverloaded = err instanceof Error && err.message.includes('overloaded_error')
              if (isOverloaded && retries < 3) {
                retries++
                send(`\n*(서버 과부하 — ${retries}초 후 재시도...)*\n`)
                await new Promise(r => setTimeout(r, retries * 1000))
              } else {
                throw err
              }
            }
          }

          const finalMsg = await stream!.finalMessage()
          history.push({ role: 'assistant', content: finalMsg.content })

          if (finalMsg.stop_reason !== 'tool_use') break

          const toolResults: Anthropic.ToolResultBlockParam[] = []

          for (const block of finalMsg.content) {
            if (block.type !== 'tool_use') continue

            let result = ''
            const input = block.input as Record<string, string>
            const folderPath = dropboxUrl ? decodeURIComponent(dropboxUrl.replace(WEB_BASE, '')) : ''

            // ── Dropbox 읽기 ──
            if (block.name === 'list_project_files') {
              const subfolder = input.subfolder
              const targetPath = subfolder ? `${folderPath}/${subfolder}` : folderPath
              send(`\n*(${subfolder ? subfolder + ' 폴더' : '프로젝트 폴더'} 조회 중...)*\n`)
              const files = await listDropboxFolder(targetPath)
              result = files.length > 0
                ? files.map(f => `${f.type === 'folder' ? '[폴더]' : '[파일]'} ${f.name}`).join('\n')
                : '(폴더가 비어 있음)'

            } else if (block.name === 'read_project_file') {
              send(`\n*(${input.filename} 읽는 중...)*\n`)
              const res = await readDropboxFile(`${folderPath}/${input.filename}`)
              result = 'error' in res ? `읽기 실패: ${res.error}` : res.text

            // ── DB 쓰기 ──
            } else if (block.name === 'add_communication_log') {
              send('\n*(소통 내역 저장 중...)*\n')
              const { error } = await admin.from('project_logs').insert({
                lead_id: leadId || null,
                sale_id: saleId || null,
                content: input.content,
                log_type: input.log_type,
                author_id: user.id,
                contacted_at: new Date().toISOString(),
              })
              if (error) {
                result = `저장 실패: ${error.message}`
              } else {
                result = '소통 내역이 저장되었습니다.'
                revalidate()
              }

            } else if (block.name === 'update_status') {
              send('\n*(단계 변경 중...)*\n')
              if (leadId) {
                const { error } = await admin.from('leads')
                  .update({ status: input.status, updated_at: new Date().toISOString() })
                  .eq('id', leadId)
                result = error ? `변경 실패: ${error.message}` : `리드 단계를 "${input.status}"로 변경했습니다.`
                if (!error) revalidate()
              } else if (saleId) {
                const { error } = await admin.from('sales')
                  .update({ contract_stage: input.status })
                  .eq('id', saleId)
                result = error ? `변경 실패: ${error.message}` : `계약 단계를 "${input.status}"로 변경했습니다.`
                if (!error) revalidate()
              }

            } else if (block.name === 'update_notes') {
              send('\n*(메모 업데이트 중...)*\n')
              if (leadId) {
                const { error } = await admin.from('leads')
                  .update({ notes: input.notes, updated_at: new Date().toISOString() })
                  .eq('id', leadId)
                result = error ? `저장 실패: ${error.message}` : '리드 메모를 업데이트했습니다.'
                if (!error) revalidate()
              } else if (saleId) {
                const { error } = await admin.from('sales')
                  .update({ memo: input.notes })
                  .eq('id', saleId)
                result = error ? `저장 실패: ${error.message}` : '계약 메모를 업데이트했습니다.'
                if (!error) revalidate()
              }

            } else if (block.name === 'create_task') {
              if (!saleId) {
                result = '태스크는 계약 건에만 추가할 수 있습니다.'
              } else {
                send('\n*(태스크 생성 중...)*\n')
                const { error } = await admin.from('tasks').insert({
                  project_id: saleId,
                  title: input.title,
                  status: '할 일',
                  priority: '보통',
                  due_date: input.due_date || null,
                  assignee_id: null,
                })
                result = error ? `생성 실패: ${error.message}` : `태스크 "${input.title}"를 생성했습니다.`
                if (!error) revalidate()
              }
            }

            toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: result })
          }

          history.push({ role: 'user', content: toolResults })
        }

        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
      } catch (err) {
        const msg = err instanceof Error ? err.message : '알 수 없는 오류'
        controller.enqueue(encoder.encode(`data: [ERROR] ${msg}\n\n`))
      } finally {
        controller.close()
      }
    },
  })

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
