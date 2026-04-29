-- 프로젝트 짧은 요약 (한눈에 박스용)
-- 사용자 요청: 현재 overview_summary가 너무 전체적인 내용을 담고 있음.
-- → 상단엔 *짧은 요약*(항상 보임) / 최하단엔 *전체 개요*(접힘, PM 정독용) 분리.
--
-- 멱등성: ADD COLUMN IF NOT EXISTS

ALTER TABLE projects ADD COLUMN IF NOT EXISTS short_summary text;
