# 고객 DB 정합화 — Step 4-2 매핑 계획서 (2026-04-29 분석)

빵빵이 + match_sale_to_customer / merge_customers / quick_create_customer 호출 시 참조용.

## 전체 상태 요약

| 대상 | NULL 건수 | 자동 매칭 가능 | 수동 판단 |
|---|---:|---:|---:|
| sales | 55 | 6 | 49 |
| leads | 74 | 39 | 35 |
| **합계** | **129** | **45** | **84** |

---

## A. 자동 매칭 — 검토 후 일괄 실행 가능

### A-1. sales 6건 (client_org 정확 일치)

빵빵이에게 한 건씩 또는 일괄 요청:

| sale_id | 건명 | → customer |
|---|---|---|
| a22df0a2 | 민숙현 교구대여 | 민숙현 |
| b4daabc7 | 보인중학교 (리드전환) | 보인중학교 |
| 6a66a628 | 경기도특수교육원 진로직업페스티벌(진드페) 행사 운영 | 경기도교육청 특수교육원 |
| 99154e23 | 260331 용인교육지원청 수첩제작 | 용인교육지원청 |
| ceeda189 | 260326 미르아이 봉제인형 샘플제작 | 용인교육지원청 |

(나머지 1건은 추가 분석 필요 — 위 코드 기반 분석 시점 기준)

빵빵이 명령 예시:
```
"민숙현 교구대여 sale을 민숙현 customer에 묶어줘"
```

### A-2. leads 39건 (client_org 정확 일치)

빵빵이로 일괄 처리하기엔 많아서, **SQL 한 번이 더 효율적**. 사용자 컨펌 받은 뒤 실행:

```sql
UPDATE leads l
SET customer_id = c.id, updated_at = NOW()
FROM customers c
WHERE l.customer_id IS NULL
  AND LOWER(TRIM(l.client_org)) = LOWER(TRIM(c.name));
-- 39 row(s) updated 예상
```

---

## B. 수동 판단 — 빵빵이 대화로 처리

### B-1. 이화여대 분점 30건 — 도메인 판단 필요

orphan sales의 자유 텍스트 client_org와 customers의 분점 매핑:

| orphan client_org | 건수 | 추천 customer | 비고 |
|---|---:|---|---|
| 이화여대 음악치료 예술교육치료연구소 | 19 | ❓ 신규 분점? | DB에 정확 매칭 없음. 새 customer 만들 거면 quick_create_customer로 "이화여자대학교(음악치료예술교육치료연구소)" 생성 후 매핑 |
| 이화여대 음악교육 프로그램 | 8 | 이화여자대학교(음악교육) | 정확 매핑 가능 |
| 이화뮤직웰니스연구센터 | 3 | 이화여자대학교(이화뮤직웰니스연구센터) | 정확 매핑 가능 |

빵빵이 명령 예시 (8건+3건 부분):
```
"이화여대 음악교육 프로그램 sales 모두 이화여자대학교(음악교육) customer에 묶어줘"
"이화뮤직웰니스연구센터 sales 모두 이화여자대학교(이화뮤직웰니스연구센터)에 묶어줘"
```

19건은 너 판단 — 신규 분점 만들지 / 기존 (음악교육)에 합칠지.

### B-2. 빈값 sales 2건 — 수동 점검

client_org 자체가 NULL. /sales/[id] 페이지로 가서 직접 client_org 채우거나 customer_id 매핑.

| sale_id | 건명 |
|---|---|
| (id 1) | 260306 삼일공고(지지스튜디오) |
| (id 2) | 260306 삼일공고(지지스튜디오) |

→ 이 둘은 "지지스튜디오"를 customer로 신규 등록하거나 삼일공고로.

### B-3. 신규 customer 등록 후 매핑 — 23건

DB에 없는 기관 (sales 23건). 빵빵이 흐름:
1. quick_create_customer({ name }) → customer_id
2. match_sale_to_customer({ sale_id, customer_id })

대상 (수동 판단 필요):
- MBN 동치미팀 (2건) — 기업
- 김선영 / 서원희 / 이준형 / 우진희 (각 1건) — 개인 (교구대여 빌린 사람들)
- 지곡초등학교 (경북 영천) (1)
- 오산 고현초 2차 (1)
- 서울시민대학 (난타북·젬베) (1)
- 서울시민대학 (1) — 위와 같은 곳? 통합?
- 서문여자고등학교 (1)
- 마포청소년문화의집 (1)
- 진건중학교(학교) (1)
- 이천마장중학교 (1)
- 예향교회 (1)
- 방아골종합사회복지관 (1)
- 부산 연일초 2차 / 금정초 2차 / 금강초 (각 1) — 부산 학교들

### B-4. leads 35건 — 빈값(6) + 자유텍스트(29)

자유텍스트: 처음 등장하는 기관 또는 customers와 미세하게 다른 표기. 새 리드 폼이 customer_id 강제하기 전에 만들어진 것들.

빵빵이로 한 건씩:
1. search_customers로 후보 확인
2. 매칭 있으면 match (현재 도구는 sales 전용 — leads는 update_lead로 처리. MCP `update_lead` 도구 활용 가능)
3. 매칭 없으면 quick_create_customer + update_lead

---

## C. 권장 진행 순서

1. **A-1 sales 5건 정확 매칭** — 빵빵이로 즉시 (각 1줄)
2. **B-1 이화 음악교육 8건 + 뮤직웰니스 3건** — 빵빵이로 일괄
3. **B-1 이화 음악치료 19건** — 사용자 판단 (신규 vs 기존)
4. **A-2 leads 39건** — SQL 일괄 (사용자 컨펌)
5. **B-3 sales 23건 + B-4 leads 29건** — 빵빵이로 한 건씩
6. **B-2/빈값 8건** — 사용자 직접 페이지에서 채움

전체 처리 끝나면 → Step 4-3 NOT NULL SQL 실행:
```sql
ALTER TABLE sales ALTER COLUMN customer_id SET NOT NULL;
ALTER TABLE leads ALTER COLUMN customer_id SET NOT NULL;
```
