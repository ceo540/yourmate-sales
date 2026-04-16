-- ============================================================
-- RLS 전체 활성화 + 정책 설정 (idempotent — 반복 실행해도 안전)
-- 목적: anon 키로 DB 직접 조회 차단
-- 원칙: 로그인(authenticated)만 허용 / 미로그인(anon) 전면 차단
-- 주의: createAdminClient()는 service_role → RLS 우회 → 기존 코드 영향 없음
-- ============================================================

-- ── RLS 활성화 ─────────────────────────────────────────────
ALTER TABLE public.customers                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.persons                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.person_org_relations     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_costs               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendors                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rentals                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_logs             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sos_concerts             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_cards           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_items         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notices                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_reports           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_reports            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_requests           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_balances           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_records       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.public_holidays          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_work_schedules  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.one_on_ones              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_requests        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_accounts       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cashflow                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fixed_costs              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salary_records           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_transactions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_bonus_items     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_entities        ENABLE ROW LEVEL SECURITY;

-- ── 기존 정책 제거 (중복 방지) ─────────────────────────────
DROP POLICY IF EXISTS "auth_all" ON public.customers;
DROP POLICY IF EXISTS "auth_all" ON public.persons;
DROP POLICY IF EXISTS "auth_all" ON public.person_org_relations;
DROP POLICY IF EXISTS "auth_all" ON public.leads;
DROP POLICY IF EXISTS "auth_all" ON public.sales;
DROP POLICY IF EXISTS "auth_all" ON public.sale_costs;
DROP POLICY IF EXISTS "auth_all" ON public.vendors;
DROP POLICY IF EXISTS "auth_all" ON public.rentals;
DROP POLICY IF EXISTS "auth_all" ON public.project_logs;
DROP POLICY IF EXISTS "auth_all" ON public.sos_concerts;
DROP POLICY IF EXISTS "auth_all" ON public.profiles;
DROP POLICY IF EXISTS "auth_all" ON public.departments;
DROP POLICY IF EXISTS "auth_all" ON public.tasks;
DROP POLICY IF EXISTS "auth_all" ON public.role_permissions;
DROP POLICY IF EXISTS "auth_all" ON public.employee_cards;
DROP POLICY IF EXISTS "auth_all" ON public.onboarding_items;
DROP POLICY IF EXISTS "auth_all" ON public.system_settings;
DROP POLICY IF EXISTS "auth_all" ON public.notices;
DROP POLICY IF EXISTS "auth_all" ON public.weekly_reports;
DROP POLICY IF EXISTS "auth_all" ON public.daily_reports;
DROP POLICY IF EXISTS "auth_all" ON public.leave_requests;
DROP POLICY IF EXISTS "auth_all" ON public.leave_balances;
DROP POLICY IF EXISTS "auth_all" ON public.attendance_records;
DROP POLICY IF EXISTS "auth_all" ON public.public_holidays;
DROP POLICY IF EXISTS "auth_all" ON public.employee_work_schedules;
DROP POLICY IF EXISTS "auth_all" ON public.one_on_ones;
DROP POLICY IF EXISTS "auth_all" ON public.document_requests;
DROP POLICY IF EXISTS "auth_all" ON public.expenses;
DROP POLICY IF EXISTS "auth_all" ON public.financial_accounts;
DROP POLICY IF EXISTS "auth_all" ON public.cashflow;
DROP POLICY IF EXISTS "auth_all" ON public.fixed_costs;
DROP POLICY IF EXISTS "auth_all" ON public.payroll;
DROP POLICY IF EXISTS "auth_all" ON public.salary_records;
DROP POLICY IF EXISTS "auth_all" ON public.bank_transactions;
DROP POLICY IF EXISTS "auth_all" ON public.employee_bonus_items;
DROP POLICY IF EXISTS "auth_all" ON public.business_entities;

-- ── 정책 생성 — 로그인 사용자 전체 허용 ────────────────────
CREATE POLICY "auth_all" ON public.customers                FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON public.persons                  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON public.person_org_relations     FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON public.leads                    FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON public.sales                    FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON public.sale_costs               FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON public.vendors                  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON public.rentals                  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON public.project_logs             FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON public.sos_concerts             FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON public.profiles                 FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON public.departments              FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON public.tasks                    FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON public.role_permissions         FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON public.employee_cards           FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON public.onboarding_items         FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON public.system_settings          FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON public.notices                  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON public.weekly_reports           FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON public.daily_reports            FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON public.leave_requests           FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON public.leave_balances           FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON public.attendance_records       FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON public.public_holidays          FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON public.employee_work_schedules  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON public.one_on_ones              FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON public.document_requests        FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON public.expenses                 FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON public.financial_accounts       FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON public.cashflow                 FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON public.fixed_costs              FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON public.payroll                  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON public.salary_records           FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON public.bank_transactions        FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON public.employee_bonus_items     FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all" ON public.business_entities        FOR ALL TO authenticated USING (true) WITH CHECK (true);
