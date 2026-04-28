#!/usr/bin/env tsx
/**
 * yourmate-system MCP 서버
 *
 * Claude Code, Claude.ai 데스크톱 등 MCP 호환 클라이언트에서 yourmate 데이터·도구 사용.
 * 빵빵이가 웹에서 쓰는 도구를 그대로 외부 AI에게 노출.
 *
 * 등록 방법 (Claude Code):
 *   claude mcp add yourmate -- npx tsx /Users/junyoungbang/yourmate-system/mcp/server.ts
 *
 * 환경변수 (yourmate-system/.env.local 자동 로드):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { join } from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

// .env.local 로드 (yourmate-system 루트 기준)
const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: join(__dirname, '..', '.env.local') })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('환경변수 누락: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const sb = createClient(SUPABASE_URL, SUPABASE_KEY)

// ─────────────────────────────────────────────
// 도구 정의
// ─────────────────────────────────────────────
const TOOLS = [
  {
    name: 'search_leads',
    description: '리드(잠재 고객) 검색. 기관명/담당자/리드ID로 매칭.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: '기관명/담당자/리드ID 검색어' },
        status: { type: 'string', description: '유입/회신대기/견적발송/조율중/진행중/완료/취소' },
        limit: { type: 'number', description: '최대 건수 (기본 20)' },
      },
    },
  },
  {
    name: 'get_lead_detail',
    description: '특정 리드의 전체 정보 (기본 + 메모 + 소통 내역 + 요약). 빵빵이 분석 결과 모두 포함.',
    inputSchema: {
      type: 'object',
      properties: {
        lead_id_or_uuid: { type: 'string', description: 'lead_id (LEAD20260421-0008) 또는 UUID' },
      },
      required: ['lead_id_or_uuid'],
    },
  },
  {
    name: 'add_communication_log',
    description: '리드 또는 계약에 소통 내역(통화/이메일/미팅/메모) 추가. lead_id 또는 sale_id 필수.',
    inputSchema: {
      type: 'object',
      properties: {
        lead_id: { type: 'string', description: '리드 UUID' },
        sale_id: { type: 'string', description: '계약 UUID' },
        content: { type: 'string', description: '소통 내용' },
        log_type: { type: 'string', description: '통화/이메일/방문/미팅/내부회의/메모/기타' },
        contacted_at: { type: 'string', description: 'YYYY-MM-DD (없으면 오늘)' },
        location: { type: 'string', description: '장소 (회의록용)' },
        participants: { type: 'array', items: { type: 'string' }, description: '참석자 이름 배열' },
        outcome: { type: 'string', description: '결정/결과' },
      },
      required: ['content', 'log_type'],
    },
  },
  {
    name: 'search_projects',
    description: '진행중 프로젝트 검색. 프로젝트명/번호로 매칭.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: '프로젝트명/번호 검색어' },
        status: { type: 'string', description: '진행중/완료/보류/취소' },
        limit: { type: 'number', description: '최대 건수 (기본 20)' },
      },
    },
  },
  {
    name: 'get_project_detail',
    description: '프로젝트 전체 정보: 기본 + 자동 개요 + 협의사항 + 메모 + 소통 + 할일 + 계약. 마스터 brief.',
    inputSchema: {
      type: 'object',
      properties: {
        project_id: { type: 'string', description: '프로젝트 UUID' },
        project_number: { type: 'string', description: '또는 프로젝트 번호 (26-110)' },
      },
    },
  },
  {
    name: 'add_task',
    description: '리드 또는 프로젝트에 할 일 추가. lead_id 또는 project_id 중 하나 필수. 시스템이 동일 제목 중복 자동 검사.',
    inputSchema: {
      type: 'object',
      properties: {
        lead_id: { type: 'string', description: '리드 UUID (리드 할일)' },
        project_id: { type: 'string', description: '프로젝트 UUID (계약/프로젝트 할일)' },
        title: { type: 'string', description: '할 일 제목' },
        due_date: { type: 'string', description: 'YYYY-MM-DD' },
        priority: { type: 'string', description: '긴급/높음/보통/낮음' },
        force: { type: 'boolean', description: '중복 무시' },
      },
      required: ['title'],
    },
  },
  {
    name: 'get_today_actions',
    description: '오늘 처리할 액션 모음 — 활성 리드의 다음 액션 + 활성 프로젝트의 협의사항 종합.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: '최대 건수 (기본 20)' },
      },
    },
  },
  {
    name: 'update_lead',
    description: '리드의 상태/리마인드/서비스/메모 등 업데이트. 같은 기관에 여러 건 있으면 lead_id로 특정.',
    inputSchema: {
      type: 'object',
      properties: {
        lead_id_or_uuid: { type: 'string', description: 'lead_id (LEAD20260421-0008) 또는 UUID' },
        status: { type: 'string', description: '유입/회신대기/견적발송/조율중/진행중/완료/취소' },
        service_type: { type: 'string', description: '교육프로그램/납품설치/유지보수/교구대여/제작인쇄/콘텐츠제작/행사운영/행사대여/프로젝트/SOS/002ENT' },
        remind_date: { type: 'string', description: '리마인드 YYYY-MM-DD' },
        notes: { type: 'string', description: '메모 덮어쓰기' },
      },
      required: ['lead_id_or_uuid'],
    },
  },
  {
    name: 'complete_task',
    description: '할 일을 완료(status=완료) 처리. task_id 또는 (lead/project + title) 조합으로 식별.',
    inputSchema: {
      type: 'object',
      properties: {
        task_id: { type: 'string', description: '할 일 UUID' },
        title: { type: 'string', description: '제목 부분 일치 (task_id 없을 때)' },
        lead_id: { type: 'string', description: 'title 검색 범위 (리드)' },
        project_id: { type: 'string', description: 'title 검색 범위 (프로젝트 UUID)' },
      },
    },
  },
  {
    name: 'update_task',
    description: '할 일 수정 (제목/상태/우선순위/마감일/담당자/설명).',
    inputSchema: {
      type: 'object',
      properties: {
        task_id: { type: 'string', description: '할 일 UUID' },
        new_title: { type: 'string' },
        status: { type: 'string', description: '할 일/진행중/완료/보류' },
        priority: { type: 'string', description: '긴급/높음/보통/낮음' },
        due_date: { type: 'string', description: 'YYYY-MM-DD (없애려면 빈 문자열)' },
        assignee_name: { type: 'string', description: '담당자 이름 ("나"=null로 해제 안 함, ""=미지정)' },
        description: { type: 'string' },
      },
      required: ['task_id'],
    },
  },
  {
    name: 'delete_task',
    description: '할 일 영구 삭제. 실수 방지용으로 task_id 필수.',
    inputSchema: {
      type: 'object',
      properties: {
        task_id: { type: 'string', description: '할 일 UUID' },
      },
      required: ['task_id'],
    },
  },
  {
    name: 'add_project_memo',
    description: '프로젝트에 메모 카드 추가 (multi memo).',
    inputSchema: {
      type: 'object',
      properties: {
        project_id: { type: 'string', description: '프로젝트 UUID' },
        title: { type: 'string', description: '메모 제목' },
        content: { type: 'string', description: '메모 본문 (markdown 가능)' },
      },
      required: ['project_id', 'content'],
    },
  },
  {
    name: 'search_customers',
    description: '고객 DB(기관) 검색. 거래 이력 매핑 전 customer_id 확보용.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: '기관명 검색어' },
        type: { type: 'string', description: '학교/공공기관/기업/개인/기타' },
        limit: { type: 'number', description: '최대 건수 (기본 15)' },
      },
    },
  },
  {
    name: 'quick_create_customer',
    description: '신규 기관(+선택 담당자) 등록 후 customer_id 반환. 새 리드/계약 만들기 직전에 사용.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: '기관명 (필수)' },
        type: { type: 'string', description: '학교/공공기관/기업/개인/기타 (기본 기타)' },
        contact_name: { type: 'string', description: '담당자 이름' },
        contact_dept: { type: 'string', description: '담당자 부서' },
        contact_title: { type: 'string', description: '담당자 직책' },
        phone: { type: 'string' },
        email: { type: 'string' },
      },
      required: ['name'],
    },
  },
] as const

// ─────────────────────────────────────────────
// 도구 핸들러
// ─────────────────────────────────────────────
type ToolInput = Record<string, unknown>

async function handleTool(name: string, input: ToolInput): Promise<unknown> {
  switch (name) {
    case 'search_leads': {
      let q = sb.from('leads')
        .select('id, lead_id, project_name, client_org, contact_name, service_type, status, inflow_date, remind_date, summary_cache')
        .order('inflow_date', { ascending: false })
        .limit((input.limit as number) || 20)
      if (input.query) {
        const s = input.query as string
        q = q.or(`client_org.ilike.%${s}%,project_name.ilike.%${s}%,contact_name.ilike.%${s}%,lead_id.ilike.%${s}%`)
      }
      if (input.status) q = q.eq('status', input.status as string)
      const { data, error } = await q
      if (error) return { error: error.message }
      return { count: data?.length, leads: data }
    }

    case 'get_lead_detail': {
      const idStr = input.lead_id_or_uuid as string
      const isUuid = /^[0-9a-f]{8}-/.test(idStr)
      const q = sb.from('leads').select('*')
      const { data: lead, error } = isUuid
        ? await q.eq('id', idStr).maybeSingle()
        : await q.eq('lead_id', idStr).maybeSingle()
      if (error || !lead) return { error: error?.message || '리드를 찾을 수 없음' }

      const { data: logs } = await sb.from('project_logs')
        .select('content, log_type, contacted_at, location, participants, outcome')
        .eq('lead_id', lead.id).order('contacted_at', { ascending: false }).limit(20)

      return { lead, logs: logs ?? [] }
    }

    case 'add_communication_log': {
      const leadId = (input.lead_id as string) || null
      const saleId = (input.sale_id as string) || null
      if (!leadId && !saleId) return { error: 'lead_id 또는 sale_id 필요' }

      const participants = input.participants as string[] | undefined
      const { data, error } = await sb.from('project_logs').insert({
        lead_id: leadId,
        sale_id: saleId,
        content: input.content,
        log_type: (input.log_type as string) || '메모',
        contacted_at: (input.contacted_at as string) || new Date().toISOString(),
        location: (input.location as string) || null,
        participants: participants?.length ? participants : null,
        outcome: (input.outcome as string) || null,
      }).select('id').single()
      if (error) return { error: error.message }
      return { success: true, log_id: data.id, target: leadId ? `lead ${leadId.slice(0, 8)}` : `sale ${saleId?.slice(0, 8)}` }
    }

    case 'search_projects': {
      let q = sb.from('projects')
        .select('id, name, project_number, service_type, status, customer_id')
        .order('created_at', { ascending: false })
        .limit((input.limit as number) || 20)
      if (input.query) {
        const s = input.query as string
        q = q.or(`name.ilike.%${s}%,project_number.ilike.%${s}%`)
      }
      if (input.status) q = q.eq('status', input.status as string)
      else q = q.neq('status', '취소')
      const { data, error } = await q
      if (error) return { error: error.message }
      return { count: data?.length, projects: data }
    }

    case 'get_project_detail': {
      let projectId = input.project_id as string | null
      if (!projectId && input.project_number) {
        const { data: p } = await sb.from('projects').select('id').eq('project_number', input.project_number as string).maybeSingle()
        projectId = p?.id ?? null
      }
      if (!projectId) return { error: 'project_id 또는 project_number 필요' }

      const [{ data: project }, { data: contracts }, { data: memos }, { data: logs }] = await Promise.all([
        sb.from('projects').select('*').eq('id', projectId).maybeSingle(),
        sb.from('sales').select('id, name, contract_stage, revenue').eq('project_id', projectId),
        sb.from('project_memos').select('id, title, content, created_at').eq('project_id', projectId).order('created_at', { ascending: false }),
        sb.from('project_logs').select('content, log_type, contacted_at, outcome').eq('project_id', projectId).order('contacted_at', { ascending: false }).limit(15),
      ])
      if (!project) return { error: '프로젝트를 찾을 수 없음' }

      const saleIds = (contracts ?? []).map(c => c.id)
      const { data: tasks } = saleIds.length > 0
        ? await sb.from('tasks').select('title, status, priority, due_date').in('project_id', saleIds).order('due_date', { ascending: true })
        : { data: [] as { title: string; status: string; priority: string; due_date: string }[] }

      return { project, contracts, memos, logs, tasks }
    }

    case 'add_task': {
      const leadId = input.lead_id as string | undefined
      const projectId = input.project_id as string | undefined
      const title = (input.title as string).trim()
      if (!title) return { error: '제목 필수' }
      if (!leadId && !projectId) return { error: 'lead_id 또는 project_id 필요' }

      let targetSaleId: string | null = null
      if (projectId) {
        const { data: firstSale } = await sb.from('sales').select('id').eq('project_id', projectId).order('created_at').limit(1).maybeSingle()
        if (!firstSale) return { error: '이 프로젝트에 연결된 계약이 없음' }
        targetSaleId = firstSale.id
      }

      // 중복 체크
      if (!input.force) {
        let q = sb.from('tasks')
          .select('id, title, status, due_date')
          .neq('status', '완료').neq('status', '보류')
          .ilike('title', `%${title}%`).limit(5)
        q = leadId ? q.eq('lead_id', leadId) : q.eq('project_id', targetSaleId!)
        const { data: existing } = await q
        if (existing && existing.length > 0) {
          return { duplicate_warning: true, existing, message: 'force=true로 재호출 시 강제 추가' }
        }
      }

      const validPriority = ['긴급', '높음', '보통', '낮음']
      const priority = validPriority.includes(input.priority as string) ? (input.priority as string) : '보통'
      const { data, error } = await sb.from('tasks').insert({
        lead_id: leadId || null,
        project_id: leadId ? null : targetSaleId,
        title,
        status: '할 일',
        priority,
        due_date: (input.due_date as string) || null,
      }).select('id, title').single()
      if (error) return { error: error.message }
      return { success: true, id: data.id, title: data.title, target: leadId ? `lead ${leadId.slice(0, 8)}` : `sale ${targetSaleId?.slice(0, 8)}` }
    }

    case 'get_today_actions': {
      const limit = (input.limit as number) || 20
      const [{ data: leads }, { data: projects }] = await Promise.all([
        sb.from('leads')
          .select('id, lead_id, project_name, client_org, summary_cache, remind_date')
          .not('status', 'in', '(완료,취소)')
          .not('summary_cache', 'is', null)
          .order('updated_at', { ascending: false }).limit(50),
        sb.from('projects')
          .select('id, name, project_number, pending_discussion')
          .eq('status', '진행중')
          .not('pending_discussion', 'is', null)
          .order('updated_at', { ascending: false }).limit(30),
      ])

      const leadActions = (leads ?? []).flatMap(l => {
        const next = l.summary_cache?.split('\n').find((s: string) => s.trim().startsWith('다음:'))?.replace(/^다음:\s*/, '').trim()
        return next && next !== '없음' && next !== '—'
          ? [{ type: 'lead', id: l.id, lead_id: l.lead_id, name: l.project_name || l.client_org, action: next }]
          : []
      })
      const projActions = (projects ?? []).flatMap(p => {
        const first = (p.pending_discussion as string)?.split('\n').map((s: string) => s.trim()).find((s: string) => /^[-*]\s/.test(s) && s.length > 5)?.replace(/^[-*]\s+/, '').slice(0, 100)
        return first
          ? [{ type: 'project', id: p.id, project_number: p.project_number, name: p.name, action: first }]
          : []
      })

      return { count: leadActions.length + projActions.length, actions: [...leadActions, ...projActions].slice(0, limit) }
    }

    case 'update_lead': {
      const idStr = input.lead_id_or_uuid as string
      const isUuid = /^[0-9a-f]{8}-/.test(idStr)
      const { data: lead } = isUuid
        ? await sb.from('leads').select('id, lead_id, client_org').eq('id', idStr).maybeSingle()
        : await sb.from('leads').select('id, lead_id, client_org').eq('lead_id', idStr).maybeSingle()
      if (!lead) return { error: '리드를 찾을 수 없음' }

      const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
      if (input.status) updates.status = input.status
      if (input.service_type) updates.service_type = input.service_type
      if (input.remind_date !== undefined) updates.remind_date = (input.remind_date as string) || null
      if (input.notes !== undefined) updates.notes = (input.notes as string) || null
      if (Object.keys(updates).length === 1) return { error: '변경할 내용이 없음' }

      const { error } = await sb.from('leads').update(updates).eq('id', lead.id)
      if (error) return { error: error.message }
      return { success: true, lead_id: lead.lead_id, client_org: lead.client_org, updates }
    }

    case 'complete_task': {
      let taskId = input.task_id as string | undefined
      if (!taskId) {
        const title = input.title as string | undefined
        if (!title) return { error: 'task_id 또는 title 필요' }
        const leadId = input.lead_id as string | undefined
        const projectId = input.project_id as string | undefined
        if (!leadId && !projectId) return { error: 'title 검색 시 lead_id 또는 project_id 필요' }

        let saleIds: string[] = []
        if (projectId) {
          const { data: sales } = await sb.from('sales').select('id').eq('project_id', projectId)
          saleIds = (sales ?? []).map(s => s.id)
          if (saleIds.length === 0) return { error: '이 프로젝트에 연결된 계약이 없음' }
        }

        let q = sb.from('tasks').select('id, title, status').ilike('title', `%${title}%`).limit(10)
        q = leadId ? q.eq('lead_id', leadId) : q.in('project_id', saleIds)
        const { data: matches } = await q
        if (!matches || matches.length === 0) return { error: `"${title}" 매칭 없음` }
        if (matches.length > 1) return { multiple: true, message: 'task_id로 특정 필요', tasks: matches }
        taskId = matches[0].id
      }
      const { data, error } = await sb.from('tasks').update({ status: '완료', updated_at: new Date().toISOString() }).eq('id', taskId).select('id, title').single()
      if (error) return { error: error.message }
      return { success: true, id: data.id, title: data.title }
    }

    case 'update_task': {
      const taskId = input.task_id as string
      const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
      if (typeof input.new_title === 'string' && (input.new_title as string).trim()) updates.title = (input.new_title as string).trim()
      if (input.status) {
        if (!['할 일', '진행중', '완료', '보류'].includes(input.status as string)) return { error: '상태는 할 일/진행중/완료/보류' }
        updates.status = input.status
      }
      if (input.priority) {
        if (!['긴급', '높음', '보통', '낮음'].includes(input.priority as string)) return { error: '우선순위는 긴급/높음/보통/낮음' }
        updates.priority = input.priority
      }
      if (input.due_date !== undefined) updates.due_date = (input.due_date as string) || null
      if (input.description !== undefined) updates.description = (input.description as string) || null
      if (input.assignee_name !== undefined) {
        const aname = (input.assignee_name as string).trim()
        if (aname === '') updates.assignee_id = null
        else {
          const { data: p } = await sb.from('profiles').select('id').ilike('name', `%${aname}%`).limit(1).maybeSingle()
          updates.assignee_id = p?.id ?? null
        }
      }
      if (Object.keys(updates).length === 1) return { error: '변경할 내용이 없음' }

      const { data, error } = await sb.from('tasks').update(updates).eq('id', taskId).select('id, title').single()
      if (error) return { error: error.message }
      return { success: true, id: data.id, title: data.title, updates }
    }

    case 'delete_task': {
      const taskId = input.task_id as string
      const { data: existed } = await sb.from('tasks').select('id, title').eq('id', taskId).maybeSingle()
      if (!existed) return { error: '해당 할 일을 찾을 수 없음' }
      const { error } = await sb.from('tasks').delete().eq('id', taskId)
      if (error) return { error: error.message }
      return { success: true, id: existed.id, title: existed.title }
    }

    case 'add_project_memo': {
      const projectId = input.project_id as string
      const content = ((input.content as string) || '').trim()
      if (!projectId || !content) return { error: 'project_id와 content 필수' }
      const { data, error } = await sb.from('project_memos').insert({
        project_id: projectId,
        title: (input.title as string) || null,
        content,
      }).select('id').single()
      if (error) return { error: error.message }
      return { success: true, memo_id: data.id }
    }

    case 'search_customers': {
      const query = input.query as string | undefined
      const typeFilter = input.type as string | undefined
      const limit = (input.limit as number) || 15
      let q = sb.from('customers').select('id, name, type, status, contact_name, phone').order('name').limit(limit)
      if (query) q = q.ilike('name', `%${query}%`)
      if (typeFilter) q = q.eq('type', typeFilter)
      const { data, error } = await q
      if (error) return { error: error.message }
      return { count: data?.length ?? 0, customers: data ?? [] }
    }

    case 'quick_create_customer': {
      const orgName = ((input.name as string) || '').trim()
      if (!orgName) return { error: '기관명 필수' }
      const customerInsert: Record<string, unknown> = {
        name: orgName,
        type: (input.type as string) || '기타',
        status: '활성',
      }
      if (input.contact_name) customerInsert.contact_name = input.contact_name
      if (input.phone) customerInsert.phone = input.phone
      if (input.email) customerInsert.contact_email = input.email
      const { data: customer, error: cErr } = await sb.from('customers').insert(customerInsert).select('id').single()
      if (cErr || !customer) return { error: cErr?.message ?? '기관 생성 실패' }

      let personId: string | null = null
      const contactName = (input.contact_name as string | undefined)?.trim()
      if (contactName) {
        const { data: person } = await sb.from('persons').insert({
          name: contactName,
          phone: (input.phone as string) || null,
          email: (input.email as string) || null,
        }).select('id').single()
        if (person) {
          personId = person.id
          await sb.from('person_org_relations').insert({
            person_id: person.id,
            customer_id: customer.id,
            dept: (input.contact_dept as string) || null,
            title: (input.contact_title as string) || null,
            started_at: new Date().toISOString().slice(0, 10),
            ended_at: null,
            is_current: true,
          })
        }
      }
      return { success: true, customer_id: customer.id, person_id: personId }
    }

    default:
      return { error: `Unknown tool: ${name}` }
  }
}

// ─────────────────────────────────────────────
// MCP 서버 setup
// ─────────────────────────────────────────────
const server = new Server(
  { name: 'yourmate', version: '1.0.0' },
  { capabilities: { tools: {} } },
)

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS as unknown as { name: string; description: string; inputSchema: unknown }[],
}))

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params
  try {
    const result = await handleTool(name, (args ?? {}) as ToolInput)
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    }
  } catch (e) {
    return {
      content: [{ type: 'text', text: `Error: ${e instanceof Error ? e.message : String(e)}` }],
      isError: true,
    }
  }
})

async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error('yourmate MCP 서버 시작 (stdio)')
}

main().catch(e => {
  console.error('MCP 서버 실패:', e)
  process.exit(1)
})
