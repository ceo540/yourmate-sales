// 할 일 완료 시 코멘트 입력 prompt (Phase 9.2)
// DRY: ProjectV2Client·TasksClient·SaleHubClient 모두 동일 UX로 호출.

export type CompletionPromptResult =
  | { cancelled: true; note: null }
  | { cancelled: false; note: string | null }

/**
 * 할일 완료 시 사용자에게 코멘트 입력 받음.
 * - cancelled=true → 사용자가 ESC/취소 (완료 처리 자체 중단해야 함)
 * - cancelled=false, note=null → OK 누르고 비워둠 (코멘트 없이 완료)
 * - cancelled=false, note='...' → 코멘트와 함께 완료
 */
export function askCompletionNote(taskTitle: string): CompletionPromptResult {
  if (typeof window === 'undefined') return { cancelled: true, note: null }
  const r = window.prompt(
    `"${taskTitle}" 완료 처리할게.\n\n어떻게 마쳤는지 한 줄 코멘트 (선택, 비워둬도 OK).`,
    ''
  )
  if (r === null) return { cancelled: true, note: null }
  return { cancelled: false, note: r.trim() || null }
}
