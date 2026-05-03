-- 2026-05-03: tasks 완료 코멘트 컬럼 추가 (Phase 9.2)
-- 비파괴 ADD COLUMN IF NOT EXISTS — 기존 row 영향 없음, 다운타임 0

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS completed_note text,
  ADD COLUMN IF NOT EXISTS completed_at   timestamptz,
  ADD COLUMN IF NOT EXISTS completed_by   uuid REFERENCES profiles(id) ON DELETE SET NULL;

-- 기존 status='완료' row의 completed_at은 updated_at으로 backfill
UPDATE tasks
   SET completed_at = updated_at
 WHERE status = '완료' AND completed_at IS NULL;

-- 검증 쿼리 (실행 후 결과 확인용)
SELECT column_name, data_type, is_nullable
  FROM information_schema.columns
 WHERE table_name = 'tasks'
   AND column_name IN ('completed_note', 'completed_at', 'completed_by');

SELECT count(*) AS total_completed,
       count(completed_at) AS backfilled
  FROM tasks
 WHERE status = '완료';
