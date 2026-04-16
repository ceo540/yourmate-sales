// 채널톡 고객 채팅 이벤트 웹훅
// 채널톡 설정 → 연동 → 웹훅 → URL: https://yourmate.vercel.app/api/channeltalk/customer
// 이벤트: userChat (새 고객 채팅 시작 시 자동 persons 등록)

import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

function normalizePhone(raw: string): string {
  if (!raw) return ''
  return raw.replace(/^(\+82|0082)/, '0').replace(/[\s\-().]/g, '')
}

export async function POST(req: NextRequest) {
  const body = await req.text()

  // 서명 검증 — CHANNELTALK_ACCESS_SECRET 설정 시 fail-closed
  const secret = process.env.CHANNELTALK_ACCESS_SECRET
  if (secret) {
    const signature = req.headers.get('x-channel-signature') || req.headers.get('x-signature') || ''
    if (!signature) {
      return NextResponse.json({ error: 'missing signature' }, { status: 401 })
    }
    const expected = crypto.createHmac('sha256', secret).update(body).digest('hex')
    if (signature !== expected && signature !== `sha256=${expected}`) {
      return NextResponse.json({ error: 'invalid signature' }, { status: 401 })
    }
  }

  let payload: any
  try {
    payload = JSON.parse(body)
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }

  // 디버깅: 어떤 이벤트가 오는지 로그 (Vercel 로그에서 확인)
  const entity = payload?.entity ?? payload?.refers?.userChats?.[0] ?? {}
  const entityType = entity?.type ?? payload?.type ?? ''
  console.log('[CT customer webhook] type:', entityType, '| entity keys:', Object.keys(entity).join(','))

  // 사용자 정보 추출 (채널톡 웹훅 payload 형식에 따라 여러 경로 시도)
  const refers = payload?.refers ?? {}

  // Case 1: refers.users 안에 있는 경우
  let ctUser: any = null
  const personId = entity?.personId ?? entity?.userId
  if (personId && refers.users) {
    ctUser = refers.users[personId] ?? Object.values(refers.users)[0]
  }
  // Case 2: entity 자체에 user 정보가 있는 경우
  if (!ctUser && entity?.user) ctUser = entity.user
  // Case 3: payload 최상위에 user 있는 경우
  if (!ctUser && payload?.user) ctUser = payload.user

  if (!ctUser) {
    console.log('[CT customer webhook] no user info found, raw payload:', JSON.stringify(payload).slice(0, 500))
    return NextResponse.json({ result: 'no user info' })
  }

  const prof = ctUser.profile ?? ctUser
  const name  = (prof.name  || ctUser.name  || '').trim()
  const phone = normalizePhone(prof.mobileNumber || prof.phone || '')
  const email = (prof.email || ctUser.email || '').trim().toLowerCase()
  const ctId  = String(ctUser.id || personId || '')

  if (!ctId || (!name && !phone && !email)) {
    return NextResponse.json({ result: 'insufficient user data' })
  }

  const admin = createAdminClient()

  // 기존 person 찾기
  let existingId: string | null = null

  const { data: byCtId } = await admin.from('persons')
    .select('id').eq('channeltalk_user_id', ctId).maybeSingle()
  if (byCtId) existingId = byCtId.id

  if (!existingId && phone) {
    const { data: byPhone } = await admin.from('persons')
      .select('id').eq('phone', phone).maybeSingle()
    if (byPhone) existingId = byPhone.id
  }

  if (!existingId && email) {
    const { data: byEmail } = await admin.from('persons')
      .select('id').ilike('email', email).maybeSingle()
    if (byEmail) existingId = byEmail.id
  }

  const patch: Record<string, string> = { channeltalk_user_id: ctId }
  if (name)  patch.name  = name
  if (phone) patch.phone = phone
  if (email) patch.email = email

  if (existingId) {
    await admin.from('persons').update(patch).eq('id', existingId)
    console.log('[CT customer webhook] updated person:', existingId)
  } else if (name) {
    await admin.from('persons').insert({ ...patch, name })
    console.log('[CT customer webhook] created person:', name)
  }

  return NextResponse.json({ result: 'ok' })
}
