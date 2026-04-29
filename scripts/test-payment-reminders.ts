// 로컬에서 payment-reminders dry-run 실행 → 결과 출력
// 실행: tsx scripts/test-payment-reminders.ts [today=YYYY-MM-DD]
import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })

async function main() {
  const todayArg = process.argv[2]
  const { runPaymentReminders } = await import('../src/lib/payment-reminders')
  const result = await runPaymentReminders({
    dryRun: true,
    ...(todayArg ? { todayKst: todayArg } : {}),
  })
  console.log(JSON.stringify(result, null, 2))
}

main().catch(e => { console.error(e); process.exit(1) })
