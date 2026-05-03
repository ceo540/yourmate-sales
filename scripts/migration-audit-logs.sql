-- 2026-05-04: audit_logs 테이블 추가 (P2-4) — 최종본 v2 (사용자 추가 요청 3개 반영)
-- 비파괴 — 새 테이블 생성만. 기존 데이터 영향 0.
--
-- 변경 사항 (v1 → v2):
--   1) summary 컬럼에 CHECK (length ≤ 120) 추가 — DB 단 안전망
--   2) taxonomy 주석 23개 명시 (POLICY_BLOCKED_SENSITIVE_INPUT, AUTH_FORBIDDEN 추가)
--   3) ip 컬럼 nullable 유지 (이미 nullable). 클라 IP 추출은 src/lib/audit.ts 에서
--      x-forwarded-for 우선 + cf-connecting-ip + x-real-ip fallback.

-- ======================
-- 1. 테이블 생성
-- ======================
CREATE TABLE IF NOT EXISTS audit_logs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 누가
  actor_id    uuid REFERENCES profiles(id) ON DELETE SET NULL,
  actor_role  text,                 -- 그 시점 role 스냅샷 (profiles.role 변경되어도 history 보존)

  -- 무엇·어디
  action      text NOT NULL,        -- taxonomy 키 (아래 주석 참고)
  entity_type text NOT NULL,        -- 'task' | 'project' | 'lead' | 'log' | 'memo' | 'customer' | 'sale' | 'quote' | 'rental' | 'auth' | 'policy'
  entity_id   uuid,                 -- 대상 리소스 id (null 가능 — 일괄 작업 등)

  -- 어떻게
  "before"    jsonb,                -- 변경 전 짧은 snapshot (헬퍼에서 화이트리스트만)
  "after"     jsonb,                -- 변경 후
  summary     text CHECK (summary IS NULL OR char_length(summary) <= 120),
                                    -- 사람용 한 줄 요약. 120자 제한 DB 강제 (헬퍼 truncate 안전망)

  -- 경로
  source      text NOT NULL DEFAULT 'ui',  -- 'ui' | 'bbang_chat' | 'bbang_project' | 'cron' | 'api'
  ip          inet,                 -- 요청 IP (헬퍼가 x-forwarded-for 우선 추출. nullable)

  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ======================
-- 1-1. action taxonomy 주석 (23개)
-- ======================
-- DB 단 enum/CHECK 강제 X — 유연성 우선 (새 액션 추가 시 마이그 없이)
-- 코드(src/lib/audit.ts)의 AuditAction 타입이 단일 진실
--
-- [Task — 7]
--   TASK_CREATED · TASK_UPDATED · TASK_REASSIGNED
--   TASK_STATUS_CHANGED · TASK_COMPLETED · TASK_REOPENED · TASK_DELETED
-- [Project — 12]
--   PROJECT_STATUS_CHANGED · PROJECT_CANCELED
--   PROJECT_MEMBER_ADDED · PROJECT_MEMBER_REMOVED · PROJECT_PM_CHANGED
--   PROJECT_MEMO_CREATED · PROJECT_MEMO_UPDATED · PROJECT_MEMO_DELETED
--   PROJECT_OVERVIEW_UPDATED · PROJECT_PENDING_DISCUSSION_UPDATED
--   PROJECT_CUSTOMER_LINKED
-- [Communication Log — 2]
--   LOG_CREATED · LOG_DELETED
-- [Bbang — 1]
--   BBANG_TOOL_INVOKED   (도구명은 summary에)
-- [Security — 2 *추가됨*]
--   POLICY_BLOCKED_SENSITIVE_INPUT   (민감 키워드 차단된 시도 — 보안 분석)
--   AUTH_FORBIDDEN                   (권한 부족 차단 — requireAdminOrManager·requireTaskOwnership·requireLogOwnerOrAdmin·requireMemoOwnerOrAdmin 실패)

-- ======================
-- 2. 인덱스
-- ======================
CREATE INDEX IF NOT EXISTS idx_audit_actor_created ON audit_logs (actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_entity        ON audit_logs (entity_type, entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_action        ON audit_logs (action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_created       ON audit_logs (created_at DESC);

-- ======================
-- 3. RLS — 클라이언트 직접 접근 차단 (service_role 우회)
-- ======================
-- 정책: select = self 또는 admin/manager만. write = service_role만 (정책 없음 = 거부)

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS audit_read_self_or_admin ON audit_logs;
CREATE POLICY audit_read_self_or_admin ON audit_logs
  FOR SELECT
  USING (
    actor_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'manager')
    )
  );

-- INSERT/UPDATE/DELETE 정책 없음 → 클라이언트 직접 시도 차단
-- service_role(createAdminClient)은 RLS 자동 우회 → recordAudit 헬퍼만 통과

-- ======================
-- 4. 검증 쿼리 (실행 후 결과 확인용)
-- ======================
SELECT column_name, data_type, is_nullable
  FROM information_schema.columns
 WHERE table_name = 'audit_logs'
 ORDER BY ordinal_position;

SELECT indexname FROM pg_indexes WHERE tablename = 'audit_logs';

-- (정책 확인)
SELECT policyname, cmd FROM pg_policies WHERE tablename = 'audit_logs';
