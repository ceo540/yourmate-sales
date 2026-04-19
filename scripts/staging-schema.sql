-- ============================================================
-- yourmate-staging-test 스키마 + 더미 데이터
-- RLS 비활성화 (보안 테스트용)
-- 프로덕션 데이터 미포함
-- ============================================================

-- ── Extensions ──────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── 테이블 생성 ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.profiles (
  id                uuid PRIMARY KEY,
  email             text,
  name              text,
  role              text DEFAULT 'member',
  department        text,
  avatar_url        text,
  created_at        timestamptz DEFAULT now(),
  departments       text DEFAULT '[]',
  join_date         date,
  entity_id         uuid,
  phone             text,
  emergency_name    text,
  emergency_phone   text,
  bank_name         text,
  account_number    text,
  birth_date        date
);

CREATE TABLE IF NOT EXISTS public.business_entities (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                text NOT NULL,
  created_at          timestamptz DEFAULT now(),
  business_number     text,
  entity_type         text DEFAULT '일반기업',
  representative_name text,
  business_type       text,
  business_item       text,
  address             text,
  email               text,
  phone               text,
  corporate_number    text,
  bank_name           text,
  account_number      text,
  account_holder      text
);

CREATE TABLE IF NOT EXISTS public.departments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key         text UNIQUE NOT NULL,
  label       text NOT NULL,
  description text,
  color       text DEFAULT '#6B7280',
  sort_order  integer DEFAULT 0,
  created_at  timestamptz DEFAULT now(),
  parent_id   uuid REFERENCES public.departments(id)
);

CREATE TABLE IF NOT EXISTS public.role_permissions (
  role         text NOT NULL,
  page_key     text NOT NULL,
  access_level text NOT NULL DEFAULT 'full',
  PRIMARY KEY (role, page_key)
);

CREATE TABLE IF NOT EXISTS public.customers (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  type          text NOT NULL DEFAULT '기타',
  status        text NOT NULL DEFAULT '활성',
  contact_name  text,
  contact_phone text,
  contact_email text,
  department    text,
  notes         text,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now(),
  phone         text,
  region        text
);

CREATE TABLE IF NOT EXISTS public.persons (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                 text NOT NULL,
  phone                text,
  email                text,
  notes                text,
  created_at           timestamptz DEFAULT now(),
  updated_at           timestamptz DEFAULT now(),
  channeltalk_user_id  text
);

CREATE TABLE IF NOT EXISTS public.person_org_relations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id   uuid REFERENCES public.persons(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES public.customers(id) ON DELETE CASCADE,
  dept        text,
  title       text,
  started_at  date,
  ended_at    date,
  is_current  boolean DEFAULT true,
  created_at  timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.vendors (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name             text NOT NULL,
  type             text DEFAULT '업체',
  phone            text,
  bank_info        text,
  memo             text,
  created_at       timestamptz DEFAULT now(),
  id_number        text,
  email            text,
  withholding_tax  boolean DEFAULT false,
  company          text,
  bank_name        text,
  account_no       text,
  account_holder   text,
  is_active        boolean DEFAULT true
);

CREATE TABLE IF NOT EXISTS public.sales (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  text NOT NULL,
  department            text,
  assignee_id           uuid REFERENCES public.profiles(id),
  revenue               bigint DEFAULT 0,
  contract_stage        text DEFAULT '계약',
  memo                  text,
  inflow_date           date,
  payment_date          date,
  dropbox_url           text,
  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now(),
  entity_id             uuid REFERENCES public.business_entities(id),
  contract_type         text,
  client_org            text,
  service_type          text,
  cost_confirmed        boolean DEFAULT false,
  customer_id           uuid REFERENCES public.customers(id),
  person_id             uuid,
  notes                 text,
  project_overview      text,
  lead_id               uuid,
  progress_status       text DEFAULT '착수전',
  contract_assignee_id  uuid REFERENCES public.profiles(id),
  client_dept           text,
  contract_contact_name text,
  contract_contact_phone text,
  contract_docs         jsonb DEFAULT '[]',
  notion_page_id        text
);

CREATE TABLE IF NOT EXISTS public.sale_costs (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id    uuid REFERENCES public.sales(id) ON DELETE CASCADE,
  item       text,
  amount     bigint DEFAULT 0,
  memo       text,
  created_at timestamptz DEFAULT now(),
  category   text DEFAULT '기타',
  vendor_id  uuid REFERENCES public.vendors(id),
  is_paid    boolean DEFAULT false,
  paid_at    timestamptz,
  unit_price bigint,
  quantity   integer DEFAULT 1,
  unit       text
);

CREATE TABLE IF NOT EXISTS public.payment_schedules (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id       uuid REFERENCES public.sales(id) ON DELETE CASCADE,
  label         text NOT NULL DEFAULT '계약금',
  amount        bigint NOT NULL DEFAULT 0,
  due_date      date,
  received_date date,
  is_received   boolean DEFAULT false,
  note          text,
  sort_order    integer DEFAULT 0,
  created_at    timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.leads (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id         text,
  inflow_date     date,
  remind_date     date,
  service_type    text,
  contact_name    text,
  client_org      text,
  phone           text,
  office_phone    text,
  email           text,
  initial_content text,
  assignee_id     uuid REFERENCES public.profiles(id),
  status          text DEFAULT '유입',
  channel         text,
  inflow_source   text,
  notes           text,
  contact_1       text,
  contact_2       text,
  contact_3       text,
  converted_sale_id uuid REFERENCES public.sales(id),
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now(),
  customer_id     uuid REFERENCES public.customers(id),
  person_id       uuid REFERENCES public.persons(id),
  dropbox_url     text,
  quotation_url   text,
  project_name    text
);

CREATE TABLE IF NOT EXISTS public.tasks (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title       text NOT NULL,
  project_id  uuid REFERENCES public.sales(id),
  assignee_id uuid REFERENCES public.profiles(id),
  status      text DEFAULT '할 일',
  priority    text DEFAULT 'Medium',
  start_date  date,
  due_date    date,
  description text,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now(),
  checklist   jsonb DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS public.project_logs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id      uuid REFERENCES public.sales(id),
  content      text NOT NULL,
  log_type     text DEFAULT '메모',
  author_id    uuid REFERENCES public.profiles(id),
  created_at   timestamptz DEFAULT now(),
  contacted_at timestamptz,
  lead_id      uuid REFERENCES public.leads(id),
  customer_id  uuid REFERENCES public.customers(id),
  person_id    uuid REFERENCES public.persons(id)
);

CREATE TABLE IF NOT EXISTS public.rentals (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_name   text,
  contact_name    text,
  phone           text,
  email           text,
  customer_type   text,
  customer_id     uuid REFERENCES public.customers(id),
  lead_id         uuid REFERENCES public.leads(id),
  sale_id         uuid REFERENCES public.sales(id),
  assignee_id     uuid REFERENCES public.profiles(id),
  rental_start    date,
  rental_end      date,
  payment_due     date,
  delivery_method text,
  pickup_method   text,
  total_amount    bigint DEFAULT 0,
  deposit         bigint DEFAULT 0,
  payment_method  text,
  status          text DEFAULT '유입',
  inflow_source   text,
  notes           text,
  dropbox_url     text,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now(),
  content         text,
  contact_1       text,
  contact_2       text,
  contact_3       text,
  payment_status  text DEFAULT '미결제',
  deposit_status  text DEFAULT '없음',
  inspection_status text DEFAULT '검수전',
  is_exception    boolean DEFAULT false,
  checklist       jsonb DEFAULT '{}',
  title           text,
  has_deposit     boolean DEFAULT false
);

CREATE TABLE IF NOT EXISTS public.sos_concerts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  year        integer,
  month       integer,
  concert_date text,
  school      text,
  concept     text,
  mc          text,
  artists     text[] DEFAULT '{}',
  staff       text[] DEFAULT '{}',
  stage       text DEFAULT '계약 전',
  tasks_done  integer DEFAULT 0,
  tasks_total integer DEFAULT 11,
  event_info  jsonb DEFAULT '{}',
  sale_id     uuid REFERENCES public.sales(id),
  created_at  timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.financial_accounts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_entity text,
  name            text NOT NULL,
  type            text DEFAULT '보통예금',
  initial_balance bigint DEFAULT 0,
  is_active       boolean DEFAULT true,
  created_at      timestamptz DEFAULT now(),
  account_number  text
);

CREATE TABLE IF NOT EXISTS public.cashflow (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date                date NOT NULL,
  account_id          uuid REFERENCES public.financial_accounts(id),
  type                text NOT NULL,
  amount              bigint NOT NULL,
  transfer_account_id uuid REFERENCES public.financial_accounts(id),
  category            text,
  description         text,
  memo                text,
  created_at          timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.fixed_costs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,
  category        text,
  business_entity text,
  amount          bigint DEFAULT 0,
  payment_day     integer,
  payment_method  text,
  memo            text,
  is_active       boolean DEFAULT true,
  created_at      timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.payroll (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  year                integer NOT NULL,
  month               integer NOT NULL,
  employee_name       text NOT NULL,
  profile_id          uuid REFERENCES public.profiles(id),
  base_salary         bigint DEFAULT 0,
  allowances          bigint DEFAULT 0,
  bonus               bigint DEFAULT 0,
  national_pension    bigint DEFAULT 0,
  health_insurance    bigint DEFAULT 0,
  employment_insurance bigint DEFAULT 0,
  income_tax          bigint DEFAULT 0,
  payment_date        date,
  memo                text,
  created_at          timestamptz DEFAULT now(),
  business_entity     text,
  employee_type       text DEFAULT '정직원',
  meal_allowance      bigint DEFAULT 0,
  mileage_allowance   bigint DEFAULT 0,
  unpaid_leave        integer DEFAULT 0,
  fixed_bonus         bigint DEFAULT 0,
  resident_id         text,
  payment_confirmed   boolean DEFAULT false,
  bank_info           text
);

CREATE TABLE IF NOT EXISTS public.notices (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category   text DEFAULT '일반',
  title      text NOT NULL,
  content    text,
  author_id  uuid REFERENCES public.profiles(id),
  pinned     boolean DEFAULT false,
  views      integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.expenses (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id  uuid REFERENCES public.profiles(id),
  payment_type text NOT NULL,
  category     text,
  title        text NOT NULL,
  amount       bigint NOT NULL,
  expense_date date NOT NULL,
  receipt_url  text,
  status       text DEFAULT '대기',
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now(),
  rejection_reason text
);

CREATE TABLE IF NOT EXISTS public.attendance_records (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_name       text NOT NULL,
  employee_no         text,
  work_date           date NOT NULL,
  check_in            text,
  check_out           text,
  work_minutes        integer DEFAULT 0,
  late_minutes        integer DEFAULT 0,
  early_leave_minutes integer DEFAULT 0,
  is_absent           boolean DEFAULT false,
  year_month          text,
  created_at          timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.public_holidays (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  holiday_date date NOT NULL UNIQUE,
  name         text NOT NULL,
  created_at   timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.employee_work_schedules (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_name text NOT NULL UNIQUE,
  work_start    time DEFAULT '09:00',
  work_end      time DEFAULT '18:00',
  updated_at    timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.leave_requests (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id        uuid REFERENCES public.profiles(id),
  type             text NOT NULL,
  start_date       date NOT NULL,
  end_date         date NOT NULL,
  days             numeric DEFAULT 1,
  reason           text,
  director_approval text DEFAULT '대기',
  ceo_approval     text DEFAULT '대기',
  created_at       timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.leave_balances (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id    uuid REFERENCES public.profiles(id),
  year         integer NOT NULL,
  initial_days numeric DEFAULT 0,
  created_at   timestamptz DEFAULT now(),
  UNIQUE(member_id, year)
);

CREATE TABLE IF NOT EXISTS public.weekly_reports (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid REFERENCES public.profiles(id),
  week_start     date NOT NULL,
  week_end       date NOT NULL,
  this_week_done text,
  next_week_todo text,
  issues         text,
  ideas          text,
  support_needed text,
  feedback       text,
  submitted_at   timestamptz,
  created_at     timestamptz DEFAULT now(),
  updated_at     timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.daily_reports (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid REFERENCES public.profiles(id),
  report_date   date NOT NULL,
  tasks_done    text,
  issues        text,
  tomorrow_plan text,
  status        text DEFAULT '임시저장',
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now(),
  UNIQUE(user_id, report_date)
);

CREATE TABLE IF NOT EXISTS public.employee_cards (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_name        text NOT NULL,
  business_entity      text,
  profile_id           uuid REFERENCES public.profiles(id),
  base_salary          bigint DEFAULT 0,
  meal_allowance       bigint DEFAULT 0,
  mileage_allowance    bigint DEFAULT 0,
  allowances           bigint DEFAULT 0,
  fixed_bonus          bigint DEFAULT 0,
  national_pension     bigint DEFAULT 0,
  health_insurance     bigint DEFAULT 0,
  employment_insurance bigint DEFAULT 0,
  income_tax           bigint DEFAULT 0,
  resident_id          text,
  bank_info            text,
  dependents           integer DEFAULT 1,
  memo                 text,
  is_active            boolean DEFAULT true,
  created_at           timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.salary_records (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id  uuid REFERENCES public.profiles(id),
  year       integer NOT NULL,
  month      integer NOT NULL,
  base_salary bigint DEFAULT 0,
  deductions bigint DEFAULT 0,
  net_salary bigint DEFAULT 0,
  memo       text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(member_id, year, month)
);

CREATE TABLE IF NOT EXISTS public.onboarding_items (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id        uuid REFERENCES public.profiles(id),
  title            text NOT NULL,
  completed        boolean DEFAULT false,
  source           text DEFAULT 'manual',
  notion_block_id  text,
  sort_order       integer DEFAULT 0,
  created_at       timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.system_settings (
  key        text PRIMARY KEY,
  value      text,
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.one_on_ones (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id    uuid REFERENCES public.profiles(id),
  date         date NOT NULL,
  content      text,
  action_items text,
  created_at   timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.document_requests (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id   uuid REFERENCES public.profiles(id),
  doc_type    text NOT NULL,
  purpose     text,
  status      text DEFAULT '요청',
  created_at  timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.bank_transactions (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tx_date        date,
  counterparty   text,
  debit          bigint DEFAULT 0,
  credit         bigint DEFAULT 0,
  company        text,
  payroll_id     uuid REFERENCES public.payroll(id),
  vendor_id      uuid REFERENCES public.vendors(id),
  import_batch   text,
  created_at     timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.vendor_payments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id   uuid REFERENCES public.vendors(id),
  sale_id     uuid REFERENCES public.sales(id),
  amount      bigint DEFAULT 0,
  paid_at     date,
  memo        text,
  created_at  timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.api_usage (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at    timestamptz DEFAULT now(),
  model         text,
  endpoint      text,
  user_id       uuid,
  input_tokens  integer DEFAULT 0,
  output_tokens integer DEFAULT 0,
  cost_usd      numeric DEFAULT 0
);

-- ── 더미 데이터 ─────────────────────────────────────────────

-- business_entities
INSERT INTO public.business_entities (id, name, business_number, entity_type, representative_name, address, email, phone) VALUES
  ('11111111-0000-0000-0000-000000000001', '(주)002코퍼레이션', '123-45-67890', '일반기업', '방준영', '서울시 강남구 테헤란로 1', 'corp@002corp.com', '02-1234-5678'),
  ('11111111-0000-0000-0000-000000000002', '유어메이트', '234-56-78901', '여성기업', '방준영', '서울시 서초구 서초대로 2', 'hello@yourmate.io', '070-7836-9132'),
  ('11111111-0000-0000-0000-000000000003', 'Sound OF School', '345-67-89012', '일반기업', '방준영', '서울시 강남구 역삼로 3', 'sos@yourmate.io', '02-3456-7890');

-- departments
INSERT INTO public.departments (id, key, label, description, color, sort_order, parent_id) VALUES
  ('22222222-0000-0000-0000-000000000001', '002corporation', '002코퍼레이션', '모회사', '#1F2937', 0, NULL),
  ('22222222-0000-0000-0000-000000000002', 'yourmate', '유어메이트', '총괄 운영', '#FFCE00', 1, '22222222-0000-0000-0000-000000000001'),
  ('22222222-0000-0000-0000-000000000003', 'sound_of_school', 'Sound OF School', 'SOS 공연', '#3B82F6', 2, '22222222-0000-0000-0000-000000000001'),
  ('22222222-0000-0000-0000-000000000004', 'artkiwoom', '아트키움', '교육프로그램', '#8B5CF6', 3, '22222222-0000-0000-0000-000000000001'),
  ('22222222-0000-0000-0000-000000000005', '002_creative', '002 Creative', '콘텐츠/행사', '#EC4899', 4, '22222222-0000-0000-0000-000000000001'),
  ('22222222-0000-0000-0000-000000000006', 'school_store', '학교상점', '납품/렌탈', '#10B981', 5, '22222222-0000-0000-0000-000000000001'),
  ('22222222-0000-0000-0000-000000000007', '002_entertainment', '002 Entertainment', '음원유통', '#F59E0B', 6, '22222222-0000-0000-0000-000000000001');

-- profiles (테스트 유저 - auth.users 없이는 FK 없음, 더미 UUID 사용)
INSERT INTO public.profiles (id, email, name, role, departments, join_date, entity_id) VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001', 'test@yourmate.io', '테스트 관리자', 'admin', '["yourmate"]', '2024-01-01', '11111111-0000-0000-0000-000000000001'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'pm1@yourmate.io', '테스트 PM1', 'member', '["sound_of_school"]', '2024-03-01', '11111111-0000-0000-0000-000000000002'),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'pm2@yourmate.io', '테스트 PM2', 'member', '["artkiwoom"]', '2024-06-01', '11111111-0000-0000-0000-000000000002'),
  ('aaaaaaaa-0000-0000-0000-000000000004', 'manager1@yourmate.io', '테스트 팀장', 'manager', '["002_creative","school_store"]', '2023-09-01', '11111111-0000-0000-0000-000000000002');

-- role_permissions
INSERT INTO public.role_permissions (role, page_key, access_level) VALUES
  ('manager', 'sales', 'full'), ('manager', 'leads', 'full'), ('manager', 'contract_hub', 'full'),
  ('manager', 'tasks', 'full'), ('manager', 'departments', 'full'), ('manager', 'pipeline', 'full'),
  ('manager', 'receivables', 'full'), ('manager', 'payments', 'full'), ('manager', 'customers', 'full'),
  ('manager', 'vendors', 'full'), ('manager', 'cashflow', 'off'), ('manager', 'finance', 'off'),
  ('manager', 'payroll', 'off'), ('manager', 'fixed_costs', 'off'), ('manager', 'admin_panel', 'off'),
  ('member', 'sales', 'own'), ('member', 'leads', 'full'), ('member', 'contract_hub', 'read'),
  ('member', 'tasks', 'full'), ('member', 'departments', 'own'), ('member', 'pipeline', 'full'),
  ('member', 'receivables', 'own'), ('member', 'payments', 'off'), ('member', 'customers', 'read'),
  ('member', 'vendors', 'read'), ('member', 'cashflow', 'off'), ('member', 'finance', 'off'),
  ('member', 'payroll', 'off'), ('member', 'fixed_costs', 'off'), ('member', 'admin_panel', 'off');

-- customers
INSERT INTO public.customers (id, name, type, status, region) VALUES
  ('cccccccc-0000-0000-0000-000000000001', '용인중학교', '학교', '활성', '경기'),
  ('cccccccc-0000-0000-0000-000000000002', '수원초등학교', '학교', '활성', '경기'),
  ('cccccccc-0000-0000-0000-000000000003', '경기도교육청', '교육청', '활성', '경기'),
  ('cccccccc-0000-0000-0000-000000000004', '서울특별시교육청', '교육청', '활성', '서울'),
  ('cccccccc-0000-0000-0000-000000000005', '한국문화예술교육진흥원', '기관', '활성', '서울'),
  ('cccccccc-0000-0000-0000-000000000006', '분당고등학교', '학교', '잠재', '경기'),
  ('cccccccc-0000-0000-0000-000000000007', '안양여자고등학교', '학교', '활성', '경기');

-- persons
INSERT INTO public.persons (id, name, phone, email) VALUES
  ('dddddddd-0000-0000-0000-000000000001', '김담당', '010-1111-2222', 'kim@school1.kr'),
  ('dddddddd-0000-0000-0000-000000000002', '이선생', '010-3333-4444', 'lee@school2.kr'),
  ('dddddddd-0000-0000-0000-000000000003', '박교사', '010-5555-6666', 'park@edu.kr'),
  ('dddddddd-0000-0000-0000-000000000004', '최과장', '010-7777-8888', 'choi@inst.kr');

-- person_org_relations
INSERT INTO public.person_org_relations (person_id, customer_id, title, is_current) VALUES
  ('dddddddd-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-000000000001', '교사', true),
  ('dddddddd-0000-0000-0000-000000000002', 'cccccccc-0000-0000-0000-000000000002', '교감', true),
  ('dddddddd-0000-0000-0000-000000000003', 'cccccccc-0000-0000-0000-000000000003', '장학사', true),
  ('dddddddd-0000-0000-0000-000000000004', 'cccccccc-0000-0000-0000-000000000005', '과장', true);

-- vendors
INSERT INTO public.vendors (id, name, type, phone, withholding_tax) VALUES
  ('eeeeeeee-0000-0000-0000-000000000001', '홍길동 아티스트', '프리랜서', '010-9999-0000', true),
  ('eeeeeeee-0000-0000-0000-000000000002', '(주)사운드시스템', '업체', '02-9876-5432', false),
  ('eeeeeeee-0000-0000-0000-000000000003', '김영희 강사', '프리랜서', '010-1234-5678', true),
  ('eeeeeeee-0000-0000-0000-000000000004', '무대장비렌탈', '업체', '031-111-2222', false),
  ('eeeeeeee-0000-0000-0000-000000000005', '이철수 MC', '프리랜서', '010-8765-4321', true);

-- sales
INSERT INTO public.sales (id, name, department, assignee_id, revenue, contract_stage, service_type, client_org, customer_id, inflow_date, progress_status, entity_id) VALUES
  ('ffffffff-0000-0000-0000-000000000001', '2026 용인중 SOS 공연', 'sound_of_school', 'aaaaaaaa-0000-0000-0000-000000000002', 3500000, '착수', 'SOS', '용인중학교', 'cccccccc-0000-0000-0000-000000000001', '2026-03-10', '착수중', '11111111-0000-0000-0000-000000000002'),
  ('ffffffff-0000-0000-0000-000000000002', '2026 수원초 교육프로그램', 'artkiwoom', 'aaaaaaaa-0000-0000-0000-000000000003', 5000000, '계약', '교육프로그램', '수원초등학교', 'cccccccc-0000-0000-0000-000000000002', '2026-03-15', '착수전', '11111111-0000-0000-0000-000000000002'),
  ('ffffffff-0000-0000-0000-000000000003', '경기도교육청 악기렌탈', 'school_store', 'aaaaaaaa-0000-0000-0000-000000000004', 12000000, '중도금', '교구대여', '경기도교육청', 'cccccccc-0000-0000-0000-000000000003', '2026-02-20', '착수중', '11111111-0000-0000-0000-000000000002'),
  ('ffffffff-0000-0000-0000-000000000004', '서울교육청 콘텐츠 제작', '002_creative', 'aaaaaaaa-0000-0000-0000-000000000001', 8000000, '완수', '콘텐츠제작', '서울특별시교육청', 'cccccccc-0000-0000-0000-000000000004', '2026-01-10', '착수중', '11111111-0000-0000-0000-000000000002'),
  ('ffffffff-0000-0000-0000-000000000005', '한국문화예술 행사운영', '002_creative', 'aaaaaaaa-0000-0000-0000-000000000004', 6500000, '잔금', '행사운영', '한국문화예술교육진흥원', 'cccccccc-0000-0000-0000-000000000005', '2026-01-05', '완수', '11111111-0000-0000-0000-000000000002'),
  ('ffffffff-0000-0000-0000-000000000006', '분당고 납품설치', 'school_store', 'aaaaaaaa-0000-0000-0000-000000000002', 2200000, '선금', '납품설치', '분당고등학교', 'cccccccc-0000-0000-0000-000000000006', '2026-04-01', '착수전', '11111111-0000-0000-0000-000000000002'),
  ('ffffffff-0000-0000-0000-000000000007', '안양여고 SOS 공연', 'sound_of_school', 'aaaaaaaa-0000-0000-0000-000000000002', 4000000, '계약', 'SOS', '안양여자고등학교', 'cccccccc-0000-0000-0000-000000000007', '2026-04-05', '착수전', '11111111-0000-0000-0000-000000000002');

-- sale_costs
INSERT INTO public.sale_costs (sale_id, item, amount, category, vendor_id, is_paid) VALUES
  ('ffffffff-0000-0000-0000-000000000001', '아티스트 섭외비', 800000, '출연료', 'eeeeeeee-0000-0000-0000-000000000001', true),
  ('ffffffff-0000-0000-0000-000000000001', '음향장비 임대', 500000, '장비', 'eeeeeeee-0000-0000-0000-000000000002', false),
  ('ffffffff-0000-0000-0000-000000000003', '악기 구매', 3000000, '기자재', 'eeeeeeee-0000-0000-0000-000000000004', true),
  ('ffffffff-0000-0000-0000-000000000004', '영상 촬영', 2000000, '외주', 'eeeeeeee-0000-0000-0000-000000000003', true),
  ('ffffffff-0000-0000-0000-000000000005', 'MC 출연료', 300000, '출연료', 'eeeeeeee-0000-0000-0000-000000000005', true);

-- payment_schedules
INSERT INTO public.payment_schedules (sale_id, label, amount, due_date, is_received, received_date, sort_order) VALUES
  ('ffffffff-0000-0000-0000-000000000001', '계약금', 1000000, '2026-03-15', true, '2026-03-14', 0),
  ('ffffffff-0000-0000-0000-000000000001', '잔금', 2500000, '2026-05-30', false, NULL, 1),
  ('ffffffff-0000-0000-0000-000000000003', '착수금', 4000000, '2026-03-01', true, '2026-03-02', 0),
  ('ffffffff-0000-0000-0000-000000000003', '중도금', 4000000, '2026-04-15', true, '2026-04-14', 1),
  ('ffffffff-0000-0000-0000-000000000003', '잔금', 4000000, '2026-05-31', false, NULL, 2),
  ('ffffffff-0000-0000-0000-000000000005', '계약금', 2000000, '2026-01-20', true, '2026-01-20', 0),
  ('ffffffff-0000-0000-0000-000000000005', '잔금', 4500000, '2026-03-31', true, '2026-03-30', 1);

-- leads
INSERT INTO public.leads (lead_id, inflow_date, remind_date, service_type, contact_name, client_org, phone, initial_content, assignee_id, status, customer_id, project_name) VALUES
  ('LEAD20260401-0001', '2026-04-01', '2026-04-25', 'SOS', '김교사', '화성중학교', '010-1111-3333', '공연 문의 전화 옴. 6월 예정', 'aaaaaaaa-0000-0000-0000-000000000002', '유입', NULL, '2026 화성중 SOS'),
  ('LEAD20260402-0001', '2026-04-02', '2026-04-20', '교육프로그램', '박선생', '평택초등학교', '010-2222-4444', '교육청 추천으로 연락', 'aaaaaaaa-0000-0000-0000-000000000003', '회신대기', NULL, '2026 평택초 교육'),
  ('LEAD20260403-0001', '2026-04-03', '2026-04-18', '납품설치', '이과장', '광명시청', '031-333-5555', '악기 납품 견적 요청', 'aaaaaaaa-0000-0000-0000-000000000004', '견적발송', NULL, '광명시청 납품'),
  ('LEAD20260405-0001', '2026-04-05', NULL, '콘텐츠제작', '최담당', '성남아트센터', '031-444-6666', '홍보영상 제작 문의', 'aaaaaaaa-0000-0000-0000-000000000001', '조율중', NULL, '성남아트센터 영상'),
  ('LEAD20260407-0001', '2026-04-07', '2026-04-30', 'SOS', '정교감', '수원중학교', '031-555-7777', '작년에도 진행했던 학교. 올해 재계약 희망', 'aaaaaaaa-0000-0000-0000-000000000002', '진행중', 'cccccccc-0000-0000-0000-000000000002', '2026 수원중 SOS');

-- tasks
INSERT INTO public.tasks (title, project_id, assignee_id, status, priority, due_date) VALUES
  ('계약서 작성 및 발송', 'ffffffff-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000002', '완료', 'High', '2026-03-20'),
  ('아티스트 컨택', 'ffffffff-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000002', '완료', 'High', '2026-03-25'),
  ('사전설문지 발송', 'ffffffff-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000002', '진행중', 'Medium', '2026-04-20'),
  ('교육 커리큘럼 기획', 'ffffffff-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000003', '할 일', 'Medium', '2026-04-25'),
  ('악기 재고 확인', 'ffffffff-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000004', '완료', 'High', '2026-02-28'),
  ('배송 일정 조율', 'ffffffff-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000004', '진행중', 'Medium', '2026-04-30'),
  ('영상 기획안 제출', 'ffffffff-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-000000000001', '완료', 'High', '2026-01-20'),
  ('촬영 진행', 'ffffffff-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-000000000001', '완료', 'High', '2026-02-10'),
  ('내부 업무: 견적 시스템 정비', NULL, 'aaaaaaaa-0000-0000-0000-000000000001', '진행중', 'Low', '2026-04-30');

-- project_logs
INSERT INTO public.project_logs (sale_id, content, log_type, author_id, contacted_at) VALUES
  ('ffffffff-0000-0000-0000-000000000001', '담당 선생님께 계약서 발송 완료', '이메일', 'aaaaaaaa-0000-0000-0000-000000000002', '2026-03-14 10:00:00+09'),
  ('ffffffff-0000-0000-0000-000000000001', '아티스트 일정 확정. 5월 20일 공연 예정', '통화', 'aaaaaaaa-0000-0000-0000-000000000002', '2026-03-20 14:30:00+09'),
  ('ffffffff-0000-0000-0000-000000000003', '악기 배송 3차 분납 협의 완료', '통화', 'aaaaaaaa-0000-0000-0000-000000000004', '2026-03-05 11:00:00+09'),
  ('ffffffff-0000-0000-0000-000000000005', '행사 완료. 정산 요청 발송', '이메일', 'aaaaaaaa-0000-0000-0000-000000000001', '2026-03-28 16:00:00+09');

-- sos_concerts
INSERT INTO public.sos_concerts (year, month, concert_date, school, concept, stage, tasks_done, tasks_total) VALUES
  (2026, 5, '2026-05-20', '용인중학교', '케이팝 댄스 페스티벌', '준비 중', 3, 11),
  (2026, 6, '2026-06-10', '안양여자고등학교', '어쿠스틱 콘서트', '계약 완료', 2, 11),
  (2026, 9, NULL, '수원중학교', '랩·힙합 콘서트', '계약 전', 0, 11);

-- notices
INSERT INTO public.notices (category, title, content, author_id, pinned) VALUES
  ('공지', '[테스트 환경] 스테이징 서버입니다', '이 환경은 보안 테스트용 스테이징 서버입니다. 실제 데이터가 아닙니다.', 'aaaaaaaa-0000-0000-0000-000000000001', true),
  ('업무', '2026년 4월 업무 공지', '월간 목표를 확인해주세요.', 'aaaaaaaa-0000-0000-0000-000000000001', false),
  ('인사', '신규 입사자 안내', '4월 신규 입사자를 환영합니다.', 'aaaaaaaa-0000-0000-0000-000000000001', false);

-- financial_accounts
INSERT INTO public.financial_accounts (business_entity, name, type, initial_balance, account_number) VALUES
  ('유어메이트', '기업은행 운영계좌', '보통예금', 50000000, '123-456789-01-001'),
  ('유어메이트', '국민은행 급여계좌', '보통예금', 10000000, '987-654321-00-002'),
  ('(주)002코퍼레이션', '신한은행 법인계좌', '보통예금', 100000000, '100-200-300456');

-- public_holidays
INSERT INTO public.public_holidays (holiday_date, name) VALUES
  ('2026-01-01', '신정'),
  ('2026-03-01', '삼일절'),
  ('2026-05-05', '어린이날'),
  ('2026-06-06', '현충일'),
  ('2026-08-15', '광복절'),
  ('2026-10-03', '개천절'),
  ('2026-10-09', '한글날'),
  ('2026-12-25', '크리스마스');

-- system_settings
INSERT INTO public.system_settings (key, value) VALUES
  ('onboarding_notion_url', ''),
  ('staging_notice', 'true');

-- api_usage (샘플)
INSERT INTO public.api_usage (model, endpoint, input_tokens, output_tokens, cost_usd) VALUES
  ('gpt-4o', '/api/chat', 500, 200, 0.00325),
  ('gpt-4o-mini', '/api/channeltalk', 200, 100, 0.000075),
  ('gpt-4o', '/api/chat', 800, 350, 0.0055);
