// urgency-score 자가 검증
import { calculateUrgencyScore } from '../src/lib/urgency-score'

let pass = 0, fail = 0
function expect(name: string, expected: string, actual: string) {
  if (expected === actual) { console.log(`  ✅ ${name}: ${actual}`); pass++ }
  else { console.log(`  ❌ ${name}: 기대 ${expected}, 실제 ${actual}`); fail++ }
}

const today = new Date()
const fmt = (d: Date) => d.toISOString().slice(0, 10)
const days = (n: number) => fmt(new Date(today.getTime() + n * 86_400_000))

console.log('━━━ urgency-score ━━━')

// Critical
const r1 = calculateUrgencyScore({ due_date: days(-3), amount: 50_000_000, customer_priority: 'high' })
expect('지난 3일 + 5천만 + 우선 → critical', 'critical', r1.level)

const r2 = calculateUrgencyScore({ due_date: days(0), amount: 30_000_000, response_delay_days: 10 })
expect('D-day + 3천만 + 10일 지연 → critical', 'critical', r2.level)

// High
const r3 = calculateUrgencyScore({ due_date: days(2), amount: 10_000_000 })
expect('D-2 + 1천만 → high', 'high', r3.level)

// Medium
const r4 = calculateUrgencyScore({ due_date: days(7), amount: 5_000_000 })
expect('D-7 + 5백만 → medium', 'medium', r4.level)

// Low
const r5 = calculateUrgencyScore({ due_date: days(20), amount: 1_000_000 })
expect('D-20 + 백만 → low', 'low', r5.level)

const r6 = calculateUrgencyScore({})
expect('빈 입력 → low', 'low', r6.level)

console.log(`\n━━━ ${pass} 통과 / ${fail} 실패 ━━━`)
process.exit(fail > 0 ? 1 : 0)
