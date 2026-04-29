-- 프로젝트별 담당자(person) 별도 지정 컬럼
-- 사용자 직접 SQL Editor 실행 또는 supabase db query --linked 자율 실행 OK.
-- ALTER ADD COLUMN IF NOT EXISTS — 멱등성 보장. 데이터 손실 0.
--
-- 동작 정책:
--   - projects.contact_person_id IS NOT NULL → 그 person을 프로젝트 담당자로 표시
--   - NULL → customer 안의 is_current=true person을 fallback (기존 동작 유지)
--   - 다른 프로젝트와 독립. 같은 customer 다른 프로젝트가 영향 받지 않음.

ALTER TABLE projects ADD COLUMN IF NOT EXISTS contact_person_id uuid;

CREATE INDEX IF NOT EXISTS projects_contact_person_id_idx ON projects (contact_person_id);
