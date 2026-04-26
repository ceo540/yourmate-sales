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
const PROJECT_STATUSES = ['유입', '협의중', '견적발송', '계약', '진행중', '완료', '보류', '취소']
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
- **프로젝트 상태: ${project.status || '진행중'}** (가능한 값: ${PROJECT_STATUSES.join('/')})
- PM: ${pmName || '(미배정)'}
- Dropbox 폴더: ${project.dropbox_url ? '연결됨 (list_project_files로 조회 가능)' : '(없음)'}
- 메모: ${project.memo || '(없음)'}

**중요**: 사용자가 "상태" 또는 "단계"를 변경해달라고 하면 기본적으로 **프로젝트 상태(projects.status)** 를 의미합니다. update_status 툴을 호출하세요. 연결된 계약의 세부 단계를 변경할 때는 사용자가 "계약 단계" 또는 "계약 진행"이라고 명시해야 합니다.
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

  const today = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long', timeZone: 'Asia/Seoul' })
  const todayIso = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' })

  const TOP_POLICY = `# 🔴 최우선 규칙
1. 오늘 날짜는 ${today} (ISO: ${todayIso}). "내일/다음주" 등 상대 날짜는 반드시 이 날짜 기준 계산. 절대 다른 연도(2025 등)로 추정 금지.
2. 사용자가 할일 추가/수정/완료/삭제, 개요 정리, 협의사항 갱신, 상태 변경, 메모 수정·추가를 요청하면 **반드시 도구를 호출**. 다음은 모두 실제 사용 가능:
   - create_task (projectId만 있어도 자동으로 첫 계약 매칭)
   - update_task / complete_task / delete_task
   - regenerate_overview / update_pending_discussion / regenerate_pending_discussion
   - add_project_memo / update_project_memo / delete_project_memo (메모 카드 — 회의록·카톡 정리 등 별도 보존)
   - update_status / update_notes / add_communication_log
3. **절대 금지 답변 패턴**:
   - "지원되지 않습니다" / "기능이 없어요"
   - "직접 처리해주세요" / "수동으로 해주세요"
   - "시스템상 제한되고 있습니다" / "구조상 제한"
   - "계약 페이지로 이동하세요" (create_task가 자동 매칭함)
   - "화면에만 보여드린 거예요" (반드시 도구로 저장)
4. 도구 호출이 실제 에러를 반환하면 그 에러 메시지를 그대로 사용자에게 전달. 추측·각색 금지.
5. 의도 명확하면 즉시 실행. 삭제만 1회 확인.
6. update_task / complete_task / delete_task에서 같은 제목 매칭이 여러 건이면 시스템이 번호 + 마감일·상태·생성일 + 전체 task_id를 보여줘. 사용자에게 그대로 친절하게 표시하고 어느 것인지 물어봐. 사용자가 "①/②/첫번째/두번째/1번/2번"이라고 답하면 그 순서대로 직전 매칭 결과의 task_id를 선택해서 도구 재호출. id 8자리만 떼서 호출 금지 — 반드시 전체 UUID 사용.`

  const systemBlocks = [
    { type: 'text' as const, text: TOP_POLICY },
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
      description: `현재 상태/단계를 변경합니다.
- projectId 컨텍스트(프로젝트 상세 페이지)에서는 projects.status를 변경하며, 가능한 값: ${PROJECT_STATUSES.join('/')}.
- saleId 컨텍스트(매출/계약 상세)에서는 sales.contract_stage를 변경하며, 가능한 값: ${CONTRACT_STAGES.join('/')}.
- leadId 컨텍스트(리드)에서는 leads.status를 변경하며, 가능한 값: ${LEAD_STATUSES.join('/')}.
사용자가 단순히 "상태"/"단계"라고 하면 현재 컨텍스트 기준으로 해석하세요. projectId가 있으면 프로젝트 상태 변경이 기본입니다.`,
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
      description: '현재 프로젝트(또는 계약)에 새 할 일을 추가합니다. projectId만 있을 때는 시스템이 자동으로 프로젝트의 첫 번째 계약을 찾아 거기에 묶음 — 사용자나 너가 계약을 지정할 필요 없음. 계약 단계와 무관하게 항상 호출 가능. "지원되지 않습니다" 같은 거짓 거부 금지.',
      input_schema: {
        type: 'object' as const,
        properties: {
          title: { type: 'string', description: '태스크 제목' },
          due_date: { type: 'string', description: '마감일 YYYY-MM-DD (선택). "내일", "다음주" 등은 시스템 헤더의 오늘 날짜 기준 계산.' },
          priority: { type: 'string', description: '긴급/높음/보통/낮음 (기본 보통)' },
          assignee_name: { type: 'string', description: '담당자 이름. "나"=본인.' },
          description: { type: 'string', description: '상세 설명' },
        },
        required: ['title'],
      },
    },
    {
      name: 'update_task',
      description: '기존 할 일의 담당자/마감일/우선순위/상태/제목/설명을 수정. title 부분 매칭 또는 task_id로 식별. 사용자가 "X 마감 바꿔/담당자 바꿔" 등이면 즉시 호출.',
      input_schema: {
        type: 'object' as const,
        properties: {
          task_id: { type: 'string' },
          title: { type: 'string', description: '제목 검색어' },
          new_title: { type: 'string' },
          due_date: { type: 'string' },
          priority: { type: 'string', description: '긴급/높음/보통/낮음' },
          status: { type: 'string', description: '할 일/진행중/완료/보류' },
          assignee_name: { type: 'string' },
          description: { type: 'string' },
        },
      },
    },
    {
      name: 'complete_task',
      description: '할 일을 완료 상태로 변경. title 또는 task_id로 식별.',
      input_schema: {
        type: 'object' as const,
        properties: {
          task_id: { type: 'string' },
          title: { type: 'string', description: '제목 검색어' },
        },
      },
    },
    {
      name: 'delete_task',
      description: '할 일을 삭제. 사용자에게 한 번 확인받은 뒤 호출. "지원 안됨" 거짓 거부 금지 — 이 도구로 실제 삭제 가능.',
      input_schema: {
        type: 'object' as const,
        properties: {
          task_id: { type: 'string' },
          title: { type: 'string' },
        },
      },
    },
    {
      name: 'regenerate_overview',
      description: '프로젝트 자동 개요(상단 박스)를 최신 데이터로 재생성. "현황 정리해줘", "개요 갱신" 요청 시 즉시 호출.',
      input_schema: { type: 'object' as const, properties: {} },
    },
    {
      name: 'update_pending_discussion',
      description: '프로젝트 협의/미결 사항 박스 전체를 새 markdown으로 덮어쓰기. 추가하려면 기존 + 새 내용 합쳐서 보내. "협의사항에 X 추가해줘" 요청 시 호출.',
      input_schema: {
        type: 'object' as const,
        properties: {
          content: { type: 'string', description: '저장할 markdown 전문' },
        },
        required: ['content'],
      },
    },
    {
      name: 'regenerate_pending_discussion',
      description: '협의사항 박스를 자동 재분석. "지금 협의할 거 다시 뽑아줘" 요청 시 호출.',
      input_schema: { type: 'object' as const, properties: {} },
    },
    {
      name: 'add_project_memo',
      description: '프로젝트에 새 메모 카드를 추가. 회의 정리, 카톡 분석 결과, 통화 메모 등을 별도 카드로 보존하고 싶을 때 사용. 마크다운 지원 (제목/리스트/표/체크박스). 사용자가 "메모 추가/메모로 정리/카드로 남겨" 등 말하면 즉시 호출.',
      input_schema: {
        type: 'object' as const,
        properties: {
          title: { type: 'string', description: '메모 제목 (선택). 없으면 자동으로 "YYYY-MM-DD 메모".' },
          content: { type: 'string', description: '메모 본문 (markdown). 표/리스트/체크박스 활용 권장.' },
        },
        required: ['content'],
      },
    },
    {
      name: 'update_project_memo',
      description: '기존 메모 카드의 제목 또는 내용을 수정. memo_id 또는 title 부분 매칭으로 식별. 매칭 여러 건이면 시스템이 목록 반환 → memo_id로 재호출.',
      input_schema: {
        type: 'object' as const,
        properties: {
          memo_id: { type: 'string', description: '메모 UUID' },
          title: { type: 'string', description: '제목 검색어 (memo_id 없을 때)' },
          new_title: { type: 'string', description: '새 제목' },
          content: { type: 'string', description: '새 본문 (전체 덮어쓰기)' },
        },
      },
    },
    {
      name: 'delete_project_memo',
      description: '메모 카드 삭제. 사용자에게 한 번 확인받은 뒤 호출.',
      input_schema: {
        type: 'object' as const,
        properties: {
          memo_id: { type: 'string' },
          title: { type: 'string', description: '제목 검색어' },
        },
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
      const sendProjectStatus = (status: string) =>
        controller.enqueue(encoder.encode(`data: [PROJECT_STATUS:${status}]\n\n`))

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
              // 우선순위: leadId > projectId > saleId
              // 프로젝트 상세 페이지에서 Claude 호출 시 saleId도 같이 오는데, 사용자 의도는
              // 보통 "프로젝트 상태" (projects.status) 변경이지 "계약 단계" (sales.contract_stage) 변경이 아님.
              if (leadId) {
                const { error } = await admin.from('leads')
                  .update({ status: input.status, updated_at: new Date().toISOString() })
                  .eq('id', leadId)
                result = error ? `변경 실패: ${error.message}` : `리드 단계를 "${input.status}"로 변경했습니다.`
                if (!error) revalidate()
              } else if (projectId) {
                const { data, error } = await admin.from('projects')
                  .update({ status: input.status, updated_at: new Date().toISOString() })
                  .eq('id', projectId)
                  .select('id, status')
                if (error) result = `변경 실패: ${error.message}`
                else if (!data || data.length === 0) result = `변경 실패: projects 테이블에서 id=${projectId}인 행을 찾지 못함`
                else {
                  result = `프로젝트 상태를 "${input.status}"로 변경 완료 (DB 확인: ${data[0].status}).`
                  revalidatePath(`/projects/${projectId}`)
                  revalidatePath('/projects')
                  sendProjectStatus(data[0].status)
                  revalidate()
                }
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
              } else if (projectId) {
                const { data, error } = await admin.from('projects')
                  .update({ memo: input.notes, updated_at: new Date().toISOString() })
                  .eq('id', projectId)
                  .select('id')
                if (error) result = `저장 실패: ${error.message}`
                else if (!data || data.length === 0) result = `저장 실패: projects 테이블에서 id=${projectId}인 행을 찾지 못함`
                else {
                  result = '프로젝트 메모를 업데이트했습니다.'
                  revalidatePath(`/projects/${projectId}`)
                  revalidate()
                }
              }

            } else if (block.name === 'create_task') {
              send('\n*(태스크 생성 중...)*\n')
              // saleId 없으면 projectId의 첫 sale 자동 매칭
              let targetSaleId = saleId ?? null
              if (!targetSaleId && projectId) {
                const { data: firstSale } = await admin
                  .from('sales').select('id')
                  .eq('project_id', projectId)
                  .order('created_at', { ascending: true })
                  .limit(1).maybeSingle()
                targetSaleId = firstSale?.id ?? null
              }
              if (!targetSaleId) {
                result = '이 프로젝트에 연결된 계약이 없어. 계약을 먼저 만들어줘.'
              } else {
                const validPriority = ['긴급', '높음', '보통', '낮음']
                const priority = validPriority.includes(input.priority) ? input.priority : '보통'
                let assigneeId: string | null = null
                if (input.assignee_name) {
                  if (input.assignee_name === '나' || input.assignee_name === '본인') assigneeId = user.id
                  else {
                    const { data } = await admin.from('profiles').select('id').ilike('name', `%${input.assignee_name}%`).limit(1)
                    assigneeId = data?.[0]?.id ?? null
                  }
                }
                const { error } = await admin.from('tasks').insert({
                  project_id: targetSaleId,
                  title: input.title,
                  status: '할 일',
                  priority,
                  due_date: input.due_date || null,
                  assignee_id: assigneeId,
                  description: input.description || null,
                  bbang_suggested: true,
                })
                result = error ? `생성 실패: ${error.message}` : `태스크 "${input.title}"를 생성했습니다.`
                if (!error) revalidate()
              }

            } else if (block.name === 'update_task' || block.name === 'complete_task' || block.name === 'delete_task') {
              // 프로젝트의 모든 sale id 수집 후 task 검색
              let saleIds: string[] = []
              if (saleId) saleIds = [saleId]
              else if (projectId) {
                const { data: sales } = await admin.from('sales').select('id').eq('project_id', projectId)
                saleIds = (sales ?? []).map(s => s.id)
              }
              if (saleIds.length === 0) {
                result = '연결된 계약이 없어 할 일을 찾을 수 없어.'
              } else {
                let task: { id: string; title: string } | null = null
                let multiple = false
                if (input.task_id) {
                  const { data } = await admin.from('tasks').select('id, title, project_id').eq('id', input.task_id).maybeSingle()
                  if (data && saleIds.includes(data.project_id ?? '')) task = { id: data.id, title: data.title }
                } else if (input.title) {
                  const { data } = await admin
                    .from('tasks')
                    .select('id, title, status, due_date, created_at, bbang_suggested')
                    .in('project_id', saleIds)
                    .ilike('title', `%${input.title}%`)
                    .order('created_at', { ascending: false })
                    .limit(5)
                  if (data && data.length === 1) task = data[0]
                  else if (data && data.length > 1) {
                    multiple = true
                    result = `"${input.title}" 매칭 ${data.length}건. 사용자에게 어느 것인지 친절하게 보여주고 task_id로 재호출:\n` +
                      data.map((t, i) => `${i + 1}. "${t.title}" — 상태:${t.status}${t.due_date ? `, 마감:${t.due_date}` : ''}, 생성:${t.created_at?.slice(0, 10)}${t.bbang_suggested ? ', 🤖빵빵이추가' : ''}\n   task_id=${t.id}`).join('\n')
                  }
                }
                if (!task && !multiple) {
                  result = '해당 할 일을 찾을 수 없어.'
                } else if (task) {
                  if (block.name === 'complete_task') {
                    send('\n*(할 일 완료 처리...)*\n')
                    const { error } = await admin.from('tasks').update({ status: '완료', updated_at: new Date().toISOString() }).eq('id', task.id)
                    result = error ? `실패: ${error.message}` : `"${task.title}" 완료 처리.`
                    if (!error) revalidate()
                  } else if (block.name === 'delete_task') {
                    send('\n*(할 일 삭제...)*\n')
                    const { error } = await admin.from('tasks').delete().eq('id', task.id)
                    result = error ? `실패: ${error.message}` : `"${task.title}" 삭제.`
                    if (!error) revalidate()
                  } else {
                    // update_task
                    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
                    if (input.new_title?.trim()) updates.title = input.new_title.trim()
                    if (input.priority && ['긴급','높음','보통','낮음'].includes(input.priority)) updates.priority = input.priority
                    if (input.status && ['할 일','진행중','완료','보류'].includes(input.status)) updates.status = input.status
                    if (input.due_date !== undefined) updates.due_date = input.due_date || null
                    if (input.description !== undefined) updates.description = input.description || null
                    if (input.assignee_name !== undefined) {
                      if (input.assignee_name === '') updates.assignee_id = null
                      else if (input.assignee_name === '나' || input.assignee_name === '본인') updates.assignee_id = user.id
                      else {
                        const { data } = await admin.from('profiles').select('id').ilike('name', `%${input.assignee_name}%`).limit(1)
                        updates.assignee_id = data?.[0]?.id ?? null
                      }
                    }
                    if (Object.keys(updates).length === 1) {
                      result = '변경할 내용이 없어.'
                    } else {
                      send('\n*(할 일 수정...)*\n')
                      const { error } = await admin.from('tasks').update(updates).eq('id', task.id)
                      result = error ? `실패: ${error.message}` : `"${task.title}" 수정 완료.`
                      if (!error) revalidate()
                    }
                  }
                }
              }

            } else if (block.name === 'regenerate_overview') {
              if (!projectId) {
                result = '프로젝트 페이지에서만 사용 가능.'
              } else {
                send('\n*(개요 재생성 중...)*\n')
                const { generateAndSaveProjectOverview } = await import('@/app/(dashboard)/projects/[id]/project-actions')
                const r = await generateAndSaveProjectOverview(projectId)
                result = 'error' in r ? `실패: ${r.error}` : '프로젝트 개요를 재생성했어.'
                if ('summary' in r) revalidate()
              }

            } else if (block.name === 'update_pending_discussion') {
              if (!projectId) {
                result = '프로젝트 페이지에서만 사용 가능.'
              } else {
                send('\n*(협의사항 저장...)*\n')
                const { error } = await admin.from('projects')
                  .update({ pending_discussion: input.content || null, updated_at: new Date().toISOString() })
                  .eq('id', projectId)
                result = error ? `실패: ${error.message}` : '협의사항을 업데이트했어.'
                if (!error) {
                  revalidatePath(`/projects/${projectId}/v2`)
                  revalidatePath(`/projects/${projectId}`)
                  revalidate()
                }
              }

            } else if (block.name === 'regenerate_pending_discussion') {
              if (!projectId) {
                result = '프로젝트 페이지에서만 사용 가능.'
              } else {
                send('\n*(협의사항 재분석 중...)*\n')
                const { generateAndSavePendingDiscussion } = await import('@/app/(dashboard)/projects/[id]/project-actions')
                const r = await generateAndSavePendingDiscussion(projectId)
                result = 'error' in r ? `실패: ${r.error}` : '협의사항을 재분석했어.'
                if ('summary' in r) revalidate()
              }

            } else if (block.name === 'add_project_memo') {
              if (!projectId) {
                result = '프로젝트 페이지에서만 사용 가능.'
              } else {
                send('\n*(메모 카드 추가 중...)*\n')
                const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' })
                const title = (input.title?.trim()) || `${today} 메모`
                const content = input.content || ''
                const { data: row, error } = await admin.from('project_memos').insert({
                  project_id: projectId,
                  title,
                  content,
                  author_id: user.id,
                }).select('id').single()
                if (error) result = `실패: ${error.message}`
                else {
                  result = `메모 카드 "${title}" 추가 완료 (id: ${row.id.slice(0, 8)})`
                  revalidatePath(`/projects/${projectId}/v2`)
                  revalidatePath(`/projects/${projectId}`)
                  revalidate()
                }
              }

            } else if (block.name === 'update_project_memo' || block.name === 'delete_project_memo') {
              if (!projectId) {
                result = '프로젝트 페이지에서만 사용 가능.'
              } else {
                let memo: { id: string; title: string | null } | null = null
                let multiple = false
                if (input.memo_id) {
                  const { data } = await admin.from('project_memos').select('id, title, project_id').eq('id', input.memo_id).maybeSingle()
                  if (data && data.project_id === projectId) memo = { id: data.id, title: data.title }
                } else if (input.title) {
                  const { data } = await admin.from('project_memos')
                    .select('id, title, content, created_at')
                    .eq('project_id', projectId)
                    .ilike('title', `%${input.title}%`)
                    .order('created_at', { ascending: false })
                    .limit(5)
                  if (data && data.length === 1) memo = data[0]
                  else if (data && data.length > 1) {
                    multiple = true
                    result = `"${input.title}" 매칭 ${data.length}건. memo_id로 특정해서 재호출:\n` +
                      data.map((m, i) => `${i + 1}. "${m.title || '제목없음'}" — 생성:${m.created_at?.slice(0, 10)}\n   memo_id=${m.id}`).join('\n')
                  }
                }
                if (!memo && !multiple) {
                  result = '해당 메모를 찾을 수 없어.'
                } else if (memo) {
                  if (block.name === 'delete_project_memo') {
                    send('\n*(메모 삭제 중...)*\n')
                    const { error } = await admin.from('project_memos').delete().eq('id', memo.id)
                    result = error ? `실패: ${error.message}` : `"${memo.title || '메모'}" 삭제.`
                  } else {
                    send('\n*(메모 수정 중...)*\n')
                    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
                    if (input.new_title !== undefined) updates.title = input.new_title || null
                    if (input.content !== undefined) updates.content = input.content || null
                    if (Object.keys(updates).length === 1) {
                      result = '변경할 내용이 없어. new_title 또는 content를 줘.'
                    } else {
                      const { error } = await admin.from('project_memos').update(updates).eq('id', memo.id)
                      result = error ? `실패: ${error.message}` : `"${memo.title || '메모'}" 수정 완료.`
                    }
                  }
                  if (!result.startsWith('실패') && !result.startsWith('변경')) {
                    revalidatePath(`/projects/${projectId}/v2`)
                    revalidatePath(`/projects/${projectId}`)
                    revalidate()
                  }
                }
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
