import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: string | Date) {
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(date))
}

export function formatDateShort(date: string | Date) {
  return new Intl.DateTimeFormat('ko-KR', {
    month: 'short',
    day: 'numeric',
  }).format(new Date(date))
}

export function getProgressColor(progress: number) {
  if (progress >= 80) return 'bg-green-500'
  if (progress >= 50) return 'bg-yellow-500'
  if (progress >= 30) return 'bg-orange-500'
  return 'bg-red-500'
}

export function getPriorityColor(priority: string) {
  switch (priority) {
    case 'High': return 'text-red-500 bg-red-50'
    case 'Medium': return 'text-yellow-600 bg-yellow-50'
    case 'Low': return 'text-green-600 bg-green-50'
    default: return 'text-gray-600 bg-gray-50'
  }
}

export function getStatusColor(status: string) {
  switch (status) {
    case '진행중': return 'text-blue-600 bg-blue-50'
    case '완료': return 'text-green-600 bg-green-50'
    case '기획중': return 'text-purple-600 bg-purple-50'
    case '취소': return 'text-gray-500 bg-gray-100'
    case '보류': return 'text-orange-600 bg-orange-50'
    case '시작 전': return 'text-gray-600 bg-gray-50'
    default: return 'text-gray-600 bg-gray-50'
  }
}

// profiles.departments JSONB 파싱 (string | string[] | null 모두 처리)
export function parseDepartments(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw as string[]
  if (typeof raw === 'string') {
    try { return JSON.parse(raw) } catch { return [] }
  }
  return []
}

// 금액 포맷팅
export function fmt(n: number | null | undefined): string {
  return (n || 0).toLocaleString()
}

// id → 전체 프로필 객체 맵. FK 조인 대신 수동 조인 시 사용.
export function createProfileMap<T extends { id: string }>(
  items: readonly T[] | null | undefined
): Record<string, T> {
  return Object.fromEntries((items ?? []).map((p) => [p.id, p]))
}

// id → 이름 문자열 맵. 로그/메모에서 작성자 이름만 필요할 때.
export function createProfileNameMap(
  items: readonly { id: string; name: string | null }[] | null | undefined
): Record<string, string> {
  return Object.fromEntries((items ?? []).map((p) => [p.id, p.name ?? '']))
}
