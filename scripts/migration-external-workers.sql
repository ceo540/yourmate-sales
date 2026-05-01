-- 외부 인력 통합 모델 마이그 (yourmate-spec.md §5.5)
-- 강사·아티스트·스태프·기술 풀 통합. 정산·평가·재사용 결정 토대.
-- 멱등 (IF NOT EXISTS). 다운타임 0.

-- 1. external_workers — 외부 인력 마스터
CREATE TABLE IF NOT EXISTS external_workers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL,                      -- '강사' | '아티스트' | '스태프' | '기술' | '복합'
  phone text,
  email text,

  -- 정산 (민감 — §4.2 L3 단계에서 pgcrypto 암호화 예정. 지금은 평문)
  ssn_text text,                           -- 주민번호 (L3 마이그 시 ssn_encrypted bytea로 교체)
  bank_name text,
  bank_account_text text,                  -- 계좌번호 (L3 마이그 시 암호화)

  -- 첨부 (Dropbox URL)
  id_card_url text,
  bank_book_url text,

  -- 단가·전문
  default_rate_type text,                  -- 'per_hour' | 'per_session' | 'per_project'
  default_rate numeric,
  specialties text[],                      -- ['공연', '교육', '디자인', ...]
  notes text,

  -- 평가·재사용
  rating numeric,                          -- 0~5
  evaluation_notes text,
  reuse_status text DEFAULT 'normal',      -- 'preferred' | 'normal' | 'avoid'

  -- 메타
  first_engaged_at date,
  last_engaged_at date,
  total_engagements int DEFAULT 0,
  total_paid numeric DEFAULT 0,

  -- §4.6.1 정책: 삭제 X, archive_status로 이동
  archive_status text DEFAULT 'active',    -- 'active' | 'pending' | 'cancelled' | 'archived'

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS external_workers_type_idx ON external_workers(type);
CREATE INDEX IF NOT EXISTS external_workers_reuse_status_idx ON external_workers(reuse_status);
CREATE INDEX IF NOT EXISTS external_workers_archive_status_idx ON external_workers(archive_status);
CREATE INDEX IF NOT EXISTS external_workers_name_idx ON external_workers(name);

-- 2. worker_engagements — 프로젝트 참여 기록
CREATE TABLE IF NOT EXISTS worker_engagements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id uuid NOT NULL,
  project_id uuid NOT NULL,
  role text,                               -- '메인 강사' | '서브' | 'MC' | '음향' | ...
  date_start date,
  date_end date,
  hours numeric,
  rate_type text,                          -- 'per_hour' | 'per_session' | 'per_project'
  rate numeric,
  amount numeric,                          -- 단가 × 시간 또는 고정
  note text,

  archive_status text DEFAULT 'active',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS worker_engagements_worker_idx ON worker_engagements(worker_id);
CREATE INDEX IF NOT EXISTS worker_engagements_project_idx ON worker_engagements(project_id);
CREATE INDEX IF NOT EXISTS worker_engagements_date_idx ON worker_engagements(date_start);

-- 3. worker_payments — 월별 묶음 정산
CREATE TABLE IF NOT EXISTS worker_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id uuid NOT NULL,
  engagement_ids uuid[],                   -- 묶음 정산 (월 정산 다건)
  total_amount numeric NOT NULL,
  scheduled_date date,
  paid_date date,
  status text DEFAULT 'pending',           -- 'pending' | 'paid' | 'failed' | 'cancelled'
  tax_form_sent_at timestamptz,            -- 세무사 핸드오프 시점
  note text,

  archive_status text DEFAULT 'active',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS worker_payments_worker_idx ON worker_payments(worker_id);
CREATE INDEX IF NOT EXISTS worker_payments_status_idx ON worker_payments(status);
CREATE INDEX IF NOT EXISTS worker_payments_scheduled_idx ON worker_payments(scheduled_date);

-- 4. updated_at 자동 트리거 (external_workers, worker_payments)
CREATE OR REPLACE FUNCTION external_workers_set_updated_at()
RETURNS trigger AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS external_workers_updated_at_trigger ON external_workers;
CREATE TRIGGER external_workers_updated_at_trigger
  BEFORE UPDATE ON external_workers
  FOR EACH ROW EXECUTE FUNCTION external_workers_set_updated_at();

DROP TRIGGER IF EXISTS worker_payments_updated_at_trigger ON worker_payments;
CREATE TRIGGER worker_payments_updated_at_trigger
  BEFORE UPDATE ON worker_payments
  FOR EACH ROW EXECUTE FUNCTION external_workers_set_updated_at();

-- 5. 검증 — 테이블 생성 확인
SELECT
  to_regclass('public.external_workers') AS external_workers,
  to_regclass('public.worker_engagements') AS worker_engagements,
  to_regclass('public.worker_payments') AS worker_payments;
