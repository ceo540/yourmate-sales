-- 견적(quotes) + 견적항목(quote_items) 테이블
-- 사용자 직접 SQL Editor 실행. 운영 DB 변경 = 위험 작업.
--
-- 1) quotes — 견적서 헤더. sale/project/lead 어디든 연결 가능 (셋 다 nullable)
--    엔티티(사업자) 1개 필수. 견적번호 'YY-MM-NNN' 형식 (lib/quote-number.ts에서 채번)
-- 2) quote_items — 견적 항목 (CASCADE 삭제)
--
-- ※ FK 조인은 PostgREST에서 동작 안 함 (CLAUDE.md). 응용 코드는 수동 조인 패턴.
--   여기서는 quote_items.quote_id에만 ON DELETE CASCADE 위해 FK 명시.

-- ─────────────────────────────────────────────────────────
-- quotes
-- ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS quotes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_number    text NOT NULL,                                -- 'YY-MM-NNN' (예: '26-04-001')
  -- 연결 (셋 중 하나 이상 채워지는 게 일반적이지만 강제 X)
  sale_id         uuid,
  project_id      uuid,
  lead_id         uuid,
  -- 발행 주체/대상
  entity_id       uuid NOT NULL,                                -- business_entities.id
  customer_id     uuid,                                         -- customers.id (자유)
  client_dept     text,                                         -- 거래처 부서/담당자 메모
  project_name    text NOT NULL,                                -- 견적서 본문에 표시되는 건명
  -- 상태/저장 위치
  status          text NOT NULL DEFAULT 'draft',                -- draft | sent | accepted | rejected | cancelled
  html_path       text,                                         -- Dropbox 경로 (HTML 저장 시)
  pdf_path        text,                                         -- Dropbox 경로 (PDF 저장 시)
  -- 금액 (vat_included=true면 total_amount는 부가세 포함)
  total_amount    numeric(15, 2) NOT NULL DEFAULT 0,
  vat_included    boolean NOT NULL DEFAULT true,
  -- 발행/메타
  issue_date      date NOT NULL DEFAULT CURRENT_DATE,
  notes           text,
  created_by      uuid,                                         -- profiles.id
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT quotes_quote_number_unique UNIQUE (quote_number)
);

CREATE INDEX IF NOT EXISTS quotes_sale_id_idx        ON quotes (sale_id);
CREATE INDEX IF NOT EXISTS quotes_project_id_idx     ON quotes (project_id);
CREATE INDEX IF NOT EXISTS quotes_lead_id_idx        ON quotes (lead_id);
CREATE INDEX IF NOT EXISTS quotes_entity_id_idx      ON quotes (entity_id);
CREATE INDEX IF NOT EXISTS quotes_customer_id_idx    ON quotes (customer_id);
CREATE INDEX IF NOT EXISTS quotes_quote_number_idx   ON quotes (quote_number);
CREATE INDEX IF NOT EXISTS quotes_created_at_idx     ON quotes (created_at DESC);

-- ─────────────────────────────────────────────────────────
-- quote_items
-- ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS quote_items (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id     uuid NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  sort_order   int NOT NULL DEFAULT 0,                          -- 표시 순서 (0부터)
  category     text,                                            -- 시나리오/항목 그룹 (예: '기본', '1일 2회', '축제연계')
  name         text NOT NULL,
  description  text,
  qty          numeric(10, 2) NOT NULL DEFAULT 1,
  unit_price   numeric(15, 2) NOT NULL DEFAULT 0,
  amount       numeric(15, 2) NOT NULL DEFAULT 0,               -- 원칙: qty * unit_price. 수동 override 가능.
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS quote_items_quote_id_idx     ON quote_items (quote_id);
CREATE INDEX IF NOT EXISTS quote_items_sort_order_idx   ON quote_items (quote_id, sort_order);

-- ─────────────────────────────────────────────────────────
-- 트리거: updated_at 자동 갱신
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION quotes_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS quotes_updated_at ON quotes;
CREATE TRIGGER quotes_updated_at
BEFORE UPDATE ON quotes
FOR EACH ROW
EXECUTE FUNCTION quotes_set_updated_at();
