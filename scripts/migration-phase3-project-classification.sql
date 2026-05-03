-- yourmate-system Phase 3 — 프로젝트 운영 분류 (yourmate-company-spec-v2 §5~8)
-- service_type(영업용) 위에 main_type + expansion_tags + capability_tags(운영 구조) 추가.
--
-- additive only. 기존 컬럼 손대지 않음.
-- 데모 단계(localStorage)에서 검증된 구조를 DB 로 승격.
-- 멱등 (IF NOT EXISTS).

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS main_type text,                                  -- '학교공연형' | '교육운영형' | '복합행사형' | '렌탈·납품형' | '콘텐츠제작형'
  ADD COLUMN IF NOT EXISTS expansion_tags text[] DEFAULT '{}',              -- 확장태그 다중 (15종)
  ADD COLUMN IF NOT EXISTS capability_tags text[] DEFAULT '{}',             -- 역량태그 다중 (24종)
  ADD COLUMN IF NOT EXISTS classification_confidence integer,               -- AI 자동분류 신뢰도 (0~100)
  ADD COLUMN IF NOT EXISTS classification_note text,                        -- "왜 이렇게 분류했는지"
  ADD COLUMN IF NOT EXISTS biz_completed_at timestamptz,                    -- 영업 완료 시점 (이번 라운드는 컬럼만)
  ADD COLUMN IF NOT EXISTS finance_completed_at timestamptz;                -- 재무 완료 시점 (이번 라운드는 컬럼만)

-- 인덱스 — main_type 필터 자주 쓰일 예정 (대시보드·리포트)
CREATE INDEX IF NOT EXISTS projects_main_type_idx ON projects(main_type) WHERE main_type IS NOT NULL;

-- 검증
SELECT
  column_name,
  data_type,
  column_default
FROM information_schema.columns
WHERE table_name = 'projects'
  AND column_name IN ('main_type','expansion_tags','capability_tags','classification_confidence','classification_note','biz_completed_at','finance_completed_at')
ORDER BY ordinal_position;
