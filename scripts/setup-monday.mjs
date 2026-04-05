import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://zzstizlyhevulaqatxgp.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp6c3Rpemx5aGV2dWxhcWF0eGdwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDg1Mjk3MiwiZXhwIjoyMDkwNDI4OTcyfQ.m8ZDT3mfMedd9S40wEMeOsqQWj1tdyBcoA-HStGCQQY'
)

async function main() {
  console.log('=== 유어메이트 시스템 월요일 셋업 ===\n')

  // 1. 전체 프로필 조회
  const { data: profiles } = await supabase.from('profiles').select('id, name, role, join_date')
  console.log('── 직원 현황 ──')
  profiles?.forEach(p => console.log(`  ${p.name} | role: ${p.role ?? '미설정'} | 입사일: ${p.join_date ?? '미설정'}`))

  const find = (name) => profiles?.find(p => p.name === name)
  const 유제민 = find('유제민')
  const 조민현 = find('조민현')
  const 임지영 = find('임지영')
  const 정태영 = find('정태영')
  const 김수아 = find('김수아')
  const 방준영 = find('방준영')

  console.log('\n── 렌탈 현황 ──')
  const { data: rentals } = await supabase.from('rentals').select('id, customer_name, assignee_id, status').order('created_at')
  const noAssignee = rentals?.filter(r => !r.assignee_id)
  console.log(`  전체: ${rentals?.length}건 | 담당자 미배정: ${noAssignee?.length}건`)

  // 2. 근무 스케줄 설정
  console.log('\n── 근무 스케줄 설정 ──')
  const names = ['방준영', '임지영', '정태영', '조민현', '김수아', '유제민']
  for (const name of names) {
    const { error } = await supabase
      .from('employee_work_schedules')
      .upsert({ employee_name: name, work_start: '09:00', work_end: '18:00' }, { onConflict: 'employee_name' })
    console.log(`  ${name}: ${error ? '❌ ' + error.message : '✅'}`)
  }

  // 3. 렌탈 담당자 미배정 건 → 유제민/조민현 절반씩
  if (noAssignee && noAssignee.length > 0 && 유제민 && 조민현) {
    console.log('\n── 렌탈 담당자 연결 ──')
    const half = Math.ceil(noAssignee.length / 2)
    for (let i = 0; i < noAssignee.length; i++) {
      const assignee = i < half ? 유제민 : 조민현
      const { error } = await supabase
        .from('rentals')
        .update({ assignee_id: assignee.id })
        .eq('id', noAssignee[i].id)
      console.log(`  ${noAssignee[i].customer_name} → ${assignee.name}: ${error ? '❌ ' + error.message : '✅'}`)
    }
  } else {
    console.log('\n── 렌탈 담당자: 이미 모두 배정됨 ──')
  }

  // 4. leave_balances 확인
  console.log('\n── 연차 초기값 ──')
  const { data: balances } = await supabase.from('leave_balances').select('member_id, year, initial_days')
  const profileMap = Object.fromEntries((profiles ?? []).map(p => [p.id, p.name]))
  balances?.forEach(b => console.log(`  ${profileMap[b.member_id] ?? b.member_id}: ${b.initial_days}일 (${b.year}년)`))

  // 5. 리드 담당자 미배정 건 수
  console.log('\n── 리드 담당자 현황 ──')
  const { data: leads } = await supabase.from('leads').select('id, client_org, assignee_id, status').neq('status', '취소')
  const noLeadAssignee = leads?.filter(l => !l.assignee_id)
  console.log(`  전체: ${leads?.length}건 | 담당자 미배정: ${noLeadAssignee?.length}건`)
  noLeadAssignee?.forEach(l => console.log(`    - ${l.client_org} (${l.status})`))

  console.log('\n✅ 완료')
}

main().catch(console.error)
