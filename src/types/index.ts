// 사용자
export type UserRole = 'admin' | 'manager' | 'member'

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

// 서비스 → 사업부 매핑은 lib/services.ts에 중앙화.
// 기존 import 경로 호환을 위해 re-export.
export { SERVICE_TO_DEPT } from '@/lib/services'

// 매출 현황 계층 구조 (사업부 → 서비스)
export const DEPT_SERVICE_GROUPS = [
  { depts: ['002_entertainment', 'sound_of_school'], label: '002 Entertainment', services: ['002ENT', 'SOS'] },
  { depts: ['artkiwoom'],    label: '아트키움',     services: ['교육프로그램'] },
  { depts: ['school_store'], label: '학교상점',     services: ['납품설치', '유지보수', '교구대여', '제작인쇄'] },
  { depts: ['002_creative'], label: '002 Creative', services: ['콘텐츠제작', '행사운영', '행사대여', '프로젝트'] },
  { depts: ['yourmate'],     label: '유어메이트',   services: [] },
]

// 서비스 선택용 flat list (optgroup 렌더링에 사용)
export const SERVICE_TYPES: Partial<Record<string, string[]>> = {
  sound_of_school: ['SOS'],
  artkiwoom: ['교육프로그램'],
  school_store: ['납품설치', '유지보수', '교구대여', '제작인쇄'],
  '002_entertainment': ['002ENT', 'SOS'],
  '002_creative': ['콘텐츠제작', '행사운영', '행사대여', '프로젝트'],
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
  // 운영 분류 (yourmate-company-spec-v2 §5~8) — Phase 3
  main_type?: string | null
  expansion_tags?: string[] | null
  capability_tags?: string[] | null
  classification_confidence?: number | null
  classification_note?: string | null
  biz_completed_at?: string | null
  finance_completed_at?: string | null
  created_at: string
  updated_at: string
}

// 업무(태스크)
export type TaskStatus = '할 일' | '진행중' | '검토중' | '완료' | '보류'

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
  // 완료 코멘트 (Phase 9.2 — 2026-05-03)
  completed_note?: string | null
  completed_at?: string | null
  completed_by?: string | null
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

// 계약 단계 (contract_stage)
export const CONTRACT_STAGES = ['계약', '착수', '선금', '중도금', '완수', '계산서발행', '잔금'] as const
export type ContractStage = typeof CONTRACT_STAGES[number]

export const CONTRACT_STAGE_COLORS: Record<string, string> = {
  '계약': 'bg-blue-50 text-blue-600',
  '착수': 'bg-purple-50 text-purple-600',
  '선금': 'bg-yellow-50 text-yellow-700',
  '중도금': 'bg-orange-50 text-orange-600',
  '완수': 'bg-teal-50 text-teal-600',
  '계산서발행': 'bg-indigo-50 text-indigo-600',
  '잔금': 'bg-green-50 text-green-600',
}

// 운영 진행 트랙 (계약 단계 contract_stage와 독립)
export const PROGRESS_STATUSES = ['착수전', '착수중', '완수'] as const
export type ProgressStatus = typeof PROGRESS_STATUSES[number]

// 리드 파이프라인
export const LEAD_STATUSES = ['유입', '회신대기', '견적발송', '조율중', '진행중', '완료', '취소'] as const
export type LeadStatus = typeof LEAD_STATUSES[number]

export const LEAD_CHANNELS = ['전화', '이메일', '카카오', '채널톡', '기타'] as const
export const LEAD_SOURCES = ['네이버', '인스타', '유튜브', '지인', '기존고객', '기타'] as const

export interface Lead {
  id: string
  lead_id: string
  person_id: string | null
  customer_id: string | null
  person?: { id: string; name: string; phone: string | null; email: string | null; currentOrg: string; title: string; dept: string; relationId: string | null; customerId: string | null; customerRegion: string; customerType: string }
  inflow_date: string | null
  remind_date: string | null
  service_type: string | null
  project_name: string | null
  contact_name: string | null
  client_org: string | null
  phone: string | null
  office_phone: string | null
  email: string | null
  initial_content: string | null
  assignee_id: string | null
  assignee?: { id: string; name: string }
  status: LeadStatus
  channel: string | null
  inflow_source: string | null
  notes: string | null
  contact_1: string | null
  contact_2: string | null
  contact_3: string | null
  converted_sale_id: string | null
  dropbox_url: string | null
  quotation_url: string | null
  linked_calendar_events: { id: string; calendarKey: string; title: string; date: string; color: string }[] | null
  summary_cache?: string | null
  summary_updated_at?: string | null
  // 운영 분류 추정/힌트 (yourmate-company-spec-v2 §5~8) — Phase 4
  guessed_main_type?: string | null
  guessed_expansion_tags?: string[] | null
  created_at: string
  updated_at: string
  relatedSales?: RelatedSale[]
}

export interface RelatedSale {
  id: string
  name: string
  contract_stage: string
  progress_status: string | null
  revenue: number | null
  lead_id: string | null
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

// 견적 (quotes / quote_items) — Step 2 추가
export type QuoteStatus = 'draft' | 'sent' | 'accepted' | 'rejected' | 'cancelled'

export interface Quote {
  id: string
  quote_number: string                   // 'YY-MM-NNN'
  sale_id: string | null
  project_id: string | null
  lead_id: string | null
  entity_id: string                      // business_entities.id
  customer_id: string | null
  client_dept: string | null
  project_name: string
  status: QuoteStatus
  html_path: string | null
  pdf_path: string | null
  total_amount: number
  vat_included: boolean
  issue_date: string                     // 'YYYY-MM-DD'
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface QuoteItem {
  id: string
  quote_id: string
  sort_order: number
  category: string | null
  name: string
  description: string | null
  qty: number
  unit_price: number
  amount: number
  created_at: string
}

// sale ↔ project N:M (yourmate-spec.md §3.2)
// 한 매출이 여러 프로젝트에, 한 프로젝트도 여러 매출에 묶일 수 있는 관계.
// 비기술 설명: "연결만 담당하는 표 1개"
export type SaleProjectRole = '주계약' | '부계약' | '예산분할' | '추가'

export interface SaleProject {
  id: string
  sale_id: string
  project_id: string
  role: SaleProjectRole
  revenue_share_pct: number  // sale.revenue 중 이 project에 귀속될 % (0~100)
  cost_share_pct: number     // sale_costs 분배 % (0~100)
  note: string | null
  created_at: string
  updated_at: string
}

// 외부 인력 통합 모델 (yourmate-spec.md §5.5)
export type ExternalWorkerType = '강사' | '아티스트' | '스태프' | '기술' | '복합'
export type ExternalWorkerReuseStatus = 'preferred' | 'normal' | 'avoid'
export type ArchiveStatus = 'active' | 'pending' | 'cancelled' | 'archived'
export type RateType = 'per_hour' | 'per_session' | 'per_project'

export interface ExternalWorker {
  id: string
  name: string
  type: ExternalWorkerType
  phone: string | null
  email: string | null

  ssn_text: string | null              // 주민번호 (L3 마이그 시 암호화 예정)
  bank_name: string | null
  bank_account_text: string | null     // L3 마이그 시 암호화 예정
  id_card_url: string | null           // Dropbox URL (대표만 권한)
  bank_book_url: string | null

  default_rate_type: RateType | null
  default_rate: number | null
  specialties: string[] | null
  notes: string | null

  rating: number | null                // 0~5 자동 + 사람 수정
  evaluation_notes: string | null
  reuse_status: ExternalWorkerReuseStatus

  first_engaged_at: string | null
  last_engaged_at: string | null
  total_engagements: number
  total_paid: number

  archive_status: ArchiveStatus

  created_at: string
  updated_at: string
}

export interface WorkerEngagement {
  id: string
  worker_id: string
  project_id: string
  role: string | null                  // '메인 강사' | '서브' | 'MC' | '음향' | ...
  date_start: string | null
  date_end: string | null
  hours: number | null
  rate_type: RateType | null
  rate: number | null
  amount: number | null
  note: string | null
  archive_status: ArchiveStatus
  created_at: string
}

export type WorkerPaymentStatus = 'pending' | 'paid' | 'failed' | 'cancelled'

export interface WorkerPayment {
  id: string
  worker_id: string
  engagement_ids: string[] | null
  total_amount: number
  scheduled_date: string | null
  paid_date: string | null
  status: WorkerPaymentStatus
  tax_form_sent_at: string | null
  note: string | null
  archive_status: ArchiveStatus
  created_at: string
  updated_at: string
}

// 영업 활동 추적 (yourmate-spec.md §5.13)
export type ProspectStatus = 'cold' | 'contacted' | 'interested' | 'lead_converted' | 'lost'
export interface Prospect {
  id: string
  org_name: string
  region: string | null
  category: string | null
  contact_name: string | null
  contact_role: string | null
  contact_phone: string | null
  contact_email: string | null
  service_target: string | null
  source: string | null
  status: ProspectStatus
  last_contacted_at: string | null
  next_action_at: string | null
  notes: string | null
  converted_lead_id: string | null
  archive_status: ArchiveStatus
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface ProspectActivity {
  id: string
  prospect_id: string
  activity_type: string
  outcome: string | null
  notes: string | null
  done_by: string | null
  done_at: string
  created_at: string
}

// 사업부 간 내부 의뢰 (§5.6)
export interface InternalRequest {
  id: string
  project_id: string | null
  from_dept: string | null
  to_dept: string | null
  type: string | null
  content: string | null
  source: 'auto_detected' | 'manual'
  source_ref: string | null
  status: 'auto' | 'confirmed' | 'in_progress' | 'done' | 'rejected'
  responder_id: string | null
  notes: string | null
  archive_status: ArchiveStatus
  detected_at: string
  resolved_at: string | null
}

// 회의·의사결정 (§5.9)
export interface Decision {
  id: string
  project_id: string | null
  context: string | null
  options_considered: unknown | null
  decision: string
  decided_by: string | null
  participants: string[] | null
  rationale: string | null
  decided_at: string
  archive_status: ArchiveStatus
  created_at: string
}

// 회의 (§5.9) — 기존 Meeting 인터페이스(line 117) 와 별개의 운영 모델
export type MeetingKind = 'weekly' | 'irregular' | 'project' | 'with_customer' | 'with_worker'
export interface MeetingRecord {
  id: string
  title: string
  type: MeetingKind | string
  project_id: string | null
  attendees: string | null
  date: string
  location: string | null
  notes: string | null
  duration_minutes: number | null
  participants: string[] | null
  external_participants: string[] | null
  agenda: string | null
  minutes: string | null
  ai_summary: string | null
  decision_ids: string[] | null
  task_ids: string[] | null
  source: 'manual' | 'plaud' | 'whisper' | 'channeltalk' | null
  source_ref: string | null
  archive_status: ArchiveStatus
  created_by: string | null
  created_at: string
  updated_at: string
}

// 장비 (§5.7)
export type EquipmentCategory = '음향' | '영상' | '텐트' | '교구' | '조명' | '의상' | '기타'
export type EquipmentArchiveStatus = 'active' | 'broken' | 'lost' | 'archived'
export interface EquipmentMaster {
  id: string
  name: string
  category: EquipmentCategory | string | null
  owning_dept: string
  total_qty: number
  unit_price: number | null
  serial_no: string | null
  storage_location: string | null
  notes: string | null
  archive_status: EquipmentArchiveStatus
  created_at: string
  updated_at: string
}

export type EquipmentRentalStatus = 'reserved' | 'in_use' | 'returned' | 'lost' | 'cancelled'
export interface EquipmentRental {
  id: string
  equipment_id: string
  qty: number
  project_id: string | null
  customer_id: string | null
  date_start: string
  date_end: string
  status: EquipmentRentalStatus
  rate: number | null
  responsible_user_id: string | null
  notes: string | null
  archive_status: ArchiveStatus
  created_at: string
  updated_at: string
}

// 결과물 아카이브 (§5.8)
export type DeliverableType = '공연영상' | '교육결과물' | '디자인산출물' | '음원' | '회의록' | 'brief' | '사진' | '기타'
export interface ProjectDeliverable {
  id: string
  project_id: string
  type: DeliverableType | string
  title: string | null
  dropbox_path: string | null
  format: string | null
  size_bytes: number | null
  delivered_at: string | null
  client_confirmed_at: string | null
  metadata: unknown | null
  ai_summary: string | null
  ai_tags: string[] | null
  archive_status: ArchiveStatus
  created_by: string | null
  created_at: string
  updated_at: string
}
