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

// 업무 우선순위 텍스트 색상 (tasks 목록, TasksSection 공용)
export const PRIORITY_TEXT: Record<string, string> = {
  '낮음': 'text-gray-400',
  '보통': 'text-yellow-500',
  '높음': 'text-red-500',
}

// 업무 우선순위 배지 (TaskDetailPanel 용 - 배경+텍스트 강조)
export const PRIORITY_BADGE: Record<string, string> = {
  '낮음': 'bg-gray-100 text-gray-400',
  '보통': 'bg-gray-100 text-gray-600',
  '높음': 'bg-orange-100 text-orange-600',
  '긴급': 'bg-red-100 text-red-600',
}

// 로그 타입 배지 색상 (리드/매출 상세 페이지 공용)
export const LOG_TYPE_COLORS: Record<string, string> = {
  통화:     'bg-blue-50 text-blue-600',
  이메일:   'bg-purple-50 text-purple-600',
  방문:     'bg-green-50 text-green-600',
  미팅:     'bg-teal-50 text-teal-600',
  출장:     'bg-cyan-50 text-cyan-600',
  메모:     'bg-yellow-50 text-yellow-700',
  내부회의: 'bg-orange-50 text-orange-600',
  최초유입: 'bg-teal-50 text-teal-600',
  기타:     'bg-gray-100 text-gray-500',
}

// 서비스 유형 배지 색상 (sales 목록, sales report 공용)
export const SERVICE_COLOR_BADGE: Record<string, string> = {
  '002ENT':     'bg-blue-50 text-blue-700',
  'SOS':        'bg-indigo-50 text-indigo-700',
  '교육프로그램': 'bg-emerald-50 text-emerald-700',
  '납품설치':   'bg-orange-50 text-orange-700',
  '유지보수':   'bg-amber-50 text-amber-700',
  '교구대여':   'bg-yellow-50 text-yellow-700',
  '제작인쇄':   'bg-lime-50 text-lime-700',
  '콘텐츠제작': 'bg-purple-50 text-purple-700',
  '행사운영':   'bg-pink-50 text-pink-700',
  '행사대여':   'bg-fuchsia-50 text-fuchsia-700',
  '프로젝트':   'bg-rose-50 text-rose-700',
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
