-- 협의해야 할 내용 3분할 — 클라이언트 / 내부 / 외주사
-- 사용자 명시 (2026-04-29): 중간 중계 시 감정·체력 소모 큼 → 분리 정리 필요.
--
-- 정책:
--   - 기존 projects.pending_discussion 컬럼은 *그대로 보존* (legacy. 빵빵이 regenerate 시 자동 분류로 이전)
--   - 3개 신규 컬럼 추가 — UI·도구는 3개 사용
--   - 멱등성: ADD COLUMN IF NOT EXISTS

ALTER TABLE projects ADD COLUMN IF NOT EXISTS pending_discussion_client text;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS pending_discussion_internal text;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS pending_discussion_vendor text;
