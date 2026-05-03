-- yourmate-system Phase 4 — 운영 분류 lead → sale → project 승계
-- (yourmate-company-spec-v2 §5~8 / yourmate-system-functional-spec-v1 §4.3·§5)
--
-- lead 단계 = 추정/힌트 (guessed_*)
-- sale 단계 = 1차 확정 (main_type, expansion_tags)
-- project 단계 = 최종 확정 (Phase 3 완료)
--
-- additive only. service_type 손대지 않음. capability_tags 는 project 만 유지.
-- 멱등 (IF NOT EXISTS).

-- leads — 영업 단계 추정 힌트
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS guessed_main_type text,                  -- '학교공연형' | '교육운영형' | '복합행사형' | '렌탈·납품형' | '콘텐츠제작형'
  ADD COLUMN IF NOT EXISTS guessed_expansion_tags text[] DEFAULT '{}';

-- sales — 1차 확정
ALTER TABLE sales
  ADD COLUMN IF NOT EXISTS main_type text,
  ADD COLUMN IF NOT EXISTS expansion_tags text[] DEFAULT '{}';

CREATE INDEX IF NOT EXISTS sales_main_type_idx ON sales(main_type) WHERE main_type IS NOT NULL;

-- 검증
SELECT 'leads' AS t, column_name FROM information_schema.columns WHERE table_name = 'leads' AND column_name IN ('guessed_main_type', 'guessed_expansion_tags')
UNION ALL
SELECT 'sales', column_name FROM information_schema.columns WHERE table_name = 'sales' AND column_name IN ('main_type', 'expansion_tags')
ORDER BY t, column_name;
