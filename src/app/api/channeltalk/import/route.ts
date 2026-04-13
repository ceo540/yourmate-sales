import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export const maxDuration = 300

const CT_BASE = 'https://api.channel.io/open/v5'

function ctHeaders() {
  return {
    'x-access-key': process.env.CHANNELTALK_ACCESS_KEY!,
    'x-access-secret': process.env.CHANNELTALK_ACCESS_SECRET!,
  }
}

function normalizePhone(raw: string): string {
  if (!raw) return ''
  return raw.replace(/^(\+82|0082)/, '0').replace(/[\s\-().]/g, '')
}

// ── 이름 파싱: "학교명(담당자명)" 분리 ──────────────────────────
interface ParsedName {
  orgName: string | null
  personName: string | null
}

// 괄호 안이 지명이면 기관명 일부로 처리
const PLACE_PATTERN = /^(서울|부산|대구|인천|광주|대전|울산|세종|수원|성남|고양|용인|부천|안산|안양|남양주|화성|평택|의정부|시흥|파주|김포|광명|군포|하남|오산|이천|안성|구리|의왕|포천|양주|여주|동두천|과천|가평|양평|연천|강남|강서|강북|강동|마포|서초|송파|노원|관악|구로|금천|도봉|동대문|동작|은평|종로|중구|중랑|성북|양천|영등포)[시군구]?$/.test

function parseCtName(raw: string): ParsedName {
  const trimmed = raw.trim()
  const match = trimmed.match(/^(.+?)\((.+?)\)$/)

  if (!match) {
    // 괄호 없음 — 기관명 키워드 포함 여부로 구분
    const isOrg = /학교|교육청|교육지원청|교육원|기관|센터|대학|학원|청$|구청|시청|군청|도청|위원회|재단|협회|법인|병원|의원|어린이집|유치원/.test(trimmed)
    if (isOrg) return { orgName: trimmed, personName: null }
    // 2~5글자 한국어 → 사람 이름
    if (/^[가-힣]{2,5}$/.test(trimmed)) return { orgName: null, personName: trimmed }
    // 그 외 → 기관
    return { orgName: trimmed, personName: null }
  }

  const outer = match[1].trim()
  const inner = match[2].trim()

  // 괄호 안이 지명이면 → 기관명 전체 유지
  const isPlace = /^[가-힣]+(시|군|구|도)$/.test(inner) || PLACE_PATTERN(inner)
  if (isPlace) return { orgName: trimmed, personName: null }

  // 괄호 안이 한국어 이름(2~4글자)이면 → 기관 + 담당자
  if (/^[가-힣]{2,4}$/.test(inner)) return { orgName: outer, personName: inner }

  // 그 외 → 기관명 전체
  return { orgName: trimmed, personName: null }
}

function inferOrgType(name: string): string {
  if (/학교|초등|중학|중등|고등|고교|유치원|어린이집/.test(name)) return '학교'
  if (/교육청|교육지원청|교육원/.test(name)) return '교육청'
  if (/구청|시청|군청|도청|주민센터|공공|행정|복지관/.test(name)) return '공공기관'
  if (/대학|학원/.test(name)) return '기업'
  return '기타'
}

// ── 채널톡 전체 유저 수집 ────────────────────────────────────────
async function fetchAllCtUsers(): Promise<any[]> {
  const userMap = new Map<string, any>()

  for (const state of ['opened', 'closed']) {
    let cursor: string | undefined
    let keepGoing = true

    while (keepGoing) {
      const params = new URLSearchParams({
        state,
        limit: '200',
        sortOrder: 'desc',
        ...(cursor ? { since: cursor } : {}),
      })

      const res = await fetch(`${CT_BASE}/user-chats?${params}`, {
        headers: ctHeaders(),
        cache: 'no-store',
      })

      if (!res.ok) {
        console.error('[CT import] fetch failed:', res.status, await res.text())
        break
      }

      const data = await res.json()
      const users: any[] = data.users ?? []
      for (const u of users) {
        if (u?.id) userMap.set(String(u.id), u)
      }

      cursor = data.next || undefined
      if (!cursor || (data.userChats ?? []).length === 0) keepGoing = false

      await new Promise(r => setTimeout(r, 300))
    }
  }

  return Array.from(userMap.values())
}

// ── 기관 찾기 or 생성 ────────────────────────────────────────────
async function findOrCreateCustomer(
  admin: ReturnType<typeof createAdminClient>,
  orgName: string
): Promise<string | null> {
  // 1) 정확히 일치
  const { data: exact } = await admin.from('customers')
    .select('id').eq('name', orgName).maybeSingle()
  if (exact) return exact.id

  // 2) 포함 검색 (앞 4글자 이상 일치)
  if (orgName.length >= 4) {
    const keyword = orgName.slice(0, 4)
    const { data: similar } = await admin.from('customers')
      .select('id, name').ilike('name', `%${keyword}%`).limit(1).maybeSingle()
    if (similar) return similar.id
  }

  // 3) 없으면 새로 생성
  const type = inferOrgType(orgName)
  const { data: created, error } = await admin.from('customers')
    .insert({ name: orgName, type, status: 'active' })
    .select('id').single()
  if (error) {
    console.error('[CT import] customer insert error:', error.message)
    return null
  }
  return created.id
}

// ── 담당자 찾기 or 생성 ──────────────────────────────────────────
async function findOrCreatePerson(
  admin: ReturnType<typeof createAdminClient>,
  ctId: string,
  personName: string,
  phone: string,
  email: string
): Promise<{ id: string; isNew: boolean } | null> {
  // 1) channeltalk_user_id
  const { data: byCtId } = await admin.from('persons')
    .select('id').eq('channeltalk_user_id', ctId).maybeSingle()
  if (byCtId) return { id: byCtId.id, isNew: false }

  // 2) 전화번호
  if (phone) {
    const { data: byPhone } = await admin.from('persons')
      .select('id').eq('phone', phone).maybeSingle()
    if (byPhone) return { id: byPhone.id, isNew: false }
  }

  // 3) 이메일
  if (email) {
    const { data: byEmail } = await admin.from('persons')
      .select('id').ilike('email', email).maybeSingle()
    if (byEmail) return { id: byEmail.id, isNew: false }
  }

  // 4) 새로 생성
  const insertData: Record<string, string> = { name: personName, channeltalk_user_id: ctId }
  if (phone) insertData.phone = phone
  if (email) insertData.email = email

  const { data: created, error } = await admin.from('persons')
    .insert(insertData).select('id').single()
  if (error) {
    console.error('[CT import] person insert error:', error.message)
    return null
  }
  return { id: created.id, isNew: true }
}

// ── 소속 관계 연결 ───────────────────────────────────────────────
async function ensureRelation(
  admin: ReturnType<typeof createAdminClient>,
  personId: string,
  customerId: string
) {
  const { data: existing } = await admin.from('person_org_relations')
    .select('id').eq('person_id', personId).eq('customer_id', customerId).maybeSingle()
  if (existing) return

  await admin.from('person_org_relations').insert({
    person_id: personId,
    customer_id: customerId,
    is_current: true,
  })
}

// ── POST ─────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: profileRow } = await admin.from('profiles').select('role').eq('id', user.id).single()
  if (!['admin', 'manager'].includes(profileRow?.role || '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const ctUsers = await fetchAllCtUsers()
    let created = 0, updated = 0, linked = 0, skipped = 0

    for (const ctUser of ctUsers) {
      const prof = ctUser.profile ?? ctUser
      const rawName = (prof.name || ctUser.name || '').trim()
      const phone   = normalizePhone(prof.mobileNumber || prof.phone || '')
      const email   = (prof.email || ctUser.email || '').trim().toLowerCase()
      const ctId    = String(ctUser.id)

      if (!rawName && !phone && !email) { skipped++; continue }

      // 이름 파싱
      const { orgName, personName } = parseCtName(rawName)

      // 담당자 이름 결정: personName이 없으면 rawName 그대로 사용
      const finalPersonName = personName || rawName

      if (!finalPersonName && !phone && !email) { skipped++; continue }

      // 담당자 찾기/생성
      const personResult = await findOrCreatePerson(admin, ctId, finalPersonName, phone, email)
      if (!personResult) { skipped++; continue }

      const { id: personId, isNew } = personResult

      // channeltalk_user_id + 정보 업데이트
      const patch: Record<string, string> = { channeltalk_user_id: ctId }
      if (finalPersonName) patch.name = finalPersonName
      if (phone) patch.phone = phone
      if (email) patch.email = email
      await admin.from('persons').update(patch).eq('id', personId)

      if (isNew) created++; else updated++

      // 기관 처리 (orgName이 있을 때만)
      if (orgName) {
        const customerId = await findOrCreateCustomer(admin, orgName)
        if (customerId) {
          await ensureRelation(admin, personId, customerId)
          linked++
        }
      }
    }

    return NextResponse.json({
      success: true,
      total: ctUsers.length,
      created,
      updated,
      linked,
      skipped,
    })
  } catch (e: any) {
    console.error('[CT import] error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
