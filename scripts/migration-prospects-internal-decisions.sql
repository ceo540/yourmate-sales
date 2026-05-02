-- 명세 §5.13·§5.6·§5.9 backbone DB 마이그
-- prospects (영업 활동 추적) + internal_requests (사업부 간 의뢰) + decisions (회의·의사결정)
-- 멱등.

-- 1. prospects — 영업 활동 추적 (§5.13)
CREATE TABLE IF NOT EXISTS prospects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_name text NOT NULL,                  -- 학교·기관·기업명
  region text,                             -- 지역 (서울·경기·평택 등)
  category text,                           -- '학교' | '교육청' | '기관' | '기업' | '기타'
  contact_name text,
  contact_role text,                       -- 담당자 직책
  contact_phone text,
  contact_email text,
  service_target text,                     -- 영업 타깃 서비스 (SOS·교육·002C 등)
  source text,                             -- '인스타' | '네이버' | '소개' | '콜드메일' | '구전' | '이벤트' | ...
  status text DEFAULT 'cold',              -- 'cold' | 'contacted' | 'interested' | 'lead_converted' | 'lost'
  last_contacted_at timestamptz,
  next_action_at date,                     -- 다음 영업 시도일
  notes text,
  converted_lead_id uuid,                  -- 리드 전환 시
  archive_status text DEFAULT 'active',
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS prospects_status_idx ON prospects(status);
CREATE INDEX IF NOT EXISTS prospects_region_idx ON prospects(region);
CREATE INDEX IF NOT EXISTS prospects_service_target_idx ON prospects(service_target);
CREATE INDEX IF NOT EXISTS prospects_next_action_idx ON prospects(next_action_at) WHERE archive_status = 'active';
CREATE INDEX IF NOT EXISTS prospects_org_name_idx ON prospects(org_name);

-- 2. prospect_activities — 영업 활동 기록
CREATE TABLE IF NOT EXISTS prospect_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id uuid NOT NULL,
  activity_type text NOT NULL,             -- 'cold_email' | 'cold_call' | 'sms' | 'visit' | 'event' | 'reply'
  outcome text,                            -- 'no_response' | 'declined' | 'interested' | 'meeting_scheduled' | ...
  notes text,
  done_by uuid,
  done_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS prospect_activities_prospect_idx ON prospect_activities(prospect_id);
CREATE INDEX IF NOT EXISTS prospect_activities_done_at_idx ON prospect_activities(done_at DESC);

-- 3. internal_requests — 사업부 간 내부 의뢰 (§5.6 1단계 자동 추출)
CREATE TABLE IF NOT EXISTS internal_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid,
  from_dept text,
  to_dept text,
  type text,                               -- '디자인' | '장비' | '강사' | '음향' | '인쇄' | ...
  content text,
  source text NOT NULL,                    -- 'auto_detected' | 'manual'
  source_ref text,                         -- 채널톡 메시지 ID·메모 ID 등
  status text DEFAULT 'auto',              -- 'auto' | 'confirmed' | 'in_progress' | 'done' | 'rejected'
  responder_id uuid,
  notes text,
  archive_status text DEFAULT 'active',
  detected_at timestamptz DEFAULT now(),
  resolved_at timestamptz
);

CREATE INDEX IF NOT EXISTS internal_requests_project_idx ON internal_requests(project_id);
CREATE INDEX IF NOT EXISTS internal_requests_status_idx ON internal_requests(status);
CREATE INDEX IF NOT EXISTS internal_requests_dept_idx ON internal_requests(from_dept, to_dept);

-- 4. decisions — 회의·의사결정 (§5.9)
CREATE TABLE IF NOT EXISTS decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid,
  context text,                            -- 어떤 상황
  options_considered jsonb,                -- 검토한 옵션
  decision text NOT NULL,                  -- 최종 결정
  decided_by uuid,                         -- 결정자
  participants uuid[],                     -- 관련자
  rationale text,                          -- 근거
  decided_at timestamptz NOT NULL,
  archive_status text DEFAULT 'active',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS decisions_project_idx ON decisions(project_id);
CREATE INDEX IF NOT EXISTS decisions_decided_at_idx ON decisions(decided_at DESC);

-- 5. updated_at 트리거 (prospects만 — 다른 건 INSERT-only)
CREATE OR REPLACE FUNCTION prospects_set_updated_at()
RETURNS trigger AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS prospects_updated_at_trigger ON prospects;
CREATE TRIGGER prospects_updated_at_trigger
  BEFORE UPDATE ON prospects
  FOR EACH ROW EXECUTE FUNCTION prospects_set_updated_at();

-- 검증
SELECT
  to_regclass('public.prospects') AS prospects,
  to_regclass('public.prospect_activities') AS prospect_activities,
  to_regclass('public.internal_requests') AS internal_requests,
  to_regclass('public.decisions') AS decisions;
