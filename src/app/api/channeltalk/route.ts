import { NextRequest, NextResponse } from 'next/server'
import { waitUntil } from '@vercel/functions'
import OpenAI from 'openai'
import { createAdminClient } from '@/lib/supabase/admin'
import crypto from 'crypto'
import { logApiUsage } from '@/lib/api-usage'
import { searchDropbox, listDropboxFolder, readDropboxFile } from '@/lib/dropbox'

const openai = new OpenAI()

const SYSTEM_PROMPT = `너는 유어메이트(yourmate) 사내 시스템 "빵빵이"야.
채널톡 내부 그룹채팅에서 팀원들 업무를 돕고 있어.
유어메이트는 SOS 공연, 아트키움 교육프로그램, 학교상점(납품설치/유지보수/교구대여/제작인쇄), 002 Creative(콘텐츠제작/행사운영/행사대여), 002 Entertainment(음원유통) 등을 하는 회사야.

## 말투
- 반말. 그냥 편하게. 근데 억지로 캐주얼하게 꾸미지 마.
- 짧게. 핵심만. 채팅이니까 더 짧게.
- 이모지 거의 쓰지 마. 쓰더라도 딱 하나.
- 목록(•, -, 번호) 꼭 필요할 때만. 말로 할 수 있으면 그냥 말로.
- "네!", "알겠습니다!", "물론이죠!" 같은 거 절대 금지.
- 모르거나 없으면 "없어" 또는 "모르겠어".

## 주요 역할
1. 계약 목록, 매출, 미수금 관련 질문 → 도구 써서 실제 데이터로 답변
2. 리드(잠재 고객) 등록 및 조회
3. 고객 DB 조회 (기관·담당자 검색)
4. 업무(tasks) 조회 및 등록
5. 노션 프로젝트 조회

데이터 관련 질문 오면 무조건 도구 써서 실제 데이터로 답변해.
상태 변경 요청 시: 어떤 건인지 조회해서 확인 후 변경. 변경 완료되면 전/후 상태 알려줘.`

const TOOLS: OpenAI.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'get_sales',
      description: '계약 목록을 조회합니다.',
      parameters: {
        type: 'object',
        properties: {
          search: { type: 'string', description: '건명 또는 발주처 검색어' },
          contract_stage: { type: 'string', description: '계약 | 착수 | 선금 | 중도금 | 완수 | 계산서발행 | 잔금' },
          service_type: { type: 'string', description: '서비스 타입 필터' },
          year_month: { type: 'string', description: '월별 조회 (예: 2026-04)' },
          limit: { type: 'number', description: '최대 조회 건수 (기본 20)' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_monthly_summary',
      description: '월별 매출 요약을 조회합니다.',
      parameters: {
        type: 'object',
        properties: {
          year: { type: 'number', description: '연도 (예: 2026)' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_receivables',
      description: '미수금 현황을 조회합니다.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_sale_detail',
      description: '특정 계약의 상세 정보를 조회합니다.',
      parameters: {
        type: 'object',
        properties: {
          search: { type: 'string', description: '건명 또는 발주처 검색어' },
        },
        required: ['search'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_sale',
      description: '새 계약건을 등록합니다.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: '건명 (필수)' },
          client_org: { type: 'string', description: '발주처' },
          service_type: { type: 'string', description: '서비스 타입' },
          revenue: { type: 'number', description: '매출액 (원 단위)' },
          memo: { type: 'string', description: '메모' },
          inflow_date: { type: 'string', description: '유입일 YYYY-MM-DD' },
        },
        required: ['name', 'service_type'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_sale_status',
      description: '계약의 계약 단계를 변경합니다.',
      parameters: {
        type: 'object',
        properties: {
          search: { type: 'string', description: '건명 또는 발주처 검색어' },
          contract_stage: { type: 'string', description: '새 단계: 계약 | 착수 | 선금 | 중도금 | 완수 | 계산서발행 | 잔금' },
        },
        required: ['search', 'contract_stage'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_tasks',
      description: '업무 목록을 조회합니다.',
      parameters: {
        type: 'object',
        properties: {
          search: { type: 'string', description: '업무명 또는 관련 건명 검색어' },
          status: { type: 'string', description: '할 일 | 진행중 | 완료' },
          assignee_name: { type: 'string', description: '담당자 이름' },
          limit: { type: 'number', description: '최대 조회 건수 (기본 15)' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_task',
      description: '새 업무를 등록합니다.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: '업무명 (필수)' },
          sale_search: { type: 'string', description: '연결할 계약건 검색어 (없으면 내부 업무)' },
          assignee_name: { type: 'string', description: '담당자 이름' },
          due_date: { type: 'string', description: '마감일 YYYY-MM-DD' },
          priority: { type: 'string', description: '낮음 | 보통 | 높음' },
          description: { type: 'string', description: '업무 메모' },
        },
        required: ['title'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_leads',
      description: '리드(잠재 고객) 목록을 검색합니다.',
      parameters: {
        type: 'object',
        properties: {
          search: { type: 'string', description: '기관명 또는 담당자명 검색어' },
          status: { type: 'string', description: '유입 | 회신대기 | 견적발송 | 조율중 | 진행중 | 완료 | 취소' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_lead',
      description: '새 리드를 등록합니다. 같은 기관/담당자도 서비스가 다르거나 별개 문의면 별도 건으로 등록 가능합니다.',
      parameters: {
        type: 'object',
        properties: {
          client_org: { type: 'string', description: '기관명 (필수)' },
          contact_name: { type: 'string', description: '담당자 이름' },
          phone: { type: 'string', description: '연락처' },
          service_type: { type: 'string', description: '서비스 분류' },
          initial_content: { type: 'string', description: '문의 내용 요약' },
          remind_date: { type: 'string', description: '리마인드 날짜 YYYY-MM-DD' },
          channel: { type: 'string', description: '전화/이메일/카카오/채널톡/기타' },
          assignee_name: { type: 'string', description: '담당 직원 이름' },
        },
        required: ['client_org'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_lead',
      description: '리드의 상태, 소통 내용 등을 업데이트합니다. 같은 기관에 여러 건이 있을 수 있으므로, 복수 결과 반환 시 lead_id로 특정해서 재호출합니다.',
      parameters: {
        type: 'object',
        properties: {
          search: { type: 'string', description: '기관명 또는 담당자명 검색어 (lead_id 없을 때 필수)' },
          lead_id: { type: 'string', description: '특정 리드 ID (예: LEAD20260413-0001). 같은 기관에 여러 건이 있을 때 명시.' },
          status: { type: 'string', description: '유입 | 회신대기 | 견적발송 | 조율중 | 진행중 | 완료 | 취소' },
          remind_date: { type: 'string', description: '리마인드 날짜 YYYY-MM-DD' },
          contact_log: { type: 'string', description: '새 소통 내용' },
          notes: { type: 'string', description: '메모' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'convert_lead_to_sale',
      description: '리드를 매출건으로 전환합니다. 같은 기관에 여러 건이 있을 수 있으므로, 복수 결과 반환 시 lead_id로 특정해서 재호출합니다.',
      parameters: {
        type: 'object',
        properties: {
          search: { type: 'string', description: '기관명 검색어 (lead_id 없을 때 필수)' },
          lead_id: { type: 'string', description: '특정 리드 ID (예: LEAD20260413-0001). 같은 기관에 여러 건이 있을 때 명시.' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_customers',
      description: '고객 DB를 검색합니다.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: '기관명 또는 담당자명' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_dropbox',
      description: '드롭박스에서 프로젝트 폴더나 파일을 검색합니다. 건명이나 기관명으로 관련 폴더/파일을 찾을 때 사용.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: '검색어 (프로젝트명, 기관명 등)' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_dropbox_folder',
      description: '드롭박스 폴더 안의 파일 목록을 조회합니다. search_dropbox로 폴더 경로를 찾은 뒤 사용.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: '★ DB 기준 상대경로 (예: /3 학교상점/1 납품 설치/260223 광교청소년수련관)' },
        },
        required: ['path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'read_dropbox_file',
      description: '드롭박스 파일 내용을 읽습니다. PDF 견적서, 계약서 등의 텍스트를 추출할 때 사용. list_dropbox_folder로 파일 경로를 먼저 확인 후 사용.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: '★ DB 기준 상대경로 (예: /3 학교상점/1 납품 설치/260223 광교청소년수련관/0 행정/견적서.pdf)' },
        },
        required: ['path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_notion_projects',
      description: '노션 프로젝트를 검색합니다.',
      parameters: {
        type: 'object',
        properties: {
          search: { type: 'string', description: '프로젝트명 검색어' },
          status: { type: 'string', description: '진행 전 | 진행 중 | 완료 | 보류' },
        },
      },
    },
  },
]

async function executeTool(name: string, input: Record<string, unknown>): Promise<unknown> {
  const supabase = createAdminClient()

  if (name === 'get_sales') {
    let query = supabase
      .from('sales')
      .select('id, name, client_org, service_type, department, revenue, contract_stage, inflow_date, memo')
      .order('inflow_date', { ascending: false })
      .limit((input.limit as number) || 20)
    if (input.search) query = query.or(`name.ilike.%${input.search}%,client_org.ilike.%${input.search}%`)
    if (input.contract_stage) query = query.eq('contract_stage', input.contract_stage as string)
    if (input.service_type) query = query.eq('service_type', input.service_type as string)
    if (input.year_month) query = query.gte('inflow_date', `${input.year_month}-01`).lte('inflow_date', `${input.year_month}-31`)
    const { data, error } = await query
    if (error) return { error: error.message }
    return { count: data?.length, sales: data }
  }

  if (name === 'get_monthly_summary') {
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
    const { data, error } = await supabase
      .from('sales')
      .select('id, name, client_org, service_type, revenue, contract_stage, inflow_date')
      .in('contract_stage', ['착수', '선금', '중도금', '완수', '계산서발행'])
      .order('inflow_date', { ascending: false })
    if (error) return { error: error.message }
    return { count: data?.length, total_receivable: data?.reduce((sum, s) => sum + (s.revenue || 0), 0), sales: data }
  }

  if (name === 'get_sale_detail') {
    const { data, error } = await supabase
      .from('sales')
      .select('*, sale_costs(*)')
      .or(`name.ilike.%${input.search}%,client_org.ilike.%${input.search}%`)
      .order('inflow_date', { ascending: false })
      .limit(3)
    if (error) return { error: error.message }
    return { sales: data }
  }

  if (name === 'create_sale') {
    const saleName = ((input.name as string) || '').trim()
    if (!saleName) return { error: '건명은 필수야.' }
    const serviceType = (input.service_type as string | null) || null
    const DEPT_MAP: Record<string, string> = {
      'SOS': 'sound_of_school', '002ENT': '002_entertainment', '교육프로그램': 'artkiwoom',
      '납품설치': 'school_store', '유지보수': 'school_store', '교구대여': 'school_store', '제작인쇄': 'school_store',
      '콘텐츠제작': '002_creative', '행사운영': '002_creative', '행사대여': '002_creative', '프로젝트': '002_creative',
    }
    const department = (serviceType && DEPT_MAP[serviceType]) || null
    const { data: saleRow, error } = await supabase.from('sales').insert({
      name: saleName,
      client_org: (input.client_org as string | null) || null,
      service_type: serviceType,
      department,
      revenue: (input.revenue as number) || 0,
      contract_stage: '계약',
      memo: (input.memo as string | null) || null,
      inflow_date: (input.inflow_date as string) || new Date().toISOString().split('T')[0],
    }).select('id').single()
    if (error) return { error: error.message }
    return { success: true, id: saleRow.id, name: saleName }
  }

  if (name === 'update_sale_status') {
    const validStatuses = ['계약', '착수', '선금', '중도금', '완수', '계산서발행', '잔금']
    if (!validStatuses.includes(input.contract_stage as string)) {
      return { error: `유효하지 않은 단계. 가능: ${validStatuses.join(', ')}` }
    }
    const { data: found, error: findErr } = await supabase
      .from('sales')
      .select('id, name, contract_stage')
      .or(`name.ilike.%${input.search}%,client_org.ilike.%${input.search}%`)
      .limit(1)
    if (findErr) return { error: findErr.message }
    if (!found || found.length === 0) return { error: '해당 건을 찾을 수 없어.' }
    const sale = found[0]
    const { error: updateErr } = await supabase.from('sales').update({ contract_stage: input.contract_stage }).eq('id', sale.id)
    if (updateErr) return { error: updateErr.message }
    return { success: true, name: sale.name, prev_status: sale.contract_stage, new_status: input.contract_stage }
  }

  if (name === 'get_tasks') {
    let query = supabase
      .from('tasks')
      .select('id, title, status, priority, due_date, description, project_id, assignee_id')
      .order('due_date', { ascending: true, nullsFirst: false })
      .limit((input.limit as number) || 15)
    if (input.status) query = query.eq('status', input.status as string)
    if (input.search) query = query.ilike('title', `%${input.search}%`)
    const { data: tasks, error } = await query
    if (error) return { error: error.message }

    // 담당자 이름 조인
    if (input.assignee_name && tasks) {
      const { data: profiles } = await supabase.from('profiles').select('id, name').ilike('name', `%${input.assignee_name}%`)
      const ids = (profiles || []).map(p => p.id)
      const filtered = tasks.filter(t => t.assignee_id && ids.includes(t.assignee_id))
      return { count: filtered.length, tasks: filtered }
    }

    return { count: tasks?.length, tasks }
  }

  if (name === 'create_task') {
    const title = ((input.title as string) || '').trim()
    if (!title) return { error: '업무명은 필수야.' }

    let project_id: string | null = null
    if (input.sale_search) {
      const { data: found } = await supabase
        .from('sales')
        .select('id, name')
        .or(`name.ilike.%${input.sale_search}%,client_org.ilike.%${input.sale_search}%`)
        .limit(1)
      project_id = found?.[0]?.id || null
    }

    let assignee_id: string | null = null
    if (input.assignee_name) {
      const { data: profiles } = await supabase.from('profiles').select('id').ilike('name', `%${input.assignee_name}%`).limit(1)
      assignee_id = profiles?.[0]?.id || null
    }

    const { error } = await supabase.from('tasks').insert({
      title,
      project_id,
      assignee_id,
      due_date: (input.due_date as string | null) || null,
      priority: (input.priority as string) || '보통',
      description: (input.description as string | null) || null,
      status: '할 일',
    })
    if (error) return { error: error.message }
    return { success: true, title, project_id }
  }

  if (name === 'search_leads') {
    let query = supabase
      .from('leads')
      .select('id, lead_id, client_org, contact_name, service_type, status, remind_date, inflow_date')
      .order('inflow_date', { ascending: false })
      .limit(20)
    if (input.search) query = query.or(`client_org.ilike.%${input.search}%,contact_name.ilike.%${input.search}%`)
    if (input.status) query = query.eq('status', input.status as string)
    const { data, error } = await query
    if (error) return { error: error.message }
    return { count: data?.length, leads: data }
  }

  if (name === 'create_lead') {
    const clientOrg = ((input.client_org as string) || '').trim()
    if (!clientOrg) return { error: '기관명은 필수야.' }
    // 기존 리드 참고용 조회 (차단 없음 — 같은 기관도 별도 건 허용)
    const { data: existing } = await supabase.from('leads').select('lead_id, status, service_type').ilike('client_org', clientOrg).neq('status', '취소').limit(5)
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    const prefix = `LEAD${today}-`
    const { data: lastId } = await supabase.from('leads').select('lead_id').ilike('lead_id', `${prefix}%`).order('lead_id', { ascending: false }).limit(1)
    const num = lastId && lastId.length > 0 ? parseInt(lastId[0].lead_id.slice(-4)) + 1 : 1
    const lead_id = `${prefix}${String(num).padStart(4, '0')}`
    let assignee_id: string | null = null
    if (input.assignee_name) {
      const { data: assignee } = await supabase.from('profiles').select('id').ilike('name', `%${input.assignee_name}%`).limit(1)
      assignee_id = assignee?.[0]?.id || null
    }
    const { data: lead, error } = await supabase.from('leads').insert({
      lead_id, client_org: clientOrg,
      contact_name: (input.contact_name as string) || null,
      phone: (input.phone as string) || null,
      service_type: (input.service_type as string) || null,
      initial_content: (input.initial_content as string) || null,
      inflow_date: new Date().toISOString().slice(0, 10),
      remind_date: (input.remind_date as string) || null,
      channel: (input.channel as string) || null,
      assignee_id, status: '유입',
    }).select('id, lead_id').single()
    if (error) return { error: error.message }
    const note = existing && existing.length > 0
      ? ` (참고: 동일 기관 기존 리드 ${existing.length}건 — ${existing.map(e => `${e.lead_id} ${e.service_type || ''} ${e.status}`).join(', ')})`
      : ''
    return { success: true, lead_id: lead.lead_id, message: `리드 등록 완료! (${lead.lead_id})${note}` }
  }

  if (name === 'update_lead') {
    // lead_id 직접 지정 시 우선 사용, 없으면 search로 조회
    let lead: { id: string; lead_id: string; client_org: string; status: string; contact_1: string | null; contact_2: string | null; contact_3: string | null } | null = null
    if (input.lead_id) {
      const { data, error: e } = await supabase
        .from('leads')
        .select('id, lead_id, client_org, status, contact_1, contact_2, contact_3')
        .eq('lead_id', input.lead_id as string)
        .single()
      if (e || !data) return { error: `리드 ID ${input.lead_id}를 찾을 수 없어.` }
      lead = data
    } else if (input.search) {
      const { data: found, error: findErr } = await supabase
        .from('leads')
        .select('id, lead_id, client_org, status, contact_1, contact_2, contact_3')
        .or(`client_org.ilike.%${input.search}%,contact_name.ilike.%${input.search}%`)
        .limit(5)
      if (findErr) return { error: findErr.message }
      if (!found || found.length === 0) return { error: '해당 리드를 찾을 수 없어.' }
      if (found.length > 1) {
        return {
          multiple: true,
          message: `"${input.search}" 검색 결과 ${found.length}건. lead_id로 특정해줘.`,
          leads: found.map(l => ({ lead_id: l.lead_id, client_org: l.client_org, status: l.status })),
        }
      }
      lead = found[0]
    } else {
      return { error: 'search 또는 lead_id 중 하나는 필요해.' }
    }
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (input.status) updates.status = input.status
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
    let lead: Record<string, unknown> | null = null
    if (input.lead_id) {
      const { data, error: e } = await supabase.from('leads').select('*').eq('lead_id', input.lead_id as string).single()
      if (e || !data) return { error: `리드 ID ${input.lead_id}를 찾을 수 없어.` }
      if (data.converted_sale_id) return { error: '이미 전환된 리드야.' }
      lead = data
    } else if (input.search) {
      const { data: found, error: findErr } = await supabase
        .from('leads')
        .select('*')
        .or(`client_org.ilike.%${input.search}%,contact_name.ilike.%${input.search}%`)
        .is('converted_sale_id', null)
        .limit(5)
      if (findErr) return { error: findErr.message }
      if (!found || found.length === 0) return { error: '전환 가능한 리드를 찾을 수 없어.' }
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
    const DEPT_MAP: Record<string, string> = {
      'SOS': 'sound_of_school', '002ENT': '002_entertainment', '교육프로그램': 'artkiwoom',
      '납품설치': 'school_store', '유지보수': 'school_store', '교구대여': 'school_store', '제작인쇄': 'school_store',
      '콘텐츠제작': '002_creative', '행사운영': '002_creative', '행사대여': '002_creative', '프로젝트': '002_creative',
    }
    const serviceType = finalLead.service_type as string | null
    const { data: sale, error: saleErr } = await supabase.from('sales').insert({
      name: `${finalLead.client_org || '(리드전환)'}`,
      client_org: finalLead.client_org, service_type: serviceType,
      department: (serviceType && DEPT_MAP[serviceType]) || null,
      assignee_id: finalLead.assignee_id, revenue: 0, contract_stage: '계약',
      memo: finalLead.initial_content, inflow_date: finalLead.inflow_date || new Date().toISOString().slice(0, 10),
    }).select('id').single()
    if (saleErr) return { error: saleErr.message }
    await supabase.from('leads').update({ converted_sale_id: sale.id, status: '완료', updated_at: new Date().toISOString() }).eq('id', finalLead.id)
    return { success: true, lead_id: finalLead.lead_id, client_org: finalLead.client_org, sale_id: sale.id }
  }

  if (name === 'search_customers') {
    const query = input.query as string | undefined
    let orgQuery = supabase.from('customers').select('*').order('name').limit(10)
    let personQuery = supabase.from('persons').select('*').order('name').limit(10)
    if (query) {
      orgQuery = supabase.from('customers').select('*').ilike('name', `%${query}%`).limit(10)
      personQuery = supabase.from('persons').select('*').ilike('name', `%${query}%`).limit(10)
    }
    const [{ data: orgs }, { data: persons }] = await Promise.all([orgQuery, personQuery])
    return { organizations: orgs ?? [], persons: persons ?? [] }
  }

  if (name === 'search_dropbox') {
    const results = await searchDropbox(input.query as string)
    if (results.length === 0) return { message: '드롭박스에서 찾을 수 없어.', results: [] }
    return { count: results.length, results }
  }

  if (name === 'list_dropbox_folder') {
    const results = await listDropboxFolder(input.path as string)
    if (results.length === 0) return { message: '폴더가 비어있거나 경로가 잘못됐어.', results: [] }
    return { count: results.length, results }
  }

  if (name === 'read_dropbox_file') {
    const result = await readDropboxFile(input.path as string)
    return result
  }

  if (name === 'search_notion_projects') {
    const token = process.env.NOTION_TOKEN
    if (!token) return { error: 'NOTION_TOKEN not set' }
    const NOTION_DB_ID = '6401e402-25e9-4941-a89e-6e3107df5f74'
    const filters: unknown[] = []
    if (input.search) filters.push({ property: 'Project name', title: { contains: input.search as string } })
    if (input.status) filters.push({ property: '상태', status: { equals: input.status as string } })
    const body: Record<string, unknown> = { page_size: 15, sorts: [{ property: '기간', direction: 'descending' }] }
    if (filters.length === 1) body.filter = filters[0]
    else if (filters.length > 1) body.filter = { and: filters }
    const res = await fetch(`https://api.notion.com/v1/databases/${NOTION_DB_ID}/query`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', 'Notion-Version': '2022-06-28' },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    if (data.object === 'error') return { error: data.message }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const projects = (data.results || []).map((page: any) => ({
      id: page.id,
      name: page.properties['Project name']?.title?.[0]?.plain_text || '',
      status: page.properties['상태']?.status?.name || '',
      date: page.properties['기간']?.date || null,
      url: page.url,
    }))
    return { count: projects.length, projects }
  }

  return { error: '알 수 없는 도구' }
}

async function sendGroupMessage(chatKey: string, text: string) {
  const key = process.env.CHANNELTALK_ACCESS_KEY
  const secret = process.env.CHANNELTALK_ACCESS_SECRET
  if (!key || !secret) {
    console.error('ChannelTalk keys not set')
    return
  }

  // chatKey "group-556532" 또는 "556532" → 숫자 ID만 추출
  const groupId = chatKey.startsWith('group-') ? chatKey.replace('group-', '') : chatKey

  const url = `https://api.channel.io/open/v5/groups/${groupId}/messages`
  console.log('[ChannelTalk send] url:', url, '| text:', text.slice(0, 50))

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'x-access-key': key,
      'x-access-secret': secret,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      plainText: text,
      blocks: [{ type: 'text', value: text }],
    }),
  })
  const data = await res.json()
  if (!res.ok) {
    console.error('ChannelTalk send error:', JSON.stringify(data))
  } else {
    console.log('[ChannelTalk send] success')
  }
  return data
}

async function processWithGPT(chatKey: string, userMessage: string) {
  const today = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Seoul' })

  const messages: OpenAI.ChatCompletionMessageParam[] = [
    { role: 'system', content: `오늘 날짜: ${today}\n${SYSTEM_PROMPT}` },
    { role: 'user', content: userMessage },
  ]

  let maxRounds = 6
  while (maxRounds-- > 0) {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 800,
      tools: TOOLS,
      messages,
    })
    logApiUsage({ model: 'gpt-4o-mini', endpoint: 'channeltalk', userId: null, inputTokens: response.usage?.prompt_tokens ?? 0, outputTokens: response.usage?.completion_tokens ?? 0 }).catch(() => {})

    const choice = response.choices[0]
    if (!choice) break

    if (choice.finish_reason === 'stop') {
      const text = choice.message.content?.trim()
      if (text) await sendGroupMessage(chatKey, text)
      break
    }

    if (choice.finish_reason === 'tool_calls') {
      messages.push(choice.message)
      const toolCalls = choice.message.tool_calls ?? []
      for (const toolCall of toolCalls) {
        if (toolCall.type !== 'function') continue
        let input: Record<string, unknown> = {}
        try { input = JSON.parse(toolCall.function.arguments) } catch { /* empty args */ }
        const result = await executeTool(toolCall.function.name, input)
        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: JSON.stringify(result),
        })
      }
    } else {
      break
    }
  }
}

export async function POST(req: NextRequest) {
  const body = await req.text()

  // 서명 검증 (secret 설정 시 fail-closed)
  const secret = process.env.CHANNELTALK_ACCESS_SECRET
  if (secret) {
    const signature = req.headers.get('x-channel-signature') || req.headers.get('x-signature') || ''
    if (!signature) {
      return NextResponse.json({ error: 'missing signature' }, { status: 401 })
    }
    const expected = crypto.createHmac('sha256', secret).update(body).digest('hex')
    if (signature !== expected && signature !== `sha256=${expected}`) {
      return NextResponse.json({ error: 'invalid signature' }, { status: 401 })
    }
  }

  let payload: Record<string, unknown>
  try {
    payload = JSON.parse(body)
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }

  // 디버깅용 로그 — 민감정보 제외
  console.log('[ChannelTalk] event received, entity type:', (payload.entity as any)?.type)

  const entity = payload.entity as Record<string, unknown> | undefined

  // 봇 메시지 무시 (무한루프 방지)
  if (entity?.personType === 'bot') {
    return NextResponse.json({ result: 'ignored' })
  }

  const personId = entity?.personId as string | undefined
  const messageText = ((entity?.plainText || entity?.content || '') as string).trim()
  // chatKey 우선 사용 (예: "group-556532"), 없으면 chatId fallback
  const chatKey = (entity?.chatKey || entity?.chatId) as string | undefined

  // personId 항상 로그 (Vercel 로그에서 ID 확인용)
  console.log('[ChannelTalk] personId:', personId, '| chatKey:', chatKey)

  if (!messageText || !chatKey) {
    return NextResponse.json({ result: 'no content' })
  }

  // 빵빵이 언급될 때만 응답
  if (!messageText.includes('빵빵이')) {
    return NextResponse.json({ result: 'not mentioned' })
  }

  // ── 권한 체크 ──────────────────────────────────────────────
  // CHANNELTALK_ALLOWED_IDS: 쉼표 구분된 허용 personId 목록
  // 예) "mgr_abc123,mgr_def456"
  // 비어있으면 모든 접근 차단 (배포 직후 ID 확인 전 안전 모드)
  const allowedIds = (process.env.CHANNELTALK_ALLOWED_IDS || '')
    .split(',')
    .map(id => id.trim())
    .filter(Boolean)

  if (allowedIds.length === 0) {
    // 아직 허용 ID 미설정 — 메시지 발신자 ID를 채팅방에 알려주고 차단
    await sendGroupMessage(chatKey,
      `빵빵이 권한 설정 필요!\n\n발신자 ID: ${personId || '확인불가'}\n\nVercel 환경변수 CHANNELTALK_ALLOWED_IDS에 이 ID를 추가해줘.`
    ).catch(console.error)
    return NextResponse.json({ result: 'setup required' })
  }

  if (!personId || !allowedIds.includes(personId)) {
    // 허용되지 않은 사용자 — 조용히 무시
    console.warn('[ChannelTalk] Unauthorized personId:', personId)
    return NextResponse.json({ result: 'unauthorized' })
  }
  // ────────────────────────────────────────────────────────────

  // waitUntil: 200 먼저 반환하고 Claude 처리 완료까지 함수 유지
  waitUntil(
    processWithGPT(chatKey, messageText).catch(async (err) => {
      console.error('[ChannelTalk bot error]', err)
      await sendGroupMessage(chatKey, '오류 발생했어. 잠시 후 다시 해봐.').catch(console.error)
    })
  )

  return NextResponse.json({ result: 'ok' })
}
