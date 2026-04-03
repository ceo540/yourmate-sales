# 유어메이트 사내 업무 관리 시스템 — 사양서

> 작성일: 2026-04-03
> 스택: Next.js 14 (App Router) · TypeScript · Supabase (PostgreSQL + Auth) · Tailwind CSS · Vercel

---

## 목차

1. [인증 및 사용자 관리](#1-인증-및-사용자-관리)
2. [매출 현황 (Sales)](#2-매출-현황-sales)
3. [리드 관리 (Leads)](#3-리드-관리-leads)
4. [업무 관리 (Tasks)](#4-업무-관리-tasks)
5. [고객 DB](#5-고객-db)
6. [거래처 DB](#6-거래처-db)
7. [재무 관리](#7-재무-관리)
8. [AI 어시스턴트 (빵빵이)](#8-ai-어시스턴트-빵빵이)
9. [네비게이션 및 레이아웃](#9-네비게이션-및-레이아웃)
10. [DB 스키마](#10-db-스키마)

---

## 1. 인증 및 사용자 관리

**목적:** 팀원 계정 생성, 역할 기반 접근 제어, 페이지별 권한 설정

### 1-1. 인증
- Supabase Auth 기반 이메일/비밀번호 로그인
- 세션 만료 시 `/login` 자동 리디렉션
- 서버 컴포넌트에서 `createClient()` → `supabase.auth.getUser()` 로 유저 확인

### 1-2. 사용자 역할
| 역할 | 설명 |
|------|------|
| `admin` | 모든 기능 전체 접근, 팀원 관리 가능 |
| `manager` | admin과 동일한 데이터 접근, 팀원 관리 불가 |
| `member` | 권한 테이블(role_permissions)에 따라 페이지별 제한 |

### 1-3. 권한 시스템
- `role_permissions` 테이블: `(role, page_key) → access_level`
- `access_level` 4단계: `off` (접근 불가) / `read` (조회만) / `own` (본인 데이터만) / `full` (전체)
- `src/lib/permissions.ts` → `getAccessLevel(role, pageKey)` 함수로 서버에서 판단
- admin/manager는 테이블 조회 없이 항상 `full` 반환
- 권한 없는 페이지 접근 시 `/dashboard`로 리디렉션

### 1-4. 팀원 관리 페이지 (`/admin`)
- 팀원 목록 조회 (이름, 이메일, 역할, 사업부)
- 초대 발송: `/api/admin/invite` → Supabase Admin API로 가입 초대 메일 발송
- 역할 변경 (admin만 가능)
- 페이지별 권한 안내표: 모든 `pageKey` 항목의 접근 레벨 시각적 표시

**등록된 pageKey 목록:**
`dashboard` / `sales` / `sales_report` / `leads` / `tasks` / `receivables` / `payments` / `finance` / `payroll` / `fixed_costs` / `cashflow` / `customers` / `vendors` / `admin_panel`

---

## 2. 매출 현황 (Sales)

**목적:** 계약 건 등록·관리, 수익/비용 트래킹, 사업부별 현황 파악

### 2-1. 매출 목록 (`/sales`)
- 전체 매출 건 카드/테이블 형태 표시
- 필터: 사업부, 서비스 타입, 담당자, 결제 상태, 기간
- 검색: 거래처명, 매출명
- 권한: admin/manager = 전체 조회, member = 본인 담당 + 소속 사업부

### 2-2. 매출 상세 (`/sales/[id]`)
- 기본 정보: 매출명, 거래처, 서비스 타입, 사업부, 담당자, 금액, 결제 상태, 메모
- 비용 항목 (sale_costs): 항목명, 금액, 거래처, 지급 상태
- 업무 목록 (tasks): 해당 건에 연결된 업무 카드
- Dropbox 폴더 링크 자동 생성 (리드 전환 시)

### 2-3. 매출 건 생성
- 직접 등록: SalesClient 내 폼
- 리드 전환: `convertLeadToSale()` → lead 데이터 복사 + status = '완료' 처리
- 리드 전환 시 Dropbox 폴더 자동 생성 (`/api/dropbox` 연동)
- 리드에 `converted_sale_id` 업데이트

### 2-4. 매출 보고서 (`/sales/report`)
- 사업부별 / 서비스별 매출 집계
- 월별 추이 차트
- 미수금 연동 표시

### 2-5. 사업부 구조

| 사업부 코드 | 명칭 | 서비스 타입 |
|------------|------|------------|
| `sound_of_school` | Sound OF School | SOS |
| `002_entertainment` | 002 Entertainment | 002ENT, SOS |
| `artkiwoom` | 아트키움 | 교육프로그램 |
| `school_store` | 학교상점 | 납품설치, 유지보수, 교구대여, 제작인쇄 |
| `002_creative` | 002 Creative | 콘텐츠제작, 행사운영, 행사대여, 프로젝트 |
| `yourmate` | 유어메이트 | (공통) |

---

## 3. 리드 관리 (Leads)

**목적:** 잠재 고객 문의 수신부터 계약 전환까지 영업 파이프라인 관리

### 3-1. 리드 목록 (`/leads`)
- 테이블 형태: 리드ID, 유입일, 서비스, 기관명, 담당자, 연락처, 상태, 담당팀원
- 필터: 상태, 서비스 타입, 담당자, 유입 채널
- 검색: 기관명, 담당자명
- 권한: admin/manager = 전체, member = 본인 담당만

### 3-2. 리드 ID 체계
- 형식: `LEAD{YYYYMMDD}-{NNNN}` (예: `LEAD20260403-0001`)
- 일별 자동 채번 (당일 최대 번호 +1)

### 3-3. 리드 필드

| 필드 | 설명 |
|------|------|
| `inflow_date` | 유입일 |
| `remind_date` | 리마인드 예정일 |
| `service_type` | 서비스 타입 |
| `contact_name` | 담당자명 |
| `client_org` | 기관명 |
| `phone` | 휴대전화 |
| `office_phone` | 사무실 전화 |
| `email` | 이메일 |
| `initial_content` | 초기 문의 내용 |
| `assignee_id` | 담당 팀원 (profiles FK) |
| `status` | 신규/회신대기/견적발송/진행중/완료/취소 |
| `channel` | 유입 채널 (전화/이메일/카카오/채널톡/기타) |
| `inflow_source` | 유입 경로 (네이버/인스타/유튜브/지인/기존고객/기타) |
| `notes` | 메모 |
| `contact_1/2/3` | 추가 연락처 |
| `converted_sale_id` | 전환된 매출 건 ID |

### 3-4. 리드 전환
- "매출 전환" 버튼 → `convertLeadToSale()` 서버 액션
- sales 테이블에 신규 레코드 생성
- lead status → '완료', `converted_sale_id` 업데이트
- Dropbox 폴더 자동 생성

### 3-5. 고객 DB 자동 동기화
- 리드 등록 시 `syncLeadToCustomerDB()` 자동 호출
- 기관명 → `customers` upsert (동명 기관 중복 방지)
- 담당자명 → `persons` upsert (전화/이메일 누락분 보완)
- 양쪽 모두 존재 시 → `person_org_relations` 관계 자동 생성
- 실패해도 리드 등록 흐름에 영향 없음 (try-catch 처리)

### 3-6. 리마인드 알림
- `/api/leads/reminders`: 오늘 remind_date인 리드 조회
- 담당자에게 알림 발송 (향후 채널톡/이메일 연동 예정)

---

## 4. 업무 관리 (Tasks)

**목적:** 매출 건(계약)을 프로젝트 단위로 보고 업무를 분해·추적

### 4-1. 업무 목록 (`/tasks`)
- 전체 업무 조회 (본인 담당 + 전체)
- 프로젝트(매출 건)별 그룹화 뷰
- 목록 뷰 (평면 리스트)
- 필터: 상태, 담당자, 우선순위, 서비스 타입

### 4-2. 업무 상세 (`/sales/[id]` 내 TasksSection)
- 해당 매출 건에 연결된 업무 카드 목록
- 업무 추가 폼 (제목, 담당자, 마감일, 우선순위, 메모)
- 상태 변경 (할 일 → 진행중 → 완료)
- 업무 수정 (인라인 편집)
- 업무 삭제

### 4-3. 업무 필드

| 필드 | 설명 |
|------|------|
| `sale_id` | 연결된 매출 건 |
| `title` | 업무명 |
| `status` | 할 일 / 진행중 / 완료 / 취소 |
| `priority` | 높음 / 보통 / 낮음 |
| `assignee_id` | 담당자 (profiles FK) |
| `due_date` | 마감일 |
| `memo` | 메모 |
| `created_by` | 생성자 |

### 4-4. 서비스별 업무 템플릿
- 매출 건 생성 시 서비스 타입에 맞는 표준 업무 목록 자동 삽입
- `applyTaskTemplate(saleId, serviceType, createdBy)` 서버 액션

| 서비스 | 업무 수 | 주요 업무 |
|--------|---------|----------|
| SOS | 11개 | CS→견적→계약→아티스트 컨택→공연→정산 |
| 교육프로그램 | 12개 | CS→견적→계약→사전답사→수업→음원발매→정산 |
| 납품설치 | 9개 | CS→방문점검→견적→시공→결제→콘텐츠 |
| 유지보수 | 6개 | CS→견적→방문→점검시공→결제 |
| 교구대여 | 10개 | CS→재고확인→계약→배송→회수→정산 |
| 제작인쇄 | 9개 | CS→상담→견적→시안→계약→제작→납품→정산 |
| 콘텐츠제작 | 12개 | CS→상담→견적→기획→계약→촬영→편집→납품→정산 |
| 행사운영 | 9개 | CS→상담→견적→기획→계약→준비→진행→정산 |
| 행사대여 | 8개 | CS→재고확인→견적→계약→배송→지원→회수→정산 |
| 프로젝트 | 8개 | CS→상담→견적→기획→계약→진행→납품→정산 |
| 002ENT | 7개 | 발매요청→자료전송→정보파악→발매확정→프로모션→정산 |

---

## 5. 고객 DB

**목적:** 기관(고객사)과 담당자 정보를 체계적으로 관리 (콜드메일 리스트, 재방문 영업)

### 5-1. 고객 목록 (`/customers`)
- 탭 전환: [기관 목록] / [담당자 목록]
- 기관 목록: 기관명, 유형, 누적 매출, 최근 거래일, 등급(VIP/일반/신규)
- 담당자 목록: 이름, 소속, 연락처, 이메일, 재직 여부

### 5-2. 기관 상세
- 기본 정보: 기관명, 유형(학교/공공기관/기업/개인/기타), 지역, 연락처, 홈페이지, 메모
- 소속 담당자 목록 (현재 재직 + 과거)
- 거래 이력 (연결된 sales 건)
- 누적 매출액, 거래 건수, 최근 거래일

### 5-3. 담당자 상세
- 기본 정보: 이름, 전화, 이메일, 메모
- 재직 이력: 기관명, 부서, 직책, 재직 기간

### 5-4. 기관-담당자 관계 (`person_org_relations`)
- 한 담당자가 여러 기관에 소속될 수 있음 (이직 이력 추적)
- `is_current`: 현재 재직 여부
- `started_at / ended_at`: 재직 기간
- 담당자 이직 시 기존 관계 `is_current = false` 처리

### 5-5. 등급 자동 산정
- VIP: 누적 매출 1억 이상
- 일반: 거래 이력 있음
- 신규: 거래 이력 없음

### 5-6. 자동 동기화
- 리드 등록 시 `syncLeadToCustomerDB()` 자동 호출
- 일괄 마이그레이션 API: `POST /api/admin/sync-leads-to-customers` (admin 전용)

---

## 6. 거래처 DB

**목적:** 협력업체, 공급사, 파트너사 정보 관리

### 6-1. 거래처 목록 (`/vendors`)
- 거래처명, 유형, 담당자, 연락처, 계좌 정보

### 6-2. 거래처 유형
- 외주업체 / 공급사 / 파트너 / 기타

### 6-3. 사업자 정보 (`business_entities`)
- 세금계산서 발행을 위한 사업자 정보 테이블
- 사업자번호, 대표자명, 사업장 주소, 업태/종목

---

## 7. 재무 관리

**목적:** 미수금 추적, 지급 관리, 재무 현황 파악 (admin 전용)

### 7-1. 미수금 현황 (`/receivables`)
- 결제 완료되지 않은 매출 건 목록
- 미수금 합계, 건별 예상 입금일

### 7-2. 지급 관리 (`/payments`) ★admin
- 외주비, 인건비 등 지급 예정 내역
- 지급 완료 처리

### 7-3. 재무 현황 (`/finance`) ★admin
- 월별 매출/비용 집계
- 사업부별 손익

### 7-4. 인건비 관리 (`/payroll`) ★admin
- 팀원별 인건비 등록/조회

### 7-5. 고정비 관리 (`/fixed-costs`) ★admin
- 임대료, 구독료 등 고정 지출 항목

### 7-6. 자금일보 (`/cashflow`) ★admin
- 일별 입출금 현황

### 7-7. 월별 매출 엑셀 내보내기
- `GET /api/export/monthly?year=YYYY&month=MM`
- 매출 건 + 비용 항목 포함 엑셀 파일 다운로드

---

## 8. AI 어시스턴트 (빵빵이)

**목적:** 자연어로 리드/매출 등록, 고객 조회, 업무 기록 — 노션 메모 대체

### 8-1. 기본 기능
- 우하단 플로팅 버튼으로 열고 닫기
- 모든 페이지에서 접근 가능 (layout.tsx에 마운트)
- Claude claude-sonnet-4-6 모델 사용
- 대화 컨텍스트 유지 (messages 배열 상태)

### 8-2. 도구 목록 (Tool Use)

| 도구명 | 설명 |
|--------|------|
| `create_lead` | 리드 등록 (기관명, 담당자, 연락처, 서비스, 채널, 유입경로, 메모) |
| `update_lead` | 리드 수정 (상태, 서비스 타입, 메모 등 부분 업데이트) |
| `create_sale` | 매출 건 등록 (이름, 거래처, 서비스, 사업부, 금액, 담당자) |
| `search_leads` | 리드 검색 (기관명, 상태, 담당자로 필터) |
| `search_sales` | 매출 건 검색 |
| `search_customers` | 고객 DB 검색 (기관 + 담당자 전체 조회) |

### 8-3. 담당자 자동 지정
- 빵빵이로 리드/매출 생성 시 로그인한 사용자가 자동으로 `assignee_id` 설정
- JWT에서 `user.id` 추출 → API route에서 insert 시 자동 포함

### 8-4. 이미지/사진 첨부
- 📎 버튼 클릭 → 파일 선택 (모바일: 카메라/갤러리 선택)
- `accept="image/*"` → iOS/Android 기본 카메라 앱 연동
- FileReader API → base64 변환
- Claude Vision API로 이미지 인식 후 텍스트와 함께 처리
- 대화창에 첨부 이미지 썸네일 미리보기 표시
- 용도: 상담 내용 캡처, 명함 사진, 현장 사진 등을 빵빵이에게 전달

### 8-5. 시스템 프롬프트 규칙
- 매출 모드: 리드/매출 건 생성, 상태 업데이트
- 고객 DB 조회 시 `search_customers` 도구 사용
- 리드/매출 생성 시 고객 DB 자동 동기화 안내
- 한국어로만 응답
- 불확실한 정보는 사용자에게 확인 요청

### 8-6. API 엔드포인트
- `POST /api/chat` — 메인 대화 처리 (tool_use 루프)
- `POST /api/chat/create-lead` — 리드 생성 (빵빵이 전용)
- `POST /api/chat/create-sale` — 매출 건 생성 (빵빵이 전용)

---

## 9. 네비게이션 및 레이아웃

**목적:** 사업 성장에 따라 메뉴가 늘어도 정리된 구조 유지

### 9-1. 구조 (Option B)
- **상단 탭 바** (h-12, sticky): 영업 / 재무 / 관리 카테고리 전환
- **좌측 서브 사이드바** (w-44, top-12): 선택된 카테고리의 메뉴 항목

### 9-2. 카테고리별 메뉴

| 카테고리 | 메뉴 |
|----------|------|
| 영업 | 대시보드, 매출 현황, 계약 목록, 리드 관리, 업무 관리 |
| 재무 | 미수금 현황, 지급 관리★, 재무 현황★, 인건비 관리★, 고정비 관리★, 자금일보★ |
| 관리 | 고객 DB, 거래처 DB, 팀원 관리★ |

★ = admin 전용 (member에게 미표시)

### 9-3. 자동 카테고리 감지
- `detectCategory(pathname)` 함수: 현재 URL에서 속한 카테고리 자동 판단
- 페이지 이동 시 상단 탭 자동 활성화

### 9-4. 모바일 대응
- 햄버거 메뉴 → 드로어 오픈
- 드로어 내 카테고리 그룹 + 메뉴 항목
- 빵빵이 플로팅 버튼 모바일 위치 최적화

### 9-5. 레이아웃
- `src/app/(dashboard)/layout.tsx`
- 사이드바 너비: `md:ml-44`
- 상단 탭 높이: `pt-16` (모바일: 상단 바 공간 확보)

---

## 10. DB 스키마

> SQL 마이그레이션 파일 없음. Supabase 대시보드에서 직접 관리. 아래는 코드 분석으로 역추적한 스키마.

### `profiles`
```sql
id          uuid PRIMARY KEY REFERENCES auth.users(id)
name        text
email       text
role        text  -- 'admin' | 'manager' | 'member'
departments jsonb -- 소속 사업부 배열 (예: ["sound_of_school", "artkiwoom"])
avatar_url  text
created_at  timestamptz DEFAULT now()
```

### `sales`
```sql
id             uuid PRIMARY KEY DEFAULT gen_random_uuid()
name           text             -- 매출명
client_org     text             -- 거래처명
service_type   text             -- SOS / 교육프로그램 / 납품설치 / ...
department     text             -- 사업부 코드
assignee_id    uuid REFERENCES profiles(id)
revenue        numeric          -- 매출액
payment_status text             -- 계약전 / 입금대기 / 부분입금 / 완료
memo           text
inflow_date    date
dropbox_url    text             -- Dropbox 폴더 링크
created_at     timestamptz DEFAULT now()
updated_at     timestamptz
```

### `sale_costs`
```sql
id             uuid PRIMARY KEY DEFAULT gen_random_uuid()
sale_id        uuid REFERENCES sales(id)
title          text    -- 비용 항목명
amount         numeric
vendor_id      uuid REFERENCES vendors(id)
payment_status text    -- 미지급 / 지급완료
paid_at        date
memo           text
created_at     timestamptz DEFAULT now()
```

### `leads`
```sql
id               uuid PRIMARY KEY DEFAULT gen_random_uuid()
lead_id          text UNIQUE      -- LEAD{YYYYMMDD}-{NNNN}
inflow_date      date
remind_date      date
service_type     text
contact_name     text
client_org       text
phone            text
office_phone     text
email            text
initial_content  text
assignee_id      uuid REFERENCES profiles(id)
status           text DEFAULT '신규'  -- 신규/회신대기/견적발송/진행중/완료/취소
channel          text             -- 전화/이메일/카카오/채널톡/기타
inflow_source    text             -- 네이버/인스타/유튜브/지인/기존고객/기타
notes            text
contact_1        text
contact_2        text
contact_3        text
converted_sale_id uuid REFERENCES sales(id)
created_at       timestamptz DEFAULT now()
updated_at       timestamptz
```

### `tasks`
```sql
id          uuid PRIMARY KEY DEFAULT gen_random_uuid()
sale_id     uuid REFERENCES sales(id)
title       text
status      text DEFAULT '할 일'  -- 할 일 / 진행중 / 완료 / 취소
priority    text DEFAULT '보통'   -- 높음 / 보통 / 낮음
assignee_id uuid REFERENCES profiles(id)
due_date    date
memo        text
created_by  uuid REFERENCES profiles(id)
created_at  timestamptz DEFAULT now()
updated_at  timestamptz
```

### `customers` (기관)
```sql
id          uuid PRIMARY KEY DEFAULT gen_random_uuid()
name        text NOT NULL
type        text NOT NULL  -- 학교 / 공공기관 / 기업 / 개인 / 기타
status      text NOT NULL DEFAULT '잠재'  -- 잠재/접촉/제안/계약/완료/보류
region      text
phone       text
email       text
homepage    text
notes       text
created_at  timestamptz DEFAULT now()
updated_at  timestamptz
```

### `persons` (담당자)
```sql
id          uuid PRIMARY KEY DEFAULT gen_random_uuid()
name        text NOT NULL
phone       text
email       text
notes       text
created_at  timestamptz DEFAULT now()
updated_at  timestamptz
```

### `person_org_relations` (기관-담당자 관계)
```sql
id          uuid PRIMARY KEY DEFAULT gen_random_uuid()
customer_id uuid REFERENCES customers(id)
person_id   uuid REFERENCES persons(id)
dept        text           -- 부서
title       text           -- 직책
is_current  boolean DEFAULT true
started_at  date
ended_at    date
created_at  timestamptz DEFAULT now()
```

### `vendors` (거래처)
```sql
id          uuid PRIMARY KEY DEFAULT gen_random_uuid()
name        text
type        text           -- 외주업체 / 공급사 / 파트너 / 기타
contact_name text
phone       text
email       text
account_info text          -- 계좌 정보
notes       text
created_at  timestamptz DEFAULT now()
```

### `business_entities` (사업자 정보)
```sql
id               uuid PRIMARY KEY DEFAULT gen_random_uuid()
name             text
entity_type      text           -- 법인 / 개인사업자
business_number  text           -- 사업자번호
representative   text           -- 대표자명
address          text
business_type    text           -- 업태
business_item    text           -- 종목
created_at       timestamptz DEFAULT now()
```

### `role_permissions` (페이지별 권한)
```sql
id            uuid PRIMARY KEY DEFAULT gen_random_uuid()
role          text  -- 역할명 (직책 또는 커스텀)
page_key      text  -- 페이지 식별자
access_level  text  -- off / read / own / full
UNIQUE(role, page_key)
```

---

## 부록. 주요 유틸리티 및 규칙

### API 엔드포인트 목록

| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | `/api/chat` | 빵빵이 대화 (tool_use 루프) |
| POST | `/api/chat/create-lead` | 빵빵이 리드 생성 |
| POST | `/api/chat/create-sale` | 빵빵이 매출 생성 |
| POST | `/api/admin/invite` | 팀원 초대 메일 발송 |
| POST | `/api/admin/sync-leads-to-customers` | 리드 → 고객DB 일괄 동기화 |
| GET/POST | `/api/admin/users` | 팀원 목록/역할 수정 |
| GET | `/api/export/monthly` | 월별 매출 엑셀 내보내기 |
| GET | `/api/leads/reminders` | 오늘 리마인드 대상 리드 조회 |

### 핵심 라이브러리

| 파일 | 역할 |
|------|------|
| `src/lib/supabase/server.ts` | 서버 컴포넌트/액션용 Supabase 클라이언트 |
| `src/lib/supabase/admin.ts` | RLS 우회용 Admin 클라이언트 |
| `src/lib/permissions.ts` | `getAccessLevel(role, pageKey)` |
| `src/lib/customer-sync.ts` | `syncLeadToCustomerDB()` |
| `src/lib/task-templates.ts` | `SERVICE_TASK_TEMPLATES` (서비스별 업무 템플릿) |
| `src/lib/dropbox.ts` | Dropbox 폴더 자동 생성 |
| `src/types/index.ts` | 전체 TypeScript 타입 정의 |

### 개발 규칙 (CLAUDE.md 요약)
1. **FK join 금지**: 별도 쿼리 + JS 수동 조인 사용
2. **profiles 조회는 `createAdminClient()`**: RLS 우회
3. **테이블 행 내 버튼**: `<button onClick={() => router.push(url)}>` 사용
4. **업무 액션 revalidate**: `/tasks`와 `/sales/${saleId}` 둘 다
5. **배포**: `npx vercel deploy --prod` (프로젝트 루트에서)
