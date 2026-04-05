import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { SERVICE_TO_DEPT } from '@/types'
import { createSaleFolder } from '@/lib/dropbox'
import { logApiUsage } from '@/lib/api-usage'

const NOTION_DB_ID = '6401e402-25e9-4941-a89e-6e3107df5f74'
const anthropic = new Anthropic()

// department → 사업별 DB 페이지 ID
const DEPT_TO_NOTION_PAGE: Record<string, string> = {
  'sound_of_school':   '03deaa70-51e4-4366-a7a6-40004ac1fa4b',
  '002_entertainment': '1eb72db2-0884-808f-a4cd-eb434ea3c075',
  'yourmate':          '47c2d4b3-dddd-4113-9e73-6f56f0bf1872',
  'school_store':      '9d25891b-a1d2-4a20-b296-dd61687b4e2a',
  'artkiwoom':         '9fafe135-1eae-4047-9639-615d9a472188',
  '002_creative':      'fa875177-4f38-4891-bd69-2a912dabd711',
}

interface ProjectProposal {
  about: string
  prep_steps: string[]
  exec_steps: string[]
  todos: string[]
  goal: string
  deliverables: string[]
}

async function generateProposal(params: {
  name: string
  client_org: string | null
  service_type: string | null
  revenue: number | null
  memo: string | null
  userId: string | null
}): Promise<ProjectProposal> {
  const { name, client_org, service_type, revenue, memo } = params

  const prompt = `다음 계약건의 프로젝트 페이지 내용을 작성해주세요. 처음 보는 사람도 바로 이해할 수 있게.

건명: ${name}
발주처: ${client_org || '미정'}
서비스: ${service_type || '미정'}
금액: ${revenue ? revenue.toLocaleString() + '원' : '미정'}
메모: ${memo || '없음'}

JSON 형식으로만 답변:
{
  "about": "이 프로젝트를 왜 하는지, 어떤 프로젝트인지 2~3문장",
  "prep_steps": ["파악·준비 단계 업무1", "업무2", "업무3"],
  "exec_steps": ["실행 단계 업무1", "업무2", "업무3"],
  "todos": ["상세 체크 항목1", "항목2", "항목3", "항목4", "항목5"],
  "goal": "이 프로젝트의 목표 한 문장",
  "deliverables": ["예상 산출물1", "산출물2"]
}`

  try {
    const res = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 800,
      messages: [{ role: 'user', content: prompt }],
    })
    logApiUsage({ model: 'claude-haiku-4-5-20251001', endpoint: 'create-sale', userId: params.userId, inputTokens: res.usage.input_tokens, outputTokens: res.usage.output_tokens }).catch(() => {})
    const text = res.content[0].type === 'text' ? res.content[0].text : ''
    const json = text.match(/\{[\s\S]*\}/)
    if (json) return JSON.parse(json[0]) as ProjectProposal
  } catch { /* 실패 시 기본값 사용 */ }

  return {
    about: `${client_org || '클라이언트'}의 ${service_type || ''} 프로젝트입니다.`,
    prep_steps: ['계약 및 사전 준비', '현장 답사 및 기획', '물품·인력 준비'],
    exec_steps: ['현장 세팅', '운영 진행', '마무리 및 철수'],
    todos: ['계약서 작성', '사전 답사', '물품 발주', '인력 배치', '결과 보고'],
    goal: `${name} 성공적 완료`,
    deliverables: ['결과 보고서', '현장 사진'],
  }
}

async function createNotionProject(params: {
  name: string
  inflowDate: string
  department: string | null
  client_org: string | null
  service_type: string | null
  revenue: number | null
  memo: string | null
  proposal: ProjectProposal
}): Promise<{ url: string | null; error?: string }> {
  const token = process.env.NOTION_TOKEN
  if (!token) return { url: null, error: 'NOTION_TOKEN not set' }

  const { name, inflowDate, department, client_org, service_type, revenue, proposal } = params

  const sabupPageId = department ? DEPT_TO_NOTION_PAGE[department] : null

  const properties: Record<string, unknown> = {
    'Project name': { title: [{ text: { content: name } }] },
    '상태': { status: { name: '진행 전' } },
    '기간': { date: { start: inflowDate } },
    '중요도': { select: { name: 'Medium' } },
  }
  if (sabupPageId) {
    properties['사업별 DB'] = { relation: [{ id: sabupPageId }] }
  }

  const t = (content: string) => [{ type: 'text', text: { content } }]
  const h1 = (text: string) => ({ object: 'block', type: 'heading_1', heading_1: { rich_text: t(text) } })
  const h2 = (text: string) => ({ object: 'block', type: 'heading_2', heading_2: { rich_text: t(text) } })
  const h3 = (text: string) => ({ object: 'block', type: 'heading_3', heading_3: { rich_text: t(text) } })
  const bullet = (text: string) => ({ object: 'block', type: 'bulleted_list_item', bulleted_list_item: { rich_text: t(text) } })
  const numbered = (text: string) => ({ object: 'block', type: 'numbered_list_item', numbered_list_item: { rich_text: t(text) } })
  const todoBlock = (text: string) => ({ object: 'block', type: 'to_do', to_do: { rich_text: t(text), checked: false } })
  const divider = () => ({ object: 'block', type: 'divider', divider: {} })
  const quote = (text: string) => ({ object: 'block', type: 'quote', quote: { rich_text: t(text) } })
  const callout = (text: string) => ({ object: 'block', type: 'callout', callout: { rich_text: t(text), icon: { type: 'emoji', emoji: '💡' } } })

  const children = [
    h1('ABOUT'),
    quote(proposal.about),
    divider(),
    h1('업무 순서'),
    h2('파악 및 준비'),
    ...proposal.prep_steps.map(s => numbered(s)),
    h2('실행'),
    ...proposal.exec_steps.map(s => numbered(s)),
    divider(),
    h1('TODO'),
    ...proposal.todos.map(s => todoBlock(s)),
    divider(),
    h1('RESOURCE'),
    bullet('투입 인원 : '),
    bullet(`예산 : ${revenue ? revenue.toLocaleString() + '원' : ''}`),
    bullet(`프로젝트 기간 : ${inflowDate} ~`),
    bullet('데드라인 : '),
    divider(),
    h1('GOAL'),
    bullet(`목표 : ${proposal.goal}`),
    h2('예상 산출물'),
    ...proposal.deliverables.map(d => bullet(d)),
    callout('할일은 필드로 연결하세요.'),
  ]

  const res = await fetch('https://api.notion.com/v1/pages', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Notion-Version': '2022-06-28',
    },
    body: JSON.stringify({ parent: { database_id: NOTION_DB_ID }, properties, children }),
  })

  const data = await res.json()
  console.log('Notion response:', JSON.stringify(data))

  if (data.object === 'error') return { url: null, error: `Notion error ${data.status}: ${data.message}` }
  if (data.url) return { url: data.url }
  if (data.id) return { url: `https://notion.so/${data.id.replace(/-/g, '')}` }
  return { url: null, error: 'No id in response' }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { name, client_org, service_type, revenue, memo } = body

    const department = (service_type && SERVICE_TO_DEPT[service_type]) || null
    const inflowDate = new Date().toISOString().split('T')[0]

    // 1. Dropbox 폴더 생성
    const dropboxUrl = await createSaleFolder({
      service_type: service_type || null,
      name: name?.trim() || '(제목 없음)',
      inflow_date: inflowDate,
    })

    // 2. Supabase에 매출건 생성
    const { data, error } = await supabase.from('sales').insert({
      name: name?.trim() || '(제목 없음)',
      client_org: client_org || null,
      service_type: service_type || null,
      department,
      revenue: revenue || 0,
      payment_status: '계약전',
      memo: memo || null,
      inflow_date: inflowDate,
      dropbox_url: dropboxUrl || null,
      assignee_id: user.id,
    }).select('id').single()

    if (error) throw new Error(error.message)

    // 3. AI 프로젝트 제안 생성 + Notion 프로젝트 생성 (병렬 불가 — proposal 먼저 필요)
    const proposal = await generateProposal({
      name: name?.trim() || '(제목 없음)',
      client_org: client_org || null,
      service_type: service_type || null,
      revenue: revenue || null,
      memo: memo || null,
      userId: user.id,
    })

    const notion = await createNotionProject({
      name: name?.trim() || '(제목 없음)',
      inflowDate,
      department,
      client_org: client_org || null,
      service_type: service_type || null,
      revenue: revenue || null,
      memo: memo || null,
      proposal,
    })

    return NextResponse.json({ id: data.id, notionUrl: notion.url, notionError: notion.error ?? null })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
