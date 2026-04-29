// 협의 박스 3분할 — 타입·라벨·컬럼 매핑·프롬프트 가이드
// project-actions.ts는 'use server' 파일이라 객체/타입 export 못 함 → 별도 파일.

export type DiscussionTarget = 'client' | 'internal' | 'vendor'

export const DISCUSSION_COLUMN: Record<DiscussionTarget, string> = {
  client: 'pending_discussion_client',
  internal: 'pending_discussion_internal',
  vendor: 'pending_discussion_vendor',
}

export const DISCUSSION_LABEL: Record<DiscussionTarget, string> = {
  client: '클라이언트 협의',
  internal: '내부 협의',
  vendor: '외주사 협의',
}

export const DISCUSSION_PROMPT_FOCUS: Record<DiscussionTarget, string> = {
  client: `**클라이언트와 협의해야 할 내용**만 정리해. 즉:
- 클라이언트가 결정해줘야 할 것 (요구사항·기획안·일정·예산 컨펌)
- 클라이언트가 답변/회신을 해야 할 것
- 클라이언트에게 보고/공유해야 할 것
- 클라이언트와 일정 조율해야 할 것
내부 결정·외주사 관련 내용은 *제외*. 클라이언트 시선에서만.`,
  internal: `**내부 (회사 내부)에서 협의·결정해야 할 내용**만 정리해. 즉:
- 인력 배치·역할 분담
- 내부 일정·우선순위 조율
- 예산·원가 관련 의사결정
- 책임자/PM 결정 사항
- 회사 차원 정책 결정
클라이언트와 외주사 관련은 *제외*. 우리 회사 내부 시선에서만.`,
  vendor: `**외주사(협력사·프리랜서)와 협의해야 할 내용**만 정리해. 즉:
- 외주 산출물의 디테일·품질 기준
- 외주 일정·납기 조율
- 외주비·계약 조건
- 외주사 답변 대기 사항
- 외주 결과 검토·피드백
클라이언트·내부 결정은 *제외*. 외주사와의 소통 시선에서만.`,
}
