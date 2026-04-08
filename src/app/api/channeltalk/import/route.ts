import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export const maxDuration = 300 // 최대 5분

const CT_BASE = 'https://api.channel.io/open/v5'

function ctHeaders() {
  return {
    'x-access-key': process.env.CHANNELTALK_ACCESS_KEY!,
    'x-access-secret': process.env.CHANNELTALK_ACCESS_SECRET!,
  }
}

function normalizePhone(raw: string): string {
  if (!raw) return ''
  // +82101234567 → 010-1234-567 → 01012345678
  return raw.replace(/^(\+82|0082)/, '0').replace(/[\s\-().]/g, '')
}

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
        console.error('[CT import] user-chats fetch failed:', res.status, await res.text())
        break
      }

      const data = await res.json()
      // 채널톡 응답: users 배열이 top-level에 있음
      const users: any[] = data.users ?? []
      for (const u of users) {
        if (u?.id) userMap.set(String(u.id), u)
      }

      cursor = data.next || undefined
      if (!cursor || (data.userChats ?? []).length === 0) keepGoing = false

      // Rate limit 보호 (100 token bucket, 10/sec)
      await new Promise(r => setTimeout(r, 300))
    }
  }

  return Array.from(userMap.values())
}

export async function POST(req: NextRequest) {
  // 인증: admin/manager만 허용
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
    let created = 0, updated = 0, skipped = 0

    for (const ctUser of ctUsers) {
      const prof = ctUser.profile ?? ctUser
      const name  = (prof.name  || ctUser.name  || '').trim()
      const phone = normalizePhone(prof.mobileNumber || prof.phone || '')
      const email = (prof.email || ctUser.email || '').trim().toLowerCase()
      const ctId  = String(ctUser.id)

      if (!name && !phone && !email) { skipped++; continue }

      // 기존 person 찾기 (우선순위: channeltalk_user_id → 전화 → 이메일)
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
        updated++
      } else {
        if (!name) { skipped++; continue }
        await admin.from('persons').insert({ ...patch, name })
        created++
      }
    }

    return NextResponse.json({ success: true, total: ctUsers.length, created, updated, skipped })
  } catch (e: any) {
    console.error('[CT import] error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
