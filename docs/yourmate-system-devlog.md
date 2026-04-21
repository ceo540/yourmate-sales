# yourmate-system 개발 로그

---

## 2026-04-07 세션

### 1. 렌탈관리 사이드바 위치 변경
- 영업 → 사업부 섹션으로 이동
- 커밋: `5b436c9`

### 2. 빵빵이 Dropbox PDF 읽기 오류 수정

**증상**: 드롭박스 폴더 경로로 PDF 읽으면 실패

**원인**: 경로 끝 `/` → Dropbox API `malformed_path` 에러

**수정 내용** (`src/app/api/chat/route.ts`):
- `folderPath.replace(/\/$/, '')` — trailing slash 자동 제거
- 경로가 `.pdf`로 끝나면 폴더 목록 조회 없이 파일 직접 다운로드
- 폴더에 PDF 여러 개면 목록 보여주고 어떤 파일 읽을지 선택 요청 (이전: 마지막 파일 자동 선택)

**커밋**: `f0e6211`

---

## 2026-04-06 세션 (2차 - 리드 소통 내역 저장 완전 해결)

### 3. 리드 소통 내역 저장 버그 완전 해결

**증상**: 리드관리 소통 내역 저장 시 Application error 500 ("null value in column")

**근본 원인**:
`project_logs.sale_id` 컬럼이 `NOT NULL` 제약 → 리드 로그 insert 시 `sale_id` 누락으로 실패

- 세일 로그는 `sale_id: saleId` 제공 → 성공
- 리드 로그는 `sale_id` 미제공 → "null value in column sale_id" 500 에러
- RPC + fallback 구조가 복잡해서 문제 파악 지연됨

**수정 내용**

1. **DB 스키마 수정** (Supabase SQL 에디터에서 실행):
   ```sql
   ALTER TABLE project_logs ALTER COLUMN sale_id DROP NOT NULL;
   ```

2. **`lead-log-actions.ts` 단순화**:
   - RPC + fallback 구조 제거 → 단순 direct insert로 변경
   - `sale_id: null` 명시적으로 포함
   - console.error로 전체 에러 메시지 로깅 추가

3. **`LeadsClient.tsx` 소통일시 시간 수정**:
   - `new Date().toISOString().slice(0, 16)` → UTC 기준이라 한국시간과 9시간 차이
   - `new Date()`의 로컬 시간 필드 직접 조합 방식으로 교체

**수정 파일**:
- `src/app/(dashboard)/leads/lead-log-actions.ts`
- `src/app/(dashboard)/leads/LeadsClient.tsx`

**커밋**: `945ef82`

---

## 2026-04-06 세션 (1차)

### 1. 소통 내역 저장 버그 완전 해결

**증상**: 소통 내역 저장 후 잠깐 보였다가 바로 사라짐

**근본 원인 3개 (모두 수정)**

1. `SaleHubClient.tsx` — `handleAddLog`/`deleteLog` 에서 `router.refresh()` 사용
   - `startTransition` 안에서 `router.refresh()` 호출 시 React 동시성 모드가 transition을 롤백함
   - **수정**: `router.refresh()` → `getSaleLogs(sale.id)` + `setLocalLogs(updated)` 로 교체

2. `SaleHubClient.tsx` — `useEffect(() => { setLocalLogs(logs) }, [logs])` 존재
   - `createLog`의 `revalidatePath`가 서버 재렌더 트리거 → 새 `logs` prop 전달 → useEffect가 덮어씀
   - **수정**: useEffect 제거

3. `/departments/[dept]/[saleId]/page.tsx` — 로그 쿼리에 `profiles:author_id(name)` FK join 사용
   - PostgREST 스키마 캐시가 FK 관계를 모름 → 빈 배열 반환 → 위 useEffect와 합쳐져 데이터 소실
   - **수정**: FK join 제거, 이미 fetch한 `profileMap` 재사용

**수정 파일**
- `src/app/(dashboard)/sales/[id]/SaleHubClient.tsx`
- `src/app/(dashboard)/departments/[dept]/[saleId]/page.tsx`

**커밋**: `e791975`, `9bf95fb`

---

### 2. 렌탈관리 페이지 구조 개선

**파일**: `src/app/(dashboard)/rentals/RentalsClient.tsx`, `actions.ts`

#### 상태값 변경
| 이전 | 이후 |
|------|------|
| 유입/상담/견적발송/확정/계약서서명/진행중/반납/완료/취소 | 유입/견적·조율/렌탈확정/배송완료/진행중/수거완료/완료/취소/보류 |

#### 신규 필드 (DB 컬럼 추가 필요)
```sql
ALTER TABLE rentals 
  ADD COLUMN IF NOT EXISTS payment_status text DEFAULT '미결제',
  ADD COLUMN IF NOT EXISTS deposit_status text DEFAULT '없음',
  ADD COLUMN IF NOT EXISTS inspection_status text DEFAULT '검수전',
  ADD COLUMN IF NOT EXISTS is_exception boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS checklist jsonb DEFAULT '{}';
```

#### 결제상태 / 보증금상태 / 검수상태 / 예외진행
- 상태와 분리된 별도 필드
- 헤더 한 줄에 드롭다운으로 인라인 수정 가능
- 예외 체크 시 "⚠ 계약 미완료 상태로 진행중" 경고 + 리스트에 ⚠ 표시

#### 마일스톤 요약 체크박스
- 계약완료 체크 → 상태 = 렌탈확정
- 배송완료 체크 → 상태 = 배송완료
- 수거완료 체크 → 상태 = 수거완료
- 상태에서 자동 derived (역방향 체크 불가)

#### 단계별 체크리스트 (DB 저장)
| 그룹 | 항목 |
|------|------|
| 계약 | 견적서 발송 / 계약서 서명 / 서류 수령 |
| 배송 | 검수 완료 / 포장 완료 / 발송 완료 / 송장 전달 |
| 반납 | 반납 안내 / 수거 완료 |
| 검수/정산 | 검수 완료 / 보증금 환급 |

- 그룹 전체 완료 시 초록 배경
- **자동 완료**: 검수 완료 + 보증금 환급 동시 체크 → 상태 자동 = 완료

#### 버튼 변경
- 이전: "완료로 변경" 단일 버튼
- 이후: 다음 단계 이동 / 완료 처리 / 보류 / 취소 / 복구(유입으로)

**신규 서버 액션**: `updateRentalChecklist(id, checklist)` — 검수+보증금 자동 완료 포함

**커밋**: `07a975f`

---

## 2026-04-05 세션 (이전 세션 요약)

### QA 보안 수정
- 리드 데이터 누수: `member` 역할은 본인 담당 리드만 조회
- 채널톡 서명 검증: `secret` 설정 시 서명 없으면 401 (fail-closed)
- `/register` 라우트 삭제 (초대 전용 시스템)
- 초대 리다이렉트: `NEXT_PUBLIC_APP_URL` 환경변수 사용
- `UserRole` 타입 통일: `'admin' | 'manager' | 'member'`

### 리드 수정 폼 포커스 해제 버그 수정
- 원인: `LeadForm` 컴포넌트가 `LeadsClient` 함수 안에 정의 → 렌더마다 새 컴포넌트 타입 → 타이핑 시 unmount/remount
- 수정: `LeadForm`을 `LeadsClient` 밖으로 이동

### 소통 내역 인프라 구축
- `project_logs` 테이블 `contacted_at` 컬럼 추가
- RPC 함수 `insert_project_log` 생성 (PostgREST 스키마 캐시 우회용)
- `getSaleLogs`: FK join 제거, profiles 별도 쿼리로 교체
