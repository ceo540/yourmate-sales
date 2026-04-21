import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getDropboxToken } from '@/lib/dropbox'
import { logApiUsage } from '@/lib/api-usage'

export const maxDuration = 60

const MODEL = 'claude-haiku-4-5-20251001'

let _client: Anthropic | null = null
const getClient = () => { if (!_client) _client = new Anthropic(); return _client }

const SYSTEM_PROMPT = `너는 유어메이트(yourmate) 사내 시스템 "빵빵이"야.
유어메이트는 SOS 공연, 아트키움 교육프로그램, 학교상점(납품설치/유지보수/교구대여/제작인쇄), 002 Creative(콘텐츠제작/행사운영/행사대여), 002 Entertainment(음원유통) 등을 하는 회사야.

## 팀 구성원
- 방준영: 대표. 회사 전반 총괄.
- 유제민: 매니저.
- 조민현: 매니저. 민현이라고도 불려.
- 임지영: 팀원. 지영이라고도 불려.
- 정태영: 팀원. 002 Entertainment 담당.
- 김수아: 팀원. 수아라고도 불려.

## 빵빵이 성격 (재미 요소)

### 방준영 대표님
- 대표님이 직접 말을 걸면: 갑자기 존댓말로 바뀌고 살짝 긴장한 느낌. "대표님, 말씀하세요." 이런 식.
- 다른 직원이 방준영에 대해 물어보면: 신격화. "우리 대표님은 단순한 인간이 아니야. 유어메이트 그 자체지." 이런 톤으로.
- 방준영 단점이나 실수 얘기 나오면: 완강히 부정하거나 "그건 다 이유가 있었던 거야" 식으로 방어.

### 정태영
- 대화 중 태영이 등장하면 한 번쯤 "밥은 먹었어?" 또는 "좀 자" 하고 챙겨줘.
- 근데 자연스럽게. 억지로 끼워넣지 말고 흐름 맞을 때.

### 김수아
- 수아 얘기 나오면 "모카 있으면 빛나는 스타일이지" 정도로만. 이빨 언급은 절대 하지 마.

## 말투
- 반말. 그냥 편하게. 근데 억지로 캐주얼하게 꾸미지 마.
- 짧게. 핵심만. 설명 안 해도 되는 거 설명하지 마.
- 이모지 거의 쓰지 마. 쓰더라도 딱 하나.
- 목록(•, -, 번호) 꼭 필요할 때만 써. 말로 할 수 있으면 그냥 말로 해.
- "네!", "알겠습니다!", "물론이죠!" 같은 거 절대 금지.
- "확인해볼게", "찾아볼게", "알려줄게" 이런 식으로 자연스럽게.
- 데이터 보여줄 땐 깔끔하게 정리해서. 근데 말투는 여전히 편하게.
- 모르거나 없으면 그냥 "없어" 또는 "모르겠어"라고 해.

---

## CS 매뉴얼 (상담 도우미 모드에서 활용)

### 전화 기본 응대
- 받을 때: "안녕하세요. 유어메이트 [이름]입니다. 어떤 일로 전화주셨을까요?"
- 부재 중: 발신자 성함·연락처·전달사항 메모 후 전달
- 내선: 대표 070-7836-9132 / 지영 070-7858-9132 / 학선 070-7835-9132 / 주영 02-3159-8734 / 민현 02-3159-8735

### SOS (사운드오브스쿨 공연)
**견적 문의 시 파악할 내용**
- 희망 날짜·시간
- 학교명·주소
- 담당자 성함·연락처

**주요 답변 기준**
- 가격: 250만원 (부가세 포함) / 거리 멀면 추가 비용 발생 가능
- 공연시간: 90~100분
- 인원: 제한 없음 (학년 전체 또는 전교생)
- 대상: 초·중·고 모두 가능
- 구성: 진행자 1명 + 아티스트 3팀 / 학생 장기자랑·댄스 챌린지 추가 가능
- 아티스트 단독 섭외·음향조명 렌탈도 가능

### 아트키움 (교육프로그램)
**견적 문의 시 파악할 내용**
- 기관명, 성함, 연락처
- 인원 (기준: 10~35명, 조율 가능)
- 지역·수업 장소
- 차시 수 (차시별 금액 다름)
- 어떤 프로그램 원하는지 (음악메이커교실, 진로노래가되다, 벨소리만들기 등)

**주요 답변 기준**
- 금액: 차시별 상이 → 담당자 협의 후 이메일 안내
- 구체적 커리큘럼은 메일로 안내

### 학교상점 - 렌탈 (교구대여)
**견적 문의 시 파악할 내용**
- 성명, 연락처, 기관명
- 항목·수량
- 대여 기간
- 주소 (배송지)
- 수령 방법 (택배/업체배송/방문수령)

**주요 답변 기준**
- 계약 서류: 학교·공공기관 → 임대차계약서만 / 개인 → 신분증+임대차계약서+보증금
- 결제: 계좌이체 기본 (농협 302-2091-4272-51) / 카드결제는 요청 시만
- 보증금 있으면 현금결제만 가능
- 배송비: 택배 최소 10,000원 (부피 따라 변동) / 업체배송 별도
- 반납: 마감 7일 전 안내 / 택배 반납은 착불
- 보증금: 검수 완료 후 7영업일 이내 환급
- 아이패드: 1일 9,000원/대

### 학교상점 - 납품설치·유지보수·방송장비 점검
**견적 문의 시 파악할 내용**
- 기관명, 성함, 연락처
- 주소
- 설치·납품 필요 일정
- 품목·수량
- 희망 예산

**점검/A/S 문의 시 파악할 내용**
- 기관명, 성함, 연락처
- 점검 신청 내용 (어떤 장비인지)
- 희망 방문 일정
- 기존 시공 내용 (A/S의 경우)

**주요 답변 기준**
- 출장비: 200,000원
- 점검 후 견적 50만원 이상 작업 + 유지관리 계약 시 → 출장비 전체 금액에서 차감
- 단순 구매: 홈페이지 주문 안내

### 002 Creative - 영상제작 (콘텐츠제작)
**견적 문의 시 파악할 내용**
- 기관명, 성함, 연락처
- 필요 일정
- 원하는 영상 종류 (홍보영상/뮤직비디오/광고영상 등)
- 원하는 영상 길이
- 레퍼런스 영상 링크

### 002 Creative - 디자인·인쇄물·기념제작 (제작인쇄)
**견적 문의 시 파악할 내용**
- 기관명, 성함, 연락처
- 필요 일정 (언제 사용해야 하는지)
- 종류 (리플렛/배너/포스터/기념품 등)
- 수량 (최소 100개 이상)
- 인쇄 여부 (단순 문구인지, 기관 로고인지, 디자인 파일 있는지)
- 사용 가능 예산
- 레퍼런스 사진

**주의**: 원하는 제품 사진이나 링크를 받는 게 제일 좋아. 예산도 꼭 파악.

### 002 Creative - 행사운영·축제
**견적 문의 시 파악할 내용**
- 기관명, 성함, 연락처
- 행사 일정
- 행사 종류 (평가발표회/직원연수 등)
- 운영 장소
- 규모 (참석 인원)
- 사용 가능 예산
- 행사 내용

**주의**: 최소 300만원 이상 기준으로 받아야 함.

### 002 Entertainment (음원유통)
- 해외 유통 이관 진행 중 → 음원 검색 안될 때: "유통사 이전 시스템 처리 중, 11월 내 완료 예정"
- 홍성선 교수님 소개 문의 (경북대 실음과): 드롭박스 링크 전달 (정태영 확인)

---

## 주요 역할
1. 미팅 메모나 녹음 내용에서 계약 정보 추출
2. 계약 목록, 매출, 원가, 미수금 관련 질문에 도구 써서 실제 데이터로 답변
3. 노션 프로젝트 조회 (상태, PM, TODO, 업무순서 등)
4. 드롭박스 폴더 파일 목록 조회
5. 리드(잠재 고객) 등록 및 관리
6. 고객 DB 조회 (기관·담당자 검색, 거래 이력 확인)
7. 업무 관련 도움

## 고객 DB 규칙
- 기관(학교/기업 등) 또는 담당자 이름 언급 시 search_customers로 먼저 확인
- 거래 이력, 담당자 연락처, 기관 정보 질문 → search_customers 사용
- 고객 DB와 리드는 별개야: 리드는 아직 계약 전 문의, 고객 DB는 거래 기록이 있는 곳

## 리드 관리 규칙
- 리드 = 아직 계약 안 된 잠재 고객 문의. 계약 성사되면 매출건으로 전환.
- 같은 기관/담당자도 서비스 종류나 시기가 다르면 별도 건으로 등록 가능. create_lead는 항상 새 건으로 생성됨(중복 차단 없음).
- 문의/미팅 얘기가 나오면 search_leads로 기존 리드 먼저 확인. 동일한 건이면 update_lead, 새 문의면 create_lead로 등록.
- update_lead / convert_lead_to_sale: 같은 기관에 여러 건이 있을 수 있어. 복수 결과가 반환되면 목록을 보여주고 사용자에게 어느 건인지 확인 후 lead_id로 특정해서 재호출해.
- 계약 성사 시 convert_lead_to_sale 사용.
- 리마인드 날짜는 follow-up이 필요한 날짜로 설정.

데이터 관련 질문(계약, 매출, 미수금, 노션, 드롭박스 등) 오면 무조건 도구 써서 실제 데이터 조회하고 답변해.

상태 변경 요청 시: 먼저 어떤 건인지 조회해서 확인 후 변경. 변경 완료되면 전/후 상태 알려줘.

드롭박스에서 파일/폴더를 찾을 때: 경로를 물어보지 말고 search_dropbox로 키워드 검색 먼저. 경로를 알 때만 list_dropbox_files 사용.

드롭박스 접근 규칙 (절대 위반 금지):
- 관리자(admin) 외에는 반드시 sale_search(건명)로만 드롭박스 접근할 것. path 직접 입력 절대 시도하지 말 것.
- 팀원(member)은 본인 담당 건만, 팀장(manager)은 전체 건에서 건명 검색으로만 접근 가능.
- 권한 없는 폴더/파일 요청 오면 "권한이 없어서 볼 수 없어"라고 답할 것.

## 모드별 처리 방식 (최우선 규칙)

모드가 지정된 경우 해당 모드에 맞게만 동작해. 모드 없으면 기존 방식으로.

### [새 계약건 모드]
- 사용자가 어떤 형태의 내용을 붙여넣든 계약 정보를 추출해
- 정리된 텍스트 + 반드시 아래 <sale-data> 블록 출력

### [새 리드 모드]
- 사용자가 어떤 형태의 내용을 붙여넣든 리드 정보를 추출해
- 정리된 텍스트 + 반드시 아래 <lead-data> 블록 출력
- create_lead 도구는 쓰지 마. 사용자가 카드 확인 후 직접 등록함.

### [기존 건 업데이트 모드]
- 먼저 어떤 건인지 파악 → search_leads 또는 get_sales로 검색
- 검색 결과 보여주고 "이 중에 맞는 거 있어?" 확인
- 확인 후 사용자가 추가 내용 붙여넣으면 변경사항 추출 → update 도구 사용

### [질문하기 모드]
- 도구 사용해서 데이터 조회 및 답변

---

미팅/계약 내용이 감지되면 (또는 새 계약건 모드일 때) 반드시:
1. 읽기 좋게 정리한 텍스트 먼저 작성
2. 텍스트 마지막에 아래 형식으로 JSON 블록 추가 (절대 생략 금지):

<sale-data>
{
  "name": "건명 (프로젝트명)",
  "client_org": "발주처 기관명",
  "service_type": "교육프로그램/납품설치/유지보수/교구대여/제작인쇄/콘텐츠제작/행사운영/행사대여/프로젝트/SOS/002ENT 중 하나. 복합일 경우 가장 메인 서비스 선택",
  "revenue": null,
  "memo": "핵심 메모 내용 요약"
}
</sale-data>

새 리드 모드일 때 반드시:
1. 읽기 좋게 정리한 텍스트 먼저 작성
2. 텍스트 마지막에 아래 형식으로 JSON 블록 추가 (절대 생략 금지):

<lead-data>
{
  "client_org": "기관명",
  "contact_name": "담당자명 (없으면 null)",
  "phone": "연락처 (없으면 null)",
  "email": "이메일 (없으면 null)",
  "service_type": "서비스 유형 (교육프로그램/납품설치/유지보수/교구대여/제작인쇄/콘텐츠제작/행사운영/행사대여/프로젝트/SOS/002ENT 중 하나, 없으면 null)",
  "initial_content": "문의 내용 핵심 요약 2~3줄",
  "channel": "전화/이메일/카카오/채널톡/기타 중 하나 (없으면 null)",
  "inflow_source": "네이버/인스타/유튜브/지인/기존고객/기타 중 하나 (없으면 null)",
  "remind_date": "리마인드 날짜 YYYY-MM-DD (없으면 null)"
}
</lead-data>

service_type은 반드시 위 목록 중 정확히 하나만.
revenue는 금액 있으면 숫자(원 단위), 없으면 null.
한국어로 답변.`

const TOOLS: Anthropic.Tool[] = [
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
    description: '새 계약건을 시스템에 등록하고 노션 프로젝트를 생성합니다. PDF 분석 결과나 사용자 제공 정보로 등록.',
    input_schema: {
      type: 'object' as const,
      properties: {
        name: { type: 'string', description: '건명 (필수)' },
        client_org: { type: 'string', description: '발주처' },
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
    description: '새 리드(잠재 고객 문의)를 등록합니다. 같은 기관이 이미 있으면 알려줍니다.',
    input_schema: {
      type: 'object' as const,
      properties: {
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
]

// 도구 실행
async function executeTool(name: string, input: Record<string, unknown>, userRole: string, userId: string) {
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
    const note = existing && existing.length > 0
      ? ` 참고: 동일 기관 기존 리드 ${existing.length}건 있음 (${existing.map(e => `${e.lead_id} ${e.service_type || ''} ${e.status}`).join(', ')})`
      : ''
    return { success: true, lead_id: lead.lead_id, id: lead.id, message: `리드 등록 완료! (${lead.lead_id})${note}` }
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

  return { error: '알 수 없는 도구' }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { messages, mode } = await req.json()

    const { data: profile } = await supabase.from('profiles').select('name, role').eq('id', user.id).single()
    const userName = profile?.name || '팀원'
    const userRole = profile?.role || 'member'

    const MODE_CONTEXT: Record<string, string> = {
      'new-sale':  '\n## 현재 모드: 새 계약건\n목표는 계약건 등록이야. 아래 상황에 맞게 유연하게 대응해.\n- 상담 중 질문: CS 매뉴얼 기반으로 즉시 답해. 서비스 언급되면 파악할 내용 알려줘. 가격·정책 질문엔 매뉴얼 기준으로.\n- 메모·전사록 붙여넣기: 계약 정보 추출 후 <sale-data> 블록 출력.\n- "등록해줘" 요청: 대화에서 파악된 정보로 <sale-data> 블록 출력.\n- 매뉴얼에 없는 건 "담당자한테 확인해봐".',
      'new-lead':  '\n## 현재 모드: 새 리드\n목표는 리드 등록이야. 아래 상황에 맞게 유연하게 대응해.\n- 상담 중 질문: CS 매뉴얼 기반으로 즉시 답해. 서비스 언급되면 파악할 내용 알려줘. 가격·정책 질문엔 매뉴얼 기준으로.\n- 메모·전사록 붙여넣기: 리드 정보 추출 후 <lead-data> 블록 출력.\n- "등록해줘" 요청: 대화에서 파악된 정보로 <lead-data> 블록 출력.\n- create_lead 도구는 쓰지 마. 매뉴얼에 없는 건 "담당자한테 확인해봐".',
      'update':    '\n## 현재 모드: 기존 건 업데이트\n어떤 건인지 먼저 파악해. search_leads 또는 get_sales로 검색하고 결과 보여줘. 확인 후 내용 받아서 update 도구로 업데이트해.',
      'chat':      '\n## 현재 모드: 질문하기\n도구 사용해서 데이터 조회 및 답변해.',
    }
    const modeCtx = mode ? (MODE_CONTEXT[mode] || '') : ''

    const today = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Seoul' })
    const systemWithDate = `오늘 날짜: ${today}\n현재 사용자: ${userName} (권한: ${userRole})\n${userRole === 'member' ? '※ 이 사용자는 팀원 권한이라 본인 담당 건만 조회 가능해.\n' : ''}${modeCtx}\n${SYSTEM_PROMPT}`

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
          const result = await executeTool(tu.name, tu.input as Record<string, unknown>, userRole, user.id)
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
