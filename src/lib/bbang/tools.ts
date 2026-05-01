// 빵빵이 시스템 프롬프트용 Anthropic tool 정의 모음.
// chat/route.ts 비대화 방지를 위해 분리.
import type Anthropic from '@anthropic-ai/sdk'

export const TOOLS: Anthropic.Tool[] = [
  {
    name: 'get_sales',
    description: '계약 목록을 조회합니다. 검색어, 상태, 서비스 타입, 월별 필터 사용 가능.',
    input_schema: {
      type: 'object' as const,
      properties: {
        search: { type: 'string', description: '건명 또는 발주처 검색어' },
        contract_stage: { type: 'string', description: '계약 | 착수 | 선금 | 중도금 | 완수 | 계산서발행 | 잔금' },
        service_type: { type: 'string', description: '서비스 타입 필터' },
        year_month: { type: 'string', description: '월별 조회 (예: 2026-04)' },
        limit: { type: 'number', description: '최대 조회 건수 (기본 20)' },
      },
    },
  },
  {
    name: 'get_monthly_summary',
    description: '월별 매출 요약 (건수, 총 매출, 총 원가, 순이익)을 조회합니다.',
    input_schema: {
      type: 'object' as const,
      properties: {
        year: { type: 'number', description: '연도 (예: 2026)' },
      },
    },
  },
  {
    name: 'get_receivables',
    description: '미수금 현황을 조회합니다. 계약 이후 아직 잔금이 완료되지 않은 건들.',
    input_schema: {
      type: 'object' as const,
      properties: {},
    },
  },
  {
    name: 'get_sale_detail',
    description: '특정 계약의 상세 정보와 원가 내역을 조회합니다.',
    input_schema: {
      type: 'object' as const,
      properties: {
        search: { type: 'string', description: '건명 또는 발주처 검색어' },
      },
      required: ['search'],
    },
  },
  {
    name: 'create_sale',
    description: '새 계약건을 시스템에 등록하고 노션 프로젝트를 생성합니다. customer_id를 가능한 한 함께 넘겨 — 없으면 client_org 정확 매칭 시도, 매칭 실패면 search_customers/quick_create_customer를 먼저 거쳐서 customer_id를 확보한 뒤 재호출해.',
    input_schema: {
      type: 'object' as const,
      properties: {
        name: { type: 'string', description: '건명 (필수)' },
        customer_id: { type: 'string', description: '발주처 customer UUID (search_customers 결과의 id). 없으면 client_org 정확 매칭. 둘 다 매칭 실패 시 quick_create_customer 먼저.' },
        client_org: { type: 'string', description: '발주처 이름 (customer_id 없을 때 폴백 매칭에만 사용)' },
        service_type: { type: 'string', description: '서비스 타입: 교육프로그램/납품설치/유지보수/교구대여/제작인쇄/콘텐츠제작/행사운영/행사대여/프로젝트/SOS/002ENT 중 하나' },
        revenue: { type: 'number', description: '매출액 (원 단위)' },
        memo: { type: 'string', description: '메모' },
        dropbox_url: { type: 'string', description: '기존 Dropbox 폴더 URL (이미 폴더가 있는 경우)' },
        inflow_date: { type: 'string', description: '유입일 YYYY-MM-DD (없으면 오늘)' },
        create_notion: { type: 'boolean', description: '노션 프로젝트도 생성할지 (기본 true)' },
      },
      required: ['name', 'service_type'],
    },
  },
  {
    name: 'update_notion_title',
    description: '노션 프로젝트 페이지 제목을 변경합니다.',
    input_schema: {
      type: 'object' as const,
      properties: {
        page_id: { type: 'string', description: '노션 페이지 ID' },
        title: { type: 'string', description: '새 제목' },
      },
      required: ['page_id', 'title'],
    },
  },
  {
    name: 'read_dropbox_pdf',
    description: '드롭박스 프로젝트 폴더의 PDF(견적서/계약서)를 읽고 금액, 내용 등을 추출합니다.',
    input_schema: {
      type: 'object' as const,
      properties: {
        sale_search: { type: 'string', description: '건명 또는 발주처 검색어' },
        path: { type: 'string', description: '직접 드롭박스 폴더 경로' },
      },
    },
  },
  {
    name: 'update_sale_revenue',
    description: '계약의 매출액을 업데이트합니다.',
    input_schema: {
      type: 'object' as const,
      properties: {
        search: { type: 'string', description: '건명 또는 발주처 검색어' },
        revenue: { type: 'number', description: '새 매출액 (원 단위)' },
      },
      required: ['search', 'revenue'],
    },
  },
  {
    name: 'update_sale_status',
    description: '계약의 결제 상태를 변경합니다. 변경 전에 반드시 사용자에게 확인받을 것.',
    input_schema: {
      type: 'object' as const,
      properties: {
        search: { type: 'string', description: '건명 또는 발주처 검색어' },
        contract_stage: { type: 'string', description: '새 단계: 계약 | 착수 | 선금 | 중도금 | 완수 | 계산서발행 | 잔금' },
      },
      required: ['search', 'contract_stage'],
    },
  },
  {
    name: 'update_notion_status',
    description: '노션 프로젝트 상태를 변경합니다. 변경 전에 반드시 사용자에게 확인받을 것.',
    input_schema: {
      type: 'object' as const,
      properties: {
        page_id: { type: 'string', description: '노션 페이지 ID' },
        status: { type: 'string', description: '새 상태: 진행 전 | 진행 중 | 완료 | 보류' },
      },
      required: ['page_id', 'status'],
    },
  },
  {
    name: 'search_notion_projects',
    description: '노션 프로젝트 DB를 검색합니다. 프로젝트 이름, 상태, PM, 기간 조회 가능.',
    input_schema: {
      type: 'object' as const,
      properties: {
        search: { type: 'string', description: '프로젝트명 검색어' },
        status: { type: 'string', description: '상태 필터 (진행 전 | 진행 중 | 완료 | 보류)' },
      },
    },
  },
  {
    name: 'get_notion_project_content',
    description: '특정 노션 프로젝트 페이지의 상세 내용(TODO, 업무순서, GOAL 등)을 조회합니다.',
    input_schema: {
      type: 'object' as const,
      properties: {
        page_id: { type: 'string', description: '노션 페이지 ID (search_notion_projects 결과에서 가져옴)' },
      },
      required: ['page_id'],
    },
  },
  {
    name: 'search_dropbox',
    description: '키워드로 Dropbox 파일/폴더를 검색합니다. 경로를 모를 때 사용.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: { type: 'string', description: '검색 키워드 (예: 용인청, 행사운영, 견적서)' },
      },
      required: ['query'],
    },
  },
  {
    name: 'search_leads',
    description: '리드(잠재 고객) 목록을 검색합니다. 기관명, 담당자, 상태로 필터 가능.',
    input_schema: {
      type: 'object' as const,
      properties: {
        search: { type: 'string', description: '기관명 또는 담당자명 검색어' },
        status: { type: 'string', description: '상태 필터: 유입 | 회신대기 | 견적발송 | 조율중 | 진행중 | 완료 | 취소' },
      },
    },
  },
  {
    name: 'create_lead',
    description: '새 리드(잠재 고객 문의)를 등록합니다. customer_id를 가능한 한 함께 넘겨 — 없으면 client_org 정확 매칭 시도, 매칭 실패면 search_customers/quick_create_customer를 먼저 거쳐서 customer_id를 확보. 같은 기관 활성 리드가 있으면 중복 경고를 반환하고 confirm=true 재호출 시에만 등록.',
    input_schema: {
      type: 'object' as const,
      properties: {
        customer_id: { type: 'string', description: '기관 customer UUID (search_customers 결과의 id). 없으면 client_org 정확 매칭.' },
        client_org: { type: 'string', description: '기관명 (필수)' },
        project_name: { type: 'string', description: '프로젝트명/건명 (예: 260610 서울중학교 렌탈). 없으면 생략.' },
        contact_name: { type: 'string', description: '담당자 이름/직급' },
        phone: { type: 'string', description: '연락처' },
        email: { type: 'string', description: '이메일' },
        service_type: { type: 'string', description: '서비스 분류: SOS/교육프로그램/납품설치/유지보수/교구대여/제작인쇄/콘텐츠제작/행사운영/행사대여/프로젝트/002ENT' },
        initial_content: { type: 'string', description: '문의 내용 요약 2~3줄' },
        inflow_date: { type: 'string', description: '최초 유입일 YYYY-MM-DD (없으면 오늘)' },
        remind_date: { type: 'string', description: '리마인드 날짜 YYYY-MM-DD' },
        channel: { type: 'string', description: '소통 경로: 전화/이메일/카카오/채널톡/기타' },
        inflow_source: { type: 'string', description: '유입 경로: 네이버/인스타/유튜브/지인/기존고객/기타' },
        assignee_name: { type: 'string', description: '담당 직원 이름 (없으면 미지정)' },
        confirm: { type: 'boolean', description: '중복 경고 후 사용자가 확인했을 때 true로 재호출' },
      },
      required: ['client_org'],
    },
  },
  {
    name: 'update_lead',
    description: '리드의 상태, 소통 내용, 리마인드 날짜 등을 업데이트합니다. 같은 기관에 여러 건이 있을 수 있으므로, 복수 결과 반환 시 lead_id로 특정해서 재호출합니다.',
    input_schema: {
      type: 'object' as const,
      properties: {
        search: { type: 'string', description: '기관명 또는 담당자명 검색어 (lead_id 없을 때 필수)' },
        lead_id: { type: 'string', description: '특정 리드 ID (예: LEAD20260413-0001). 같은 기관에 여러 건이 있을 때 명시.' },
        status: { type: 'string', description: '새 상태: 유입 | 회신대기 | 견적발송 | 조율중 | 진행중 | 완료 | 취소' },
        service_type: { type: 'string', description: '서비스 유형: 교육프로그램 | 납품설치 | 유지보수 | 교구대여 | 제작인쇄 | 콘텐츠제작 | 행사운영 | 행사대여 | 프로젝트 | SOS | 002ENT' },
        remind_date: { type: 'string', description: '리마인드 날짜 YYYY-MM-DD' },
        contact_log: { type: 'string', description: '새 소통 내용 (1→2→3차 순서로 빈 칸에 자동 저장)' },
        notes: { type: 'string', description: '메모 업데이트' },
      },
    },
  },
  {
    name: 'convert_lead_to_sale',
    description: '리드를 매출건으로 전환합니다. 계약이 성사됐을 때 사용. 같은 기관에 여러 건이 있을 수 있으므로, 복수 결과 반환 시 lead_id로 특정해서 재호출합니다.',
    input_schema: {
      type: 'object' as const,
      properties: {
        search: { type: 'string', description: '기관명 또는 담당자명 검색어 (lead_id 없을 때 필수)' },
        lead_id: { type: 'string', description: '특정 리드 ID (예: LEAD20260413-0001). 같은 기관에 여러 건이 있을 때 명시.' },
      },
    },
  },
  {
    name: 'search_customers',
    description: '고객 DB를 검색합니다. 기관(학교/기업 등)과 담당자(개인) 정보, 거래 이력을 조회할 수 있습니다.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: { type: 'string', description: '기관명 또는 담당자명 검색어' },
        type: { type: 'string', description: '기관 유형 필터: 학교 | 공공기관 | 기업 | 개인 | 기타' },
      },
    },
  },
  {
    name: 'quick_create_customer',
    description: '신규 기관(customers) + 선택적 담당자(persons)를 즉석 등록하고 customer_id를 반환합니다. create_sale/create_lead 직전에 사용. 사용자에게 한 번 확인받은 뒤 호출.',
    input_schema: {
      type: 'object' as const,
      properties: {
        name: { type: 'string', description: '기관명 (필수)' },
        type: { type: 'string', description: '기관 유형: 학교 | 공공기관 | 기업 | 개인 | 기타 (기본 기타)' },
        contact_name: { type: 'string', description: '담당자 이름 (선택)' },
        contact_dept: { type: 'string', description: '담당자 소속 부서 (선택)' },
        contact_title: { type: 'string', description: '담당자 직책 (선택)' },
        phone: { type: 'string', description: '담당자 연락처 (선택)' },
        email: { type: 'string', description: '담당자 이메일 (선택)' },
      },
      required: ['name'],
    },
  },
  {
    name: 'find_duplicate_customers',
    description: '중복 의심 customer 후보를 추출합니다. 이름 정규화(공백·괄호·법인격 제거) + 앞 4글자 매칭으로 그룹핑. merge_customers 호출 전에 사용.',
    input_schema: {
      type: 'object' as const,
      properties: {
        keyword: { type: 'string', description: '특정 키워드만 점검 (예: 이화여대). 없으면 전체.' },
      },
    },
  },
  {
    name: 'merge_customers',
    description: '여러 customer를 하나로 통합합니다. merge_ids에 있는 customer의 sales/leads/projects/person_org_relations를 모두 keep_id로 옮기고 merge_ids는 삭제. 사용자에게 반드시 한 번 확인받은 뒤 호출.',
    input_schema: {
      type: 'object' as const,
      properties: {
        keep_id: { type: 'string', description: '남길 기관 UUID' },
        merge_ids: { type: 'array', items: { type: 'string' }, description: '통합할(삭제할) 기관 UUID들' },
      },
      required: ['keep_id', 'merge_ids'],
    },
  },
  {
    name: 'find_orphan_sales',
    description: 'customer_id가 비어 있는 sales 행을 찾습니다. client_org 텍스트 그대로 노출. match_sale_to_customer 호출 전 단서로 사용.',
    input_schema: {
      type: 'object' as const,
      properties: {
        keyword: { type: 'string', description: '특정 client_org 키워드 필터 (선택)' },
        limit: { type: 'number', description: '최대 조회 건수 (기본 50)' },
      },
    },
  },
  {
    name: 'match_sale_to_customer',
    description: '단일 sale 행을 특정 customer에 연결합니다. sales.customer_id + (있으면) projects.customer_id 같이 갱신.',
    input_schema: {
      type: 'object' as const,
      properties: {
        sale_id: { type: 'string', description: 'sales.id (UUID)' },
        customer_id: { type: 'string', description: 'customers.id (UUID)' },
      },
      required: ['sale_id', 'customer_id'],
    },
  },
  {
    name: 'match_lead_to_customer',
    description: '단일 lead 행을 특정 customer에 연결합니다. leads.customer_id 갱신.',
    input_schema: {
      type: 'object' as const,
      properties: {
        lead_id: { type: 'string', description: 'leads.id (UUID) 또는 lead_id (예: LEAD20260413-0001)' },
        customer_id: { type: 'string', description: 'customers.id (UUID)' },
      },
      required: ['lead_id', 'customer_id'],
    },
  },
  {
    name: 'find_orphan_leads',
    description: 'customer_id가 비어 있는 leads를 찾습니다. client_org 텍스트 그대로 노출. 정리 시 단서로 사용.',
    input_schema: {
      type: 'object' as const,
      properties: {
        keyword: { type: 'string', description: '특정 client_org 키워드 필터 (선택)' },
        limit: { type: 'number', description: '최대 조회 건수 (기본 50)' },
      },
    },
  },
  {
    name: 'list_dropbox_files',
    description: '프로젝트의 Dropbox 폴더 파일 목록을 조회합니다.',
    input_schema: {
      type: 'object' as const,
      properties: {
        sale_search: { type: 'string', description: '건명 또는 발주처 검색어 (sales 테이블에서 dropbox 경로 찾기)' },
        path: { type: 'string', description: '직접 Dropbox 폴더 경로 (예: /방 준영/1. 가업/★ DB/...)' },
      },
    },
  },
  {
    name: 'set_dropbox_url',
    description: '현재 프로젝트에 Dropbox 폴더 URL을 연결합니다. search_dropbox로 폴더를 찾은 뒤 사용.',
    input_schema: {
      type: 'object' as const,
      properties: {
        dropbox_url: { type: 'string', description: 'Dropbox 폴더 URL (https://www.dropbox.com/home/... 형식)' },
      },
      required: ['dropbox_url'],
    },
  },
  {
    name: 'update_brief_note',
    description: '현재 프로젝트의 brief.md AI 협업 노트 섹션에 중요 정보를 추가합니다. 클라이언트 성향, 구두 합의, 핵심 결정사항, 주의사항 등 DB에 담기 어려운 정성 정보를 저장.',
    input_schema: {
      type: 'object' as const,
      properties: {
        note: { type: 'string', description: '저장할 내용 (1~2줄 요약)' },
      },
      required: ['note'],
    },
  },
  {
    name: 'add_project_log',
    description: '소통 내역(통화/이메일/미팅) 등록. 프로젝트 페이지에서는 자동으로 현재 프로젝트의 첫 계약에 연결. 대시보드(BrainDump)에서는 lead_id 또는 sale_id를 명시적으로 줘야 함 — search_leads/get_sales로 먼저 찾은 후 그 UUID를 전달.',
    input_schema: {
      type: 'object' as const,
      properties: {
        content: { type: 'string', description: '소통 내용 (필수)' },
        log_type: { type: 'string', description: '통화 / 이메일 / 방문 / 미팅 / 내부회의 / 메모 / 기타' },
        contacted_at: { type: 'string', description: '날짜 YYYY-MM-DD (없으면 오늘)' },
        lead_id: { type: 'string', description: '리드 UUID (search_leads 결과의 id 필드). projectId 컨텍스트 없을 때 필수.' },
        sale_id: { type: 'string', description: '계약 UUID. lead_id 대신 sale에 직접 기록할 때.' },
        location: { type: 'string', description: '장소 (선택, 회의록용)' },
        participants: { type: 'array', items: { type: 'string' }, description: '참석자 이름 배열 (선택, 회의록용)' },
        outcome: { type: 'string', description: '결정/결과 (선택, 회의록용)' },
      },
      required: ['content'],
    },
  },
  {
    name: 'update_project_status',
    description: '현재 열린 프로젝트/리드의 상태를 변경합니다. 프로젝트 페이지에서만 동작.',
    input_schema: {
      type: 'object' as const,
      properties: {
        status: { type: 'string', description: '리드 상태: 유입/회신대기/견적발송/조율중/진행중/완료/취소 | 프로젝트 상태: 기획중/진행중/완료/보류' },
      },
      required: ['status'],
    },
  },
  {
    name: 'create_project_task',
    description: '현재 프로젝트에 할 일 추가. 시스템이 자동으로 첫 번째 계약에 묶고 같은 제목 진행 중 할일이 있으면 중복 경고를 반환함. 사용자가 "그래도 추가" 의사 명확히 하면 force=true로 재호출.',
    input_schema: {
      type: 'object' as const,
      properties: {
        title: { type: 'string', description: '할 일 제목 (필수)' },
        priority: { type: 'string', description: '긴급 | 높음 | 보통 | 낮음 (기본 보통)' },
        due_date: { type: 'string', description: '마감일 YYYY-MM-DD' },
        assignee_name: { type: 'string', description: '담당자 이름. 본인이면 "나"' },
        description: { type: 'string', description: '상세 설명/메모' },
        force: { type: 'boolean', description: '중복 경고 무시하고 강제 추가' },
      },
      required: ['title'],
    },
  },
  {
    name: 'complete_task',
    description: '현재 프로젝트의 할 일을 완료 상태로 변경합니다. 제목 일부로 검색해서 찾음. 여러 건 매칭 시 task_id로 재호출 필요.',
    input_schema: {
      type: 'object' as const,
      properties: {
        task_id: { type: 'string', description: '할 일 ID (UUID). title 검색 결과가 여러 개일 때 명시.' },
        title: { type: 'string', description: '제목 검색어 (task_id 없을 때 필수)' },
      },
    },
  },
  {
    name: 'update_task',
    description: '현재 프로젝트의 기존 할 일을 수정합니다. 담당자/마감일/우선순위/상태/제목/설명 모두 변경 가능. 사용자가 "X 할일 마감 바꿔/담당자 바꿔/제목 바꿔" 등이라고 하면 즉시 호출. task_id 또는 title 부분 매칭으로 식별.',
    input_schema: {
      type: 'object' as const,
      properties: {
        task_id: { type: 'string', description: '할 일 ID (UUID). title 검색 결과가 여러 개일 때 명시.' },
        title: { type: 'string', description: '제목 검색어 (task_id 없을 때 필수)' },
        new_title: { type: 'string', description: '새 제목 (변경 시)' },
        priority: { type: 'string', description: '긴급 | 높음 | 보통 | 낮음' },
        due_date: { type: 'string', description: '마감일 YYYY-MM-DD (없애려면 빈 문자열)' },
        status: { type: 'string', description: '할 일 | 진행중 | 완료 | 보류' },
        assignee_name: { type: 'string', description: '담당자 이름. "나"=본인, ""=미지정.' },
        description: { type: 'string', description: '상세 설명' },
      },
    },
  },
  {
    name: 'delete_task',
    description: '현재 프로젝트의 할 일을 삭제합니다. 사용자에게 "정말 삭제할까?" 한 번 확인받은 뒤 호출. 영구 삭제. "지원되지 않아요" 같은 거짓 거부 답변 절대 금지 — 이 도구로 실제 삭제 가능.',
    input_schema: {
      type: 'object' as const,
      properties: {
        task_id: { type: 'string', description: '할 일 ID (UUID)' },
        title: { type: 'string', description: '제목 검색어 (task_id 없을 때 필수)' },
      },
    },
  },
  {
    name: 'regenerate_overview',
    description: '현재 프로젝트의 자동 개요(overview_summary)를 최신 데이터로 재생성합니다. 계약/할일/소통 변동이 있어 개요가 오래되면 사용.',
    input_schema: {
      type: 'object' as const,
      properties: {},
    },
  },
  {
    name: 'create_quote',
    description: `현재 프로젝트·계약·리드 컨텍스트에서 견적서를 자동 생성합니다. 사용자가 자연어로 견적 작성 요청 시(예: "견적 뽑아줘", "이 내용으로 견적서 만들어줘") 호출. 빵빵이가 매뉴얼(7 Claude협업/01_SOS·00_공통)·소통내역·기존 데이터를 종합 분석하여 항목·금액·사업자 결정 후 호출. 호출 전 *항목 list와 사업자(공공이코/지지/드림 중 어느 거)*를 사용자에게 짧게 확인받는 게 안전. 호출 시 quote_number와 Dropbox 저장 경로 반환됨. *최종 견적서 HTML 자동 생성·Dropbox /0 행정/견적/ 자동 저장*.`,
    input_schema: {
      type: 'object' as const,
      properties: {
        sale_id: { type: 'string', description: '계약 UUID — 컨텍스트가 sale이면 사용' },
        project_id: { type: 'string', description: '프로젝트 UUID — 컨텍스트가 project이면 사용' },
        lead_id: { type: 'string', description: '리드 UUID — 컨텍스트가 lead이면 사용' },
        entity_short_name: { type: 'string', enum: ['공공이코', '지지', '드림'], description: '발행 사업자. 메인은 "공공이코"(공공이코퍼레이션). 분할·여성기업한도용은 "지지"(지지스튜디오). 별도법인은 "드림"(드림비앤비). 상황에 맞게 결정.' },
        project_name: { type: 'string', description: '견적서 본문 건명 (예: "26-04 OO 행사 기획·운영")' },
        client_org: { type: 'string', description: '거래처명 — 비우면 sale/project에서 자동 채움' },
        client_dept: { type: 'string', description: '발주 부서 (수의계약 한도용)' },
        client_manager: { type: 'string', description: '담당자 이름' },
        items: {
          type: 'array',
          description: '견적 항목 list. 매뉴얼·소통내역에서 추출. 최소 1개 이상.',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string', description: '품명' },
              description: { type: 'string', description: '세부 내용' },
              qty: { type: 'number', description: '수량' },
              unit_price: { type: 'number', description: '단가 (부가세 포함 디폴트. vat_included=false면 공급가)' },
              category: { type: 'string', description: '항목 그룹/시나리오 (예: "기본", "1일 2회", "축제연계")' },
            },
            required: ['name', 'qty', 'unit_price'],
          },
        },
        notes: { type: 'string', description: '안내사항 (예: "유효기간 14일", "VAT 포함")' },
        vat_included: { type: 'boolean', description: '입력 단가가 부가세 포함인지. 디폴트 true.' },
      },
      required: ['entity_short_name', 'project_name', 'items'],
    },
  },
  {
    name: 'update_quote',
    description: `발행된 견적의 항목·금액·메모·상태를 수정합니다. "이 견적 부가세 별도로 다시 뽑아줘", "사회자 빼고 다시", "할인 추가" 같은 자연어 요청 시 호출. items 인자는 *전체 새 항목 list*. 기존 항목 수정만 원해도 *전체 list 다시 보냄*. HTML 자동 재렌더링·Dropbox 재저장.`,
    input_schema: {
      type: 'object' as const,
      properties: {
        quote_id: { type: 'string', description: '수정할 견적 UUID. 모르면 list_quotes 또는 사용자에게 quote_number 받기' },
        project_name: { type: 'string' },
        client_org: { type: 'string' },
        client_dept: { type: 'string' },
        client_manager: { type: 'string' },
        items: {
          type: 'array',
          description: '*전체* 새 항목 list. 부분 수정도 list 그대로 다시 보냄. 미지정 시 기존 항목 유지.',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              description: { type: 'string' },
              qty: { type: 'number' },
              unit_price: { type: 'number' },
              category: { type: 'string' },
            },
            required: ['name', 'qty', 'unit_price'],
          },
        },
        notes: { type: 'string' },
        vat_included: { type: 'boolean' },
        status: { type: 'string', enum: ['draft', 'sent', 'accepted', 'rejected', 'cancelled'], description: '발송됨/수주/실주 등 상태 변경' },
      },
      required: ['quote_id'],
    },
  },
  {
    name: 'list_quotes',
    description: '현재 컨텍스트(project/sale/lead)의 발행 견적 목록 조회. 수정 전 quote_id 찾기용.',
    input_schema: {
      type: 'object' as const,
      properties: {
        sale_id: { type: 'string' },
        project_id: { type: 'string' },
        lead_id: { type: 'string' },
      },
    },
  },
  {
    name: 'update_short_summary',
    description: '현재 프로젝트의 짧은 요약(short_summary, 한눈에 박스)을 직접 작성한 평문으로 덮어쓰기. 자동 생성은 regenerate_short_summary.',
    input_schema: {
      type: 'object' as const,
      properties: {
        content: { type: 'string', description: '저장할 평문 2-4줄. 빈 문자열이면 삭제.' },
      },
      required: ['content'],
    },
  },
  {
    name: 'regenerate_short_summary',
    description: '현재 프로젝트의 짧은 요약을 자동 재생성 (기존 자세한 개요·계약·고객 정보를 보고 2-4줄 평문 압축). 사용자가 "한눈에 보이게 정리" 등 요청 시 호출.',
    input_schema: {
      type: 'object' as const,
      properties: {},
    },
  },
  {
    name: 'update_pending_discussion',
    description: '현재 프로젝트의 협의/미결 사항을 분류별(클라이언트/내부/외주사)로 덮어씁니다. 추가하고 싶으면 기존 내용을 포함해서 합친 markdown을 content로. target은 어느 분류 박스인지: client(클라이언트와 협의), internal(내부 결정), vendor(외주사·협력사 협의). 자동 분석은 regenerate_pending_discussion.',
    input_schema: {
      type: 'object' as const,
      properties: {
        target: { type: 'string', enum: ['client', 'internal', 'vendor'], description: '분류 — client(클라이언트 협의) / internal(내부 협의) / vendor(외주사 협의)' },
        content: { type: 'string', description: '새로 저장할 markdown 전문. 빈 문자열이면 삭제.' },
      },
      required: ['target', 'content'],
    },
  },
  {
    name: 'regenerate_pending_discussion',
    description: '현재 프로젝트의 협의 사항을 최근 데이터로 분류별 재분석 후 자동 갱신. target 분류 한 개씩 호출.',
    input_schema: {
      type: 'object' as const,
      properties: {
        target: { type: 'string', enum: ['client', 'internal', 'vendor'], description: '분류 — client / internal / vendor' },
      },
      required: ['target'],
    },
  },
  {
    name: 'update_overview',
    description: '현재 프로젝트의 자동 개요(overview_summary)를 직접 markdown으로 덮어씁니다. 사용자가 직접 작성한 개요를 저장하거나 기존 + 추가분을 합쳐서 보낼 때 사용. 자동 분석 원하면 regenerate_overview.',
    input_schema: {
      type: 'object' as const,
      properties: {
        content: { type: 'string', description: '새로 저장할 markdown 전문. 빈 문자열이면 삭제.' },
      },
      required: ['content'],
    },
  },
  {
    name: 'update_lead_summary',
    description: '리드 요약(summary_cache)을 직접 markdown/plain text로 덮어씁니다. 사용자가 직접 작성한 정리 내용을 저장할 때 사용. 자동 분석 원하면 regenerate_lead_summary.',
    input_schema: {
      type: 'object' as const,
      properties: {
        lead_id: { type: 'string', description: '리드 UUID 또는 lead_id (예: LEAD20260413-0001)' },
        content: { type: 'string', description: '저장할 markdown 또는 plain text' },
      },
      required: ['lead_id', 'content'],
    },
  },
  {
    name: 'regenerate_lead_summary',
    description: '리드의 요약(summary_cache)을 최초 문의 + 소통 내역 기반으로 재생성합니다. 사용자가 "리드 요약 다시 뽑아줘", "정리 갱신" 등이라고 하면 호출.',
    input_schema: {
      type: 'object' as const,
      properties: {
        lead_id: { type: 'string', description: '리드 UUID 또는 lead_id (예: LEAD20260413-0001)' },
      },
      required: ['lead_id'],
    },
  },
  {
    name: 'link_sale_project',
    description: '계약(sale)과 프로젝트(project)를 N:M 관계로 연결합니다. 한 계약을 여러 프로젝트에, 한 프로젝트도 여러 계약에 묶을 수 있습니다. revenue_share_pct는 영업이익 분배 비율 (1:N 분배 시 균등 50/30/20 등). 1:1 또는 N:1 케이스에서는 100을 그대로 사용.',
    input_schema: {
      type: 'object' as const,
      properties: {
        sale_id: { type: 'string', description: '계약 UUID' },
        project_id: { type: 'string', description: '프로젝트 UUID' },
        role: { type: 'string', description: '주계약 | 부계약 | 예산분할 | 추가 (기본: 주계약)' },
        revenue_share_pct: { type: 'number', description: '매출 분배 % (0~100, 기본: 100)' },
        cost_share_pct: { type: 'number', description: '비용 분배 % (0~100, 기본: 100)' },
        note: { type: 'string', description: '메모 (선택)' },
      },
      required: ['sale_id', 'project_id'],
    },
  },
  {
    name: 'unlink_sale_project',
    description: '계약-프로젝트 N:M 연결을 해제합니다. 매핑 자체 제거 (계약·프로젝트 데이터는 유지). 사용자 컨펌 권장.',
    input_schema: {
      type: 'object' as const,
      properties: {
        sale_id: { type: 'string', description: '계약 UUID' },
        project_id: { type: 'string', description: '프로젝트 UUID' },
      },
      required: ['sale_id', 'project_id'],
    },
  },
  {
    name: 'set_revenue_share',
    description: '계약-프로젝트 매핑의 분배 비율을 변경합니다. 1:N(1 계약 → N 프로젝트) 케이스에서 영업이익 분배 비율 조정. 합이 100% 안 맞아도 경고만, 저장은 됨.',
    input_schema: {
      type: 'object' as const,
      properties: {
        sale_id: { type: 'string', description: '계약 UUID' },
        project_id: { type: 'string', description: '프로젝트 UUID' },
        revenue_share_pct: { type: 'number', description: '매출 분배 % (0~100)' },
        cost_share_pct: { type: 'number', description: '비용 분배 % (0~100, 생략 시 revenue_share_pct와 동일)' },
      },
      required: ['sale_id', 'project_id', 'revenue_share_pct'],
    },
  },
  {
    name: 'compute_project_profit',
    description: '프로젝트 영업이익을 N:M 분배 비율 기반으로 자동 계산합니다. 매출(분배 후) - 비용(분배 후) = 이익. 분배 명세도 같이 반환.',
    input_schema: {
      type: 'object' as const,
      properties: {
        project_id: { type: 'string', description: '프로젝트 UUID' },
      },
      required: ['project_id'],
    },
  },
  {
    name: 'search_workers',
    description: '외부 인력(강사·아티스트·스태프·기술) 풀 검색. **모든 인자가 선택**. 인자 없이 호출하면 *전체 목록* (최대 30건, rating 내림차순) 반환. 이름·전문영역·재사용상태 필터 가능. preferred 우선 정렬. archive_status=active만. 0건이면 외부 인력 DB가 비어있다는 뜻 — add_external_worker로 등록 권유.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: { type: 'string', description: '이름 부분 검색 (선택, 생략 시 전체)' },
        type: { type: 'string', description: '강사 | 아티스트 | 스태프 | 기술 | 복합 (선택)' },
        specialty: { type: 'string', description: '전문 영역 부분 일치 (예: "공연", "교육")' },
        only_preferred: { type: 'boolean', description: 'true면 reuse_status=preferred만' },
      },
    },
  },
  {
    name: 'add_external_worker',
    description: '외부 인력 신규 등록. 사용자에게 한 번 확인 후 호출. 주민번호·계좌는 추후 보안 L3 마이그 후 암호화 예정 (지금은 평문 저장 — §4.2.1).',
    input_schema: {
      type: 'object' as const,
      properties: {
        name: { type: 'string', description: '이름 (필수)' },
        type: { type: 'string', description: '강사 | 아티스트 | 스태프 | 기술 | 복합 (필수)' },
        phone: { type: 'string' },
        email: { type: 'string' },
        bank_name: { type: 'string', description: '은행명' },
        bank_account: { type: 'string', description: '계좌번호' },
        ssn: { type: 'string', description: '주민번호 (세무용)' },
        default_rate_type: { type: 'string', description: 'per_hour | per_session | per_project' },
        default_rate: { type: 'number', description: '기본 단가 (원)' },
        specialties: { type: 'array', items: { type: 'string' }, description: '전문 영역 배열 (예: ["공연", "교육"])' },
        notes: { type: 'string' },
      },
      required: ['name', 'type'],
    },
  },
  {
    name: 'record_engagement',
    description: '외부 인력의 프로젝트 참여 기록. amount는 자동 계산 (rate_type + rate + hours).',
    input_schema: {
      type: 'object' as const,
      properties: {
        worker_id: { type: 'string', description: '외부 인력 UUID' },
        project_id: { type: 'string', description: '프로젝트 UUID' },
        role: { type: 'string', description: '참여 역할 (예: 메인 강사·MC·음향)' },
        date_start: { type: 'string', description: '시작일 YYYY-MM-DD' },
        date_end: { type: 'string', description: '종료일 YYYY-MM-DD (선택)' },
        hours: { type: 'number', description: '시간 (per_hour일 때)' },
        rate_type: { type: 'string', description: 'per_hour | per_session | per_project (생략 시 worker.default_rate_type)' },
        rate: { type: 'number', description: '단가 (생략 시 worker.default_rate)' },
        note: { type: 'string' },
      },
      required: ['worker_id', 'project_id'],
    },
  },
  {
    name: 'compute_worker_monthly_payment',
    description: '특정 외부 인력의 특정 월 정산 묶음 계산. engagement 합산. status pending 미리보기 (worker_payments INSERT는 별도 컨펌).',
    input_schema: {
      type: 'object' as const,
      properties: {
        worker_id: { type: 'string', description: '외부 인력 UUID' },
        year_month: { type: 'string', description: 'YYYY-MM' },
      },
      required: ['worker_id', 'year_month'],
    },
  },
  {
    name: 'create_monthly_payment',
    description: '특정 외부 인력의 특정 월 정산 묶음을 worker_payments에 INSERT. status=pending. 사용자 컨펌 필수 (재무 변경). 이미 pending 있으면 거부 — 먼저 처리 후 재생성.',
    input_schema: {
      type: 'object' as const,
      properties: {
        worker_id: { type: 'string', description: '외부 인력 UUID' },
        year_month: { type: 'string', description: 'YYYY-MM' },
        scheduled_date: { type: 'string', description: '지급 예정일 YYYY-MM-DD (선택)' },
      },
      required: ['worker_id', 'year_month'],
    },
  },
  {
    name: 'generate_tax_handoff',
    description: '세무사 핸드오프 .xlsx 자동 생성. 특정 월의 모든 pending worker_payments → 이름·주민번호·계좌번호·금액·구분·비고 .xlsx. Q27 사용자 패턴 (매월 말·익월 초 카톡 전송용). xlsx_base64 반환 — 사용자가 다운로드 또는 카톡 첨부.',
    input_schema: {
      type: 'object' as const,
      properties: {
        year_month: { type: 'string', description: 'YYYY-MM (이 월에 생성된 pending payments)' },
        mark_sent: { type: 'boolean', description: 'true면 tax_form_sent_at 갱신 (발송 후 호출)' },
      },
      required: ['year_month'],
    },
  },
  {
    name: 'mark_payment_paid',
    description: 'worker_payment 지급 완료 처리. status=paid + paid_date 기록. worker.total_paid 누적 자동.',
    input_schema: {
      type: 'object' as const,
      properties: {
        payment_id: { type: 'string', description: 'worker_payment UUID' },
        paid_date: { type: 'string', description: 'YYYY-MM-DD' },
      },
      required: ['payment_id', 'paid_date'],
    },
  },
  {
    name: 'analyze_cost_folder',
    description: '계약(sale)의 Dropbox 0행정/원가 폴더 PDF를 자동 분석. 견적서·세금계산서·거래명세서·이체확인증·계약서를 OCR + 통합해서 sale_costs 후보 목록 반환. 미리보기만 (DB 변경 X). 결과 좋으면 사용자가 [📎 원가 폴더 분석] 모달에서 [추가] 클릭하거나 빵빵이에게 import 요청. compute_project_profit에서 cost가 0이거나 부족하면 자동 권장.',
    input_schema: {
      type: 'object' as const,
      properties: {
        sale_id: { type: 'string', description: '계약 UUID' },
      },
      required: ['sale_id'],
    },
  },
  {
    name: 'create_calendar_event',
    description: '구글 캘린더에 일정을 등록합니다. 행사, 배송, 미팅, 마감일 등.',
    input_schema: {
      type: 'object' as const,
      properties: {
        calendar_key: { type: 'string', description: 'main(개인/전체) | sos(공연) | rental(렌탈 배송/수거) | artqium(아트키움)' },
        title: { type: 'string', description: '일정 제목' },
        date: { type: 'string', description: '시작일 YYYY-MM-DD' },
        end_date: { type: 'string', description: '종료일 YYYY-MM-DD (종일 이벤트이고 하루짜리면 생략)' },
        start_time: { type: 'string', description: '시작 시간 HH:MM (종일 이벤트면 생략)' },
        end_time: { type: 'string', description: '종료 시간 HH:MM (종일 이벤트면 생략)' },
        description: { type: 'string', description: '일정 설명 (선택)' },
        is_all_day: { type: 'boolean', description: '종일 이벤트 여부 (기본 true)' },
      },
      required: ['calendar_key', 'title', 'date'],
    },
  },
]
