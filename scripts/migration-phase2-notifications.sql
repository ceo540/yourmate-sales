-- Phase 2: 결제·청구 알림 자동화 backbone
-- 사용자 직접 실행 후 컨펌 필요. 운영 DB 변경 = 위험 작업.
--
-- 1) 알림 설정 테이블 — 종류별 ON/OFF + 빈도 등 config
-- 2) 알림 로그 테이블 — 중복 발송 방지 (같은 reference_id + scheduled_label은 한 번만)
-- 3) profiles.channeltalk_user_id — 멘션용 매핑 (닉네임 사용 직원 추후 채움)

-- ─────────────────────────────────────────────────────────
-- notification_settings: 알림 종류별 설정
-- ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notification_settings (
  id text PRIMARY KEY,                                  -- 알림 종류 키 ('payment_due', 'payable_due' 등)
  label text NOT NULL,                                  -- 사람용 이름
  enabled boolean NOT NULL DEFAULT true,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,            -- 종류별 설정 (시점·대상 등)
  description text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 디폴트 설정값
INSERT INTO notification_settings (id, label, config, description) VALUES
  ('payment_due',
   '결제 입금 알림 (sales)',
   '{"d_minus": [3, 0], "d_plus": [1, 7], "send_to": "service_group", "include_assignee_mention": true}'::jsonb,
   'payment_schedules.is_received=false 항목을 due_date 기준으로 D-3 / D-day / D+1 / D+7에 알림. service_type별 채널톡 그룹으로 발송.'
  ),
  ('payable_due',
   '외주비 지급 알림 (sale_costs)',
   '{"d_minus": [3, 0], "d_plus": [1, 7], "send_to": "fixed_group", "target_group_id": "563786", "include_assignee_mention": true}'::jsonb,
   'sale_costs.is_paid=false 항목을 due_date 기준으로 D-3 / D-day / D+1 / D+7에 알림. 채널톡 9_외주비_결제 그룹(563786)으로 발송.'
  )
ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────
-- notification_log: 중복 발송 방지 + 추적
-- ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notification_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_type text NOT NULL,                      -- notification_settings.id 참조
  reference_table text NOT NULL,                        -- 'payment_schedules' | 'sale_costs'
  reference_id text NOT NULL,
  scheduled_label text NOT NULL,                        -- 'D-3' | 'D-day' | 'D+1' | 'D+7'
  channel_group_id text,                                -- 발송된 채널톡 그룹
  message text,
  sent_at timestamptz NOT NULL DEFAULT now(),
  dry_run boolean NOT NULL DEFAULT false,
  CONSTRAINT notification_log_unique UNIQUE (notification_type, reference_id, scheduled_label)
);

CREATE INDEX IF NOT EXISTS notification_log_sent_at_idx ON notification_log (sent_at DESC);
CREATE INDEX IF NOT EXISTS notification_log_ref_idx ON notification_log (reference_table, reference_id);

-- ─────────────────────────────────────────────────────────
-- profiles 멘션용 채널톡 user id 매핑
-- ─────────────────────────────────────────────────────────
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS channeltalk_user_id text;

-- 사용자 컨펌 후 추가 — 닉네임 사용 직원 매핑 시:
-- UPDATE profiles SET channeltalk_user_id = 'xxx' WHERE id = '...';

-- ─────────────────────────────────────────────────────────
-- sale_costs.due_date — 외주비 지급 예정일 (외주비 알림에 필요)
-- ─────────────────────────────────────────────────────────
ALTER TABLE sale_costs ADD COLUMN IF NOT EXISTS due_date date;

-- 기존 행은 NULL → 알림 대상 아님. 사용자가 CostSheetEditor·CostModal에서 채워나감.
CREATE INDEX IF NOT EXISTS sale_costs_due_date_idx ON sale_costs (due_date) WHERE due_date IS NOT NULL AND is_paid = false;
