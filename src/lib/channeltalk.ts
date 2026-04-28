import { SERVICE_TO_GROUP } from './services'

const CT_BASE = 'https://api.channel.io/open/v5'

function ctHeaders() {
  return {
    'x-access-key': process.env.CHANNELTALK_ACCESS_KEY!,
    'x-access-secret': process.env.CHANNELTALK_ACCESS_SECRET!,
    'Content-Type': 'application/json',
  }
}

export const DEFAULT_GROUP = '395641' // 0_YOURMATE_OFFICIAL (기타/유어메이트)

export async function sendGroupMessage(groupId: string, text: string) {
  const key = process.env.CHANNELTALK_ACCESS_KEY
  const secret = process.env.CHANNELTALK_ACCESS_SECRET
  if (!key || !secret) return

  const cleanId = groupId.startsWith('group-') ? groupId.replace('group-', '') : groupId
  const url = `${CT_BASE}/groups/${cleanId}/messages`

  const res = await fetch(url, {
    method: 'POST',
    headers: ctHeaders(),
    body: JSON.stringify({
      plainText: text,
      blocks: [{ type: 'text', value: text }],
    }),
  })

  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    console.error('[ChannelTalk] sendGroupMessage error:', JSON.stringify(data))
  }
}

export interface MentionTarget {
  name: string
  channeltalkUserId: string | null
}

export function buildMentionedText(text: string, targets: MentionTarget[]): string {
  if (targets.length === 0) return text
  const tags = targets.map(t => `@${t.name}`).join(' ')
  return `${tags}\n${text}`
}

export async function sendGroupMessageWithMention(
  groupId: string,
  text: string,
  mentions: MentionTarget[] = []
) {
  const key = process.env.CHANNELTALK_ACCESS_KEY
  const secret = process.env.CHANNELTALK_ACCESS_SECRET
  if (!key || !secret) return

  const cleanId = groupId.startsWith('group-') ? groupId.replace('group-', '') : groupId
  const url = `${CT_BASE}/groups/${cleanId}/messages`

  const mentionedManagerIds = mentions.map(m => m.channeltalkUserId).filter((id): id is string => !!id)
  const finalText = buildMentionedText(text, mentions)

  const body: Record<string, unknown> = {
    plainText: finalText,
    blocks: [{ type: 'text', value: finalText }],
  }
  if (mentionedManagerIds.length > 0) {
    body.mentionedManagerIds = mentionedManagerIds
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: ctHeaders(),
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    console.error('[ChannelTalk] sendGroupMessageWithMention error:', JSON.stringify(data))
  }
}

export async function notifyLeadConverted({
  clientOrg,
  serviceType,
  saleName,
}: {
  clientOrg: string | null
  serviceType: string | null
  saleName: string
  saleId: string
}) {
  const groupId = (serviceType && SERVICE_TO_GROUP[serviceType]) ?? DEFAULT_GROUP

  const lines = [
    `[계약 전환] ${clientOrg ?? '(기관 미입력)'}`,
    serviceType ? `서비스: ${serviceType}` : null,
    `건명: ${saleName}`,
    `계약 정보 입력 필요 → contract-hub`,
  ].filter(Boolean).join('\n')

  await sendGroupMessage(groupId, lines).catch(console.error)
}
