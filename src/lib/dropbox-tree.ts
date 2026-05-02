// AI 친화 프로젝트 폴더 트리 (yourmate-spec.md §5.8.2)
// 신규 프로젝트 또는 사용자 트리거 시 표준 서브폴더 자동 생성.
// 기존 트리는 손대지 않음 (사용자 평: 잘 정리됨).

import { ensureSubFolderPath } from './dropbox'

// 명세 §5.8.2 표준 서브폴더
// 00_브리프 → AI가 가장 먼저 읽음
// 01_기획 / 02_실행 / 03_결과물 / 04_정산 / 99_아카이브
const STANDARD_SUBFOLDERS: string[] = [
  '00_브리프',
  '01_기획/견적',
  '01_기획/계약',
  '01_기획/회의록',
  '02_실행/외주',
  '02_실행/자료',
  '02_실행/일정',
  '03_결과물/공연영상',
  '03_결과물/사진',
  '03_결과물/디자인산출물',
  '03_결과물/음원',
  '04_정산/입금영수',
  '04_정산/외주지급',
  '04_정산/외부인력정산',
  '04_정산/세금계산서',
  '99_아카이브',
]

/**
 * 프로젝트 폴더에 AI 친화 표준 서브폴더 일괄 생성.
 * 이미 있는 폴더는 conflict 무시. 일부만 실패해도 계속 진행.
 */
export async function applyAiFriendlyProjectTree(projectFolderWebUrl: string): Promise<{
  created: string[]
  failed: { sub: string; error: string }[]
}> {
  const created: string[] = []
  const failed: { sub: string; error: string }[] = []

  for (const sub of STANDARD_SUBFOLDERS) {
    const r = await ensureSubFolderPath(projectFolderWebUrl, sub)
    if (r.ok) created.push(sub)
    else failed.push({ sub, error: r.error })
  }

  return { created, failed }
}
