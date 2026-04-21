-- ============================================================
-- Migration: projects 테이블 도입
-- 2026-04-20
-- Phase 1: 스키마 추가 (additive only, 기존 데이터 영향 없음)
-- Phase 2: 기존 데이터 마이그레이션
-- ============================================================

-- ── Phase 1: 스키마 추가 ──────────────────────────────────────

-- 0. 이전 실패 시 클린업 (신규 테이블만, 기존 데이터 없음)
DROP TABLE IF EXISTS public.project_members CASCADE;
DROP TABLE IF EXISTS public.projects CASCADE;

-- 1. projects 테이블 (중심 허브)
CREATE TABLE public.projects (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name             text NOT NULL,
  service_type     text,
  department       text,
  pm_id            uuid REFERENCES public.profiles(id),
  customer_id      uuid REFERENCES public.customers(id),
  person_id        uuid REFERENCES public.persons(id),
  status           text DEFAULT '진행중',
  dropbox_url      text,
  memo             text,
  notes            text,
  project_overview text,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now(),
  _source_sale_id  uuid
);

-- 2. project_members (PM + 팀원 다중 담당자)
CREATE TABLE public.project_members (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role       text NOT NULL DEFAULT '팀원',  -- 'PM' | '팀원'
  created_at timestamptz DEFAULT now(),
  UNIQUE(project_id, profile_id)
);

-- 3. leads에 project_id 추가
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id),
  ADD COLUMN IF NOT EXISTS is_primary_lead boolean DEFAULT false;

-- 4. sales에 project_id + 계약분리사유 추가
ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id),
  ADD COLUMN IF NOT EXISTS contract_split_reason text;

-- 5. project_logs에 project_id + log_category 추가 (sale_id 유지)
ALTER TABLE public.project_logs
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id),
  ADD COLUMN IF NOT EXISTS log_category text DEFAULT '외부';  -- '외부' | '내부'

-- 6. 인덱스
CREATE INDEX IF NOT EXISTS idx_projects_pm_id        ON public.projects(pm_id);
CREATE INDEX IF NOT EXISTS idx_projects_customer_id  ON public.projects(customer_id);
CREATE INDEX IF NOT EXISTS idx_project_members_pid   ON public.project_members(project_id);
CREATE INDEX IF NOT EXISTS idx_project_members_uid   ON public.project_members(profile_id);
CREATE INDEX IF NOT EXISTS idx_leads_project_id      ON public.leads(project_id);
CREATE INDEX IF NOT EXISTS idx_sales_project_id      ON public.sales(project_id);
CREATE INDEX IF NOT EXISTS idx_project_logs_proj_id  ON public.project_logs(project_id);


-- ── Phase 2: 기존 데이터 마이그레이션 ─────────────────────────
-- 기존 sales 1건 → projects 1건 자동 생성
-- 이후 UI에서 프로젝트 통합/분리 가능

-- 2-1. 기존 sales → projects 생성
INSERT INTO public.projects (
  name, service_type, department, pm_id,
  customer_id, person_id, status,
  dropbox_url, memo, project_overview,
  created_at, updated_at,
  _source_sale_id
)
SELECT
  s.name,
  s.service_type,
  s.department,
  s.assignee_id,
  s.customer_id,
  s.person_id,
  CASE
    WHEN s.progress_status = '완수' THEN '완료'
    WHEN s.contract_stage  = '완수' THEN '완료'
    ELSE '진행중'
  END,
  s.dropbox_url,
  s.memo,
  s.project_overview,
  s.created_at,
  s.updated_at,
  s.id
FROM public.sales s
WHERE NOT EXISTS (
  SELECT 1 FROM public.projects p WHERE p._source_sale_id = s.id
);

-- 2-2. sales.project_id 업데이트
UPDATE public.sales s
SET project_id = p.id
FROM public.projects p
WHERE p._source_sale_id = s.id
  AND s.project_id IS NULL;

-- 2-3. project_logs.project_id 업데이트 (sale_id 경유)
UPDATE public.project_logs pl
SET project_id = s.project_id
FROM public.sales s
WHERE pl.sale_id = s.id
  AND s.project_id IS NOT NULL
  AND pl.project_id IS NULL;

-- 2-4. leads.project_id 업데이트 (converted_sale_id 경유)
UPDATE public.leads l
SET project_id       = s.project_id,
    is_primary_lead  = true
FROM public.sales s
WHERE l.converted_sale_id = s.id
  AND s.project_id IS NOT NULL
  AND l.project_id IS NULL;

-- 2-5. PM → project_members 삽입 (assignee_id 기반)
INSERT INTO public.project_members (project_id, profile_id, role)
SELECT p.id, p.pm_id, 'PM'
FROM public.projects p
WHERE p.pm_id IS NOT NULL
ON CONFLICT (project_id, profile_id) DO NOTHING;


-- ── 검증 쿼리 ────────────────────────────────────────────────
-- 아래 쿼리로 결과 확인 후 이상 없으면 완료

-- SELECT COUNT(*) FROM public.projects;
-- SELECT COUNT(*) FROM public.project_members;
-- SELECT COUNT(*) FROM public.sales WHERE project_id IS NOT NULL;
-- SELECT COUNT(*) FROM public.leads WHERE project_id IS NOT NULL;
-- SELECT COUNT(*) FROM public.project_logs WHERE project_id IS NOT NULL;
