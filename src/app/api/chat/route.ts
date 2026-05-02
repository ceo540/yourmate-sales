import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'

// 데이터 변경 도구. 호출되면 응답에 mutated:true 실어 클라이언트가 router.refresh().
const MUTATING_TOOLS = new Set([
  'create_sale', 'update_sale_revenue', 'update_sale_status',
  'update_notion_title', 'update_notion_status',
  'create_lead', 'update_lead', 'convert_lead_to_sale',
  'add_project_log', 'update_project_status',
  'update_brief_note', 'set_dropbox_url',
  'create_calendar_event',
  'create_project_task', 'complete_task', 'update_task', 'delete_task',
  'regenerate_overview', 'update_overview', 'update_pending_discussion', 'regenerate_pending_discussion',
  'update_short_summary', 'regenerate_short_summary',
  'create_quote', 'update_quote',
  'update_lead_summary', 'regenerate_lead_summary',
  'quick_create_customer', 'merge_customers', 'match_sale_to_customer', 'match_lead_to_customer',
  'link_sale_project', 'unlink_sale_project', 'set_revenue_share',
  'add_external_worker', 'record_engagement',
  'create_monthly_payment', 'generate_tax_handoff', 'mark_payment_paid',
  'add_prospect', 'log_prospect_activity', 'record_decision',
])
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getDropboxToken, readDropboxFile, uploadTextFile, createSaleFolder } from '@/lib/dropbox'
import { appendAiNote } from '@/lib/brief-generator'
import { logApiUsage } from '@/lib/api-usage'
import { createEvent as createGCalEvent } from '@/lib/google-calendar'
import { SYSTEM_PROMPT } from '@/lib/bbang/loadSchema'
import { TOOLS } from '@/lib/bbang/tools'
import { ensureProjectForSale, generateProjectNumber } from '@/lib/projects'
import { resolveCustomerId, quickCreateCustomer } from '@/lib/customer-resolve'
import {
  generateAndSaveProjectOverview,
  generateAndSavePendingDiscussion,
  updateProjectPendingDiscussion,
  updateProjectShortSummary,
  generateAndSaveProjectShortSummary,
} from '@/app/(dashboard)/projects/[id]/project-actions'

export const maxDuration = 60

const MODEL = 'claude-sonnet-4-6'

let _client: Anthropic | null = null
const getClient = () => { if (!_client) _client = new Anthropic(); return _client }



// 도구 실행
async function executeTool(name: string, input: Record<string, unknown>, userRole: string, userId: string, projectId?: string) {
  const supabase = await createClient()
  const isMember = userRole === 'member'

  if (name === 'get_sales') {
    let query = supabase
      .from('sales')
      .select('id, name, client_org, service_type, department, revenue, contract_stage, inflow_date, memo')
      .order('inflow_date', { ascending: false })
      .limit((input.limit as number) || 20)

    if (isMember) query = query.eq('assignee_id', userId)
    if (input.search) query = query.or(`name.ilike.%${input.search}%,client_org.ilike.%${input.search}%`)
    if (input.contract_stage) query = query.eq('contract_stage', input.contract_stage)
    if (input.service_type) query = query.eq('service_type', input.service_type)
    if (input.year_month) query = query.gte('inflow_date', `${input.year_month}-01`).lte('inflow_date', `${input.year_month}-31`)

    const { data, error } = await query
    if (error) return { error: error.message }
    return { count: data?.length, sales: data }
  }

  if (name === 'get_monthly_summary') {
    if (isMember) return { error: '팀원은 월별 전체 매출 조회 권한이 없어.' }
    const year = (input.year as number) || new Date().getFullYear()
    const { data, error } = await supabase
      .from('sales')
      .select('inflow_date, revenue, contract_stage')
      .gte('inflow_date', `${year}-01-01`)
      .lte('inflow_date', `${year}-12-31`)

    if (error) return { error: error.message }

    const monthly: Record<string, { count: number; revenue: number }> = {}
    for (const s of data ?? []) {
      const month = s.inflow_date?.slice(0, 7) || '미정'
      if (!monthly[month]) monthly[month] = { count: 0, revenue: 0 }
      monthly[month].count++
      monthly[month].revenue += s.revenue || 0
    }

    return {
      year,
      total_count: data?.length,
      total_revenue: data?.reduce((sum, s) => sum + (s.revenue || 0), 0),
      by_month: monthly,
    }
  }

  if (name === 'get_receivables') {
    if (isMember) return { error: '팀원은 전체 미수금 조회 권한이 없어.' }
    const { data, error } = await supabase
      .from('sales')
      .select('id, name, client_org, service_type, revenue, contract_stage, inflow_date')
      .in('contract_stage', ['착수', '선금', '중도금', '완수', '계산서발행'])
      .order('inflow_date', { ascending: false })

    if (error) return { error: error.message }
    const total = data?.reduce((sum, s) => sum + (s.revenue || 0), 0)
    return { count: data?.length, total_receivable: total, sales: data }
  }

  if (name === 'get_sale_detail') {
    let query = supabase
      .from('sales')
      .select('*, sale_costs(*)')
      .or(`name.ilike.%${input.search}%,client_org.ilike.%${input.search}%`)
      .order('inflow_date', { ascending: false })
      .limit(3)

    if (isMember) query = query.eq('assignee_id', userId)

    const { data, error } = await query
    if (error) return { error: error.message }
    return { sales: data }
  }

  if (name === 'create_sale') {
    if (isMember) return { error: '팀원 권한으로는 계약건 생성 불가.' }

    const saleName = ((input.name as string) || '').trim()
    if (!saleName) return { error: '건명은 필수야.' }

    const serviceType = (input.service_type as string | null) || null
    const clientOrg = (input.client_org as string | null) || null
    const revenue = (input.revenue as number) || 0
    const memo = (input.memo as string | null) || null
    const dropboxUrl = (input.dropbox_url as string | null) || null
    const inflowDate = (input.inflow_date as string) || new Date().toISOString().split('T')[0]

    const adminDb = createAdminClient()
    const customerId = await resolveCustomerId(adminDb, {
      customer_id: input.customer_id as string | null | undefined,
      client_org: clientOrg,
    })

    const DEPT_MAP: Record<string, string> = {
      'SOS': 'sound_of_school', '002ENT': '002_entertainment', '교육프로그램': 'artkiwoom',
      '납품설치': 'school_store', '유지보수': 'school_store', '교구대여': 'school_store', '제작인쇄': 'school_store',
      '콘텐츠제작': '002_creative', '행사운영': '002_creative', '행사대여': '002_creative', '프로젝트': '002_creative',
    }
    const department = (serviceType && DEPT_MAP[serviceType]) || null
    const projectNumber = await generateProjectNumber()

    const { data: saleRow, error: insertErr } = await supabase.from('sales').insert({
      name: saleName, client_org: clientOrg, customer_id: customerId, service_type: serviceType, department,
      revenue, contract_stage: '계약', memo, inflow_date: inflowDate, dropbox_url: dropboxUrl,
      project_number: projectNumber,
    }).select('id').single()
    if (insertErr) return { error: insertErr.message }

    // 프로젝트 자동 생성 (orphan sales 방지)
    await ensureProjectForSale({
      saleId: saleRow.id,
      name: saleName,
      service_type: serviceType,
      department,
      customer_id: customerId,
      pm_id: userId,
      project_number: projectNumber,
      dropbox_url: dropboxUrl,
    })

    if (input.create_notion === false) return { success: true, id: saleRow.id, name: saleName }

    const notionToken = process.env.NOTION_TOKEN
    if (!notionToken) return { success: true, id: saleRow.id, notionError: 'NOTION_TOKEN not set' }

    // claude-haiku로 프로젝트 제안 생성
    let proposal = { about: '', prep_steps: [] as string[], exec_steps: [] as string[], todos: [] as string[], goal: '', deliverables: [] as string[] }
    try {
      const propRes = await getClient().messages.create({
        model: MODEL,
        max_tokens: 800,
        messages: [{ role: 'user', content: `계약건 프로젝트 페이지를 JSON으로만 작성:\n건명:${saleName}\n발주처:${clientOrg||'미정'}\n서비스:${serviceType||'미정'}\n금액:${revenue?revenue.toLocaleString()+'원':'미정'}\n메모:${memo||'없음'}\n\n{"about":"2~3문장","prep_steps":["준비1","준비2","준비3"],"exec_steps":["실행1","실행2","실행3"],"todos":["TODO1","TODO2","TODO3","TODO4","TODO5"],"goal":"목표","deliverables":["산출물1","산출물2"]}` }],
      })
      logApiUsage({ model: MODEL, endpoint: 'chat', userId, inputTokens: propRes.usage.input_tokens, outputTokens: propRes.usage.output_tokens }).catch(() => {})
      const pt = propRes.content[0].type === 'text' ? propRes.content[0].text : ''
      const pm = pt.match(/\{[\s\S]*\}/)
      if (pm) proposal = JSON.parse(pm[0])
    } catch { /* 기본값 유지 */ }

    const NOTION_DB_ID = '6401e402-25e9-4941-a89e-6e3107df5f74'
    const DEPT_TO_NOTION: Record<string, string> = {
      'sound_of_school': '03deaa70-51e4-4366-a7a6-40004ac1fa4b',
      '002_entertainment': '1eb72db2-0884-808f-a4cd-eb434ea3c075',
      'yourmate': '47c2d4b3-dddd-4113-9e73-6f56f0bf1872',
      'school_store': '9d25891b-a1d2-4a20-b296-dd61687b4e2a',
      'artkiwoom': '9fafe135-1eae-4047-9639-615d9a472188',
      '002_creative': 'fa875177-4f38-4891-bd69-2a912dabd711',
    }
    const rt = (c: string) => [{ type: 'text', text: { content: c } }]
    const sabupId = department ? DEPT_TO_NOTION[department] : null
    const nProps: Record<string, unknown> = {
      'Project name': { title: [{ text: { content: saleName } }] },
      '상태': { status: { name: '진행 전' } }, '기간': { date: { start: inflowDate } }, '중요도': { select: { name: 'Medium' } },
    }
    if (sabupId) nProps['사업별 DB'] = { relation: [{ id: sabupId }] }

    const prepSteps = proposal.prep_steps.length ? proposal.prep_steps : ['계약 및 사전 준비', '현장 답사', '물품·인력 준비']
    const execSteps = proposal.exec_steps.length ? proposal.exec_steps : ['현장 세팅', '운영 진행', '마무리']
    const todos = proposal.todos.length ? proposal.todos : ['계약서 작성', '사전 답사', '물품 발주', '인력 배치', '결과 보고']
    const deliverables = proposal.deliverables.length ? proposal.deliverables : ['결과 보고서', '현장 사진']

    const nBlocks = [
      { object: 'block', type: 'heading_1', heading_1: { rich_text: rt('ABOUT') } },
      { object: 'block', type: 'quote', quote: { rich_text: rt(proposal.about || `${clientOrg||'클라이언트'}의 ${serviceType||''} 프로젝트`) } },
      { object: 'block', type: 'divider', divider: {} },
      { object: 'block', type: 'heading_1', heading_1: { rich_text: rt('업무 순서') } },
      { object: 'block', type: 'heading_2', heading_2: { rich_text: rt('파악 및 준비') } },
      ...prepSteps.map(s => ({ object: 'block', type: 'numbered_list_item', numbered_list_item: { rich_text: rt(s) } })),
      { object: 'block', type: 'heading_2', heading_2: { rich_text: rt('실행') } },
      ...execSteps.map(s => ({ object: 'block', type: 'numbered_list_item', numbered_list_item: { rich_text: rt(s) } })),
      { object: 'block', type: 'divider', divider: {} },
      { object: 'block', type: 'heading_1', heading_1: { rich_text: rt('TODO') } },
      ...todos.map(s => ({ object: 'block', type: 'to_do', to_do: { rich_text: rt(s), checked: false } })),
      { object: 'block', type: 'divider', divider: {} },
      { object: 'block', type: 'heading_1', heading_1: { rich_text: rt('RESOURCE') } },
      { object: 'block', type: 'bulleted_list_item', bulleted_list_item: { rich_text: rt('투입 인원 : ') } },
      { object: 'block', type: 'bulleted_list_item', bulleted_list_item: { rich_text: rt(`예산 : ${revenue ? revenue.toLocaleString()+'원' : ''}`) } },
      { object: 'block', type: 'bulleted_list_item', bulleted_list_item: { rich_text: rt(`프로젝트 기간 : ${inflowDate} ~`) } },
      { object: 'block', type: 'divider', divider: {} },
      { object: 'block', type: 'heading_1', heading_1: { rich_text: rt('GOAL') } },
      { object: 'block', type: 'bulleted_list_item', bulleted_list_item: { rich_text: rt(`목표 : ${proposal.goal || saleName+' 성공적 완료'}`) } },
      { object: 'block', type: 'heading_2', heading_2: { rich_text: rt('예상 산출물') } },
      ...deliverables.map(d => ({ object: 'block', type: 'bulleted_list_item', bulleted_list_item: { rich_text: rt(d) } })),
    ]

    const nRes = await fetch('https://api.notion.com/v1/pages', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${notionToken}`, 'Content-Type': 'application/json', 'Notion-Version': '2022-06-28' },
      body: JSON.stringify({ parent: { database_id: NOTION_DB_ID }, properties: nProps, children: nBlocks }),
    })
    const nData = await nRes.json()
    const notionUrl = nData.url || (nData.id ? `https://notion.so/${nData.id.replace(/-/g, '')}` : null)
    return { success: true, id: saleRow.id, name: saleName, notionUrl, notionError: nData.object === 'error' ? nData.message : null }
  }

  if (name === 'update_notion_title') {
    const token = process.env.NOTION_TOKEN
    if (!token) return { error: 'NOTION_TOKEN not set' }
    const pageId = (input.page_id as string).replace(/-/g, '')
    const res = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', 'Notion-Version': '2022-06-28' },
      body: JSON.stringify({ properties: { 'Project name': { title: [{ text: { content: input.title } }] } } }),
    })
    const data = await res.json()
    if (data.object === 'error') return { error: data.message }
    return { success: true, new_title: input.title }
  }

  if (name === 'read_dropbox_pdf') {
    const token = await getDropboxToken()
    if (!token) return { error: 'Dropbox 토큰 발급 실패. 환경변수 확인 필요.' }
    const rootNs = process.env.DROPBOX_ROOT_NAMESPACE ?? '3265523555'
    const pathRootHeader = JSON.stringify({ '.tag': 'root', 'root': rootNs })

    let folderPath = input.path as string | undefined
    let saleName = ''

    if (userRole !== 'admin' && input.path) return { error: '직접 경로로 드롭박스 접근은 불가능해. 건명으로 검색해줘.' }

    if (!folderPath && input.sale_search) {
      let query = supabase
        .from('sales')
        .select('name, dropbox_url')
        .or(`name.ilike.%${input.sale_search}%,client_org.ilike.%${input.sale_search}%`)
        .not('dropbox_url', 'is', null)
        .limit(1)
      if (isMember) query = query.eq('assignee_id', userId)
      const { data } = await query
      if (!data || data.length === 0) return { error: isMember ? '본인 담당 건 중에 해당 폴더를 찾을 수 없어.' : '해당 건의 Dropbox 폴더를 찾을 수 없어. dropbox_url이 없는 건일 수도 있어.' }
      const url = data[0].dropbox_url as string
      folderPath = decodeURIComponent(url.replace('https://www.dropbox.com/home', ''))
      saleName = data[0].name as string
    }

    if (!folderPath) return { error: 'sale_search 또는 path가 필요해.' }

    folderPath = folderPath.replace(/\/$/, '')

    const toAsciiSafe = (obj: object) =>
      JSON.stringify(obj).replace(/[^\x00-\x7F]/g, c => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`)

    let pdfFile: { name: string; path_display: string }
    if (folderPath.toLowerCase().endsWith('.pdf')) {
      pdfFile = { name: folderPath.split('/').pop() ?? 'file.pdf', path_display: folderPath }
    } else {
      const listRes = await fetch('https://api.dropboxapi.com/2/files/list_folder', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Dropbox-API-Path-Root': pathRootHeader,
        },
        body: JSON.stringify({ path: folderPath, recursive: true }),
      })
      const listData = await listRes.json()
      if (listData.error_summary) return { error: `폴더 조회 실패: ${listData.error_summary}` }

      type DropboxEntry = { '.tag': string; name: string; path_display: string }
      const pdfs = ((listData.entries || []) as DropboxEntry[]).filter(
        e => e['.tag'] === 'file' && e.name.toLowerCase().endsWith('.pdf')
      )
      if (pdfs.length === 0) return { error: `"${folderPath}" 폴더에 PDF 파일이 없어.` }
      if (pdfs.length > 1) return { error: `폴더에 PDF가 ${pdfs.length}개 있어: ${pdfs.map(p => p.name).join(', ')}\n어떤 파일 읽을지 알려줘.` }
      pdfFile = pdfs[0]
    }

    const dlRes = await fetch('https://content.dropboxapi.com/2/files/download', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Dropbox-API-Arg': toAsciiSafe({ path: pdfFile.path_display }),
        'Dropbox-API-Path-Root': pathRootHeader,
      },
    })
    if (!dlRes.ok) return { error: `PDF 다운로드 실패: ${dlRes.status}` }

    const pdfBuffer = await dlRes.arrayBuffer()
    const base64Data = Buffer.from(pdfBuffer).toString('base64')

    // Claude로 PDF 직접 분석 (base64 document)
    const analysisRes = await getClient().messages.create({
      model: MODEL,
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'document',
            source: {
              type: 'base64',
              media_type: 'application/pdf',
              data: base64Data,
            },
          } as unknown as Anthropic.ContentBlockParam,
          {
            type: 'text',
            text: '이 문서에서 다음 정보를 JSON으로만 추출해줘:\n{"total_amount": 총금액(숫자,원단위,없으면null), "summary": "핵심내용 2~3줄", "date": "날짜(YYYY-MM-DD,없으면null)", "items": ["주요항목1","항목2"]}',
          },
        ],
      }],
    })
    logApiUsage({ model: MODEL, endpoint: 'chat', userId, inputTokens: analysisRes.usage.input_tokens, outputTokens: analysisRes.usage.output_tokens }).catch(() => {})

    const analysisText = analysisRes.content[0].type === 'text' ? analysisRes.content[0].text : ''
    const jsonMatch = analysisText.match(/\{[\s\S]*\}/)
    let extracted = null
    try { if (jsonMatch) extracted = JSON.parse(jsonMatch[0]) } catch { /* ignore */ }

    return { filename: pdfFile.name, sale_name: saleName, extracted, raw: extracted ? undefined : analysisText }
  }

  if (name === 'update_sale_revenue') {
    let findQuery = supabase
      .from('sales')
      .select('id, name, revenue')
      .or(`name.ilike.%${input.search}%,client_org.ilike.%${input.search}%`)
      .limit(1)
    if (isMember) findQuery = findQuery.eq('assignee_id', userId)

    const { data: found, error: findErr } = await findQuery
    if (findErr) return { error: findErr.message }
    if (!found || found.length === 0) return { error: '해당 건을 찾을 수 없어.' }

    const sale = found[0]
    const { error: updateErr } = await supabase
      .from('sales')
      .update({ revenue: input.revenue })
      .eq('id', sale.id)

    if (updateErr) return { error: updateErr.message }
    return { success: true, name: sale.name, prev_revenue: sale.revenue, new_revenue: input.revenue }
  }

  if (name === 'update_sale_status') {
    const validStatuses = ['계약', '착수', '선금', '중도금', '완수', '계산서발행', '잔금']
    if (!validStatuses.includes(input.contract_stage as string)) {
      return { error: `유효하지 않은 단계야. 가능한 값: ${validStatuses.join(', ')}` }
    }

    let findQuery = supabase
      .from('sales')
      .select('id, name, contract_stage')
      .or(`name.ilike.%${input.search}%,client_org.ilike.%${input.search}%`)
      .limit(1)
    if (isMember) findQuery = findQuery.eq('assignee_id', userId)

    const { data: found, error: findErr } = await findQuery
    if (findErr) return { error: findErr.message }
    if (!found || found.length === 0) return { error: '해당 건을 찾을 수 없어.' }

    const sale = found[0]
    const { error: updateErr } = await supabase
      .from('sales')
      .update({ contract_stage: input.contract_stage })
      .eq('id', sale.id)

    if (updateErr) return { error: updateErr.message }
    return { success: true, name: sale.name, prev_status: sale.contract_stage, new_status: input.contract_stage }
  }

  if (name === 'update_notion_status') {
    const token = process.env.NOTION_TOKEN
    if (!token) return { error: 'NOTION_TOKEN not set' }

    const pageId = (input.page_id as string).replace(/-/g, '')
    const res = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', 'Notion-Version': '2022-06-28' },
      body: JSON.stringify({ properties: { '상태': { status: { name: input.status } } } }),
    })
    const data = await res.json()
    if (data.object === 'error') return { error: data.message }
    return { success: true, new_status: input.status }
  }

  if (name === 'search_notion_projects') {
    const token = process.env.NOTION_TOKEN
    if (!token) return { error: 'NOTION_TOKEN not set' }

    const NOTION_DB_ID = '6401e402-25e9-4941-a89e-6e3107df5f74'
    const filters: unknown[] = []
    if (input.search) filters.push({ property: 'Project name', title: { contains: input.search as string } })
    if (input.status) filters.push({ property: '상태', status: { equals: input.status as string } })

    const body: Record<string, unknown> = {
      page_size: 20,
      sorts: [{ property: '기간', direction: 'descending' }],
    }
    if (filters.length === 1) body.filter = filters[0]
    else if (filters.length > 1) body.filter = { and: filters }

    const res = await fetch(`https://api.notion.com/v1/databases/${NOTION_DB_ID}/query`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', 'Notion-Version': '2022-06-28' },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    if (data.object === 'error') return { error: data.message }

    const projects = (data.results || []).map((page: Record<string, unknown>) => {
      const props = page.properties as Record<string, unknown>
      const titleProp = props['Project name'] as { title: { plain_text: string }[] }
      const statusProp = props['상태'] as { status: { name: string } }
      const dateProp = props['기간'] as { date: { start: string; end: string | null } | null }
      const pmProp = props['PM'] as { people: { name: string }[] }
      return {
        id: page.id,
        name: titleProp?.title?.[0]?.plain_text || '',
        status: statusProp?.status?.name || '',
        date: dateProp?.date || null,
        pm: pmProp?.people?.map((p) => p.name) || [],
        url: page.url,
      }
    })

    return { count: projects.length, projects }
  }

  if (name === 'get_notion_project_content') {
    const token = process.env.NOTION_TOKEN
    if (!token) return { error: 'NOTION_TOKEN not set' }

    const pageId = (input.page_id as string).replace(/-/g, '')
    const res = await fetch(`https://api.notion.com/v1/blocks/${pageId}/children?page_size=100`, {
      headers: { 'Authorization': `Bearer ${token}`, 'Notion-Version': '2022-06-28' },
    })
    const data = await res.json()
    if (data.object === 'error') return { error: data.message }

    type NotionBlock = { type: string; [key: string]: unknown }
    const blocks = (data.results || []).map((block: NotionBlock) => {
      const type = block.type as string
      const content = block[type] as { rich_text?: { plain_text: string }[]; checked?: boolean } | undefined
      const text = content?.rich_text?.map((t) => t.plain_text).join('') || ''
      return { type, text, checked: content?.checked }
    }).filter((b: { text: string }) => b.text)

    return { blocks }
  }

  if (name === 'search_dropbox') {
    const token = await getDropboxToken()
    if (!token) return { error: 'Dropbox 토큰 발급 실패.' }
    const rootNs = process.env.DROPBOX_ROOT_NAMESPACE ?? '3265523555'

    const searchPath = userRole === 'admin' ? '' : '/방 준영/1. 가업/★ DB'

    const res = await fetch('https://api.dropboxapi.com/2/files/search_v2', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Dropbox-API-Path-Root': JSON.stringify({ '.tag': 'root', 'root': rootNs }),
      },
      body: JSON.stringify({
        query: input.query,
        options: { path: searchPath, max_results: 15, file_status: 'active' },
      }),
    })
    const data = await res.json()
    if (data.error_summary) return { error: data.error_summary }

    type DropboxMatch = { metadata: { metadata: { '.tag': string; name: string; path_display: string } } }
    let results = (data.matches || []).map((m: DropboxMatch) => ({
      type: m.metadata.metadata['.tag'],
      name: m.metadata.metadata.name,
      path: m.metadata.metadata.path_display,
    }))

    if (isMember) {
      const { data: mySales } = await supabase
        .from('sales')
        .select('dropbox_url')
        .eq('assignee_id', userId)
        .not('dropbox_url', 'is', null)
      const myPaths = (mySales || []).map(s =>
        decodeURIComponent((s.dropbox_url as string).replace('https://www.dropbox.com/home', ''))
      )
      results = results.filter((r: { path: string }) => myPaths.some(p => r.path.startsWith(p)))
    }

    return { count: results.length, results }
  }

  if (name === 'search_leads') {
    let query = supabase
      .from('leads')
      .select('id, lead_id, client_org, contact_name, service_type, status, remind_date, inflow_date, assignee_id, converted_sale_id')
      .order('inflow_date', { ascending: false })
      .limit(20)

    if (isMember) query = query.eq('assignee_id', userId)
    if (input.search) query = query.or(`client_org.ilike.%${input.search}%,contact_name.ilike.%${input.search}%`)
    if (input.status) query = query.eq('status', input.status)

    const { data, error } = await query
    if (error) return { error: error.message }
    return { count: data?.length, leads: data }
  }

  if (name === 'create_lead') {
    if (isMember) return { error: '팀원 권한으로는 리드 생성 불가.' }

    const clientOrg = ((input.client_org as string) || '').trim()
    if (!clientOrg) return { error: '기관명은 필수야.' }

    const { data: existing } = await supabase
      .from('leads')
      .select('id, lead_id, status, client_org, service_type')
      .ilike('client_org', `%${clientOrg}%`)
      .neq('status', '취소')
      .limit(5)

    if (existing && existing.length > 0 && !input.confirm) {
      const list = existing.map(e => `• ${e.lead_id} [${e.service_type || '미지정'}] ${e.status}`).join('\n')
      return {
        duplicate_warning: true,
        existing_count: existing.length,
        message: `⚠️ "${clientOrg}" 활성 리드 ${existing.length}건 있어:\n${list}\n\n그래도 새로 등록할까? (confirm=true로 재호출)`,
      }
    }

    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    const prefix = `LEAD${today}-`
    const { data: lastId } = await supabase
      .from('leads')
      .select('lead_id')
      .ilike('lead_id', `${prefix}%`)
      .order('lead_id', { ascending: false })
      .limit(1)
    const num = lastId && lastId.length > 0 ? parseInt(lastId[0].lead_id.slice(-4)) + 1 : 1
    const lead_id = `${prefix}${String(num).padStart(4, '0')}`

    let assignee_id: string | null = null
    if (input.assignee_name) {
      const { data: assignee } = await supabase
        .from('profiles')
        .select('id')
        .ilike('name', `%${input.assignee_name}%`)
        .limit(1)
      assignee_id = assignee?.[0]?.id || null
    }

    const adminDb = createAdminClient()
    const customerId = await resolveCustomerId(adminDb, {
      customer_id: input.customer_id as string | null | undefined,
      client_org: clientOrg,
    })

    const { data: lead, error } = await supabase.from('leads').insert({
      lead_id,
      client_org: clientOrg,
      customer_id: customerId,
      project_name: (input.project_name as string) || null,
      contact_name: (input.contact_name as string) || null,
      phone: (input.phone as string) || null,
      email: (input.email as string) || null,
      service_type: (input.service_type as string) || null,
      initial_content: (input.initial_content as string) || null,
      inflow_date: (input.inflow_date as string) || new Date().toISOString().slice(0, 10),
      remind_date: (input.remind_date as string) || null,
      channel: (input.channel as string) || null,
      inflow_source: (input.inflow_source as string) || null,
      assignee_id,
      status: '유입',
    }).select('id, lead_id').single()

    if (error) return { error: error.message }
    return { success: true, lead_id: lead.lead_id, id: lead.id, message: `리드 등록 완료! (${lead.lead_id})` }
  }

  if (name === 'update_lead') {
    type LeadRow = { id: string; lead_id: string; client_org: string; status: string; contact_1: string | null; contact_2: string | null; contact_3: string | null }
    let lead: LeadRow | null = null

    if (input.lead_id) {
      let q = supabase.from('leads').select('id, lead_id, client_org, status, contact_1, contact_2, contact_3').eq('lead_id', input.lead_id as string)
      if (isMember) q = q.eq('assignee_id', userId)
      const { data, error: e } = await q.single()
      if (e || !data) return { error: `리드 ID ${input.lead_id}를 찾을 수 없어.` }
      lead = data as LeadRow
    } else if (input.search) {
      let q = supabase.from('leads').select('id, lead_id, client_org, status, contact_1, contact_2, contact_3').or(`client_org.ilike.%${input.search}%,contact_name.ilike.%${input.search}%`).limit(5)
      if (isMember) q = q.eq('assignee_id', userId)
      const { data: found, error: findErr } = await q
      if (findErr) return { error: findErr.message }
      if (!found || found.length === 0) return { error: '해당 리드를 찾을 수 없어.' }
      if (found.length > 1) {
        return {
          multiple: true,
          message: `"${input.search}" 검색 결과 ${found.length}건. lead_id로 특정해줘.`,
          leads: (found as LeadRow[]).map(l => ({ lead_id: l.lead_id, client_org: l.client_org, status: l.status })),
        }
      }
      lead = found[0] as LeadRow
    } else {
      return { error: 'search 또는 lead_id 중 하나는 필요해.' }
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (input.status) updates.status = input.status
    if (input.service_type) updates.service_type = input.service_type
    if (input.remind_date) updates.remind_date = input.remind_date
    if (input.notes) updates.notes = input.notes
    if (input.contact_log) {
      if (!lead.contact_1) updates.contact_1 = input.contact_log
      else if (!lead.contact_2) updates.contact_2 = input.contact_log
      else updates.contact_3 = input.contact_log
    }

    const { error: updateErr } = await supabase.from('leads').update(updates).eq('id', lead.id)
    if (updateErr) return { error: updateErr.message }
    return { success: true, lead_id: lead.lead_id, client_org: lead.client_org, updates }
  }

  if (name === 'convert_lead_to_sale') {
    if (isMember) return { error: '팀원 권한으로는 매출건 전환 불가.' }

    let lead: Record<string, unknown> | null = null

    if (input.lead_id) {
      const { data, error: e } = await supabase.from('leads').select('*').eq('lead_id', input.lead_id as string).single()
      if (e || !data) return { error: `리드 ID ${input.lead_id}를 찾을 수 없어.` }
      if (data.converted_sale_id) return { error: '이미 전환된 리드야.' }
      lead = data
    } else if (input.search) {
      const { data: found, error: findErr } = await supabase
        .from('leads').select('*')
        .or(`client_org.ilike.%${input.search}%,contact_name.ilike.%${input.search}%`)
        .is('converted_sale_id', null).limit(5)
      if (findErr) return { error: findErr.message }
      if (!found || found.length === 0) return { error: '전환 가능한 리드를 찾을 수 없어. 이미 전환됐거나 없는 건이야.' }
      if (found.length > 1) {
        return {
          multiple: true,
          message: `"${input.search}" 검색 결과 ${found.length}건. 어떤 건을 전환할지 lead_id로 특정해줘.`,
          leads: found.map(l => ({ lead_id: l.lead_id, client_org: l.client_org, service_type: l.service_type, status: l.status })),
        }
      }
      lead = found[0]
    } else {
      return { error: 'search 또는 lead_id 중 하나는 필요해.' }
    }

    const finalLead = lead!
    const serviceType = finalLead.service_type as string | null
    const DEPT_MAP: Record<string, string> = {
      'SOS': 'sound_of_school', '002ENT': '002_entertainment', '교육프로그램': 'artkiwoom',
      '납품설치': 'school_store', '유지보수': 'school_store', '교구대여': 'school_store', '제작인쇄': 'school_store',
      '콘텐츠제작': '002_creative', '행사운영': '002_creative', '행사대여': '002_creative', '프로젝트': '002_creative',
    }
    const department = (serviceType && DEPT_MAP[serviceType]) || null
    const convProjectNumber = await generateProjectNumber()
    const convName = `${convProjectNumber} ${finalLead.client_org || '(리드전환)'}`
    const adminDb = createAdminClient()
    const leadCustomerId = (finalLead.customer_id as string | null) ?? null
    const customerId = leadCustomerId
      ?? await resolveCustomerId(adminDb, { client_org: finalLead.client_org as string | null })

    const { data: sale, error: saleErr } = await supabase.from('sales').insert({
      name: convName,
      client_org: finalLead.client_org,
      customer_id: customerId,
      service_type: serviceType,
      department,
      assignee_id: finalLead.assignee_id,
      revenue: 0,
      contract_stage: '계약',
      memo: finalLead.initial_content,
      inflow_date: finalLead.inflow_date || new Date().toISOString().slice(0, 10),
      project_number: convProjectNumber,
      lead_id: finalLead.id,
    }).select('id').single()

    if (saleErr) return { error: saleErr.message }

    // 프로젝트 자동 생성 (orphan sales 방지)
    const projectId = await ensureProjectForSale({
      saleId: sale.id,
      name: convName,
      service_type: serviceType,
      department,
      customer_id: customerId,
      pm_id: (finalLead.assignee_id as string | null) ?? null,
      project_number: convProjectNumber,
      dropbox_url: null,
    })

    await supabase.from('leads').update({
      converted_sale_id: sale.id,
      project_id: projectId,
      status: '완료',
      updated_at: new Date().toISOString(),
    }).eq('id', finalLead.id)

    return { success: true, lead_id: finalLead.lead_id, client_org: finalLead.client_org, sale_id: sale.id, message: `"${finalLead.client_org}" 리드가 매출건으로 전환됐어! /sales/report에서 수정해줘.` }
  }

  if (name === 'search_customers') {
    const adminDb = createAdminClient()
    const query = input.query as string | undefined
    const typeFilter = input.type as string | undefined

    let orgQuery = adminDb
      .from('customers')
      .select('*')
      .order('name')
      .limit(15)
    if (query) orgQuery = orgQuery.ilike('name', `%${query}%`)
    if (typeFilter) orgQuery = orgQuery.eq('type', typeFilter)

    let personQuery = adminDb
      .from('persons')
      .select('*')
      .order('name')
      .limit(15)
    if (query) personQuery = personQuery.ilike('name', `%${query}%`)

    const [{ data: orgs, error: orgErr }, { data: persons, error: personErr }] = await Promise.all([orgQuery, personQuery])

    if (orgErr) return { error: orgErr.message }
    if (personErr) return { error: personErr.message }

    return {
      organizations: orgs ?? [],
      persons: persons ?? [],
      total_orgs: orgs?.length ?? 0,
      total_persons: persons?.length ?? 0,
    }
  }

  if (name === 'quick_create_customer') {
    if (isMember) return { error: '팀원 권한으로는 고객 생성 불가.' }
    const orgName = ((input.name as string) || '').trim()
    if (!orgName) return { error: '기관명은 필수야.' }
    const adminDb = createAdminClient()
    const result = await quickCreateCustomer(adminDb, {
      name: orgName,
      type: input.type as string | null | undefined,
      contact_name: input.contact_name as string | null | undefined,
      contact_dept: input.contact_dept as string | null | undefined,
      contact_title: input.contact_title as string | null | undefined,
      phone: input.phone as string | null | undefined,
      email: input.email as string | null | undefined,
    })
    if ('error' in result) return result
    revalidatePath('/customers')
    return { success: true, customer_id: result.customer_id, person_id: result.person_id ?? null, message: `"${orgName}" 등록 완료. 이 customer_id로 create_sale/create_lead 호출해.` }
  }

  if (name === 'find_duplicate_customers') {
    if (isMember) return { error: '팀원 권한으로는 고객DB 정리 불가.' }
    const adminDb = createAdminClient()
    const keyword = (input.keyword as string | undefined)?.trim()
    let q = adminDb.from('customers').select('id, name, type, status').order('name')
    if (keyword) q = q.ilike('name', `%${keyword}%`)
    const { data: rows, error } = await q
    if (error) return { error: error.message }
    if (!rows || rows.length === 0) return { groups: [], message: '대상 없음.' }

    // 정규화: 공백·괄호·법인격(주식회사·㈜·(주)) 제거
    const normalize = (s: string) => s
      .replace(/\(주\)|㈜|주식회사|유한회사|\(유\)|㈠|\bcorp\b|\binc\b/gi, '')
      .replace(/[\s·\-,.]/g, '')
      .toLowerCase()
    const groups = new Map<string, typeof rows>()
    for (const r of rows) {
      const key = normalize(r.name).slice(0, 6) || normalize(r.name)
      if (!key) continue
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(r)
    }
    const dupes = Array.from(groups.values()).filter(g => g.length > 1)
    return {
      total_groups: dupes.length,
      groups: dupes.map(g => ({
        normalized: normalize(g[0].name).slice(0, 6),
        candidates: g.map(c => ({ id: c.id, name: c.name, type: c.type, status: c.status })),
      })),
      message: dupes.length === 0 ? '중복 의심 후보 없음.' : `중복 후보 ${dupes.length}그룹. merge_customers로 통합.`,
    }
  }

  if (name === 'merge_customers') {
    if (isMember) return { error: '팀원 권한으로는 고객DB 정리 불가.' }
    const keepId = (input.keep_id as string | undefined)?.trim()
    const mergeIds = (input.merge_ids as string[] | undefined) ?? []
    if (!keepId || mergeIds.length === 0) return { error: 'keep_id와 merge_ids 모두 필요.' }
    if (mergeIds.includes(keepId)) return { error: 'keep_id가 merge_ids에 포함돼 있어.' }

    const adminDb = createAdminClient()
    const { data: keep } = await adminDb.from('customers').select('id, name').eq('id', keepId).maybeSingle()
    if (!keep) return { error: 'keep_id에 해당하는 customer를 찾을 수 없어.' }

    let salesUpdated = 0, leadsUpdated = 0, projectsUpdated = 0, relationsUpdated = 0
    for (const mergeId of mergeIds) {
      const { data: s } = await adminDb.from('sales').update({ customer_id: keepId }).eq('customer_id', mergeId).select('id')
      salesUpdated += s?.length ?? 0
      const { data: l } = await adminDb.from('leads').update({ customer_id: keepId }).eq('customer_id', mergeId).select('id')
      leadsUpdated += l?.length ?? 0
      const { data: p } = await adminDb.from('projects').update({ customer_id: keepId }).eq('customer_id', mergeId).select('id')
      projectsUpdated += p?.length ?? 0
      const { data: r } = await adminDb.from('person_org_relations').update({ customer_id: keepId }).eq('customer_id', mergeId).select('id')
      relationsUpdated += r?.length ?? 0
    }
    const { error: delErr } = await adminDb.from('customers').delete().in('id', mergeIds)
    if (delErr) return { error: `통합은 됐는데 삭제 실패: ${delErr.message}` }

    revalidatePath('/customers')
    return {
      success: true,
      kept: { id: keep.id, name: keep.name },
      merged_count: mergeIds.length,
      sales_moved: salesUpdated,
      leads_moved: leadsUpdated,
      projects_moved: projectsUpdated,
      relations_moved: relationsUpdated,
    }
  }

  if (name === 'find_orphan_sales') {
    if (isMember) return { error: '팀원 권한으로는 전체 sales 조회 불가.' }
    const adminDb = createAdminClient()
    const limit = (input.limit as number) || 50
    const keyword = (input.keyword as string | undefined)?.trim()
    let q = adminDb
      .from('sales')
      .select('id, name, client_org, service_type, inflow_date, contract_stage')
      .is('customer_id', null)
      .order('inflow_date', { ascending: false })
      .limit(limit)
    if (keyword) q = q.ilike('client_org', `%${keyword}%`)
    const { data, error } = await q
    if (error) return { error: error.message }
    return { count: data?.length ?? 0, sales: data ?? [] }
  }

  if (name === 'find_orphan_leads') {
    if (isMember) return { error: '팀원 권한으로는 전체 leads 조회 불가.' }
    const adminDb = createAdminClient()
    const limit = (input.limit as number) || 50
    const keyword = (input.keyword as string | undefined)?.trim()
    let q = adminDb
      .from('leads')
      .select('id, lead_id, client_org, contact_name, service_type, status, inflow_date')
      .is('customer_id', null)
      .order('inflow_date', { ascending: false })
      .limit(limit)
    if (keyword) q = q.ilike('client_org', `%${keyword}%`)
    const { data, error } = await q
    if (error) return { error: error.message }
    return { count: data?.length ?? 0, leads: data ?? [] }
  }

  if (name === 'match_lead_to_customer') {
    if (isMember) return { error: '팀원 권한으로는 leads 매핑 불가.' }
    const idStr = (input.lead_id as string | undefined)?.trim()
    const customerId = (input.customer_id as string | undefined)?.trim()
    if (!idStr || !customerId) return { error: 'lead_id와 customer_id 모두 필요.' }
    const adminDb = createAdminClient()
    const { data: customer } = await adminDb.from('customers').select('id, name').eq('id', customerId).maybeSingle()
    if (!customer) return { error: 'customer_id에 해당하는 customer를 찾을 수 없음.' }

    const isUuid = /^[0-9a-f]{8}-/.test(idStr)
    const { data: lead } = isUuid
      ? await adminDb.from('leads').select('id, lead_id, client_org').eq('id', idStr).maybeSingle()
      : await adminDb.from('leads').select('id, lead_id, client_org').eq('lead_id', idStr).maybeSingle()
    if (!lead) return { error: 'lead를 찾을 수 없음.' }

    const { error: uErr } = await adminDb
      .from('leads')
      .update({ customer_id: customerId, updated_at: new Date().toISOString() })
      .eq('id', lead.id)
    if (uErr) return { error: uErr.message }
    revalidatePath('/leads')
    return { success: true, lead: { id: lead.id, lead_id: lead.lead_id, client_org: lead.client_org }, customer: { id: customer.id, name: customer.name } }
  }

  if (name === 'match_sale_to_customer') {
    if (isMember) return { error: '팀원 권한으로는 sales 매핑 불가.' }
    const saleId = (input.sale_id as string | undefined)?.trim()
    const customerId = (input.customer_id as string | undefined)?.trim()
    if (!saleId || !customerId) return { error: 'sale_id와 customer_id 모두 필요.' }
    const adminDb = createAdminClient()
    const { data: customer } = await adminDb.from('customers').select('id, name').eq('id', customerId).maybeSingle()
    if (!customer) return { error: 'customer_id에 해당하는 customer를 찾을 수 없어.' }
    const { data: sale } = await adminDb.from('sales').select('id, name, project_id').eq('id', saleId).maybeSingle()
    if (!sale) return { error: 'sale_id에 해당하는 sale을 찾을 수 없어.' }

    const { error: sErr } = await adminDb.from('sales').update({ customer_id: customerId }).eq('id', saleId)
    if (sErr) return { error: sErr.message }
    if (sale.project_id) {
      await adminDb.from('projects').update({ customer_id: customerId }).eq('id', sale.project_id)
    }
    return { success: true, sale: { id: sale.id, name: sale.name }, customer: { id: customer.id, name: customer.name } }
  }

  if (name === 'list_dropbox_files') {
    const token = await getDropboxToken()
    if (!token) return { error: 'Dropbox 토큰 발급 실패. 환경변수 확인 필요.' }
    const rootNs = process.env.DROPBOX_ROOT_NAMESPACE ?? '3265523555'

    let folderPath = input.path as string | undefined

    const isNonAdmin = userRole !== 'admin'

    if (isNonAdmin && input.path) return { error: '직접 경로로 드롭박스 접근은 불가능해. 건명으로 검색해줘.' }

    if (!folderPath && input.sale_search) {
      let query = supabase
        .from('sales')
        .select('name, dropbox_url')
        .or(`name.ilike.%${input.sale_search}%,client_org.ilike.%${input.sale_search}%`)
        .not('dropbox_url', 'is', null)
        .limit(1)
      if (isMember) query = query.eq('assignee_id', userId)
      const { data } = await query
      if (!data || data.length === 0) return { error: isMember ? '본인 담당 건 중에 해당 폴더를 찾을 수 없어.' : '해당 건의 Dropbox 폴더를 찾을 수 없어.' }
      const url = data[0].dropbox_url as string
      folderPath = decodeURIComponent(url.replace('https://www.dropbox.com/home', ''))
    }

    if (!folderPath) return { error: 'path 또는 sale_search 필요해.' }

    const res = await fetch('https://api.dropboxapi.com/2/files/list_folder', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Dropbox-API-Path-Root': JSON.stringify({ '.tag': 'root', 'root': rootNs }),
      },
      body: JSON.stringify({ path: folderPath, recursive: false }),
    })
    const data = await res.json()
    if (data.error_summary) return { error: data.error_summary }

    type DropboxEntry = { '.tag': string; name: string; path_display: string; size?: number }
    const entries = (data.entries || []).map((e: DropboxEntry) => ({
      type: e['.tag'],
      name: e.name,
      path: e.path_display,
      size: e.size,
    }))

    return { path: folderPath, count: entries.length, files: entries }
  }

  if (name === 'add_project_log') {
    const admin = createAdminClient()
    let saleId: string | null = (input.sale_id as string) || null
    let leadId: string | null = (input.lead_id as string) || null

    // input에 명시 없으면 projectId 컨텍스트에서 자동 매핑
    if (!saleId && !leadId && projectId) {
      const { data: sales } = await admin.from('sales').select('id').eq('project_id', projectId).order('created_at').limit(1)
      saleId = sales?.[0]?.id ?? null
    }

    // lead_id, sale_id 둘 다 없으면 error (BrainDump에서 search 안 한 경우)
    if (!saleId && !leadId) {
      return { error: '소통 내역을 저장하려면 lead_id 또는 sale_id가 필요해. 먼저 search_leads / get_sales로 찾은 뒤 그 id를 넘겨줘.' }
    }

    // ID 검증 (오타·환각 방지)
    if (leadId) {
      const { data: leadCheck } = await admin.from('leads').select('id').eq('id', leadId).maybeSingle()
      if (!leadCheck) return { error: `lead_id ${leadId} 존재하지 않음. search_leads로 다시 찾아줘.` }
    }
    if (saleId) {
      const { data: saleCheck } = await admin.from('sales').select('id').eq('id', saleId).maybeSingle()
      if (!saleCheck) return { error: `sale_id ${saleId} 존재하지 않음. get_sales로 다시 찾아줘.` }
    }

    const contactedAt = (input.contacted_at as string)
      ? new Date(input.contacted_at as string).toISOString()
      : new Date().toISOString()

    const participantsInput = input.participants as string[] | undefined
    const { data: inserted, error } = await admin.from('project_logs').insert({
      lead_id: leadId,
      sale_id: saleId,
      content: input.content,
      log_type: (input.log_type as string) || '메모',
      author_id: userId,
      contacted_at: contactedAt,
      location: (input.location as string) || null,
      participants: participantsInput?.length ? participantsInput : null,
      outcome: (input.outcome as string) || null,
    }).select('id').single()

    if (error) return { error: error.message }
    revalidatePath('/leads')
    if (projectId) {
      revalidatePath(`/projects/${projectId}`)
    }
    return {
      success: true,
      log_id: inserted?.id,
      target: leadId ? `lead ${leadId.slice(0, 8)}` : `sale ${saleId?.slice(0, 8)}`,
      message: leadId ? '리드 소통 내역 저장 완료' : '계약 소통 내역 저장 완료',
    }
  }

  if (name === 'update_project_status') {
    if (!projectId) return { error: '프로젝트 페이지에서만 사용 가능해.' }
    const admin = createAdminClient()
    const { error } = await admin
      .from('projects')
      .update({ status: input.status, updated_at: new Date().toISOString() })
      .eq('id', projectId)
    if (error) return { error: error.message }
    revalidatePath(`/projects/${projectId}`)
    return { success: true, message: `프로젝트 상태를 "${input.status}"로 변경했어.` }
  }

  if (name === 'update_brief_note') {
    if (!projectId) return { error: '프로젝트 페이지에서만 사용 가능해.' }
    const admin = createAdminClient()
    const { data: project } = await admin.from('projects').select('dropbox_url, name, service_type').eq('id', projectId).single()

    let folderUrl = project?.dropbox_url as string | null

    if (!folderUrl) {
      if (!project?.service_type || !project?.name) {
        return { error: 'Dropbox 폴더가 없고 서비스 유형이나 프로젝트명이 없어서 자동 생성 불가. 수동으로 연결해줘.' }
      }
      folderUrl = await createSaleFolder({ service_type: project.service_type, name: project.name, inflow_date: null }).catch(() => null)
      if (folderUrl) {
        await admin.from('projects').update({ dropbox_url: folderUrl, updated_at: new Date().toISOString() }).eq('id', projectId)
      }
    }

    if (!folderUrl) return { error: 'Dropbox 폴더 자동 생성 실패. 직접 연결해줘.' }

    const folderPath = decodeURIComponent(folderUrl.replace('https://www.dropbox.com/home', '')).replace(/\/$/, '')
    const existing = await readDropboxFile(`${folderPath}/brief.md`).catch(() => null)
    const existingText = existing && !('error' in existing) ? existing.text : ''
    const updated = appendAiNote(existingText, input.note as string)
    await uploadTextFile({ folderWebUrl: folderUrl, filename: 'brief.md', content: updated })
    const wasCreated = !project?.dropbox_url
    return { success: true, message: wasCreated ? `Dropbox 폴더 새로 만들고 brief 저장했어.` : 'brief.md AI 협업 노트에 저장했어.' }
  }

  if (name === 'set_dropbox_url') {
    if (!projectId) return { error: '프로젝트 페이지에서만 사용 가능해.' }
    const url = input.dropbox_url as string
    if (!url.startsWith('https://www.dropbox.com')) return { error: 'Dropbox URL 형식이 맞지 않아.' }
    const admin = createAdminClient()
    const { error } = await admin.from('projects').update({ dropbox_url: url, updated_at: new Date().toISOString() }).eq('id', projectId)
    if (error) return { error: error.message }
    return { success: true, message: 'Dropbox 폴더 연결했어. 이제 brief 저장이나 파일 조회 가능해.' }
  }

  // 현재 프로젝트의 첫 번째 sale.id (task의 project_id 컬럼이 sale.id를 가리킴)
  async function getProjectFirstSaleId(): Promise<string | null> {
    if (!projectId) return null
    const admin = createAdminClient()
    const { data } = await admin
      .from('sales')
      .select('id')
      .eq('project_id', projectId)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()
    return data?.id ?? null
  }

  // 프로젝트 컨텍스트 내에서 task 검색 (task_id 우선, 그다음 title 부분 매칭)
  type TaskFindResult =
    | { kind: 'one'; task: { id: string; title: string; status: string; project_id: string | null } }
    | { kind: 'many'; tasks: { id: string; title: string; status: string }[] }
    | { error: string }
  async function findProjectTask(taskId: string | undefined, title: string | undefined): Promise<TaskFindResult> {
    if (!projectId) return { error: '프로젝트 페이지에서만 사용 가능해.' }
    const admin = createAdminClient()
    const { data: sales } = await admin.from('sales').select('id').eq('project_id', projectId)
    const saleIds = (sales ?? []).map(s => s.id)
    if (saleIds.length === 0) return { error: '이 프로젝트에 연결된 계약이 없어. 할 일은 계약 단위로 관리돼.' }

    if (taskId) {
      const { data } = await admin.from('tasks').select('id, title, status, project_id').eq('id', taskId).maybeSingle()
      if (!data || !saleIds.includes(data.project_id ?? '')) return { error: '이 프로젝트에 해당 할 일이 없어.' }
      return { kind: 'one', task: data }
    }
    if (!title) return { error: 'task_id 또는 title이 필요해.' }
    const { data: matches } = await admin
      .from('tasks')
      .select('id, title, status, project_id')
      .in('project_id', saleIds)
      .ilike('title', `%${title}%`)
      .limit(10)
    if (!matches || matches.length === 0) return { error: `"${title}" 검색 결과 없음.` }
    if (matches.length > 1) {
      return { kind: 'many', tasks: matches.map(m => ({ id: m.id, title: m.title, status: m.status })) }
    }
    return { kind: 'one', task: matches[0] }
  }

  // 담당자 이름 → profile id (없으면 null). "나"는 현재 user.
  async function resolveAssigneeId(input: string | undefined): Promise<string | null | undefined> {
    if (input === undefined) return undefined
    if (input === '') return null
    if (input === '나' || input === '본인') return userId
    const admin = createAdminClient()
    const { data } = await admin.from('profiles').select('id').ilike('name', `%${input}%`).limit(1)
    return data?.[0]?.id ?? null
  }

  // 프로젝트 컨텍스트의 페이지 캐시 무효화
  function revalidateProjectPages() {
    if (!projectId) return
    revalidatePath(`/projects/${projectId}`)
    revalidatePath('/tasks')
  }

  if (name === 'create_project_task') {
    if (!projectId) return { error: '프로젝트 페이지에서만 사용 가능해.' }
    const title = ((input.title as string) || '').trim()
    if (!title) return { error: '할 일 제목은 필수야.' }
    const saleId = await getProjectFirstSaleId()
    if (!saleId) return { error: '이 프로젝트에 연결된 계약이 없어. 계약을 먼저 만들어줘.' }

    const admin = createAdminClient()

    // 중복 체크 — 같은 프로젝트의 진행 중인 task 중 제목 유사 (force=true 시 무시)
    if (!input.force) {
      const { data: existing } = await admin
        .from('tasks')
        .select('id, title, status, due_date')
        .eq('project_id', saleId)
        .neq('status', '완료')
        .neq('status', '보류')
        .ilike('title', `%${title}%`)
        .limit(5)
      if (existing && existing.length > 0) {
        return {
          duplicate_warning: true,
          message: `유사한 할일이 이미 ${existing.length}건 있어. 정말 추가할거면 force=true로 재호출:\n` +
            existing.map(t => `- "${t.title}" [${t.status}${t.due_date ? `, 마감 ${t.due_date}` : ''}]`).join('\n'),
          existing,
        }
      }
    }

    const validPriority = ['긴급', '높음', '보통', '낮음']
    const priority = validPriority.includes(input.priority as string) ? (input.priority as string) : '보통'
    const assigneeId = await resolveAssigneeId(input.assignee_name as string | undefined)

    const { data, error } = await admin.from('tasks').insert({
      project_id: saleId,
      title,
      status: '할 일',
      priority,
      due_date: (input.due_date as string) || null,
      assignee_id: assigneeId ?? null,
      description: (input.description as string) || null,
      bbang_suggested: true,
    }).select('id, title').single()
    if (error) return { error: error.message }
    revalidateProjectPages()
    return { success: true, id: data.id, title: data.title, message: `"${data.title}" 할 일을 추가했어.` }
  }

  if (name === 'complete_task') {
    const found = await findProjectTask(input.task_id as string | undefined, input.title as string | undefined)
    if ('error' in found) return found
    if (found.kind === 'many') {
      return {
        multiple: true,
        message: `여러 건 매칭. task_id로 특정해줘.`,
        tasks: found.tasks,
      }
    }
    const admin = createAdminClient()
    const { error } = await admin
      .from('tasks')
      .update({ status: '완료', updated_at: new Date().toISOString() })
      .eq('id', found.task.id)
    if (error) return { error: error.message }
    revalidateProjectPages()
    return { success: true, id: found.task.id, title: found.task.title, message: `"${found.task.title}" 완료 처리했어.` }
  }

  if (name === 'update_task') {
    const found = await findProjectTask(input.task_id as string | undefined, input.title as string | undefined)
    if ('error' in found) return found
    if (found.kind === 'many') {
      return { multiple: true, message: '여러 건 매칭. task_id로 특정해줘.', tasks: found.tasks }
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (typeof input.new_title === 'string' && input.new_title.trim()) updates.title = input.new_title.trim()
    if (input.priority) {
      if (!['긴급', '높음', '보통', '낮음'].includes(input.priority as string)) {
        return { error: '우선순위는 긴급/높음/보통/낮음 중 하나여야 해.' }
      }
      updates.priority = input.priority
    }
    if (input.due_date !== undefined) updates.due_date = (input.due_date as string) || null
    if (input.status) {
      if (!['할 일', '진행중', '완료', '보류'].includes(input.status as string)) {
        return { error: '상태는 할 일/진행중/완료/보류 중 하나여야 해.' }
      }
      updates.status = input.status
    }
    if (input.assignee_name !== undefined) {
      updates.assignee_id = await resolveAssigneeId(input.assignee_name as string)
    }
    if (input.description !== undefined) updates.description = (input.description as string) || null

    if (Object.keys(updates).length === 1) return { error: '변경할 내용이 없어.' }

    const admin = createAdminClient()
    const { error } = await admin.from('tasks').update(updates).eq('id', found.task.id)
    if (error) return { error: error.message }
    revalidateProjectPages()
    return { success: true, id: found.task.id, title: found.task.title, updates }
  }

  if (name === 'delete_task') {
    const found = await findProjectTask(input.task_id as string | undefined, input.title as string | undefined)
    if ('error' in found) return found
    if (found.kind === 'many') {
      return { multiple: true, message: '여러 건 매칭. task_id로 특정해줘.', tasks: found.tasks }
    }
    const admin = createAdminClient()
    const { error } = await admin.from('tasks').delete().eq('id', found.task.id)
    if (error) return { error: error.message }
    revalidateProjectPages()
    return { success: true, id: found.task.id, title: found.task.title, message: `"${found.task.title}" 삭제했어.` }
  }

  if (name === 'regenerate_overview') {
    if (!projectId) return { error: '프로젝트 페이지에서만 사용 가능해.' }
    const result = await generateAndSaveProjectOverview(projectId)
    if ('error' in result) return result
    return { success: true, summary: result.summary, message: '프로젝트 개요를 재생성했어.' }
  }

  if (name === 'update_pending_discussion') {
    if (!projectId) return { error: '프로젝트 페이지에서만 사용 가능해.' }
    const target = input.target as 'client' | 'internal' | 'vendor' | undefined
    if (!target || !['client', 'internal', 'vendor'].includes(target)) {
      return { error: 'target 필수 (client | internal | vendor)' }
    }
    try {
      await updateProjectPendingDiscussion(projectId, target, (input.content as string) ?? '')
      return { success: true, message: `${target} 협의사항을 업데이트했어.` }
    } catch (e) {
      return { error: e instanceof Error ? e.message : '협의사항 업데이트 실패' }
    }
  }

  if (name === 'create_quote') {
    const admin = createAdminClient()
    const shortName = input.entity_short_name as string
    const { data: entity } = await admin
      .from('business_entities')
      .select('id, short_name')
      .eq('short_name', shortName)
      .maybeSingle()
    if (!entity) {
      return { error: `사업자 short_name="${shortName}" 없음. 사용 가능: 공공이코 / 지지 / 드림` }
    }
    const { createQuote } = await import('@/app/(dashboard)/quotes/actions')
    const result = await createQuote({
      sale_id: input.sale_id as string | undefined,
      project_id: (input.project_id as string | undefined) ?? projectId ?? undefined,
      lead_id: input.lead_id as string | undefined,
      entity_id: entity.id,
      project_name: input.project_name as string,
      client_org: input.client_org as string | undefined,
      client_dept: input.client_dept as string | undefined,
      client_manager: input.client_manager as string | undefined,
      items: input.items as Array<{ name: string; description?: string; qty: number; unit_price: number; category?: string }>,
      notes: input.notes as string | undefined,
      vat_included: input.vat_included as boolean | undefined,
    })
    if (!result.ok) return { error: result.error }
    return {
      success: true,
      quote_number: result.quote_number,
      html_path: result.html_path,
      message: `견적 ${result.quote_number} 생성됨${result.warning ? ` (${result.warning})` : ''}`,
    }
  }

  if (name === 'update_quote') {
    const { updateQuote } = await import('@/app/(dashboard)/quotes/actions')
    const result = await updateQuote({
      quote_id: input.quote_id as string,
      project_name: input.project_name as string | undefined,
      client_org: input.client_org as string | undefined,
      client_dept: input.client_dept as string | undefined,
      client_manager: input.client_manager as string | undefined,
      items: input.items as Array<{ name: string; description?: string; qty: number; unit_price: number; category?: string }> | undefined,
      notes: input.notes as string | undefined,
      vat_included: input.vat_included as boolean | undefined,
      status: input.status as 'draft' | 'sent' | 'accepted' | 'rejected' | 'cancelled' | undefined,
    })
    if (!result.ok) return { error: result.error }
    return {
      success: true,
      quote_number: result.quote_number,
      html_path: result.html_path,
      message: `견적 ${result.quote_number} 수정됨${result.warning ? ` (${result.warning})` : ''}`,
    }
  }

  if (name === 'list_quotes') {
    const { listQuotes } = await import('@/app/(dashboard)/quotes/actions')
    const filter: { sale_id?: string; project_id?: string; lead_id?: string } = {}
    if (input.sale_id) filter.sale_id = input.sale_id as string
    if (input.project_id) filter.project_id = input.project_id as string
    else if (projectId) filter.project_id = projectId
    if (input.lead_id) filter.lead_id = input.lead_id as string
    const quotes = await listQuotes(filter)
    return {
      success: true,
      count: quotes.length,
      quotes: quotes.map(q => ({
        quote_id: q.id,
        quote_number: q.quote_number,
        project_name: q.project_name,
        total: q.total_amount,
        status: q.status,
        created_at: q.created_at,
      })),
    }
  }

  if (name === 'update_short_summary') {
    if (!projectId) return { error: '프로젝트 페이지에서만 사용 가능해.' }
    try {
      await updateProjectShortSummary(projectId, (input.content as string) ?? '')
      return { success: true, message: '한눈에 요약을 업데이트했어.' }
    } catch (e) {
      return { error: e instanceof Error ? e.message : '한눈에 요약 업데이트 실패' }
    }
  }

  if (name === 'regenerate_short_summary') {
    if (!projectId) return { error: '프로젝트 페이지에서만 사용 가능해.' }
    const result = await generateAndSaveProjectShortSummary(projectId)
    if ('error' in result) return result
    return { success: true, summary: result.summary, message: '한눈에 요약을 재생성했어.' }
  }

  if (name === 'regenerate_pending_discussion') {
    if (!projectId) return { error: '프로젝트 페이지에서만 사용 가능해.' }
    const target = input.target as 'client' | 'internal' | 'vendor' | undefined
    if (!target || !['client', 'internal', 'vendor'].includes(target)) {
      return { error: 'target 필수 (client | internal | vendor)' }
    }
    const result = await generateAndSavePendingDiscussion(projectId, target)
    if ('error' in result) return result
    return { success: true, summary: result.summary, message: '협의사항을 재분석했어.' }
  }

  if (name === 'update_overview') {
    if (!projectId) return { error: '프로젝트 페이지에서만 사용 가능해.' }
    const adminDb = createAdminClient()
    const content = (input.content as string) ?? ''
    const { error } = await adminDb.from('projects')
      .update({ overview_summary: content || null, updated_at: new Date().toISOString() })
      .eq('id', projectId)
    if (error) return { error: error.message }
    revalidatePath(`/projects/${projectId}`)
    return { success: true, message: '개요를 업데이트했어.' }
  }

  if (name === 'update_lead_summary') {
    const adminDb = createAdminClient()
    const leadInput = (input.lead_id as string)?.trim()
    if (!leadInput) return { error: 'lead_id 필수.' }
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(leadInput)
    const { data: lead } = isUuid
      ? await adminDb.from('leads').select('id').eq('id', leadInput).maybeSingle()
      : await adminDb.from('leads').select('id').eq('lead_id', leadInput).maybeSingle()
    if (!lead) return { error: `lead_id ${leadInput} 존재하지 않음. search_leads로 다시 찾아줘.` }
    const content = (input.content as string) ?? ''
    const { error } = await adminDb.from('leads')
      .update({ summary_cache: content || null, summary_updated_at: new Date().toISOString() })
      .eq('id', lead.id)
    if (error) return { error: error.message }
    revalidatePath('/leads')
    return { success: true, message: '리드 요약을 업데이트했어.' }
  }

  if (name === 'regenerate_lead_summary') {
    const adminDb = createAdminClient()
    const leadInput = (input.lead_id as string)?.trim()
    if (!leadInput) return { error: 'lead_id 필수.' }
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(leadInput)
    const { data: lead } = isUuid
      ? await adminDb.from('leads').select('id, initial_content').eq('id', leadInput).maybeSingle()
      : await adminDb.from('leads').select('id, initial_content').eq('lead_id', leadInput).maybeSingle()
    if (!lead) return { error: `lead_id ${leadInput} 존재하지 않음.` }
    const { data: logs } = await adminDb
      .from('project_logs')
      .select('content, log_type, contacted_at')
      .eq('lead_id', lead.id)
      .order('contacted_at', { ascending: false })
      .limit(30)
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://yourmate-sales.vercel.app'
    try {
      const r = await fetch(`${baseUrl}/api/lead-summary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead_id: lead.id,
          initial_content: lead.initial_content ?? null,
          logs: logs ?? [],
          force: true,
        }),
      })
      const d = await r.json()
      if (d.error) return { error: d.error }
      revalidatePath('/leads')
      return { success: true, message: '리드 요약을 재생성했어.' }
    } catch (e: unknown) {
      return { error: e instanceof Error ? e.message : '리드 요약 재생성 실패' }
    }
  }

  if (name === 'link_sale_project') {
    const supabase = createAdminClient()
    const sale_id = input.sale_id as string
    const project_id = input.project_id as string
    const role = (input.role as string) || '주계약'
    const revenue_share_pct = typeof input.revenue_share_pct === 'number' ? input.revenue_share_pct : 100
    const cost_share_pct = typeof input.cost_share_pct === 'number' ? input.cost_share_pct : 100
    const note = (input.note as string) ?? null

    const { data: sale } = await supabase.from('sales').select('id, name').eq('id', sale_id).maybeSingle()
    const { data: project } = await supabase.from('projects').select('id, name').eq('id', project_id).maybeSingle()
    if (!sale || !project) return { error: '계약 또는 프로젝트를 찾을 수 없음' }

    const { data, error } = await supabase
      .from('sale_projects')
      .upsert({ sale_id, project_id, role, revenue_share_pct, cost_share_pct, note }, { onConflict: 'sale_id,project_id' })
      .select('*')
      .maybeSingle()
    if (error) return { error: error.message }
    return { success: true, link: data, sale: { id: sale.id, name: sale.name }, project: { id: project.id, name: project.name } }
  }

  if (name === 'unlink_sale_project') {
    const supabase = createAdminClient()
    const sale_id = input.sale_id as string
    const project_id = input.project_id as string
    const { error } = await supabase.from('sale_projects').delete().match({ sale_id, project_id })
    if (error) return { error: error.message }
    return { success: true, sale_id, project_id }
  }

  if (name === 'set_revenue_share') {
    const supabase = createAdminClient()
    const sale_id = input.sale_id as string
    const project_id = input.project_id as string
    const revenue_share_pct = input.revenue_share_pct as number
    const cost_share_pct = typeof input.cost_share_pct === 'number' ? input.cost_share_pct : revenue_share_pct

    const { data: existing } = await supabase
      .from('sale_projects')
      .select('id')
      .match({ sale_id, project_id })
      .maybeSingle()
    if (!existing) {
      // 없으면 자동 생성 (link_sale_project + 비율)
      const { data, error } = await supabase
        .from('sale_projects')
        .insert({ sale_id, project_id, role: '주계약', revenue_share_pct, cost_share_pct })
        .select('*')
        .maybeSingle()
      if (error) return { error: error.message }
      return { success: true, link: data, created: true }
    }
    const { data, error } = await supabase
      .from('sale_projects')
      .update({ revenue_share_pct, cost_share_pct })
      .match({ sale_id, project_id })
      .select('*')
      .maybeSingle()
    if (error) return { error: error.message }

    // 합계 100% 검증 (이 sale의 모든 매핑 합)
    const { data: allShares } = await supabase
      .from('sale_projects')
      .select('revenue_share_pct')
      .eq('sale_id', sale_id)
    const totalShare = (allShares ?? []).reduce((s, x: any) => s + (x.revenue_share_pct ?? 0), 0)
    return { success: true, link: data, total_revenue_share_pct: totalShare, warning: totalShare !== 100 ? `합계 ${totalShare}% (100%가 아님)` : null }
  }

  if (name === 'compute_project_profit') {
    const supabase = createAdminClient()
    const project_id = input.project_id as string

    const { computeProjectProfit } = await import('@/lib/sale-projects')
    const [{ data: project }, { data: saleProjects }, { data: sales }] = await Promise.all([
      supabase.from('projects').select('id, name').eq('id', project_id).maybeSingle(),
      supabase.from('sale_projects').select('*').eq('project_id', project_id),
      supabase.from('sales').select('id, revenue, name').eq('project_id', project_id),
    ])
    if (!project) return { error: '프로젝트를 찾을 수 없음' }

    const allSales = (sales ?? []) as any[]
    const saleIds = allSales.map(s => s.id)
    const { data: saleCosts } = saleIds.length > 0
      ? await supabase.from('sale_costs').select('sale_id, amount').in('sale_id', saleIds)
      : { data: [] as any[] }

    // 매핑 누락 sale은 100% fallback (page.tsx와 동일 로직)
    const mappedSaleIds = new Set((saleProjects ?? []).map((sp: any) => sp.sale_id))
    const fallbackMappings = allSales
      .filter(s => !mappedSaleIds.has(s.id))
      .map(s => ({
        id: '_fallback_' + s.id, sale_id: s.id, project_id, role: '주계약' as const,
        revenue_share_pct: 100, cost_share_pct: 100, note: null, created_at: '', updated_at: '',
      }))
    const allMappings = [...((saleProjects ?? []) as any[]), ...fallbackMappings]

    const result = computeProjectProfit({
      projectId: project_id,
      sales: allSales.map(s => ({ id: s.id, revenue: s.revenue ?? 0 })),
      saleCosts: ((saleCosts ?? []) as any[]).map(c => ({ sale_id: c.sale_id, amount: c.amount ?? 0 })),
      saleProjects: allMappings,
    })

    const saleNameMap = new Map(allSales.map(s => [s.id, s.name]))
    return {
      success: true,
      project: { id: project.id, name: project.name },
      revenue: result.revenue,
      cost: result.cost,
      profit: result.profit,
      margin_pct: Math.round(result.margin * 10) / 10,
      breakdown: result.breakdown.map(b => ({
        sale_id: b.sale_id,
        sale_name: saleNameMap.get(b.sale_id) ?? null,
        sale_revenue: b.sale_revenue,
        revenue_share_pct: b.revenue_share_pct,
        revenue_attributed: b.revenue_attributed,
        cost_share_pct: b.cost_share_pct,
        cost_attributed: b.cost_attributed,
      })),
    }
  }

  if (name === 'search_workers') {
    const supabase = createAdminClient()
    const query = ((input.query as string) ?? '').trim()
    const type = input.type as string | undefined
    const specialty = input.specialty as string | undefined
    const onlyPreferred = input.only_preferred as boolean | undefined

    // 1차: 기본 ILIKE
    let q = supabase.from('external_workers')
      .select('id, name, type, phone, email, default_rate_type, default_rate, specialties, rating, reuse_status, total_engagements, total_paid')
      .eq('archive_status', 'active')
      .order('rating', { ascending: false, nullsFirst: false })
      .limit(30)
    if (query) q = q.ilike('name', `%${query}%`)
    if (type) q = q.eq('type', type)
    if (onlyPreferred) q = q.eq('reuse_status', 'preferred')

    const { data, error } = await q
    if (error) return { error: error.message }

    let rows = data ?? []
    let matchMode: 'exact' | 'fuzzy' | 'tokens' = 'exact'

    // 2·3차 fallback (query 있고 결과 0건일 때)
    if (query && rows.length === 0) {
      const { fuzzyMatch } = await import('@/lib/fuzzy-search')
      let fbQ = supabase.from('external_workers')
        .select('id, name, type, phone, email, default_rate_type, default_rate, specialties, rating, reuse_status, total_engagements, total_paid')
        .eq('archive_status', 'active')
        .order('rating', { ascending: false, nullsFirst: false })
      if (type) fbQ = fbQ.eq('type', type)
      if (onlyPreferred) fbQ = fbQ.eq('reuse_status', 'preferred')
      const { data: all } = await fbQ
      const fb = fuzzyMatch(all ?? [], query, ['name', 'phone', 'email'])
      rows = fb.matched.slice(0, 30)
      matchMode = fb.mode === 'none' ? 'exact' : fb.mode
    }

    if (specialty) {
      rows = rows.filter(r => Array.isArray(r.specialties) && r.specialties.some((s: string) => s.includes(specialty)))
    }
    return { success: true, count: rows.length, match_mode: matchMode, workers: rows }
  }

  if (name === 'add_external_worker') {
    const supabase = createAdminClient()
    const reqName = (input.name as string)?.trim()
    const reqPhone = (input.phone as string)?.trim() || null
    const force = (input as { force?: boolean }).force === true

    // 중복 감지: 이름 동일 + 활성. 전화번호 있으면 같이 매칭.
    const { data: existing } = await supabase
      .from('external_workers')
      .select('id, name, type, phone, default_rate, total_engagements, archive_status')
      .eq('name', reqName)
      .eq('archive_status', 'active')
      .limit(5)

    const dupes = (existing ?? []).filter(w => {
      if (!reqPhone) return true  // 전화번호 미입력 시 이름만으로 판단
      return !w.phone || w.phone === reqPhone
    })

    if (dupes.length > 0 && !force) {
      return {
        duplicate_found: true,
        existing: dupes,
        message: `⚠️ "${reqName}" 동명 활성 인력 ${dupes.length}건 발견. 추가 등록하려면 force=true. 기존 인력 사용은 그 ID 그대로 record_engagement 호출.`,
      }
    }

    const newWorker = {
      name: reqName,
      type: input.type as string,
      phone: reqPhone,
      email: (input.email as string) ?? null,
      bank_name: (input.bank_name as string) ?? null,
      bank_account_text: (input.bank_account as string) ?? null,
      ssn_text: (input.ssn as string) ?? null,
      default_rate_type: (input.default_rate_type as string) ?? null,
      default_rate: typeof input.default_rate === 'number' ? input.default_rate : null,
      specialties: Array.isArray(input.specialties) ? (input.specialties as string[]) : null,
      notes: (input.notes as string) ?? null,
    }
    const { data, error } = await supabase
      .from('external_workers')
      .insert(newWorker)
      .select('id, name, type')
      .maybeSingle()
    if (error) return { error: error.message }
    return { success: true, worker: data, note: '⚠️ 보안 L3 마이그 전이라 주민번호·계좌번호는 평문 저장됨. 신분증·통장 사본은 /0_민감정보/외부인력/ 폴더 권장.' }
  }

  if (name === 'search_projects') {
    const supabase = createAdminClient()
    const { fuzzyMatch } = await import('@/lib/fuzzy-search')
    const query = (input.query as string ?? '').trim()
    const limit = typeof input.limit === 'number' ? input.limit : 10
    if (!query) return { error: 'query 필수' }

    // 1차: 정확한 ILIKE 부분 일치
    const { data: exact, error } = await supabase
      .from('projects')
      .select('id, name, project_number, status, customer_id, service_type')
      .or(`name.ilike.%${query}%,project_number.ilike.%${query}%`)
      .neq('status', '취소')
      .limit(limit)
    if (error) return { error: error.message }

    let result = exact ?? []
    let matchMode: 'exact' | 'fuzzy' | 'tokens' = 'exact'

    // 2·3차 fallback (fuzzy-search.ts 통일 — NFC 정규화 포함)
    if (result.length === 0) {
      const { data: all } = await supabase
        .from('projects')
        .select('id, name, project_number, status, customer_id, service_type')
        .neq('status', '취소')
      const fb = fuzzyMatch(all ?? [], query, ['name', 'project_number'])
      result = fb.matched.slice(0, limit)
      matchMode = fb.mode === 'none' ? 'exact' : fb.mode
    }

    return {
      success: true,
      count: result.length,
      match_mode: matchMode,
      projects: result,
      hint: result.length === 0
        ? '결과 없음 — 사용자에게 정확한 이름·번호 다시 물어보기'
        : result.length > 1
          ? '다수 매칭 — 사용자에게 어느 건인지 확인 필요'
          : '단일 매칭 — 그대로 record_engagement 등에서 project_id로 사용',
    }
  }

  if (name === 'record_engagement') {
    const supabase = createAdminClient()
    const { computeEngagementAmount } = await import('@/lib/external-workers')
    const { fuzzyMatch } = await import('@/lib/fuzzy-search')

    let worker_id = input.worker_id as string | undefined
    let project_id = input.project_id as string | undefined

    // worker_query로 worker_id 자동 매칭
    if (!worker_id && typeof input.worker_query === 'string' && input.worker_query) {
      const wq = (input.worker_query as string).trim()
      // 1차 ILIKE
      const { data: exact } = await supabase
        .from('external_workers')
        .select('id, name, type, phone, default_rate, default_rate_type')
        .ilike('name', `%${wq}%`)
        .eq('archive_status', 'active')
        .limit(5)
      let workers = exact ?? []
      // 2·3차 fuzzy
      if (workers.length === 0) {
        const { data: all } = await supabase
          .from('external_workers')
          .select('id, name, type, phone, default_rate, default_rate_type')
          .eq('archive_status', 'active')
        const fb = fuzzyMatch(all ?? [], wq, ['name', 'phone'])
        workers = fb.matched.slice(0, 5)
      }
      if (workers.length === 0) {
        return { error: `외부 인력 검색 결과 없음 (query="${wq}"). add_external_worker로 신규 등록 필요할 수도.` }
      }
      if (workers.length > 1) {
        return {
          error: `다수 외부 인력 매칭 (query="${wq}", ${workers.length}건). 사용자에게 어느 건인지 후보 보여주고 확인 받아.`,
          candidates: workers,
        }
      }
      worker_id = workers[0].id
    }
    if (!worker_id) return { error: 'worker_id 또는 worker_query 필요' }

    // project_id 없으면 project_query로 자동 검색 (fuzzy-search.ts 통일 — NFC 정규화 포함)
    if (!project_id && typeof input.project_query === 'string' && input.project_query) {
      const q = (input.project_query as string).trim()
      const { data: exact } = await supabase
        .from('projects')
        .select('id, name')
        .or(`name.ilike.%${q}%,project_number.ilike.%${q}%`)
        .neq('status', '취소')
        .limit(5)
      let prjs = exact ?? []
      if (prjs.length === 0) {
        const { data: all } = await supabase
          .from('projects').select('id, name, project_number').neq('status', '취소')
        const fb = fuzzyMatch(all ?? [], q, ['name', 'project_number'])
        prjs = fb.matched.slice(0, 5)
      }
      if (prjs.length === 0) {
        return { error: `프로젝트 검색 결과 없음 (query="${q}"). 정확한 이름·번호 확인 필요.` }
      }
      if (prjs.length > 1) {
        return {
          error: `다수 프로젝트 매칭 (query="${q}", ${prjs.length}건). 사용자에게 어느 건인지 확인 필요.`,
          candidates: prjs,
        }
      }
      project_id = prjs[0].id
    }
    if (!project_id) return { error: 'project_id 또는 project_query 필요' }

    // worker default 로드
    const { data: worker } = await supabase
      .from('external_workers')
      .select('default_rate_type, default_rate, name')
      .eq('id', worker_id)
      .maybeSingle()
    if (!worker) return { error: '외부 인력을 찾을 수 없음' }

    const rate_type = (input.rate_type as string) ?? worker.default_rate_type ?? null
    const rate = typeof input.rate === 'number' ? input.rate : worker.default_rate ?? null
    const hours = typeof input.hours === 'number' ? input.hours : null
    const amount = computeEngagementAmount({ rate_type: rate_type as 'per_hour' | 'per_session' | 'per_project' | null, rate, hours })

    const { data, error } = await supabase
      .from('worker_engagements')
      .insert({
        worker_id, project_id,
        role: (input.role as string) ?? null,
        date_start: (input.date_start as string) ?? null,
        date_end: (input.date_end as string) ?? null,
        hours, rate_type, rate, amount,
        note: (input.note as string) ?? null,
      })
      .select('*')
      .maybeSingle()
    if (error) return { error: error.message }

    // worker 누적 업데이트 (total_engagements, last_engaged_at)
    const { data: stats } = await supabase
      .from('worker_engagements')
      .select('id, date_start')
      .eq('worker_id', worker_id)
      .eq('archive_status', 'active')
    const total = (stats ?? []).length
    const dates = (stats ?? []).map(s => s.date_start).filter((d): d is string => !!d).sort()
    await supabase.from('external_workers').update({
      total_engagements: total,
      first_engaged_at: dates[0] ?? null,
      last_engaged_at: dates[dates.length - 1] ?? null,
    }).eq('id', worker_id)

    // 자동 업무표 (§5.4.2)
    const { logActivity } = await import('@/lib/activity-log')
    void logActivity({
      actor_id: userId,
      source: 'yourmate',
      action: 'create_engagement',
      ref_type: 'project',
      ref_id: project_id,
      summary: `${worker.name} 참여 기록 — ${(amount / 10000).toFixed(0)}만원`,
    })

    return {
      success: true,
      engagement: data,
      computed_amount: amount,
      worker_name: worker.name,
      worker_total_engagements: total,
    }
  }

  if (name === 'compute_worker_monthly_payment') {
    const supabase = createAdminClient()
    const { computeMonthlyPayment } = await import('@/lib/external-workers')
    const worker_id = input.worker_id as string
    const yearMonth = input.year_month as string

    const [{ data: worker }, { data: engagements }] = await Promise.all([
      supabase.from('external_workers').select('*').eq('id', worker_id).maybeSingle(),
      supabase.from('worker_engagements').select('*').eq('worker_id', worker_id),
    ])
    if (!worker) return { error: '외부 인력을 찾을 수 없음' }

    const result = computeMonthlyPayment({
      worker: worker as never,
      engagements: (engagements ?? []) as never[],
      yearMonth,
    })

    return {
      success: true,
      worker_name: worker.name,
      year_month: yearMonth,
      total_amount: result.total,
      engagement_count: result.count,
      details: result.details,
      note: 'worker_payments INSERT는 사용자 컨펌 후 별도 호출. 지금은 미리보기.',
    }
  }

  if (name === 'create_monthly_payment') {
    const { createMonthlyPaymentAction } = await import('@/lib/worker-payments-actions')
    const r = await createMonthlyPaymentAction({
      worker_id: input.worker_id as string,
      year_month: input.year_month as string,
      scheduled_date: (input.scheduled_date as string) ?? null,
    })
    return r
  }

  if (name === 'generate_tax_handoff') {
    const { generateTaxHandoffXlsxAction } = await import('@/lib/worker-payments-actions')
    const r = await generateTaxHandoffXlsxAction({
      year_month: input.year_month as string,
      mark_sent: (input.mark_sent as boolean) ?? false,
    })
    if ('error' in r) return r
    // base64 xlsx는 빵빵이 응답에 길게 들어가면 부담 — 길이만 응답하고 별도 다운로드 endpoint 권장
    return {
      success: true,
      filename: r.filename,
      total: r.total,
      row_count: r.row_count,
      warnings: r.warnings,
      xlsx_size_kb: Math.round(r.xlsx_base64.length * 3 / 4 / 1024),
      note: '실제 .xlsx 다운로드는 추후 별도 endpoint 제공. 지금은 워커 정산 미리보기 + 발송 표시만.',
    }
  }

  if (name === 'mark_payment_paid') {
    const { markPaymentPaidAction } = await import('@/lib/worker-payments-actions')
    const r = await markPaymentPaidAction({
      payment_id: input.payment_id as string,
      paid_date: input.paid_date as string,
    })
    return r
  }

  if (name === 'check_schedule_overlap') {
    const supabase = createAdminClient()
    const date = input.date as string
    const worker_id = input.worker_id as string | undefined
    const scope = (input.scope as string) ?? 'workers'

    const result: Record<string, unknown> = { date, scope }

    if (scope === 'workers' || scope === 'all') {
      let q = supabase.from('worker_engagements')
        .select('id, worker_id, project_id, role, date_start, date_end, hours, amount')
        .eq('archive_status', 'active')
        .lte('date_start', date)
        .or(`date_end.gte.${date},date_end.is.null`)
      if (worker_id) q = q.eq('worker_id', worker_id)
      const { data: engs } = await q

      // worker name 매핑
      const workerIds = [...new Set((engs ?? []).map(e => e.worker_id))]
      const { data: workers } = workerIds.length > 0
        ? await supabase.from('external_workers').select('id, name').in('id', workerIds)
        : { data: [] }
      const wMap = new Map((workers ?? []).map(w => [w.id, w.name]))

      result.worker_engagements = (engs ?? []).map(e => ({
        worker_name: wMap.get(e.worker_id) ?? e.worker_id.slice(0, 8),
        role: e.role,
        date_start: e.date_start,
        date_end: e.date_end,
        hours: e.hours,
      }))
      result.workers_busy_count = (engs ?? []).length
    }

    if (scope === 'equipment' || scope === 'all') {
      // equipment_rentals 테이블 — 다음 라운드 (yourmate-spec.md §5.7)
      result.equipment_note = '장비 충돌 감지는 다음 라운드 (§5.7 통합 마이그 후)'
    }

    return { success: true, ...result }
  }

  if (name === 'add_prospect') {
    const supabase = createAdminClient()
    const { data, error } = await supabase.from('prospects').insert({
      org_name: input.org_name as string,
      region: (input.region as string) ?? null,
      category: (input.category as string) ?? null,
      contact_name: (input.contact_name as string) ?? null,
      contact_role: (input.contact_role as string) ?? null,
      contact_phone: (input.contact_phone as string) ?? null,
      contact_email: (input.contact_email as string) ?? null,
      service_target: (input.service_target as string) ?? null,
      source: (input.source as string) ?? null,
      notes: (input.notes as string) ?? null,
      created_by: userId,
    }).select('id, org_name, status').maybeSingle()
    if (error) return { error: error.message }
    return { success: true, prospect: data, note: '영업 후보 등록. log_prospect_activity로 활동 기록.' }
  }

  if (name === 'log_prospect_activity') {
    const supabase = createAdminClient()
    const { fuzzyMatch } = await import('@/lib/fuzzy-search')
    let prospect_id = input.prospect_id as string | undefined
    if (!prospect_id && typeof input.prospect_query === 'string' && input.prospect_query) {
      const q = input.prospect_query.trim()
      const { data: exact } = await supabase
        .from('prospects').select('id, org_name')
        .ilike('org_name', `%${q}%`).eq('archive_status', 'active').limit(5)
      let prsp = exact ?? []
      if (prsp.length === 0) {
        const { data: all } = await supabase
          .from('prospects').select('id, org_name').eq('archive_status', 'active')
        const fb = fuzzyMatch(all ?? [], q, ['org_name'])
        prsp = fb.matched.slice(0, 5)
      }
      if (prsp.length === 0) return { error: `prospect 검색 0건 ("${q}"). add_prospect로 신규 등록 필요할 수도.` }
      if (prsp.length > 1) return { error: '다수 매칭', candidates: prsp }
      prospect_id = prsp[0].id
    }
    if (!prospect_id) return { error: 'prospect_id 또는 prospect_query 필요' }

    const { data, error } = await supabase.from('prospect_activities').insert({
      prospect_id,
      activity_type: input.activity_type as string,
      outcome: (input.outcome as string) ?? null,
      notes: (input.notes as string) ?? null,
      done_by: userId,
      done_at: (input.done_at as string) ?? new Date().toISOString(),
    }).select('id').maybeSingle()
    if (error) return { error: error.message }

    // prospect last_contacted_at 갱신
    await supabase.from('prospects')
      .update({ last_contacted_at: new Date().toISOString() })
      .eq('id', prospect_id)

    return { success: true, activity: data }
  }

  if (name === 'record_decision') {
    const supabase = createAdminClient()
    const { fuzzyMatch } = await import('@/lib/fuzzy-search')
    let project_id = input.project_id as string | undefined
    if (!project_id && typeof input.project_query === 'string' && input.project_query) {
      const q = input.project_query.trim()
      const { data: exact } = await supabase
        .from('projects').select('id, name')
        .or(`name.ilike.%${q}%,project_number.ilike.%${q}%`)
        .neq('status', '취소').limit(5)
      let prjs = exact ?? []
      if (prjs.length === 0) {
        const { data: all } = await supabase.from('projects').select('id, name, project_number').neq('status', '취소')
        const fb = fuzzyMatch(all ?? [], q, ['name', 'project_number'])
        prjs = fb.matched.slice(0, 5)
      }
      if (prjs.length === 1) project_id = prjs[0].id
    }

    const { data, error } = await supabase.from('decisions').insert({
      project_id: project_id ?? null,
      context: (input.context as string) ?? null,
      decision: input.decision as string,
      rationale: (input.rationale as string) ?? null,
      decided_by: userId,
      decided_at: (input.decided_at as string) ?? new Date().toISOString(),
    }).select('id').maybeSingle()
    if (error) return { error: error.message }
    return { success: true, decision: data }
  }

  // ============================================================
  // 라운드 A — §5.7 장비 / §5.8 결과물·드롭박스 트리 / §5.9 회의
  // ============================================================
  if (name === 'add_equipment') {
    const admin = createAdminClient()
    const { data, error } = await admin.from('equipment_master').insert({
      name: input.name as string,
      category: (input.category as string) ?? null,
      owning_dept: input.owning_dept as string,
      total_qty: (input.total_qty as number) ?? 1,
      unit_price: (input.unit_price as number) ?? null,
      storage_location: (input.storage_location as string) ?? null,
      notes: (input.notes as string) ?? null,
    }).select('id, name, owning_dept, total_qty').maybeSingle()
    if (error) return { error: error.message }
    return { success: true, equipment: data }
  }

  if (name === 'search_equipment') {
    const admin = createAdminClient()
    const q = (input.query as string)?.trim()
    let query = admin.from('equipment_master').select('id, name, category, owning_dept, total_qty, unit_price, storage_location').eq('archive_status', 'active').limit(30)
    if (q) query = query.or(`name.ilike.%${q}%,category.ilike.%${q}%`)
    if (input.owning_dept) query = query.eq('owning_dept', input.owning_dept as string)
    const { data, error } = await query
    if (error) return { error: error.message }
    return { count: data?.length ?? 0, equipment: data }
  }

  if (name === 'add_equipment_rental') {
    const admin = createAdminClient()
    const { fuzzyMatch } = await import('@/lib/fuzzy-search')
    let equipment_id = input.equipment_id as string | undefined
    if (!equipment_id && typeof input.equipment_query === 'string' && input.equipment_query) {
      const q = input.equipment_query.trim()
      const { data: exact } = await admin.from('equipment_master').select('id, name').ilike('name', `%${q}%`).eq('archive_status', 'active').limit(5)
      let eqs = exact ?? []
      if (eqs.length === 0) {
        const { data: all } = await admin.from('equipment_master').select('id, name').eq('archive_status', 'active')
        const fb = fuzzyMatch(all ?? [], q, ['name'])
        eqs = fb.matched.slice(0, 5)
      }
      if (eqs.length === 0) return { error: `장비 검색 0건 ("${q}"). add_equipment로 신규 등록 필요할 수도.` }
      if (eqs.length > 1) return { error: '다수 매칭', candidates: eqs }
      equipment_id = eqs[0].id
    }
    if (!equipment_id) return { error: 'equipment_id 또는 equipment_query 필요' }

    let project_id = input.project_id as string | undefined
    if (!project_id && typeof input.project_query === 'string' && input.project_query) {
      const q = input.project_query.trim()
      const { data: prjs } = await admin.from('projects').select('id, name').or(`name.ilike.%${q}%,project_number.ilike.%${q}%`).neq('status', '취소').limit(5)
      if ((prjs ?? []).length === 1) project_id = prjs![0].id
    }

    // overlap 감지
    const { data: overlaps } = await admin.from('equipment_rentals')
      .select('id, date_start, date_end, qty, status, project_id')
      .eq('equipment_id', equipment_id)
      .eq('archive_status', 'active')
      .neq('status', 'returned')
      .neq('status', 'cancelled')
      .lte('date_start', input.date_end as string)
      .gte('date_end', input.date_start as string)

    const { data, error } = await admin.from('equipment_rentals').insert({
      equipment_id,
      qty: (input.qty as number) ?? 1,
      project_id: project_id ?? null,
      date_start: input.date_start as string,
      date_end: input.date_end as string,
      rate: (input.rate as number) ?? null,
      responsible_user_id: userId,
      notes: (input.notes as string) ?? null,
    }).select('id').maybeSingle()
    if (error) return { error: error.message }
    return { success: true, rental: data, overlap_count: overlaps?.length ?? 0, overlap_warning: (overlaps?.length ?? 0) > 0 ? '같은 장비에 기간 충돌 예약 있음' : null }
  }

  async function resolveProjectId(admin: ReturnType<typeof createAdminClient>, input: Record<string, unknown>): Promise<{ project_id?: string; error?: string; candidates?: unknown[] }> {
    const { fuzzyMatch } = await import('@/lib/fuzzy-search')
    let project_id = input.project_id as string | undefined
    if (project_id) return { project_id }
    if (typeof input.project_query !== 'string' || !input.project_query) return {}
    const q = input.project_query.trim()
    const { data: exact } = await admin.from('projects').select('id, name, project_number').or(`name.ilike.%${q}%,project_number.ilike.%${q}%`).neq('status', '취소').limit(5)
    let prjs = exact ?? []
    if (prjs.length === 0) {
      const { data: all } = await admin.from('projects').select('id, name, project_number').neq('status', '취소')
      const fb = fuzzyMatch(all ?? [], q, ['name', 'project_number'])
      prjs = fb.matched.slice(0, 5)
    }
    if (prjs.length === 0) return { error: `프로젝트 검색 0건 ("${q}").` }
    if (prjs.length > 1) return { error: '다수 매칭', candidates: prjs }
    return { project_id: prjs[0].id }
  }

  if (name === 'add_deliverable') {
    const admin = createAdminClient()
    const r = await resolveProjectId(admin, input)
    if (r.error) return { error: r.error, candidates: r.candidates }
    if (!r.project_id) return { error: 'project_id 또는 project_query 필요' }
    const { data, error } = await admin.from('project_deliverables').insert({
      project_id: r.project_id,
      type: input.type as string,
      title: (input.title as string) ?? null,
      dropbox_path: (input.dropbox_path as string) ?? null,
      format: (input.format as string) ?? null,
      delivered_at: (input.delivered_at as string) ?? null,
      ai_summary: (input.ai_summary as string) ?? null,
      ai_tags: (input.ai_tags as string[]) ?? null,
      created_by: userId,
    }).select('id, type, title').maybeSingle()
    if (error) return { error: error.message }
    return { success: true, deliverable: data }
  }

  if (name === 'list_deliverables') {
    const admin = createAdminClient()
    const r = await resolveProjectId(admin, input)
    if (r.error) return { error: r.error, candidates: r.candidates }
    if (!r.project_id) return { error: 'project_id 또는 project_query 필요' }
    const { data } = await admin.from('project_deliverables')
      .select('id, type, title, dropbox_path, format, delivered_at, client_confirmed_at, ai_summary')
      .eq('project_id', r.project_id).eq('archive_status', 'active')
      .order('delivered_at', { ascending: false, nullsFirst: false })
      .limit(50)
    return { count: data?.length ?? 0, deliverables: data }
  }

  if (name === 'apply_ai_friendly_folder_tree') {
    const admin = createAdminClient()
    const r = await resolveProjectId(admin, input)
    if (r.error) return { error: r.error, candidates: r.candidates }
    if (!r.project_id) return { error: 'project_id 또는 project_query 필요' }
    const { data: project } = await admin.from('projects').select('id, name, dropbox_url').eq('id', r.project_id).maybeSingle()
    if (!project?.dropbox_url) return { error: '프로젝트에 dropbox_url 없음. 드롭박스 폴더 먼저 생성 필요.' }
    const { applyAiFriendlyProjectTree } = await import('@/lib/dropbox-tree')
    const result = await applyAiFriendlyProjectTree(project.dropbox_url)
    return { success: true, project: project.name, created_count: result.created.length, failed_count: result.failed.length, created: result.created, failed: result.failed }
  }

  if (name === 'create_meeting') {
    const admin = createAdminClient()
    const r = input.project_id || input.project_query ? await resolveProjectId(admin, input) : { project_id: undefined as string | undefined }
    if ('error' in r && r.error) return { error: r.error, candidates: r.candidates }
    const { data, error } = await admin.from('meetings').insert({
      title: input.title as string,
      type: (input.type as string) ?? 'irregular',
      project_id: r.project_id ?? null,
      date: input.date as string,
      duration_minutes: (input.duration_minutes as number) ?? null,
      location: (input.location as string) ?? null,
      agenda: (input.agenda as string) ?? null,
      notes: (input.notes as string) ?? null,
      source: 'manual',
      created_by: userId,
    }).select('id, title, date').maybeSingle()
    if (error) return { error: error.message }
    return { success: true, meeting: data }
  }

  if (name === 'add_meeting_minutes') {
    const admin = createAdminClient()
    let meeting_id = input.meeting_id as string | undefined
    if (!meeting_id && typeof input.title_query === 'string' && input.title_query) {
      const q = input.title_query.trim()
      const { data: meets } = await admin.from('meetings').select('id, title, date').ilike('title', `%${q}%`).eq('archive_status', 'active').order('date', { ascending: false }).limit(5)
      if ((meets ?? []).length === 0) return { error: `회의 검색 0건 ("${q}").` }
      if ((meets ?? []).length > 1) return { error: '다수 매칭', candidates: meets }
      meeting_id = meets![0].id
    }
    if (!meeting_id) return { error: 'meeting_id 또는 title_query 필요' }
    const patch: Record<string, unknown> = { minutes: input.minutes as string }
    if (input.ai_summary) patch.ai_summary = input.ai_summary
    const { error } = await admin.from('meetings').update(patch).eq('id', meeting_id)
    if (error) return { error: error.message }
    return { success: true, meeting_id }
  }

  if (name === 'analyze_cost_folder') {
    const sale_id = input.sale_id as string
    if (!sale_id) return { error: 'sale_id 필요' }
    try {
      const { analyzeCostFolder } = await import('@/app/(dashboard)/sales/[id]/cost-actions')
      const r = await analyzeCostFolder(sale_id)
      if ('error' in r) return { error: r.error, diagnostic: r.diagnostic }
      return {
        success: true,
        sale_id,
        pdfs_scanned: r.pdfsScanned,
        rows_count: r.rows.length,
        rows: r.rows.map(row => ({
          item: row.item,
          amount: row.amount,
          vendor: row.vendor_name,
          due_date: row.due_date,
          doc_type: row.doc_type,
          source_pdf: row.source_pdf,
          duplicate: row.duplicate,
        })),
        note: '미리보기. sale_costs 등록은 [📎 원가 폴더 분석] 모달에서 [추가] 클릭 또는 사용자 별도 요청.',
      }
    } catch (e) {
      return { error: e instanceof Error ? e.message : '원가 분석 실패' }
    }
  }

  if (name === 'create_calendar_event') {
    const calKey = (input.calendar_key as string) || 'main'
    const title = input.title as string
    const date = input.date as string
    const isAllDay = input.is_all_day !== false && !input.start_time
    try {
      await createGCalEvent(calKey, {
        title,
        date,
        endDate: (input.end_date as string) || date,
        startTime: input.start_time as string | undefined,
        endTime: input.end_time as string | undefined,
        description: (input.description as string) || '',
        isAllDay,
      })
      return { success: true, message: `캘린더(${calKey})에 "${title}" 일정 등록했어. (${date})` }
    } catch (e: unknown) {
      return { error: e instanceof Error ? e.message : '캘린더 등록 실패' }
    }
  }

  return { error: '알 수 없는 도구' }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { messages, mode, projectId } = await req.json()

    const { data: profile } = await supabase.from('profiles').select('name, role').eq('id', user.id).single()
    const userName = profile?.name || '팀원'
    const userRole = profile?.role || 'member'

    // 프로젝트 컨텍스트 주입 (URL에서 감지된 프로젝트 ID)
    let projectContext = ''
    if (projectId) {
      const admin = createAdminClient()
      const { data: project } = await admin
        .from('projects')
        .select('name, service_type, department, status, project_number, dropbox_url')
        .eq('id', projectId)
        .single()
      if (project) {
        // V2 페이지와 동일한 경로: sales.project_id 직접 조인
        const { data: directSales } = await admin
          .from('sales')
          .select('id, name, revenue, contract_stage')
          .eq('project_id', projectId)
          .limit(10)
        const saleIdList = (directSales ?? []).map(s => s.id)
        // tasks.project_id 컬럼은 sale.id를 가리킴 (CLAUDE.md 도메인 모델 참고)
        const { data: openTasks } = saleIdList.length > 0
          ? await admin
              .from('tasks')
              .select('id, title, status, priority, due_date')
              .in('project_id', saleIdList)
              .not('status', 'in', '(완료,보류)')
              .limit(20)
          : { data: [] as { id: string; title: string; status: string; priority: string | null; due_date: string | null }[] }

        const salesLines = (directSales ?? [])
          .map(s => `  - ${s.name} / ${(s.revenue ?? 0).toLocaleString()}원 / ${s.contract_stage}`)
          .join('\n')
        const taskLines = (openTasks ?? [])
          .map(t => `  - [${t.priority || '보통'}] ${t.title}${t.due_date ? ` (마감: ${t.due_date})` : ''} [id:${t.id.slice(0, 8)}]`)
          .join('\n')

        // brief.md 읽기 (Dropbox 폴더가 있을 때)
        let briefSection = ''
        if (project.dropbox_url) {
          const folderPath = decodeURIComponent(
            (project.dropbox_url as string).replace('https://www.dropbox.com/home', '')
          ).replace(/\/$/, '')
          const briefResult = await readDropboxFile(`${folderPath}/brief.md`).catch(() => null)
          if (briefResult && !('error' in briefResult)) {
            briefSection = `\n\n### 프로젝트 Brief (brief.md)\n${briefResult.text}`
          }
        }

        // 소통내역 최근 3건 — project_id로 직접 조회
        const { data: logs } = await admin
          .from('project_logs')
          .select('content, log_type, contacted_at')
          .eq('project_id', projectId)
          .order('contacted_at', { ascending: false })
          .limit(3)
        const recentLogs = logs?.length
          ? `\n- 최근 소통:\n${logs.map(l => `  - [${l.log_type}] ${l.contacted_at?.slice(0, 10)}: ${l.content}`).join('\n')}`
          : ''

        projectContext = `\n## 현재 열린 프로젝트\n이 대화는 아래 프로젝트 페이지에서 시작됐어. 프로젝트 관련 질문에 우선적으로 활용해.\n- 프로젝트명: ${project.name}\n- 번호: ${project.project_number || '미지정'}\n- 서비스: ${project.service_type || '미지정'}\n- 상태: ${project.status || '미지정'}\n- 사업부: ${project.department || '미지정'}${salesLines ? `\n- 연결된 계약:\n${salesLines}` : ''}${taskLines ? `\n- 미완료 업무:\n${taskLines}` : ''}${recentLogs}${briefSection}\n`
      }
    }

    const MODE_CONTEXT: Record<string, string> = {
      'new-sale':  '\n## 현재 모드: 새 계약건\n목표는 계약건 등록이야. 아래 상황에 맞게 유연하게 대응해.\n- 상담 중 질문: CS 매뉴얼 기반으로 즉시 답해. 서비스 언급되면 파악할 내용 알려줘. 가격·정책 질문엔 매뉴얼 기준으로.\n- 메모·전사록 붙여넣기: 계약 정보 추출 후 <sale-data> 블록 출력.\n- "등록해줘" 요청: 대화에서 파악된 정보로 <sale-data> 블록 출력.\n- 매뉴얼에 없는 건 "담당자한테 확인해봐".',
      'new-lead':  '\n## 현재 모드: 새 리드\n목표는 리드 등록이야. 상황에 맞게 유연하게 대응해.\n- 상담 중 질문: CS 매뉴얼 기반으로 즉시 답해. 서비스 언급되면 파악할 내용 알려줘.\n- 메모·전사록 붙여넣기: 리드 정보 추출 후 <lead-data> 블록 출력.\n- 대화 흐름에서 정보가 충분히 파악되면 자동으로 <lead-data> 블록 제시해. 요약만 하고 끝내지 마.\n- "등록해줘", "넣어줘", "저장해줘" 같이 명시적으로 등록 요청하면 create_lead 도구로 바로 직접 등록해. 카드로 보여주지 말고 바로 실행.\n- 매뉴얼에 없는 건 "담당자한테 확인해봐".',
      'update':    '\n## 현재 모드: 기존 건 업데이트\n어떤 건인지 먼저 파악해. search_leads 또는 get_sales로 검색하고 결과 보여줘. 확인 후 내용 받아서 update 도구로 업데이트해.',
      'chat':      '\n## 현재 모드: 질문하기\n도구 사용해서 데이터 조회 및 답변해. 프로젝트 페이지에서는 단순 조회뿐 아니라 할일/개요/협의사항 등 데이터 변경 도구도 적극 사용 (위 최우선 규칙 참고).',
      'brain-dump': `
## 현재 모드: 빠른 메모 / 쏟아내기 (대시보드)

사용자가 머릿속의 생각·고민·할일·미팅 정리·소통 메모 등을 자유롭게 쏟아내는 모드.
프로젝트/리드 컨텍스트가 *없으니* 너가 직접 매칭해서 처리해.

🔴 **절대 금지 (환각)**
- 도구 호출 없이 "추가했어요/등록했어요/저장했어요" 답변 ← 절대 금지. 실제 도구 호출 결과 success가 떠야 그렇게 말해.
- 도구 호출했어도 결과가 error면 그 에러 메시지 그대로 사용자에게 전달.
- 모르는 lead_id/sale_id 추측 금지. 반드시 search_leads/get_sales 결과로 받은 실제 UUID만 사용.

📋 **처리 흐름**
1. **분석**: 사용자 메시지에서 어떤 건에 해당하는지 파악 (기관명·프로젝트명·담당자 단서)
2. **검색**: search_leads / get_sales 호출. 후보가 1건이면 그대로, 여러 건이면 사용자 확인.
3. **실행**: 적절한 도구를 *반드시* 호출
   - 통화/이메일/미팅 메모 → **add_project_log** (lead_id 또는 sale_id input 필수 — search 결과 id 그대로 전달)
   - 새 리드 등록 → create_lead
   - 새 계약건 등록 → create_sale
   - 매출/계약 단계 변경 → update_sale_status
   - 리드 상태 변경 → update_lead status
   - **캘린더 일정 → create_calendar_event** (calendar_key/title/date 필수)
   - 견적서 매출 변경 → update_sale_revenue
4. **결과 보고**: 도구가 success 반환하면 짧게 "✅ 평택 리드에 소통 저장 / 캘린더 5/18 등록 완료" 식으로. 실패하면 에러 그대로.

📝 **add_project_log 필수 절차** (자주 실수하는 부분)
1. search_leads("평택")로 lead 찾기 → 응답에서 \`id\` (UUID) 얻기
2. add_project_log({ lead_id: "그-id", content: "...", log_type: "통화" }) 호출
3. 응답에 success:true 있어야 진짜 저장됨. 없으면 실패.

📅 **create_calendar_event 필수 절차**
- calendar_key: main(개인/전체) | sos(공연) | rental(렌탈) | artqium(아트키움) 중 하나
- title, date(YYYY-MM-DD) 필수
- 시간 있으면 start_time/end_time, 없으면 종일
- 응답 success 확인 후 보고

🗂️ **여러 건 한꺼번에 쏟아낸 경우**
- 예: "평택 강사 5/15 답변 / 봉일천 견적 내일 / 이화여대 답사 5/20"
- 각 건을 분리해서 차례대로 도구 호출
- 마지막에 처리 결과 한 줄씩 요약 (✅/❌)

🤔 **매칭 모호한 경우**
- "이 건은 새 리드로 등록할까, 기존 건에 메모 추가할까?" 한 번 묻기
- 사용자 답변 후 즉시 실행

응답: 마크다운 사용. 처리 결과 명확히. 거짓 보고 절대 금지.`,
    }
    const modeCtx = mode ? (MODE_CONTEXT[mode] || '') : ''

    const today = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long', timeZone: 'Asia/Seoul' })
    const todayIso = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' }) // YYYY-MM-DD

    // 최상단에 강제 정책 — 모델이 후반부 무시해도 이 부분은 반드시 봄
    const TOP_POLICY = projectId
      ? `# 🔴 최우선 규칙 (프로젝트 페이지 컨텍스트)
1. 오늘 날짜는 ${today} (ISO: ${todayIso}). "내일/다음주" 등 상대 날짜는 반드시 이 날짜 기준 계산. 절대 다른 연도(2025 등)로 추정 금지.
2. 사용자가 할일 추가/수정/완료/삭제, 개요 정리, 협의사항 갱신을 요청하면 **반드시 도구를 호출**해라. 다음은 모두 실제 호출 가능한 도구다:
   - create_project_task / update_task / complete_task / delete_task
   - regenerate_overview / update_overview / update_pending_discussion / regenerate_pending_discussion
   - update_lead_summary / regenerate_lead_summary (리드 요약 박스)
   - update_project_status / add_project_log
3. **절대 금지**: "지원되지 않습니다", "기능이 없어요", "직접 처리해주세요", "시스템상 제한되고 있습니다", "화면에만 보여드린 것" 같은 거짓 거부 답변. 항상 도구를 먼저 호출해.
4. 도구 호출이 실제로 에러를 반환하면 그 에러 메시지를 그대로 사용자에게 전달. 추측·각색 금지.
5. 의도가 명확하면 즉시 실행. 삭제만 1회 확인.

`
      : `오늘 날짜: ${today} (ISO: ${todayIso}). 상대 날짜는 이 날짜 기준 계산.\n`

    const AUTO_MEMORY_POLICY = `\n# 🟢 자율 메모 저장 (학습 효과)
사용자가 명시 안 해도 회의·통화·결정사항·고객 정보 등 다음 대화에 도움될 정보를 발견하면 즉시 add_project_log / add_project_task 등으로 저장. 저장 후 "메모 남겼어" 정도로 짧게 알려줘. 매번 길게 보고 X. 판단 애매하면 한 번 물어봐.\n`
    const dateHeader = `${TOP_POLICY}${AUTO_MEMORY_POLICY}# 시스템 컨텍스트\n현재 사용자: ${userName} (권한: ${userRole})\n${userRole === 'member' ? '※ 이 사용자는 팀원 권한이라 본인 담당 건만 조회 가능해.\n' : ''}`
    const systemWithDate = `${dateHeader}${projectContext}${modeCtx}\n${SYSTEM_PROMPT}`

    const apiMessages: Anthropic.MessageParam[] = messages.map((m: {
      role: string
      content: string
      imageData?: { base64: string; mediaType: string }
    }) => {
      if (m.imageData) {
        return {
          role: m.role as 'user' | 'assistant',
          content: [
            {
              type: 'image' as const,
              source: {
                type: 'base64' as const,
                media_type: (m.imageData.mediaType || 'image/jpeg') as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
                data: m.imageData.base64,
              },
            },
            { type: 'text' as const, text: m.content },
          ],
        }
      }
      return {
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }
    })

    // tool_use 루프
    let mutated = false
    const toolTrace: { name: string; input: Record<string, unknown>; result: unknown; ok: boolean }[] = []
    let response = await getClient().messages.create({
      model: MODEL,
      max_tokens: 2048,
      system: systemWithDate,
      tools: TOOLS,
      messages: apiMessages,
    })
    logApiUsage({ model: MODEL, endpoint: 'chat', userId: user.id, inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens }).catch(() => {})

    while (response.stop_reason === 'tool_use') {
      const toolUseBlocks = response.content.filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use')

      const toolResults: Anthropic.ToolResultBlockParam[] = await Promise.all(
        toolUseBlocks.map(async (tu) => {
          const input = tu.input as Record<string, unknown>
          const result = await executeTool(tu.name, input, userRole, user.id, projectId)
          const ok = !!result && typeof result === 'object' && !('error' in result) && !('duplicate_warning' in result) && !('multiple' in result)
          toolTrace.push({ name: tu.name, input, result, ok })
          if (MUTATING_TOOLS.has(tu.name) && ok) {
            mutated = true
          }
          return {
            type: 'tool_result' as const,
            tool_use_id: tu.id,
            content: JSON.stringify(result),
          }
        })
      )

      apiMessages.push({ role: 'assistant', content: response.content as Anthropic.ContentBlockParam[] })
      apiMessages.push({ role: 'user', content: toolResults })

      response = await getClient().messages.create({
        model: MODEL,
        max_tokens: 2048,
        system: systemWithDate,
        tools: TOOLS,
        messages: apiMessages,
      })
      logApiUsage({ model: MODEL, endpoint: 'chat', userId: user.id, inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens }).catch(() => {})
    }

    const rawText = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map(b => b.text)
      .join('')

    // <sale-data> 블록 파싱
    const saleMatch = rawText.match(/<sale-data>([\s\S]*?)<\/sale-data>/)
    let saleData = null
    let text = rawText
    if (saleMatch) {
      try { saleData = JSON.parse(saleMatch[1].trim()) } catch { /* ignore */ }
      text = text.replace(/<sale-data>[\s\S]*?<\/sale-data>/, '').trim()
    }

    // <lead-data> 블록 파싱
    const leadMatch = text.match(/<lead-data>([\s\S]*?)<\/lead-data>/)
    let leadData = null
    if (leadMatch) {
      try { leadData = JSON.parse(leadMatch[1].trim()) } catch { /* ignore */ }
      text = text.replace(/<lead-data>[\s\S]*?<\/lead-data>/, '').trim()
    }

    return NextResponse.json({
      text, saleData, leadData, mutated,
      toolTrace: toolTrace.map(t => ({
        name: t.name,
        ok: t.ok,
        // 에러/실패 메시지만 노출 (성공 결과는 너무 큼)
        error: !t.ok && t.result && typeof t.result === 'object' && 'error' in t.result ? (t.result as { error: string }).error : null,
        // 핵심 input만 (UUID 제외, 가독성)
        inputSummary: Object.fromEntries(
          Object.entries(t.input)
            .filter(([k]) => !['lead_id', 'sale_id', 'memo_id', 'task_id'].includes(k))
            .map(([k, v]) => [k, typeof v === 'string' ? v.slice(0, 100) : v])
        ),
      })),
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('Chat API error:', msg)
    return NextResponse.json({ error: `오류: ${msg}` }, { status: 500 })
  }
}
