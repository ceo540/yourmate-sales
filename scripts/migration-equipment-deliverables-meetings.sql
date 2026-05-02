-- 라운드 A 데이터 모델 마이그
-- §5.7 장비·렌탈 통합 (equipment_master + equipment_rentals)
-- §5.8 결과물 아카이브 (project_deliverables)
-- §5.9 회의 (meetings — decisions 는 prospects 마이그에 이미 포함)
-- 멱등 (IF NOT EXISTS).

-- ============================================================
-- §5.7 장비 통합
-- ============================================================

CREATE TABLE IF NOT EXISTS equipment_master (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text,                              -- '음향' | '영상' | '텐트' | '교구' | '조명' | '의상' | '기타'
  owning_dept text NOT NULL,                  -- 'school_store' | '002_creative' | 'sound_of_school' | 'artkiwoom' | '002_entertainment' | 'yourmate'
  total_qty int NOT NULL DEFAULT 1,
  unit_price numeric,                         -- 자체 환산용 (원가 또는 외부 대여 단가)
  serial_no text,                             -- 시리얼/관리번호 (선택)
  storage_location text,                      -- 보관 위치
  notes text,
  archive_status text DEFAULT 'active',       -- 'active' | 'broken' | 'lost' | 'archived'
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS equipment_master_dept_idx ON equipment_master(owning_dept);
CREATE INDEX IF NOT EXISTS equipment_master_category_idx ON equipment_master(category);
CREATE INDEX IF NOT EXISTS equipment_master_name_idx ON equipment_master(name);
CREATE INDEX IF NOT EXISTS equipment_master_archive_idx ON equipment_master(archive_status);

CREATE TABLE IF NOT EXISTS equipment_rentals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_id uuid NOT NULL,
  qty int NOT NULL DEFAULT 1,
  project_id uuid,                            -- 내부 사용은 NULL 가능, 보통 채움
  customer_id uuid,                           -- 외부 대여
  date_start date NOT NULL,
  date_end date NOT NULL,
  status text DEFAULT 'reserved',             -- 'reserved' | 'in_use' | 'returned' | 'lost' | 'cancelled'
  rate numeric,                               -- 대여료 (외부면 청구액)
  responsible_user_id uuid,                   -- 담당자 (반납 책임)
  notes text,
  archive_status text DEFAULT 'active',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS equipment_rentals_equipment_idx ON equipment_rentals(equipment_id);
CREATE INDEX IF NOT EXISTS equipment_rentals_project_idx ON equipment_rentals(project_id);
CREATE INDEX IF NOT EXISTS equipment_rentals_date_idx ON equipment_rentals(date_start, date_end);
CREATE INDEX IF NOT EXISTS equipment_rentals_status_idx ON equipment_rentals(status);

-- ============================================================
-- §5.8 결과물 아카이브
-- ============================================================

CREATE TABLE IF NOT EXISTS project_deliverables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  type text NOT NULL,                         -- '공연영상' | '교육결과물' | '디자인산출물' | '음원' | '회의록' | 'brief' | '사진' | '기타'
  title text,
  dropbox_path text,                          -- Dropbox URL 또는 경로
  format text,                                -- 'mp4' | 'pdf' | 'wav' | 'md' | ...
  size_bytes bigint,
  delivered_at timestamptz,                   -- 고객 전달 시점
  client_confirmed_at timestamptz,            -- 고객 확인 시점
  metadata jsonb,                             -- 추출 메타 (GPS·EXIF·duration 등)
  ai_summary text,                            -- 빵빵이 자동 요약
  ai_tags text[],                             -- 빵빵이 자동 태그
  archive_status text DEFAULT 'active',
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS project_deliverables_project_idx ON project_deliverables(project_id);
CREATE INDEX IF NOT EXISTS project_deliverables_type_idx ON project_deliverables(type);
CREATE INDEX IF NOT EXISTS project_deliverables_delivered_idx ON project_deliverables(delivered_at DESC);

-- ============================================================
-- §5.9 회의
-- 기존 meetings (id, title, type, project_id, attendees text, date, location, notes, created_at) 유지
-- + 명세에 필요한 컬럼만 ALTER ADD (호환 유지)
-- decisions 는 이미 prospects 마이그에서 생성됨
-- ============================================================

CREATE TABLE IF NOT EXISTS meetings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  type text DEFAULT 'irregular',
  project_id uuid,
  attendees text,
  date timestamptz NOT NULL DEFAULT now(),
  location text,
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE meetings ADD COLUMN IF NOT EXISTS duration_minutes int;
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS participants uuid[];                 -- profiles.id 배열
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS external_participants text[];        -- 외부 참여자 이름
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS agenda text;                          -- 안건
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS minutes text;                         -- 정식 회의록 (notes 와 별도)
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS ai_summary text;                      -- 빵빵이 요약
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS decision_ids uuid[];                  -- 회의 → decisions
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS task_ids uuid[];                      -- 회의 → tasks
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS source text;                          -- 'manual' | 'plaud' | 'whisper' | 'channeltalk'
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS source_ref text;
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS archive_status text DEFAULT 'active';
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS created_by uuid;
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

CREATE INDEX IF NOT EXISTS meetings_date_idx ON meetings(date DESC);
CREATE INDEX IF NOT EXISTS meetings_project_idx ON meetings(project_id);
CREATE INDEX IF NOT EXISTS meetings_type_idx ON meetings(type);
CREATE INDEX IF NOT EXISTS meetings_archive_idx ON meetings(archive_status);

-- ============================================================
-- updated_at 트리거 (4개 테이블)
-- ============================================================

CREATE OR REPLACE FUNCTION round_a_set_updated_at()
RETURNS trigger AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS equipment_master_updated_at_trigger ON equipment_master;
CREATE TRIGGER equipment_master_updated_at_trigger
  BEFORE UPDATE ON equipment_master
  FOR EACH ROW EXECUTE FUNCTION round_a_set_updated_at();

DROP TRIGGER IF EXISTS equipment_rentals_updated_at_trigger ON equipment_rentals;
CREATE TRIGGER equipment_rentals_updated_at_trigger
  BEFORE UPDATE ON equipment_rentals
  FOR EACH ROW EXECUTE FUNCTION round_a_set_updated_at();

DROP TRIGGER IF EXISTS project_deliverables_updated_at_trigger ON project_deliverables;
CREATE TRIGGER project_deliverables_updated_at_trigger
  BEFORE UPDATE ON project_deliverables
  FOR EACH ROW EXECUTE FUNCTION round_a_set_updated_at();

DROP TRIGGER IF EXISTS meetings_updated_at_trigger ON meetings;
CREATE TRIGGER meetings_updated_at_trigger
  BEFORE UPDATE ON meetings
  FOR EACH ROW EXECUTE FUNCTION round_a_set_updated_at();

-- ============================================================
-- 검증
-- ============================================================
SELECT
  to_regclass('public.equipment_master') AS equipment_master,
  to_regclass('public.equipment_rentals') AS equipment_rentals,
  to_regclass('public.project_deliverables') AS project_deliverables,
  to_regclass('public.meetings') AS meetings;
