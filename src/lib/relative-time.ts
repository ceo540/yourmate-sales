// 상대 시간 표시 헬퍼 (Phase 9.6)
// 한눈에·협의·Dropbox 스캔 시각 등 공통 사용.
//
// 규칙:
// - 1분 미만: 방금 전
// - 60분 미만: N분 전
// - 24시간 미만: N시간 전
// - 24시간 이상: N일 전
// - 7일 이상: N주 전
// - 30일 이상: 절대시각 (YYYY-MM-DD)

export function formatRelativeTime(iso: string | null | undefined, nowMs?: number): string {
  if (!iso) return ''
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  const now = nowMs ?? Date.now()
  const diff = now - then
  if (diff < 60_000) return '방금 전'
  const min = Math.floor(diff / 60_000)
  if (min < 60) return `${min}분 전`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}시간 전`
  const day = Math.floor(hr / 24)
  if (day < 7) return `${day}일 전`
  if (day < 30) return `${Math.floor(day / 7)}주 전`
  return iso.slice(0, 10)
}

/**
 * hover/tooltip에 표시할 절대시각 (YYYY-MM-DD HH:mm).
 * 시간대는 클라이언트 로컬.
 */
export function formatAbsoluteTime(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`
}
