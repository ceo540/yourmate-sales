import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://zzstizlyhevulaqatxgp.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp6c3Rpemx5aGV2dWxhcWF0eGdwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDg1Mjk3MiwiZXhwIjoyMDkwNDI4OTcyfQ.m8ZDT3mfMedd9S40wEMeOsqQWj1tdyBcoA-HStGCQQY'
)

// 2025년 공연 데이터 (노션 "공연 학교 리스트" 테이블 기반)
const concerts2025 = [
  { concert_date: '7월 3일(목)', school: '', concept: '', artists: '부석현, 김민경, 쿠모, 현서, 할순', notes: '답사 필요, 동의서 필요', status: '완료' },
  { concert_date: '7월 7일(월)', school: '', concept: '', artists: '성영주, 조은세, 별은, 이동현', notes: '', status: '완료' },
  { concert_date: '7월 8일(화)', school: '', concept: '사연기반', artists: '성영주, 김예안, 현서, 할순, 쿠모', notes: '', status: '완료' },
  { concert_date: '7월 10일(목)', school: '', concept: '', artists: '성영주, 이운희, 쿠모, 유제민', notes: '계획안, 동의서 필요', status: '완료' },
  { concert_date: '7월 16일(수)', school: '', concept: '', artists: '성영주, 심각한 개구리, Chad Burger, 별은, 조은세', notes: '', status: '완료' },
  { concert_date: '10월 15일(수)', school: '', concept: '', artists: '부석현, 김민경, 모스트, 쿠모', notes: '동의서 필요', status: '완료' },
  { concert_date: '10월 21일(화)', school: '', concept: '', artists: '성영주, 김민경, 레다, 심각한개구리', notes: '', status: '완료' },
  { concert_date: '10월 26일(일)', school: '', concept: '', artists: '성영주, 김민경, 쿠모, 심각한 개구리', notes: '', status: '완료' },
  { concert_date: '10월 27일(월)', school: '', concept: '', artists: '성영주, 심각한 개구리, 쿠모, 109', notes: '', status: '완료' },
  { concert_date: '10월 28일(화)', school: '', concept: '', artists: '성영주, 김민경, 심각한 개구리, 109', notes: '동의서 필요', status: '완료' },
  { concert_date: '11월 10일(월)', school: '', concept: '', artists: '성영주, 김민경, 109', notes: '', status: '완료' },
  { concert_date: '11월 20일(목)', school: '', concept: '', artists: '심각한 개구리, 레다, 109, 현서', notes: '동의서 필요', status: '완료' },
  { concert_date: '11월 22일(토)', school: '', concept: '', artists: '레다, 홀린, Maji', notes: '', status: '완료' },
  { concert_date: '11월 27일(목)', school: '', concept: '', artists: '성영주, 109, 레다', notes: '', status: '완료' },
  { concert_date: '12월 4일(목)', school: '', concept: '', artists: '심각한 개구리, 레다, 109', notes: '', status: '완료' },
  { concert_date: '12월 19일(금)', school: '', concept: '', artists: '심각한 개구리, 레다, 109', notes: '행정 서류 작성 필요', status: '완료' },
  { concert_date: '12월 23일(화)', school: '', concept: '', artists: '부석현, 심각한 개구리, 레다, 조은세', notes: '', status: '완료' },
  { concert_date: '12월 26일(금)', school: '', concept: '', artists: '심각한 개구리, 레다, 109', notes: '', status: '완료' },
  { concert_date: '1월 6일(화)', school: '', concept: '', artists: '레다, 심각한 개구리, 조은세', notes: '', status: '완료' },
]

async function main() {
  console.log('=== SOS 공연 데이터 시드 ===\n')

  // 기존 데이터 확인
  const { data: existing, error: readErr } = await supabase
    .from('sos_concerts')
    .select('id')
    .eq('year', 2025)

  if (readErr) {
    console.error('❌ 테이블 없음 — Supabase Dashboard > SQL Editor에서 scripts/setup-sos.sql 먼저 실행하세요')
    console.error(readErr.message)
    return
  }

  if (existing && existing.length > 0) {
    console.log(`⚠️  2025년 데이터 이미 ${existing.length}건 있음 — 건너뜁니다`)
    return
  }

  const rows = concerts2025.map(c => ({ ...c, year: 2025 }))
  const { error } = await supabase.from('sos_concerts').insert(rows)

  if (error) {
    console.error('❌ 시드 실패:', error.message)
  } else {
    console.log(`✅ 2025년 공연 ${rows.length}건 등록 완료`)
    console.log('   * 학교명은 노션에서 확인 후 직접 입력해 주세요')
  }
}

main().catch(console.error)
