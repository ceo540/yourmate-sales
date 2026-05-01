// 외부 인력 헬퍼 검증 (운영 영향 0)
import {
  computeEngagementAmount,
  computeMonthlyPayment,
  computeWorkerRating,
  suggestReuseStatus,
  detectRateVariation,
  isPayableWorker,
  generateTaxHandoffRows,
} from '../src/lib/external-workers'
import type { ExternalWorker, WorkerEngagement } from '../src/types'

let pass = 0, fail = 0
function ok(name: string, expected: unknown, actual: unknown, tolerance = 0.01) {
  const eq = typeof expected === 'number' && typeof actual === 'number'
    ? Math.abs(expected - actual) < tolerance
    : JSON.stringify(expected) === JSON.stringify(actual)
  if (eq) { console.log(`  ✅ ${name}`); pass++ }
  else { console.log(`  ❌ ${name}: 기대 ${JSON.stringify(expected)}, 실제 ${JSON.stringify(actual)}`); fail++ }
}

console.log('\n━━━ computeEngagementAmount ━━━')
ok('per_hour 4시간×100,000 = 400,000', 400000, computeEngagementAmount({ rate_type: 'per_hour', rate: 100000, hours: 4 }))
ok('per_session 1회 200,000', 200000, computeEngagementAmount({ rate_type: 'per_session', rate: 200000, hours: null }))
ok('per_project 500,000', 500000, computeEngagementAmount({ rate_type: 'per_project', rate: 500000, hours: null }))
ok('rate 0 = 0', 0, computeEngagementAmount({ rate_type: 'per_hour', rate: 0, hours: 10 }))

console.log('\n━━━ computeMonthlyPayment ━━━')
const baseEngagements: WorkerEngagement[] = [
  { id: 'E1', worker_id: 'W1', project_id: 'P1', role: '강사', date_start: '2026-04-10', date_end: null, hours: 4, rate_type: 'per_hour', rate: 100000, amount: 400000, note: null, archive_status: 'active', created_at: '' },
  { id: 'E2', worker_id: 'W1', project_id: 'P2', role: '강사', date_start: '2026-04-25', date_end: null, hours: null, rate_type: 'per_session', rate: 200000, amount: 200000, note: null, archive_status: 'active', created_at: '' },
  { id: 'E3', worker_id: 'W1', project_id: 'P1', role: '강사', date_start: '2026-05-01', date_end: null, hours: 2, rate_type: 'per_hour', rate: 100000, amount: 200000, note: null, archive_status: 'active', created_at: '' },
  { id: 'E4', worker_id: 'W1', project_id: 'P3', role: '취소', date_start: '2026-04-15', date_end: null, hours: 4, rate_type: 'per_hour', rate: 100000, amount: 400000, note: null, archive_status: 'cancelled', created_at: '' },
]
const apr = computeMonthlyPayment({ worker: { id: 'W1' } as ExternalWorker, engagements: baseEngagements, yearMonth: '2026-04' })
ok('4월 합계 = 400k + 200k = 600k', 600000, apr.total)
ok('4월 engagement 2건 (취소 제외)', 2, apr.count)
ok('4월 engagement_ids = [E1, E2]', ['E1', 'E2'], apr.engagement_ids)

const may = computeMonthlyPayment({ worker: { id: 'W1' } as ExternalWorker, engagements: baseEngagements, yearMonth: '2026-05' })
ok('5월 합계 = 200k', 200000, may.total)

console.log('\n━━━ computeWorkerRating ━━━')
ok('완벽 worker 5.0', 5.0,
  computeWorkerRating({ total_engagements: 10, completed_count: 10, payment_disputes: 0, pm_rating: 5, client_feedback_score: 5 }))

ok('평균 worker', 2.5,
  computeWorkerRating({ total_engagements: 0, completed_count: 0, payment_disputes: 0, pm_rating: null, client_feedback_score: null }))

console.log('\n━━━ suggestReuseStatus ━━━')
ok('4.5 → preferred', 'preferred', suggestReuseStatus(4.5))
ok('3.0 → normal', 'normal', suggestReuseStatus(3.0))
ok('1.5 → avoid', 'avoid', suggestReuseStatus(1.5))
ok('4.0 → preferred (경계)', 'preferred', suggestReuseStatus(4.0))
ok('2.0 → normal (경계)', 'normal', suggestReuseStatus(2.0))

console.log('\n━━━ detectRateVariation ━━━')
const stableRates: WorkerEngagement[] = [
  { ...baseEngagements[0], rate: 100000 },
  { ...baseEngagements[2], rate: 100000 },
]
const stable = detectRateVariation(stableRates)
ok('단가 동일 → isStable=true', true, stable.isStable)
ok('mostCommon = 100000', 100000, stable.mostCommon)

const variableRates: WorkerEngagement[] = baseEngagements
const variable = detectRateVariation(variableRates)
ok('단가 변동 → isStable=false', false, variable.isStable)

console.log('\n━━━ isPayableWorker ━━━')
const fullyPayable: ExternalWorker = {
  id: 'W1', name: '홍길동', type: '강사',
  phone: null, email: null,
  ssn_text: '000000-0000000', bank_name: '국민', bank_account_text: '123-456-789',
  id_card_url: null, bank_book_url: 'https://dropbox.com/...',
  default_rate_type: null, default_rate: null, specialties: null, notes: null,
  rating: null, evaluation_notes: null, reuse_status: 'normal',
  first_engaged_at: null, last_engaged_at: null, total_engagements: 0, total_paid: 0,
  archive_status: 'active', created_at: '', updated_at: '',
}
const r1 = isPayableWorker(fullyPayable)
ok('필수 다 있으면 payable=true', true, r1.payable)
ok('missing 0건', 0, r1.missing.length)

const missingDocs: ExternalWorker = { ...fullyPayable, ssn_text: null, bank_book_url: null }
const r2 = isPayableWorker(missingDocs)
ok('주민번호·통장 누락 → payable=false', false, r2.payable)
ok('missing 2건', 2, r2.missing.length)

console.log('\n━━━ generateTaxHandoffRows ━━━')
{
  const w1: ExternalWorker = { ...fullyPayable, id: 'W1', name: '서림석', ssn_text: '900101-1234567', bank_account_text: '국민 123-456' }
  const w2: ExternalWorker = { ...fullyPayable, id: 'W2', name: '홍길동', ssn_text: null, bank_account_text: '신한 789-012' }
  const r = generateTaxHandoffRows({
    payments: [
      { worker_id: 'W1', total_amount: 600000, note: '4월 묶음' },
      { worker_id: 'W2', total_amount: 300000, note: '4월 묶음' },
    ],
    workers: [w1, w2],
  })
  ok('헤더 6개', 6, r.headers.length)
  ok('rows 2건', 2, r.rows.length)
  ok('총합 900,000', 900000, r.total)
  ok('서림석 첫 행 이름', '서림석', r.rows[0][0])
  ok('서림석 주민번호', '900101-1234567', r.rows[0][1])
  ok('서림석 금액 600k', 600000, r.rows[0][3])
  ok('서림석 구분 = 인건비', '인건비', r.rows[0][4])
  ok('홍길동 ssn 누락 → "(누락)"', '(누락)', r.rows[1][1])
  ok('warnings에 홍길동 누락 표시', true, r.warnings.some(w => w.includes('홍길동') && w.includes('주민')))
}

console.log(`\n━━━ 결과: ${pass} 통과 / ${fail} 실패 ━━━`)
process.exit(fail > 0 ? 1 : 0)
