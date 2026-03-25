// 사용자
export type UserRole = 'admin' | 'member'

export interface User {
  id: string
  email: string
  name: string
  role: UserRole
  department?: string
  avatar_url?: string
  created_at: string
}

// 사업부
export type Department =
  | 'yourmate'
  | 'sound_of_school'
  | 'artkiwoom'
  | '002_creative'
  | 'school_store'
  | '002_entertainment'

export const DEPARTMENT_LABELS: Record<Department, string> = {
  yourmate: '유어메이트',
  sound_of_school: 'Sound OF School',
  artkiwoom: '아트키움',
  '002_creative': '002 Creative',
  school_store: '학교상점',
  '002_entertainment': '002 Entertainment',
}

// 프로젝트
export type ProjectStatus = '기획중' | '진행중' | '완료' | '취소' | '보류'
export type Priority = 'Low' | 'Medium' | 'High'

export interface Project {
  id: string
  name: string
  pm_id: string
  pm?: User
  status: ProjectStatus
  priority: Priority
  progress: number
  start_date?: string
  end_date?: string
  department: Department
  description?: string
  goal?: string
  budget?: number
  created_at: string
  updated_at: string
}

// 업무(태스크)
export type TaskStatus = '시작 전' | '진행중' | '완료' | '취소'

export interface Task {
  id: string
  title: string
  project_id?: string
  project?: Project
  assignee_id?: string
  assignee?: User
  status: TaskStatus
  priority: Priority
  start_date?: string
  due_date?: string
  description?: string
  created_at: string
  updated_at: string
}

// 목표 (OKR)
export interface Goal {
  id: string
  title: string
  description?: string
  department: Department
  year: number
  progress: number
  key_results: KeyResult[]
  created_at: string
}

export interface KeyResult {
  id: string
  goal_id: string
  title: string
  progress: number
}

// 미팅/출장
export type MeetingType = '미팅' | '출장' | '화상'

export interface Meeting {
  id: string
  title: string
  type: MeetingType
  project_id?: string
  attendees: string[]
  date: string
  location?: string
  notes?: string
  created_at: string
}

// 회의록
export interface Minutes {
  id: string
  title: string
  meeting_id?: string
  project_id?: string
  date: string
  attendees: string[]
  content: string
  action_items: ActionItem[]
  created_at: string
}

export interface ActionItem {
  id: string
  content: string
  assignee_id?: string
  due_date?: string
  done: boolean
}

// 주간 업무 리포트
export interface WeeklyReport {
  id: string
  user_id: string
  user?: User
  week_start: string
  week_end: string
  done: string
  doing: string
  todo: string
  issues?: string
  created_at: string
}

// SOP / 업무 설명서
export interface SOP {
  id: string
  title: string
  department?: Department
  category: string
  content: string
  author_id: string
  created_at: string
  updated_at: string
}

// 운영 정책
export interface Policy {
  id: string
  title: string
  department: Department
  content: string
  updated_at: string
}

// CRM 고객
export type CustomerType = '학교' | '교육청' | '기관' | '기업' | '기타'
export type CustomerStatus = '잠재' | '접촉' | '제안' | '계약' | '완료' | '보류'

export interface Customer {
  id: string
  name: string
  type: CustomerType
  status: CustomerStatus
  contact_name?: string
  contact_phone?: string
  contact_email?: string
  department?: Department
  notes?: string
  created_at: string
  updated_at: string
}
