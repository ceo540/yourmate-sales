# yourmate-system 명세 (Phase 0 — 현재 상태 자동 추출)

> **이 문서는 *지금 운영 중인 시스템을 그대로 기록한 명세*다.**
> 추측·계획·이상안은 들어가지 않는다. 코드·DB·설정 파일에서 직접 추출한 사실만 적는다.
>
> **사용자 액션:** 읽으면서 빨간 줄(❌) — "이건 죽었어 / 잘못 적혔어 / 이건 안 써" 표시.
> **다음 단계:** Phase 1 — 비즈니스 흐름 그리기 (이 문서 기반).

| 항목 | 값 |
|---|---|
| 추출 시점 | 2026-05-01 |
| main 커밋 | `29ef837` |
| Next.js | 16.1.6 (App Router) |
| React | 19.2.3 |
| 배포 | Vercel `yourmate-system.vercel.app` (ceo-7550 팀) |
| Supabase 프로젝트 | `zzstizlyhevulaqatxgp` |
| 미들웨어 파일 | `src/proxy.ts` (Next 16 규칙: `proxy()` export) |
| 빌드 명령 | `npx next build` |
| 타입 검사 | `npx tsc --noEmit` (Turbopack은 TS 에러 무시) |

---

## 1. 사이드바 메뉴 (`src/components/layout/Sidebar.tsx`)

**메인 메뉴**

| 라벨 | href | pageKey | 비고 |
|---|---|---|---|
| 🏠 홈 | `/dashboard` | — | |
| 📥 리드 | `/leads` | `leads` | |
| ◈ 프로젝트 | `/projects` | — | |
| 📜 계약 | `/sales` | `sales` | |
| ⬡ 서비스 | `/services` | — | active prefix: `/rentals`, `/sos`, `/departments` |
| 🗂️ 고객 | `/customers` | `customers` | |
| 📅 캘린더 | `/calendar` | — | |
| 📊 재무 | `/finance` | `finance` | adminOnly |
| 👥 팀 | `/team` | — | active prefix: `/hr`, `/attendance` |

**하단 메뉴**

| 라벨 | href | pageKey | 비고 |
|---|---|---|---|
| 📢 공지 | `/notice` | `notice` | |
| ✅ 업무 | `/tasks` | `tasks` | |
| ⚙️ 관리 | `/admin` | `admin_panel` | adminOnly |

---

## 2. 페이지 트리 (`src/app`)

### `(auth)` — 비인증

- `/login`
- `/set-password`

### `(dashboard)` — 인증 필요 (layout.tsx에서 세션 검사 + Sidebar + AiChat)

| 경로 | 비고 |
|---|---|
| `/dashboard` | 홈 |
| `/about` | |
| `/admin` | 관리 패널 (admin/manager) |
| `/attendance` | 출근 (yourmate-attendance 별도 시스템 있음) |
| `/calendar` | |
| `/cashflow` | |
| `/customers` | |
| `/daily-report` | |
| `/departments` | 사업부 매출 현황 (서비스 메뉴 active) |
| `/departments/[dept]` | |
| `/departments/[dept]/[saleId]` | |
| `/expenses` | |
| `/finance` | adminOnly |
| `/fixed-costs` | |
| `/hr` | |
| `/leads` | 리드 목록 |
| `/notice` | |
| `/payments` | |
| `/payroll` | |
| `/profile` | |
| `/projects` | 프로젝트 목록 |
| `/projects/[id]` | 프로젝트 상세 (V2 기본) |
| `/projects/[id]/v2` | (V1 → V2 전환 후 잔존 라우트, 정리 후보) |
| `/quotes` | 견적 목록 (Step 1·2·3 완료, Step 4 PDF 미진행) |
| `/receivables` | 미수금 |
| `/rentals` | 교구대여 (학교상점) |
| `/rentals/[id]` | |
| `/sales` | 계약 (= 매출 건) |
| `/sales/[id]` | 계약 상세 *(SaleHub deprecate 후보 — 메모리)* |
| `/sales/new` | |
| `/sales/report` | |
| `/sales/tasks` | |
| `/services` | 서비스 허브 |
| `/sos` | SOS 콘서트 |
| `/tasks` | |
| `/team` | |
| `/vendors` | 외주사 |
| `/vendors/[id]` | |
| `/vendors/[id]/ledger` | |
| `/vendors/new` | |
| `/weekly-report` | |
| `/ux-demo/*` | 데모 페이지 7종 (사이드바 미연결, **정리 후보**) |

**기타**

- `/share/[token]` — 공개 공유 토큰
- `/auth/callback` — Supabase OAuth callback

---

## 3. API 라우트 (`src/app/api`)

### 관리 / 사용자

- `POST /api/admin/invite` — 사용자 초대
- `GET  /api/admin/users` — 사용자 목록
- `GET  /api/admin/api-usage` — API 비용·토큰 집계 (사용자×월/주 cross-tab)
- `POST /api/admin/sync-leads-to-customers` — 옛 데이터 정리

### 빵빵이 (AI)

- `POST /api/chat` — **사이드바 빵빵이** (사용자 통합 어시스턴트). Anthropic `claude-sonnet-4-6`. 도구 46개. `maxDuration=60`
- `POST /api/chat/create-lead` — 리드 생성 단일 액션
- `POST /api/claude/project` — **프로젝트 페이지 내 빵빵이**. Anthropic `claude-sonnet-4-6`. 도구 30개
- `POST /api/claude/save-html` — Claude 응답 HTML 저장
- `POST /api/claude/save-to-brief` — Claude 응답 → brief.md 저장
- `POST /api/claude/save-to-dropbox` — Claude 응답 → Dropbox 저장
- `POST /api/channeltalk` — **채널톡 빵빵이** (외부 봇). Anthropic `claude-haiku-4-5-20251001`. HMAC-SHA256 서명 검증. 도구 19개
- `GET  /api/channeltalk/conversations` — 대화 목록
- `GET  /api/channeltalk/customer` — 채널톡 사용자 매핑
- `POST /api/channeltalk/import` — 옛 채널톡 데이터 가져오기

### 리드 / 견적 / 요약

- `POST /api/lead-summary` — 리드 요약 캐시 갱신
- `GET  /api/leads/reminders` — 리마인드 대상
- `POST /api/project-summary` — 프로젝트 요약
- `POST /api/quotation` — (옛 라우트, **이번 라운드 정리됨**)
- `POST /api/quotes/preview` — HTML 견적 미리보기
- `POST /api/suggest-keyword` — 키워드 추천
- `POST /api/transcribe` — Whisper 음성 STT (OpenAI). **OPENAI_API_KEY 보존 사유**

### 캘린더 / 자동화

- `GET/POST /api/calendar/events` — 캘린더 이벤트 CRUD
- `GET/PATCH/DELETE /api/calendar/events/[id]`
- `GET  /api/cron/payment-reminders` — **cron**: 결제 리마인드 (vercel.json `0 0 * * *` UTC = KST 09시 매일)

### 외부 / 디버그

- `GET  /api/export/monthly` — 월별 익스포트
- `POST /api/debug-cost` — 원가 PDF 디버그 (**검증 끝나면 제거 후보**)
- `GET  /api/debug-dropbox` — Dropbox 디버그 (**제거 후보**)

---

## 4. 데이터베이스 (Supabase, 58 테이블)

### 4.1 핵심 도메인 (CRM·세일즈·프로젝트)

| 테이블 | 용도 |
|---|---|
| `customers` | 고객사 (조직) |
| `persons` | 담당자 (사람) |
| `person_org_relations` | 담당자↔고객사 N:M (부서·직급·is_current) |
| `leads` | 리드 파이프라인 |
| `sales` | 계약 = 매출 건 (7단계 contract_stage) |
| `projects` | 프로젝트 (sales와 별도 운영) |
| `project_logs` | 소통 로그 (sale_id/lead_id/customer_id/person_id/project_id 다중) |
| `project_members` | 프로젝트 멤버 (role: PM 등) |
| `project_memos` | 프로젝트 메모 (multi) |
| `tasks` | 업무. 컬럼: `project_id`(NOT sale_id), `description`(NOT memo) |

### 4.2 견적 / 계약

| 테이블 | 용도 |
|---|---|
| `quotes` | 견적 (`YY-MM-NNN` 채번, status: draft/sent/accepted/rejected/cancelled) |
| `quote_items` | 견적 항목 (sort_order, qty, unit_price, amount) |
| `business_entities` | 사업자 6개 (아래 §6) |
| `payment_schedules` | 분할 결제 일정 (sale_id, label, amount, due_date, is_received) |
| `vendors` | 외주사 |
| `sale_costs` | 외주비 |
| `vendor_payments` | 외주사 지급 내역 |

### 4.3 학교상점 (교구대여)

| 테이블 | 용도 |
|---|---|
| `rentals` | 대여 건 (project_id 직접 연결) |
| `rental_items` | 대여 항목 |
| `rental_deliveries` | 배송 (parent_rental_id 분기 구조 — **정리 후보 메모리**) |

### 4.4 SOS / 002ENT

| 테이블 | 용도 |
|---|---|
| `sos_concerts` | SOS 공연 |

### 4.5 인사 / 조직

| 테이블 | 용도 |
|---|---|
| `profiles` | 직원. `departments`는 **text(JSON 문자열)** — 파싱 필요 |
| `departments` | 사업부 메타 |
| `attendance_records` | 근태 (시·분 단위) |
| `payroll` | 급여 |
| `salary_records` | 급여 이력 |
| `leave_balances` | 휴가 잔액 |
| `leave_requests` | 휴가 신청 |
| `employee_cards` | 명함 |
| `employee_bonus_items` | 보너스 항목 |
| `employee_work_schedules` | 근무 스케줄 |
| `onboarding_items` | 온보딩 |
| `one_on_ones` | 1:1 미팅 |
| `warning` | 경고/이슈 (단수형 주의) |
| `public_holidays` | 공휴일 |

### 4.6 재무

| 테이블 | 용도 |
|---|---|
| `cashflow` | 자금 흐름 |
| `bank_transactions` | 은행 거래 |
| `financial_accounts` | 계좌 |
| `expenses` | 지출 |
| `fixed_costs` | 고정비 |

### 4.7 시스템 / 메타

| 테이블 | 용도 |
|---|---|
| `api_usage` | AI 호출 토큰·비용 로그 (model·endpoint·user_id) |
| `notification_settings` | 알림 설정 (id, label, enabled, config jsonb) |
| `notification_log` | 알림 발송 로그 (notification_type, reference, dry_run) |
| `role_permissions` | 페이지 키 × 역할 권한 (access_level: off/read/own/full) |
| `system_settings` | 시스템 설정 |
| `plugin` | (단수형, 용도 확인 필요) |

### 4.8 보고 / 회의

| 테이블 | 용도 |
|---|---|
| `weekly_reports` | 주간 리포트 |
| `daily_reports` | 일일 리포트 |
| `meetings` | 미팅 |
| `minutes` | 회의록 |
| `notices` | 공지 |
| `sops` | SOP / 업무 설명서 |
| `policies` | 운영 정책 |
| `goals` / `key_results` / `department_goals` | OKR |
| `document_requests` | 문서 요청 |

### 4.9 핵심 컬럼 메모

**`leads`** — `lead_id`(text), `customer_id`, `person_id`, `service_type`, `status`, `assignee_id`, `linked_calendar_events`(jsonb), `summary_cache`, `summary_updated_at`, `is_primary_lead`, `project_id`, `dropbox_url`, `quotation_url`, contact_1/2/3 (멀티 담당자 옛 흔적)

**`projects`** — `name`, `service_type`, `department`, `pm_id`, `customer_id`, `person_id`, `contact_person_id`, `status`, `dropbox_url`, `project_overview`, `overview_summary`(한눈에), `work_description`(자세한), `pending_discussion`(통합), `pending_discussion_client/_internal/_vendor`(3분할), `short_summary`, `linked_calendar_events`, `project_number`, `_source_sale_id`

**`profiles`** — `role`(admin/manager/member), `department`(text), `departments`(text JSON), `entity_id`(business_entities FK 없음), `channeltalk_user_id`

**`payment_schedules`** — sale_id, label, amount(bigint), due_date, received_date, is_received, sort_order

### 4.10 FK 제약 없음 — 수동 조인 패턴 필수

```ts
// ❌ PostgREST 조인 — 빈 화면
admin.from('sales').select('*, assignee:profiles(*)')

// ✅ 별도 쿼리 + JS 수동 조인
const { data: sales } = await admin.from('sales').select('*')
const { data: profiles } = await admin.from('profiles').select('id, name')
const profileMap = Object.fromEntries(profiles.map(p => [p.id, p]))
```

---

## 5. 빵빵이 (AI 어시스턴트)

빵빵이는 4개의 다른 진입점에서 다른 권한·도구로 동작.

### 5.1 사이드바 빵빵이 (`/api/chat`) — 46개 도구

**파일:** `src/lib/bbang/tools.ts` (정의), `src/app/api/chat/route.ts` (실행)
**모델:** `claude-sonnet-4-6`

**도구 카탈로그 (그룹별):**

- **계약/매출**: `get_sales`, `get_monthly_summary`, `get_receivables`, `get_sale_detail`, `create_sale`, `update_sale_revenue`, `update_sale_status`
- **노션 잔존**: `update_notion_title`, `update_notion_status`, `search_notion_projects`, `get_notion_project_content` *(노션 안 쓰는 정책 — 정리 후보)*
- **PDF/Dropbox**: `read_dropbox_pdf`, `search_dropbox`, `list_dropbox_files`, `set_dropbox_url`
- **리드**: `search_leads`, `create_lead`, `update_lead`, `convert_lead_to_sale`
- **고객 정합화**: `search_customers`, `quick_create_customer`, `find_duplicate_customers`, `merge_customers`, `find_orphan_sales`, `find_orphan_leads`, `match_lead_to_customer`, `match_sale_to_customer`
- **프로젝트 로그/상태**: `add_project_log`, `update_project_status`, `update_brief_note`
- **프로젝트 업무**: `create_project_task`, `complete_task`, `update_task`, `delete_task`
- **프로젝트 분석 (자동 생성)**: `regenerate_overview`, `update_overview`, `update_short_summary`, `regenerate_short_summary`, `update_pending_discussion`, `regenerate_pending_discussion`, `update_lead_summary`, `regenerate_lead_summary`
- **견적**: `create_quote`, `update_quote`, `list_quotes`
- **캘린더**: `create_calendar_event`

### 5.2 프로젝트 빵빵이 (`/api/claude/project`) — 30개 도구

**파일:** `src/app/api/claude/project/route.ts`
**진입:** 프로젝트 상세 페이지 내 ProjectClaudeChat 사이드 패널

**도구 카탈로그:**

- **파일**: `list_project_files`, `read_project_file`
- **소통/상태**: `add_communication_log`, `update_status`, `update_notes`
- **업무**: `create_task`, `update_task`, `complete_task`, `delete_task`
- **개요**: `regenerate_overview`, `update_overview`
- **요약**: `update_short_summary`, `regenerate_short_summary`
- **협의(3분할)**: `update_pending_discussion(target)`, `regenerate_pending_discussion(target)` — target: client/internal/vendor
- **리드 요약**: `regenerate_lead_summary`, `update_lead_summary`
- **brief**: `rename_brief_file`, `regenerate_master_brief`
- **메모**: `add_project_memo`, `update_project_memo`, `delete_project_memo`
- **고객**: `search_customers`, `quick_create_customer`
- **견적**: `create_quote`, `update_quote`, `list_quotes`

### 5.3 채널톡 빵빵이 (`/api/channeltalk`) — 19개 도구

**모델:** `claude-haiku-4-5-20251001`
**용도:** 채널톡 외부 봇 응대 (HMAC-SHA256 검증)

**도구:** `get_sales`, `get_monthly_summary`, `get_receivables`, `get_sale_detail`, `create_sale`, `update_sale_status`, `get_tasks`, `create_task`, `search_leads`, `create_lead`, `update_lead`, `convert_lead_to_sale`, `search_customers`, `search_dropbox`, `list_dropbox_folder`, `read_dropbox_file`, `search_notion_projects`, (이하 +2)

### 5.4 MCP 서버 (`mcp/server.ts`) — 14개 도구

**stdio 트랜스포트** (`npm run mcp` → tsx). HTTP 트랜스포트 미구현 (직원용 후보).

`search_leads`, `get_lead_detail`, `add_communication_log`, `search_projects`, `get_project_detail`, `add_task`, `get_today_actions`, `update_lead`, `complete_task`, `update_task`, `delete_task`, `add_project_memo`, `search_customers`, `quick_create_customer`

---

## 6. 사업부 + 서비스 + 사업자

### 6.1 사업부 6개 (`Department` 타입 + `DEPARTMENT_LABELS`)

| 키 | 라벨 |
|---|---|
| `yourmate` | 유어메이트 |
| `sound_of_school` | Sound OF School |
| `artkiwoom` | 아트키움 |
| `002_creative` | 002 Creative |
| `school_store` | 학교상점 |
| `002_entertainment` | 002 Entertainment |

### 6.2 서비스 → 사업부 매핑 (`src/lib/services.ts`)

| 서비스 | 사업부 | 채널톡 그룹 ID | Dropbox 경로 |
|---|---|---|---|
| `SOS` | sound_of_school | 395644 (1_사운드오브스쿨) | `/2 SOS/2 프로젝트` |
| `002ENT` | 002_entertainment | 462715 | `/5 002ent` |
| `교육프로그램` | artkiwoom | 404376 | `/1 아트키움/2 프로젝트` |
| `납품설치` | school_store | 416890 | `/3 학교상점/1 납품 설치` |
| `유지보수` | school_store | 416890 | `/3 학교상점/1 유지보수` |
| `교구대여` | school_store | 416890 | `/3 학교상점/1 교구대여` |
| `제작인쇄` | school_store | 416890 | `/3 학교상점/1 제작인쇄` |
| `콘텐츠제작` | 002_creative | 433414 | `/4 002Creative.../2 콘텐츠제작` |
| `행사운영` | 002_creative | 433414 | `/4 002Creative.../2 행사운영` |
| `행사대여` | 002_creative | 433414 | `/4 002Creative.../2 행사대여` |
| `프로젝트` | 002_creative | 433414 | `/4 002Creative.../2 프로젝트` |

> **주의:** `yourmate` 사업부는 SERVICE_TYPES에 없음(자체 서비스 X, 본부 역할).

### 6.3 사업자 6개 (`business_entities`)

| 정식명 | short_name |
|---|---|
| 주식회사 공공이코퍼레이션 | 공공이코 (메인 / 통상 default) |
| 주식회사 공공이크리에이티브 | 공공이크 (분할결제·수의계약 한도 초과 시) |
| 지지스튜디오 | 지지 |
| 드림비앤비 | 드림 |
| 넥스트플랜 | 넥스트 |
| 유어메이트 | 유어 |

**견적 HTML 템플릿:** 공공이코 / 지지 / 드림 3종만 보유 (`src/lib/quote-templates/`).
**잔여 3개(공공이크·넥스트·유어) 템플릿 미보유** → ❓ Phase 2 정책 결정 필요.

### 6.4 상태/단계 enum

- **계약 단계 (`contract_stage`)**: 계약 → 착수 → 선금 → 중도금 → 완수 → 계산서발행 → 잔금
- **운영 진행 트랙 (`progress_status`)**: 착수전 → 착수중 → 완수
- **리드 상태**: 유입 → 회신대기 → 견적발송 → 조율중 → 진행중 → 완료 / 취소
- **프로젝트 상태**: 기획중 / 진행중 / 완료 / 취소 / 보류
- **업무 상태**: 할 일 / 진행중 / 검토중 / 완료 / 보류
- **견적 상태**: draft / sent / accepted / rejected / cancelled

---

## 7. 권한 모델

**역할 (`profiles.role`):** `admin` / `manager` / `member`

**권한 함수 (`src/lib/permissions.ts`):**
- `isAdmin(role)` — admin only
- `isAdminOrManager(role)` — admin or manager
- `getAccessLevel(role, pageKey)` → `off` / `read` / `own` / `full`
  - admin은 항상 full
  - 나머지 역할은 `role_permissions` 테이블 (page_key × role) 조회

**사이드바 pageKey:** `leads`, `sales`, `customers`, `finance`(adminOnly), `notice`, `tasks`, `admin_panel`(adminOnly)

> ❓ Phase 2 정책 결정 필요: 재무 메뉴 권한 정확히 누구까지 / member 역할 실제 차이.

---

## 8. 자동화

### 8.1 cron (`vercel.json`)

| 경로 | 스케줄 | KST | 동작 |
|---|---|---|---|
| `/api/cron/payment-reminders` | `0 0 * * *` (UTC) | 매일 09시 | 결제 리마인드 알림 |

> Phase 2 알림 backbone은 *코드 추가됐으나 사용자 dry-run 검증 미완* (메모리 v2). cron 추가 등록은 검증 후 결정.

### 8.2 채널톡 → 빵빵이 자동 응대

- 외부 채널톡 웹훅 → `/api/channeltalk` (HMAC 검증)
- 자동 도구 호출로 리드 생성·고객 매칭·매출 조회

### 8.3 자동 분석 (사용자 트리거 / 빵빵이 능동)

- `regenerate_overview` — 프로젝트 한눈에 요약
- `regenerate_pending_discussion` — 협의(3분할 각각)
- `regenerate_short_summary` — 한 줄 요약
- `regenerate_lead_summary` — 리드 요약
- `regenerate_master_brief` — 프로젝트 brief.md 통합 갱신

### 8.4 자동 폴더/파일 생성

- 프로젝트 생성 시 service_type 기반 Dropbox 폴더 자동 생성 (`createSaleFolder`)
- 프로젝트 생성 시 `brief.md` 자동 생성·갱신

---

## 9. 외부 연동

| 연동 | 용도 | 키/설정 |
|---|---|---|
| **Anthropic** | 빵빵이 (chat=Sonnet 4.6, channeltalk=Haiku 4.5) | `ANTHROPIC_API_KEY` |
| **OpenAI** | Whisper 음성 STT (`/api/transcribe`만) | `OPENAI_API_KEY` |
| **Supabase** | DB·Auth·Storage | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` |
| **Dropbox** | 파일 저장·검색 (Business 팀) | `DROPBOX_ACCESS_TOKEN`, `DROPBOX_ROOT_NAMESPACE`(=3265523555) |
| **채널톡** | 외부 봇·고객 응대 | `CHANNELTALK_ACCESS_KEY`, `CHANNELTALK_ACCESS_SECRET` |
| **Notion** | 옛 동기화 (잔존) | `NOTION_TOKEN` *(노션 정책상 정리 대상)* |
| **Google Calendar** | 캘린더 이벤트 (googleapis) | OAuth 토큰 |
| **pdf-parse** | 옛 PDF 텍스트 추출 (PoC). v2-claude OCR로 마이그됨 | — |

**채널톡 알림(`src/lib/channeltalk.ts`):** `notifyLeadConverted()` — 서비스별 그룹 ID 하드코딩 매핑.

---

## 10. AI 비용 로깅

모든 AI 호출 후 `logApiUsage()` (`src/lib/api-usage.ts`) 호출.

`api_usage` 테이블 컬럼: `model`, `endpoint`, `user_id`, `input_tokens`, `output_tokens`, `cost_usd`, `created_at`

`/admin` API 사용량 페이지에서 사용자×월/주 cross-tab + 사용처별 모델 라벨로 집계.

---

## 11. 알려진 deprecate / 정리 후보

| 항목 | 출처 | 메모 |
|---|---|---|
| `/sales/[id]` (SaleHub) | 메모리 `yourmate-salehub-deprecate.md` | ProjectV2로 통합 흡수 후보 |
| `/projects/[id]/v2` 라우트 | V1→V2 전환 후 잔존 | default 전환 완료, 라우트 자체 정리 가능 |
| `/ux-demo/*` 7종 | 데모 페이지 | 사이드바 미연결, 정리 후보 |
| 빵빵이 노션 도구 (`update_notion_*`, `search_notion_projects`, `get_notion_project_content`) | 정책상 노션 안 씀 | 정리 후보 |
| 빵빵이 `create_sale` (chat) — 옛 Notion 자동 생성 흐름 | 사용자 안 씀 | 정리 후보 |
| `/api/debug-cost`, `/api/debug-dropbox` | 디버그 엔드포인트 | 원가 PDF 검증 끝나면 제거 |
| `rental_deliveries` / `parent_rental_id` | 메모리 `yourmate-session-2026-04-29-rentals.md` | 정리 후보 |
| `leads.contact_1/2/3` | 멀티 담당자 옛 흔적 | persons + person_org_relations 패턴으로 대체됨 |
| 사업자 3종 (공공이크·넥스트·유어) 견적 템플릿 부재 | 6.3 | Phase 2 정책 결정 필요 |
| sales 22건 + leads 35건 NULL customer_id | 메모리 `yourmate-todo.md` | 정책 결정 후 일괄 정리 |

---

## 12. 환경 / 운영 메모

- **배포: `git push origin main`만**. `vercel deploy --prod`는 잘못된 alias로 가서 운영 미반영 (메모리 `yourmate-vercel-projects.md`)
- **검증 환경:** localhost X, Vercel 운영 URL `yourmate-system.vercel.app`로
- **`'use server'` 파일 export 제약:** async 함수만. type·object·상수는 별도 파일 (`discussion-types.ts` 패턴)
- **자율 SQL:** `npx supabase db query --linked --file scripts/migration-XXX.sql` (멱등 SQL은 자율 OK, DROP/DELETE는 컨펌)

---

## 13. 빨간 줄 표시 가이드

이 문서를 훑으면서 다음 표기로 메모해주세요:

| 표시 | 의미 |
|---|---|
| ❌ X | "이 페이지/기능/도구는 죽었어. 안 써." |
| ⚠️ 잘못 | "여기 사실 다르게 동작해. 자동 추출이 잘못 잡았어." |
| ❓ 모호 | "이거 정확히 어떻게 쓰는지 나도 헷갈려. Phase 2에서 정해야 할듯." |
| ✂️ 합치자 | "이 두 개 사실 같은 거. 하나로 모을 수 있어." |
| 🆕 빠짐 | "여기 들어가야 할 페이지/기능이 빠졌어." |

표시 후 알려주시면 Phase 1(비즈니스 흐름)에서 빨간 줄 영역만 별도 섹션으로 다룹니다.

---

**다음 단계 (Phase 1):**
이 문서 검토 후 → `docs/yourmate-spec-1-flows.md` (핵심 워크플로 5~10개 시각화. 내가 초안, 사용자 OX 교정).
