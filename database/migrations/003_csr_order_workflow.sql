CREATE SEQUENCE flowline.order_number_seq START WITH 1001;

ALTER TABLE flowline.orders
  ALTER COLUMN order_number SET DEFAULT (
    'FO-' || to_char(clock_timestamp(), 'YYYY') || '-' ||
    lpad(nextval('flowline.order_number_seq')::text, 6, '0')
  ),
  ALTER COLUMN customer_name DROP NOT NULL,
  ALTER COLUMN product_name DROP NOT NULL,
  ALTER COLUMN requested_quantity DROP NOT NULL,
  ALTER COLUMN requested_delivery_date DROP NOT NULL;

ALTER TABLE flowline.attachments
  ADD COLUMN content bytea,
  ADD CONSTRAINT attachments_size_limit CHECK (size_bytes <= 5242880),
  ADD CONSTRAINT attachments_content_size CHECK (
    content IS NULL OR octet_length(content) = size_bytes
  );

CREATE TABLE flowline.clarification_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES flowline.orders(id) ON DELETE RESTRICT,
  stage text NOT NULL,
  question text NOT NULL,
  status text NOT NULL DEFAULT 'OPEN',
  requested_by_auth_user_id text NOT NULL,
  requested_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  response text,
  responded_by_auth_user_id text,
  responded_at timestamptz,
  CONSTRAINT clarification_requests_stage CHECK (
    stage IN ('R&D', 'Planning', 'Press', 'Shipping')
  ),
  CONSTRAINT clarification_requests_status CHECK (
    status IN ('OPEN', 'RESOLVED', 'CANCELLED')
  ),
  CONSTRAINT clarification_requests_response_gate CHECK (
    status = 'OPEN'
    OR (
      response IS NOT NULL
      AND responded_by_auth_user_id IS NOT NULL
      AND responded_at IS NOT NULL
    )
  )
);

CREATE INDEX clarification_requests_order_idx
  ON flowline.clarification_requests (order_id, requested_at DESC);

CREATE INDEX clarification_requests_open_idx
  ON flowline.clarification_requests (status, requested_at)
  WHERE status = 'OPEN';