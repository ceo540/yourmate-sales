const CT_BASE = 'https://api.channel.io/open/v5'

function ctHeaders() {
  return {
    'x-access-key': process.env.CHANNELTALK_ACCESS_KEY!,
    'x-access-secret': process.env.CHANNELTALK_ACCESS_SECRET!,
    'Content-Type': 'application/json',
  }
}

// 서비스 타입 → 채널톡 그룹 ID 매핑
const SERVICE_TO_GROUP: Record<string, string> = {
  'SOS':        '395644', // 1_사운드오브스쿨
  '002ENT':     '462715', // 1_002ENT
  '교육프로그램': '404376', // 1_아트키움-예술교육
  '납품설치':    '416890', // 1_학교상점
  '유지보수':    '416890',
  '교구대여':    '416890',
  '제작인쇄':    '416890',
  '콘텐츠제작':  '433414', // 1_002CREATIVE
  '행사운영':    '433414',
  '행사대여':    '433414',
  '프로젝트':    '433414',
}

const DEFAULT_GROUP = '395641' // 0_YOURMATE_OFFICIAL (기타/유어메이트)

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
