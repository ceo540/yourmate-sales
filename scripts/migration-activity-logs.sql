-- 자동 업무표 백본 (yourmate-spec.md §5.4.2)
-- 직원 행위 통합 인덱스. 단계 1 (yourmate 내부) → 단계 2~6 (채널톡·캘린더·드롭박스·이메일·외부 메신저).
-- 멱등.

CREATE TABLE IF NOT EXISTS activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid NOT NULL,                  -- 누가 (profiles.id)
  source text NOT NULL,                    -- 'yourmate' | 'channeltalk' | 'calendar' | 'dropbox' | 'gmail' | ...
  action text NOT NULL,                    -- 'create_log' | 'create_memo' | 'update_status' | 'reply' | 'meeting' | 'visit' | ...
  ref_type text,                           -- 'project' | 'lead' | 'task' | 'sale' | 'customer' | 'worker_engagement' | 'memo' | ...
  ref_id uuid,                             -- 참조 데이터 ID
  summary text,                            -- 빵빵이 1줄 요약 (없어도 OK)
  raw jsonb,                               -- 원본 데이터 (선택)
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- 조회 인덱스
CREATE INDEX IF NOT EXISTS activity_logs_actor_occurred_idx
  ON activity_logs(actor_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS activity_logs_ref_idx
  ON activity_logs(ref_type, ref_id);
CREATE INDEX IF NOT EXISTS activity_logs_source_idx
  ON activity_logs(source);
CREATE INDEX IF NOT EXISTS activity_logs_occurred_idx
  ON activity_logs(occurred_at DESC);

-- 검증
SELECT to_regclass('public.activity_logs') AS activity_logs;
