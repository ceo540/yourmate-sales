// knowledge/schema/ 의 각 파일을 조립해 빵빵이 시스템 프롬프트를 만든다.
// 정적 import만 사용 (런타임 파일 I/O 없음 — Vercel Functions 친화).
import { PERSONA } from '@/knowledge/schema/persona'
import { SERVICES } from '@/knowledge/schema/services'
import { PERMISSIONS } from '@/knowledge/schema/permissions'
import { WORKFLOWS } from '@/knowledge/schema/workflows'

export const SYSTEM_PROMPT = [
  PERSONA,
  '---',
  SERVICES,
  '---',
  PERMISSIONS,
  WORKFLOWS,
].join('\n\n')

export { PERSONA, SERVICES, PERMISSIONS, WORKFLOWS }
