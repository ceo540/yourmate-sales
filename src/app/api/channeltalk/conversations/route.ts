import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const CT_BASE = 'https://api.channel.io/open/v5'

function ctHeaders() {
  return {
    'x-access-key': process.env.CHANNELTALK_ACCESS_KEY!,
    'x-access-secret': process.env.CHANNELTALK_ACCESS_SECRET!,
  }
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ctUserId = req.nextUrl.searchParams.get('userId')
  if (!ctUserId) return NextResponse.json({ error: 'userId required' }, { status: 400 })

  try {
    // 이 고객의 채팅 목록
    const chatsRes = await fetch(
      `${CT_BASE}/users/${ctUserId}/user-chats?limit=10&sortOrder=desc`,
      { headers: ctHeaders(), cache: 'no-store' }
    )
    if (!chatsRes.ok) {
      return NextResponse.json({ error: `채널톡 API 오류: ${chatsRes.status}` }, { status: 502 })
    }

    const chatsData = await chatsRes.json()
    const userChats: any[] = chatsData.userChats ?? []

    // 각 채팅의 메시지 가져오기 (최근 5개 채팅만)
    const conversations = await Promise.all(
      userChats.slice(0, 5).map(async (chat: any) => {
        const msgRes = await fetch(
          `${CT_BASE}/user-chats/${chat.id}/messages?limit=50&sortOrder=asc`,
          { headers: ctHeaders(), cache: 'no-store' }
        )
        const msgData = msgRes.ok ? await msgRes.json() : {}
        const messages = (msgData.messages ?? [])
          .map((m: any) => ({
            id: m.id,
            text: m.plainText || m.content?.plainText || '',
            personType: m.personType, // 'user' | 'manager' | 'bot'
            createdAt: m.createdAt,
          }))
          .filter((m: any) => m.text.trim())

        return {
          id: chat.id,
          state: chat.state,
          createdAt: chat.createdAt,
          updatedAt: chat.updatedAt,
          messages,
        }
      })
    )

    return NextResponse.json({ conversations })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
