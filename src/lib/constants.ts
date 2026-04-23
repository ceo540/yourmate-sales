import { Department } from '@/types'

// 계약 7단계 배지 색상 (sales/projects 상세 페이지 공용)
export const CONTRACT_STAGE_BADGE: Record<string, string> = {
  '계약':       'bg-blue-50 text-blue-600',
  '착수':       'bg-purple-50 text-purple-600',
  '선금':       'bg-yellow-50 text-yellow-700',
  '중도금':     'bg-orange-50 text-orange-600',
  '완수':       'bg-teal-50 text-teal-600',
  '계산서발행': 'bg-indigo-50 text-indigo-600',
  '잔금':       'bg-green-50 text-green-600',
}

// 사업부 아이콘 이모지
export const DEPT_ICONS: Record<Department, string> = {
  sound_of_school:    '🎵',
  artkiwoom:          '🎨',
  school_store:       '🏫',
  '002_creative':     '🎬',
  yourmate:           '🏢',
  '002_entertainment':'🎤',
}
