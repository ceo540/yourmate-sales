# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# 개발 서버
npm run dev --prefix /Users/junyoungbang/yourmate-system

# 빌드 (배포 전 필수)
npx next build   # 반드시 해당 경로에서 직접 실행

# TypeScript 검사 (빌드 전 필수)
npx tsc --noEmit  # Turbopack은 TS 에러를 무시하므로 이 명령어로 반드시 확인

# 배포
npx vercel deploy --prod  # 프로젝트 경로(/Users/junyoungbang/yourmate-system)에서 실행

# 린트
npm run lint --prefix /Users/junyoungbang/yourmate-system
```

모든 npm 명령어는 반드시 `/Users/junyoungbang/yourmate-system` 경로에서 실행하거나 `--prefix` 플래그 사용.

---

## 아키텍처 개요

Next.js 16 App Router + Supabase + Tailwind CSS. 인증은 Supabase Auth, 배포는 Vercel.

**라우트 그룹:**
- `(auth)` — `/login`, `/set-password`
- `(dashboard)` — 인증된 사용자 전용. `layout.tsx`에서 Supabase 세션 검사 + Sidebar + AiChat 렌더링

**미들웨어:** `src/proxy.ts`에서 `proxy()` 함수로 export (Next.js 16 필수. `middleware.ts` + `middleware` 함수명은 Vercel 빌드 실패 원인).

---

## Supabase 클라이언트 두 종류

| 클라이언트 | 파일 | 용도 |
|-----------|------|------|
| `createClient()` | `src/lib/supabase/server.ts` | 세션/인증 확인용만 (RLS 적용됨) |
| `createAdminClient()` | `src/lib/supabase/admin.ts` | 데이터 조회/변경 모두 (service role, RLS 우회) |

**profiles 테이블 조회는 반드시 `createAdminClient()` 사용.** 일반 클라이언트로 조회하면 RLS로 인해 null 반환됨.

---

## ❌ FK 조인 절대 금지

이 Supabase 프로젝트에는 FK 제약이 없어 PostgREST 조인이 항상 실패함. 새 페이지 작성 시 반드시 수동 조인 패턴 사용.

```typescript
// ❌ 빈 화면 버그 발생
supabase.from('sales').select('*, assignee:profiles(id, name)')

// ✅ 별도 쿼리 + JS 수동 조인
const { data: sales } = await admin.from('sales').select('*')
const { data: profiles } = await admin.from('profiles').select('id, name')
const profileMap = Object.fromEntries(profiles.map(p => [p.id, p]))
const result = sales.map(s => ({ ...s, assignee: profileMap[s.assignee_id] ?? null }))
```

---

## 페이지 패턴

서버 컴포넌트에서 데이터 조회 → 클라이언트 컴포넌트로 props 전달.

```
page.tsx (서버 컴포넌트)
├── createClient()로 세션 확인
├── createAdminClient()로 데이터 조회 (Promise.all 병렬)
├── profileMap으로 수동 조인
└── XxxClient.tsx (클라이언트 컴포넌트)에 전달
```

**권한 체크 패턴:**
```typescript
const profile = await admin.from('profiles').select('id, role').eq('id', user.id).single()
const isAdmin = profile?.role === 'admin' || profile?.role === 'manager'
// isAdmin은 UI 버튼 제어에만 사용. 데이터 조회 범위 제한은 별도 처리.
```

`src/lib/permissions.ts`의 `getAccessLevel(role, pageKey)` — `role_permissions` 테이블에서 페이지별 권한 조회 (admin은 항상 full).

---

## Server Actions

각 페이지 폴더 또는 인접한 `actions.ts`에 위치. `'use server'` 지시어 필수.

업무(tasks) 관련 액션은 두 경로 모두 revalidate:
```typescript
revalidatePath(`/sales/${saleId}`)
revalidatePath('/tasks')
```

`'use server'` 파일에서 non-async 함수 export 불가 → 유틸 함수는 별도 파일 분리 (예: `weekly-report/utils.ts`).

---

## 테이블 내 링크/클릭 처리

테이블 `<tr>`에 `onClick`이 있을 때 내부 `<a href>`는 부모 이벤트에 막혀 동작하지 않음:

```typescript
// ❌
<a href={`/sales/${id}`}>링크</a>

// ✅
<button onClick={e => { e.stopPropagation(); router.push(`/sales/${id}`) }}>링크</button>
```

---

## 핵심 도메인 모델

`src/types/index.ts` 참고.

- **sales** — 매출 건 = 프로젝트. `contract_stage` 7단계: `계약 → 착수 → 선금 → 중도금 → 완수 → 계산서발행 → 잔금`
- **leads** — 리드 파이프라인. 상태: `유입 → 회신대기 → 견적발송 → 조율중 → 진행중 → 완료 / 취소`
- **tasks** — `project_id`(nullable, sales.id 연결). 컬럼명 주의: `project_id`(NOT `sale_id`), `description`(NOT `memo`). insert 시 `created_by` 포함하면 안 됨.
- **profiles** — `departments` 컬럼이 `text` 타입(JSON 문자열). 사용 전 파싱 필요:
  ```typescript
  const depts: string[] = Array.isArray(raw) ? raw : (typeof raw === 'string' ? (() => { try { return JSON.parse(raw) } catch { return [] } })() : [])
  ```

**사업부 키:** `yourmate`, `sound_of_school`, `artkiwoom`, `002_creative`, `school_store`, `002_entertainment`

---

## AI / 외부 연동

**시스템 내 빵빵이** (`/api/chat/route.ts`): Anthropic `claude-sonnet-4-6`. `export const maxDuration = 60` 필수.

**채널톡 빵빵이** (`/api/channeltalk/route.ts`): Anthropic `claude-haiku-4-5-20251001`. HMAC-SHA256 서명 검증 포함.

**AI 사용량 로깅:** 모든 AI 호출 후 `logApiUsage()` (`src/lib/api-usage.ts`) 호출.

**pdf-parse:** 반드시 함수 내부에서 `require('pdf-parse')` lazy load. 최상위 import 시 해당 모듈을 import하는 모든 라우트 크래시. `next.config.ts`에 `serverExternalPackages: ['pdf-parse']` 설정됨.

**Dropbox:** `src/lib/dropbox.ts`. Business 팀 계정이므로 `Dropbox-API-Path-Root` 헤더에 root namespace ID 필수 (하드코딩: `3265523555`). `too_many_write_operations` 대비 지수 백오프 재시도 내장.

**채널톡 알림:** `src/lib/channeltalk.ts`의 `notifyLeadConverted()` — 서비스별 채널 그룹 ID 하드코딩 매핑.

---

## 환경 변수

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
ANTHROPIC_API_KEY
OPENAI_API_KEY        # 현재는 /api/transcribe (Whisper 음성 STT) 전용. 빵빵이는 Claude.
DROPBOX_ACCESS_TOKEN
DROPBOX_ROOT_NAMESPACE   # 기본값 3265523555 하드코딩됨
NOTION_TOKEN
CHANNELTALK_ACCESS_KEY
CHANNELTALK_ACCESS_SECRET
```

로컬은 `.env.local`, 운영은 Vercel 환경변수.

---

## 데모/미사용 페이지

`-demo` 접미사 폴더들(`leads-demo-v2~v5`, `pipeline-demo`, `cashflow-demo` 등)은 사이드바 미연결 상태로 방치 중. 수정 대상 아님.

Supabase 프로젝트 ID: `zzstizlyhevulaqatxgp`
