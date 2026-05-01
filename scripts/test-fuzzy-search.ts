// 사용자 자연어 검색 시나리오 검증 (운영 DB 실제 데이터)
// 실행: npx tsx scripts/test-fuzzy-search.ts

import 'dotenv/config'
import { fuzzyMatch, normalizeForSearch } from '../src/lib/fuzzy-search'

let pass = 0, fail = 0
function ok(name: string, expected: number, actual: number) {
  if (expected === actual) { console.log(`  ✅ ${name}: ${actual}`); pass++ }
  else { console.log(`  ❌ ${name}: 기대 ${expected}, 실제 ${actual}`); fail++ }
}

console.log('━━━ 운영 DB 시뮬레이션 ━━━')

// 운영 데이터 mock (실제 DB에서 발견한 케이스)
const projects = [
  { id: 'p1', name: '260223 용인미르아이밴드캠프', project_number: '26-069', status: '진행중' },
  { id: 'p2', name: '용인 청소년 어울림한마당', project_number: '26-077', status: '진행중' },
  { id: 'p3', name: '평택교육지원청 신규교사연수', project_number: '26-115', status: '진행중' },
  { id: 'p4', name: '안성 수학영재 교실', project_number: '26-100', status: '진행중' },
  { id: 'p5', name: '서울 종로구청 행사', project_number: '26-080', status: '취소' },
]
const activeProjects = projects.filter(p => p.status !== '취소')

// 사용자가 칠 만한 입력 변형 — 실제 사용자 답답함 사례 포함
const scenarios = [
  // 정확 케이스
  { q: '260223 용인미르아이밴드캠프', expected: 1, label: '정확 이름' },
  { q: '26-069', expected: 1, label: '정확 번호' },
  { q: '미르아이', expected: 1, label: '키워드 일부 (정확 ILIKE 통과)' },

  // 사용자가 답답해 한 케이스 — 공백 차이
  { q: '용인 미르아이밴드캠프', expected: 1, label: '공백 추가 (사용자 실제 케이스)' },
  { q: '용인미르아이밴드캠프', expected: 1, label: '공백 없음 정확' },

  // 띄어쓰기 변형
  { q: '용인  미르아이밴드캠프', expected: 1, label: '공백 2개' },
  { q: ' 용인 미르아이밴드캠프 ', expected: 1, label: '앞뒤 공백' },

  // 일부만
  { q: '미르아이밴드', expected: 1, label: '일부분만' },
  { q: '용인 미르', expected: 1, label: '앞 토큰만 (공백)' },
  { q: '밴드캠프', expected: 1, label: '뒤 토큰만' },

  // 토큰 AND
  { q: '용인 밴드', expected: 1, label: '토큰 분리 AND (둘 다 포함되는 1건)' },
  { q: '용인 캠프', expected: 1, label: '토큰 AND' },

  // 토큰 AND 다중 매칭
  { q: '용인', expected: 2, label: '"용인" — 2건 매칭 (사용자 명확화 필요)' },
  { q: '26-', expected: 4, label: '"26-" 모든 active 4건' },

  // 0건 — 정말 없음
  { q: '없는프로젝트XYZ', expected: 0, label: '존재 X' },
  { q: '서울 종로구청', expected: 0, label: '취소 상태 제외 확인' },
]

for (const s of scenarios) {
  // 1차 ILIKE 모방
  const exact = activeProjects.filter(p =>
    p.name.toLowerCase().includes(s.q.toLowerCase()) ||
    (p.project_number ?? '').toLowerCase().includes(s.q.toLowerCase())
  )

  let result = exact
  if (result.length === 0) {
    const fb = fuzzyMatch(activeProjects, s.q, ['name', 'project_number'])
    result = fb.matched
  }

  ok(s.label + ` "${s.q}"`, s.expected, result.length)
}

console.log('\n━━━ Worker 검색 시나리오 ━━━')
const workers = [
  { id: 'w1', name: '서림석', phone: '010-2927-6115' },
  { id: 'w2', name: '홍길동 강사', phone: '010-1111-2222' },
  { id: 'w3', name: '김 선생', phone: '010-3333-4444' },
]
const wScenarios = [
  { q: '서림석', expected: 1, label: '정확' },
  { q: '서 림석', expected: 1, label: '이상한 공백' },
  { q: '서림', expected: 1, label: '일부' },
  { q: '홍길동', expected: 1, label: '강사 단어 빠진 것' },
  { q: '김선생', expected: 1, label: '공백 차이' },
  { q: '010-2927', expected: 1, label: '전화 일부' },
  { q: '없음', expected: 0, label: '없음' },
]
for (const s of wScenarios) {
  const exact = workers.filter(w =>
    w.name.toLowerCase().includes(s.q.toLowerCase()) ||
    w.phone.includes(s.q)
  )
  let result = exact
  if (result.length === 0) {
    const fb = fuzzyMatch(workers, s.q, ['name', 'phone'])
    result = fb.matched
  }
  ok(s.label + ` "${s.q}"`, s.expected, result.length)
}

console.log('\n━━━ 정규화 헬퍼 ━━━')
const normTests: [string, string][] = [
  ['용인 미르아이밴드캠프', '용인미르아이밴드캠프'],
  ['26-069', '26069'],
  ['  공백   ', '공백'],
  ['ABC, 123 (test)', 'abc123test'],
]
for (const [input, expected] of normTests) {
  const actual = normalizeForSearch(input)
  if (actual === expected) { console.log(`  ✅ "${input}" → "${actual}"`); pass++ }
  else { console.log(`  ❌ "${input}" → 기대 "${expected}", 실제 "${actual}"`); fail++ }
}

console.log(`\n━━━ 결과: ${pass} 통과 / ${fail} 실패 ━━━`)
process.exit(fail > 0 ? 1 : 0)
