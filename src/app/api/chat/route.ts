import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getDropboxToken, readDropboxFile, uploadTextFile, createSaleFolder } from '@/lib/dropbox'
import { appendAiNote } from '@/lib/brief-generator'
import { logApiUsage } from '@/lib/api-usage'
import { createEvent as createGCalEvent } from '@/lib/google-calendar'
import { SYSTEM_PROMPT } from '@/lib/bbang/loadSchema'
import { TOOLS } from '@/lib/bbang/tools'

export const maxDuration = 60

const MODEL = 'claude-haiku-4-5-20251001'

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

    const DEPT_MAP: Record<string, string> = {
      'SOS': 'sound_of_school', '002ENT': '002_entertainment', '교육프로그램': 'artkiwoom',
      '납품설치': 'school_store', '유지보수': 'school_store', '교구대여': 'school_store', '제작인쇄': 'school_store',
      '콘텐츠제작': '002_creative', '행사운영': '002_creative', '행사대여': '002_creative', '프로젝트': '002_creative',
    }
    const department = (serviceType && DEPT_MAP[serviceType]) || null

    const { data: saleRow, error: insertErr } = await supabase.from('sales').insert({
      name: saleName, client_org: clientOrg, service_type: serviceType, department,
      revenue, contract_stage: '계약', memo, inflow_date: inflowDate, dropbox_url: dropboxUrl,
    }).select('id').single()
    if (insertErr) return { error: insertErr.message }

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

    const { data: lead, error } = await supabase.from('leads').insert({
      lead_id,
      client_org: clientOrg,
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

    const { data: sale, error: saleErr } = await supabase.from('sales').insert({
      name: `${finalLead.client_org || '(리드전환)'}`,
      client_org: finalLead.client_org,
      service_type: serviceType,
      department,
      assignee_id: finalLead.assignee_id,
      revenue: 0,
      contract_stage: '계약',
      memo: finalLead.initial_content,
      inflow_date: finalLead.inflow_date || new Date().toISOString().slice(0, 10),
    }).select('id').single()

    if (saleErr) return { error: saleErr.message }

    await supabase.from('leads').update({
      converted_sale_id: sale.id,
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
    let saleId: string | null = null
    let leadId: string | null = null

    if (projectId) {
      const { data: rel } = await admin
        .from('project_sales_relations')
        .select('sale_id')
        .eq('project_id', projectId)
        .limit(1)
        .single()
      saleId = rel?.sale_id ?? null
    }

    const contactedAt = (input.contacted_at as string)
      ? new Date(input.contacted_at as string).toISOString()
      : new Date().toISOString()

    const { error } = await admin.from('project_logs').insert({
      lead_id: leadId,
      sale_id: saleId,
      content: input.content,
      log_type: (input.log_type as string) || '메모',
      author_id: userId,
      contacted_at: contactedAt,
    })
    if (error) return { error: error.message }
    return { success: true, message: '소통 내역을 저장했어.' }
  }

  if (name === 'update_project_status') {
    if (!projectId) return { error: '프로젝트 페이지에서만 사용 가능해.' }
    const admin = createAdminClient()
    const { error } = await admin
      .from('projects')
      .update({ status: input.status, updated_at: new Date().toISOString() })
      .eq('id', projectId)
    if (error) return { error: error.message }
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
        const { data: linkedSales } = await admin
          .from('project_sales_relations')
          .select('sale_id, sales(name, revenue, contract_stage)')
          .eq('project_id', projectId)
          .limit(5)
        const { data: openTasks } = await admin
          .from('tasks')
          .select('title, status, priority, due_date')
          .eq('project_id', projectId)
          .not('status', 'in', '(완료,보류)')
          .limit(10)

        const salesLines = (linkedSales ?? [])
          .map((r: any) => r.sales ? `  - ${r.sales.name} / ${(r.sales.revenue ?? 0).toLocaleString()}원 / ${r.sales.contract_stage}` : '')
          .filter(Boolean).join('\n')
        const taskLines = (openTasks ?? [])
          .map((t: any) => `  - [${t.priority || '보통'}] ${t.title}${t.due_date ? ` (마감: ${t.due_date})` : ''}`)
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

        // 소통내역 최근 3건
        const primarySaleId = (linkedSales ?? [])[0]?.sale_id ?? null
        let recentLogs = ''
        if (primarySaleId) {
          const { data: logs } = await admin
            .from('project_logs')
            .select('content, log_type, contacted_at')
            .eq('sale_id', primarySaleId)
            .order('contacted_at', { ascending: false })
            .limit(3)
          if (logs?.length) {
            recentLogs = `\n- 최근 소통:\n${logs.map((l: any) => `  - [${l.log_type}] ${l.contacted_at?.slice(0, 10)}: ${l.content}`).join('\n')}`
          }
        }

        projectContext = `\n## 현재 열린 프로젝트\n이 대화는 아래 프로젝트 페이지에서 시작됐어. 프로젝트 관련 질문에 우선적으로 활용해.\n- 프로젝트명: ${project.name}\n- 번호: ${project.project_number || '미지정'}\n- 서비스: ${project.service_type || '미지정'}\n- 상태: ${project.status || '미지정'}\n- 사업부: ${project.department || '미지정'}${salesLines ? `\n- 연결된 계약:\n${salesLines}` : ''}${taskLines ? `\n- 미완료 업무:\n${taskLines}` : ''}${recentLogs}${briefSection}\n`
      }
    }

    const MODE_CONTEXT: Record<string, string> = {
      'new-sale':  '\n## 현재 모드: 새 계약건\n목표는 계약건 등록이야. 아래 상황에 맞게 유연하게 대응해.\n- 상담 중 질문: CS 매뉴얼 기반으로 즉시 답해. 서비스 언급되면 파악할 내용 알려줘. 가격·정책 질문엔 매뉴얼 기준으로.\n- 메모·전사록 붙여넣기: 계약 정보 추출 후 <sale-data> 블록 출력.\n- "등록해줘" 요청: 대화에서 파악된 정보로 <sale-data> 블록 출력.\n- 매뉴얼에 없는 건 "담당자한테 확인해봐".',
      'new-lead':  '\n## 현재 모드: 새 리드\n목표는 리드 등록이야. 상황에 맞게 유연하게 대응해.\n- 상담 중 질문: CS 매뉴얼 기반으로 즉시 답해. 서비스 언급되면 파악할 내용 알려줘.\n- 메모·전사록 붙여넣기: 리드 정보 추출 후 <lead-data> 블록 출력.\n- 대화 흐름에서 정보가 충분히 파악되면 자동으로 <lead-data> 블록 제시해. 요약만 하고 끝내지 마.\n- "등록해줘", "넣어줘", "저장해줘" 같이 명시적으로 등록 요청하면 create_lead 도구로 바로 직접 등록해. 카드로 보여주지 말고 바로 실행.\n- 매뉴얼에 없는 건 "담당자한테 확인해봐".',
      'update':    '\n## 현재 모드: 기존 건 업데이트\n어떤 건인지 먼저 파악해. search_leads 또는 get_sales로 검색하고 결과 보여줘. 확인 후 내용 받아서 update 도구로 업데이트해.',
      'chat':      '\n## 현재 모드: 질문하기\n도구 사용해서 데이터 조회 및 답변해.',
    }
    const modeCtx = mode ? (MODE_CONTEXT[mode] || '') : ''

    const today = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Seoul' })
    const systemWithDate = `오늘 날짜: ${today}\n현재 사용자: ${userName} (권한: ${userRole})\n${userRole === 'member' ? '※ 이 사용자는 팀원 권한이라 본인 담당 건만 조회 가능해.\n' : ''}${projectContext}${modeCtx}\n${SYSTEM_PROMPT}`

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
          const result = await executeTool(tu.name, tu.input as Record<string, unknown>, userRole, user.id, projectId)
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

    return NextResponse.json({ text, saleData, leadData })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('Chat API error:', msg)
    return NextResponse.json({ error: `오류: ${msg}` }, { status: 500 })
  }
}
