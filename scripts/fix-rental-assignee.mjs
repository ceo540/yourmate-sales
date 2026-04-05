import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://zzstizlyhevulaqatxgp.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp6c3Rpemx5aGV2dWxhcWF0eGdwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDg1Mjk3MiwiZXhwIjoyMDkwNDI4OTcyfQ.m8ZDT3mfMedd9S40wEMeOsqQWj1tdyBcoA-HStGCQQY'
)

async function main() {
  // 조민현 ID 조회
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, name')
    .eq('name', '조민현')
    .single()

  if (profileError || !profile) {
    console.error('조민현 프로필 없음:', profileError)
    return
  }
  console.log(`조민현 ID: ${profile.id}`)

  // 전체 렌탈 담당자 → 조민현
  const { data, error } = await supabase
    .from('rentals')
    .update({ assignee_id: profile.id })
    .neq('id', '00000000-0000-0000-0000-000000000000') // 전체

  if (error) {
    console.error('업데이트 실패:', error.message)
  } else {
    console.log('✅ 전체 렌탈 담당자 → 조민현 완료')
  }

  // 확인
  const { data: rentals } = await supabase
    .from('rentals')
    .select('customer_name, assignee_id')
    .order('created_at')

  const notJoMinHyun = rentals?.filter(r => r.assignee_id !== profile.id)
  console.log(`전체: ${rentals?.length}건 | 조민현 외: ${notJoMinHyun?.length}건`)
}

main().catch(console.error)
