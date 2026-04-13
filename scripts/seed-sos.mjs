import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://zzstizlyhevulaqatxgp.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp6c3Rpemx5aGV2dWxhcWF0eGdwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDg1Mjk3MiwiZXhwIjoyMDkwNDI4OTcyfQ.m8ZDT3mfMedd9S40wEMeOsqQWj1tdyBcoA-HStGCQQY'
)

// 2025년 공연 데이터 (노션 기반)
const concerts2025 = [
  { month: 7,  concert_date: '7월 3일(목)',   artists: ['부석현', '김민경', '쿠모', '현서', '할순'],             staff: ['조민현'] },
  { month: 7,  concert_date: '7월 7일(월)',   artists: ['성영주', '조은세', '별은', '이동현'],                   staff: ['임지영'] },
  { month: 7,  concert_date: '7월 8일(화)',   artists: ['성영주', '쿠모', '현서', '할순'],   concept: '사연기반', staff: ['조민현'] },
  { month: 7,  concert_date: '7월 10일(목)',  artists: ['성영주', '이동현', '쿠모'],                             staff: ['유제민'] },
  { month: 7,  concert_date: '7월 16일(수)',  artists: ['성영주', '심각한 개구리', 'Chad Burger', '별은', '조은세'], staff: ['임지영'] },
  { month: 10, concert_date: '10월 15일(수)', artists: ['부석현', '김민경', '쿠모'],                             staff: ['조민현'] },
  { month: 10, concert_date: '10월 21일(화)', artists: ['성영주', '김민경', '레다', '심각한 개구리'],             staff: ['임지영'] },
  { month: 10, concert_date: '10월 26일(일)', artists: ['성영주', '김민경', '쿠모', '심각한 개구리'],             staff: ['유제민'] },
  { month: 10, concert_date: '10월 27일(월)', artists: ['성영주', '심각한 개구리', '쿠모', '109'],               staff: ['조민현'] },
  { month: 10, concert_date: '10월 28일(화)', artists: ['성영주', '김민경', '심각한 개구리', '109'],             staff: ['임지영'] },
  { month: 11, concert_date: '11월 10일(월)', artists: ['성영주', '김민경', '109'],                             staff: ['유제민'] },
  { month: 11, concert_date: '11월 20일(목)', artists: ['심각한 개구리', '레다', '109', '현서'],                 staff: ['조민현'] },
  { month: 11, concert_date: '11월 22일(토)', artists: ['레다', '홀린', 'Maji'],                                staff: ['임지영'] },
  { month: 11, concert_date: '11월 27일(목)', artists: ['성영주', '109', '레다'],                               staff: ['유제민'] },
  { month: 12, concert_date: '12월 4일(목)',  artists: ['심각한 개구리', '레다', '109'],                         staff: ['조민현'] },
  { month: 12, concert_date: '12월 19일(금)', artists: ['심각한 개구리', '레다', '109'],                         staff: ['임지영'] },
  { month: 12, concert_date: '12월 23일(화)', artists: ['부석현', '심각한 개구리', '레다', '조은세'],             staff: ['유제민'] },
  { month: 12, concert_date: '12월 26일(금)', artists: ['심각한 개구리', '레다', '109'],                         staff: ['조민현'] },
  { month: 1,  concert_date: '1월 6일(화)',   artists: ['레다', '심각한 개구리', '조은세'],                       staff: ['임지영'], year: 2026 },
]

async function main() {
  console.log('=== SOS 공연 데이터 시드 ===\n')

  const { data: existing, error: readErr } = await supabase
    .from('sos_concerts')
    .select('id')
    .eq('year', 2025)

  if (readErr) {
    console.error('❌ 오류:', readErr.message)
    return
  }

  if (existing && existing.length > 0) {
    console.log(`⚠️  2025년 데이터 이미 ${existing.length}건 있음 — 건너뜁니다`)
    return
  }

  const rows = concerts2025.map(c => ({
    year: c.year ?? 2025,
    month: c.month,
    concert_date: c.concert_date,
    school: '',
    concept: c.concept ?? '',
    mc: '',
    artists: c.artists,
    staff: c.staff,
    stage: '완료',
    tasks_done: 11,
    tasks_total: 11,
    event_info: {},
  }))

  const { error } = await supabase.from('sos_concerts').insert(rows)

  if (error) {
    console.error('❌ 시드 실패:', error.message)
  } else {
    console.log(`✅ 공연 ${rows.length}건 등록 완료`)
    console.log('   * 학교명은 관리 페이지에서 직접 입력해 주세요')
  }
}

main().catch(console.error)
