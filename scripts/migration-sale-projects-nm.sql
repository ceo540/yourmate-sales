-- N:M sale↔project 마이그
-- yourmate-spec.md §3.2 기반
-- 멱등. 다운타임 0. 기존 _source_sale_id 그대로 유지 (fallback).

-- 1. sale_projects join 테이블
CREATE TABLE IF NOT EXISTS sale_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid NOT NULL,
  project_id uuid NOT NULL,
  role text DEFAULT '주계약',                          -- '주계약' / '부계약' / '예산분할' / '추가'
  revenue_share_pct numeric DEFAULT 100,                -- sale.revenue 중 이 project에 귀속될 %
  cost_share_pct numeric DEFAULT 100,                   -- sale_costs 분배 %
  note text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- UNIQUE: 같은 (sale, project) 쌍 중복 X
CREATE UNIQUE INDEX IF NOT EXISTS sale_projects_sale_project_uniq
  ON sale_projects(sale_id, project_id);

-- 조회 인덱스
CREATE INDEX IF NOT EXISTS sale_projects_sale_id_idx ON sale_projects(sale_id);
CREATE INDEX IF NOT EXISTS sale_projects_project_id_idx ON sale_projects(project_id);

-- 2. 기존 1:1 매핑 백필 (멱등 — ON CONFLICT DO NOTHING)
INSERT INTO sale_projects (sale_id, project_id, role, revenue_share_pct, cost_share_pct)
SELECT _source_sale_id, id, '주계약', 100, 100
FROM projects
WHERE _source_sale_id IS NOT NULL
ON CONFLICT (sale_id, project_id) DO NOTHING;

-- 3. updated_at 자동 갱신 트리거
CREATE OR REPLACE FUNCTION sale_projects_set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sale_projects_updated_at_trigger ON sale_projects;
CREATE TRIGGER sale_projects_updated_at_trigger
  BEFORE UPDATE ON sale_projects
  FOR EACH ROW
  EXECUTE FUNCTION sale_projects_set_updated_at();

-- 4. 검증 쿼리 (실행 후 결과 보기)
SELECT
  (SELECT COUNT(*) FROM sale_projects) AS sale_projects_count,
  (SELECT COUNT(*) FROM projects WHERE _source_sale_id IS NOT NULL) AS expected_count;
