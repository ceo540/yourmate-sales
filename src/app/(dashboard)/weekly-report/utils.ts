// 주간 날짜 유틸 (서버/클라이언트 공통)

export function getWeekRange(date: Date = new Date()): { start: string; end: string } {
  const d = new Date(date)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day // 월요일로
  d.setDate(d.getDate() + diff)
  const start = d.toISOString().slice(0, 10)
  d.setDate(d.getDate() + 4) // 금요일
  const end = d.toISOString().slice(0, 10)
  return { start, end }
}

export function getWeekLabel(start: string, end: string): string {
  const s = new Date(start + 'T00:00:00')
  const e = new Date(end + 'T00:00:00')
  const firstDay = new Date(s.getFullYear(), s.getMonth(), 1)
  const weekNum = Math.ceil((s.getDate() + firstDay.getDay()) / 7)
  const month = s.getMonth() + 1
  return `${month}월 ${weekNum}주차 (${month}/${s.getDate()}~${e.getMonth() + 1}/${e.getDate()})`
}

export function getRecentWeeks(n = 8): Array<{ start: string; end: string; label: string }> {
  const weeks = []
  const current = getWeekRange()
  for (let i = 0; i < n; i++) {
    const d = new Date(current.start + 'T00:00:00')
    d.setDate(d.getDate() - i * 7)
    const w = getWeekRange(d)
    weeks.push({ ...w, label: getWeekLabel(w.start, w.end) })
  }
  return weeks
}
