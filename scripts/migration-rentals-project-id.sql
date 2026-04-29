-- ============================================================
-- Migration: rentals.project_id 추가
-- 2026-04-29
-- 한 프로젝트 안에서 여러 배송건(rental)을 묶기 위한 직접 연결.
-- 기존 sale_id 컬럼은 보존 (sale 경유 연결 유지).
-- additive only — 기존 데이터 영향 없음.
-- ============================================================

-- 1. 컬럼 추가 (NULLABLE)
ALTER TABLE public.rentals
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id);

-- 2. 인덱스
CREATE INDEX IF NOT EXISTS idx_rentals_project_id ON public.rentals(project_id);

-- 3. 기존 데이터 베스트-에포트 백필
--    rentals.sale_id → sales.project_id 경유로 채움
UPDATE public.rentals r
SET    project_id = s.project_id
FROM   public.sales s
WHERE  r.sale_id = s.id
  AND  s.project_id IS NOT NULL
  AND  r.project_id IS NULL;

-- ── 검증 쿼리 ─────────────────────────────────────────────────
-- SELECT COUNT(*) AS total, COUNT(project_id) AS with_project FROM public.rentals;
