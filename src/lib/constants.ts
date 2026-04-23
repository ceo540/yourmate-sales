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

// 업무(태스크) 상태 배지 색상 — tasks, TasksSection, TaskDetailPanel, dashboard 공용
export const TASK_STATUS_STYLE: Record<string, string> = {
  '할 일':  'bg-gray-100 text-gray-600',
  '진행중': 'bg-blue-100 text-blue-700',
  '검토중': 'bg-yellow-100 text-yellow-700',
  '완료':   'bg-green-100 text-green-700',
  '보류':   'bg-red-100 text-red-600',
}

// 업무 우선순위 도트 색상
export const PRIORITY_DOT: Record<string, string> = {
  '긴급': 'bg-red-500',
  '높음': 'bg-orange-400',
  '보통': 'bg-gray-300',
  '낮음': 'bg-gray-200',
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
