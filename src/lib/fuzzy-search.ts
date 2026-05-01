// 사용자 자연어 검색 — 공백·구두점·토큰 변형 흡수 (feedback_input_flexibility 정책)
// 모든 search_* 도구·UI·매칭에 적용.

export const normalizeForSearch = (s: string | null | undefined): string =>
  (s ?? '').toLowerCase().replace(/[\s\-_().,·\\/]/g, '')

/**
 * 사용자 query에 매칭되는 후보 필터.
 * 1차: 정확한 ILIKE substring (호출자가 미리 시도)
 * 2차 fuzzy: 공백·구두점 무시한 normalize 후 includes
 * 3차 tokens: 공백 분리 토큰이 모두 포함 (AND)
 *
 * @param items — 후보 객체 배열
 * @param query — 사용자 입력
 * @param fields — 매칭에 쓸 필드 이름 (예: ['name', 'project_number'])
 * @returns { matched, mode } — 매칭 결과 + 어느 단계로 매칭됐는지
 */
export function fuzzyMatch<T extends Record<string, unknown>>(
  items: T[],
  query: string,
  fields: (keyof T)[],
): { matched: T[]; mode: 'fuzzy' | 'tokens' | 'none' } {
  const q = query.trim()
  if (!q) return { matched: [], mode: 'none' }

  const nq = normalizeForSearch(q)

  // 2차 fuzzy
  const fuzzy = items.filter(item =>
    fields.some(f => normalizeForSearch(String(item[f] ?? '')).includes(nq))
  )
  if (fuzzy.length > 0) return { matched: fuzzy, mode: 'fuzzy' }

  // 3차 tokens (공백 있을 때만)
  if (q.includes(' ')) {
    const tokens = q.split(/\s+/).map(normalizeForSearch).filter(t => t.length > 0)
    const token = items.filter(item =>
      tokens.every(t => fields.some(f => normalizeForSearch(String(item[f] ?? '')).includes(t)))
    )
    if (token.length > 0) return { matched: token, mode: 'tokens' }
  }

  return { matched: [], mode: 'none' }
}
