# 유어메이트 사내 시스템 - 개발 규칙

## Supabase 규칙

### ❌ FK join 쿼리 절대 금지
이 프로젝트의 Supabase에는 FK 제약(Foreign Key)이 설정되어 있지 않다.
PostgREST join 문법(`assignee:profiles(id, name)`, `entity:business_entities(id, name)` 등)은 **반드시 실패**한다.

```typescript
// ❌ 잘못된 방법 — FK join
supabase.from('sales').select('*, assignee:profiles(id, name)')

// ✅ 올바른 방법 — 별도 쿼리 + JS 수동 조인
const { data: sales } = await supabase.from('sales').select('*')
const { data: profiles } = await supabase.from('profiles').select('id, name')
const profileMap = Object.fromEntries(profiles.map(p => [p.id, p]))
const result = sales.map(s => ({ ...s, assignee: profileMap[s.assignee_id] ?? null }))
```

### ❌ profile 조회에 일반 클라이언트 사용 금지
`createClient()`(서버 클라이언트)로 profiles 테이블 조회 시 RLS로 인해 null 반환될 수 있다.
profile 조회는 반드시 `createAdminClient()` 사용.

```typescript
// ❌ 잘못된 방법
const supabase = await createClient()
const { data: profile } = await supabase.from('profiles').select('id, role').eq('id', userId).single()

// ✅ 올바른 방법
const adminSupabase = createAdminClient()
const { data: profile } = await adminSupabase.from('profiles').select('id, role').eq('id', userId).single()
```

---

## Next.js / React 규칙

### ❌ 테이블 행 내부에서 <a href> 사용 금지
테이블 `<tr>`에 onClick이 있을 때 내부 `<a href>`는 부모 이벤트에 막혀 동작하지 않는다.

```typescript
// ❌ 잘못된 방법
<a href={`/sales/${id}`}>업무 관리</a>

// ✅ 올바른 방법
<button onClick={e => { e.stopPropagation(); router.push(`/sales/${id}`) }}>
  업무 관리
</button>
```

---

## Server Actions (revalidatePath) 규칙

### 업무(tasks) 관련 액션은 두 경로 모두 revalidate
```typescript
revalidatePath(`/sales/${saleId}`)
revalidatePath('/tasks')
```

---

## 배포 규칙

- npm 명령어는 반드시 `/Users/junyoungbang/yourmate-system` 경로에서 실행
- 배포 명령어: `npx vercel deploy --prod` (해당 경로에서)
- 배포 전 반드시 `npx next build`로 빌드 확인

---

## 프로젝트 구조 규칙

- **매출 건 = 프로젝트**: 모든 업무(task)는 반드시 sale_id에 연결
- **권한 분기**: `createAdminClient()`로 role 조회 후 `isAdmin = role === 'admin' || role === 'manager'`
- **isAdmin**: 추가/삭제/수정 버튼 제어에만 사용. 데이터 조회는 모든 사용자 허용.
