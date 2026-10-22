CREATE TABLE flowline.order_issues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES flowline.orders(id) ON DELETE RESTRICT,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'OPEN',
  reported_by_auth_user_id text NOT NULL,
  reported_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  resolved_by_auth_user_id text,
  resolution text,
  resolved_at timestamptz,
  CONSTRAINT order_issues_message_length CHECK (char_length(btrim(message)) BETWEEN 10 AND 2000),
  CONSTRAINT order_issues_status CHECK (status IN ('OPEN', 'RESOLVED', 'CANCELLED')),
  CONSTRAINT order_issues_resolution_gate CHECK (
    status = 'OPEN'
    OR (resolved_by_auth_user_id IS NOT NULL AND resolution IS NOT NULL AND resolved_at IS NOT NULL)
  )
);

CREATE INDEX order_issues_order_idx
  ON flowline.order_issues (order_id, reported_at DESC);
CREATE INDEX order_issues_open_idx
  ON flowline.order_issues (status, reported_at DESC)
  WHERE status = 'OPEN';

CREATE TABLE flowline.order_issue_recipients (
  issue_id uuid NOT NULL REFERENCES flowline.order_issues(id) ON DELETE CASCADE,
  recipient_auth_user_id text NOT NULL,
  notified_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (issue_id, recipient_auth_user_id)
);

CREATE INDEX order_issue_recipients_user_idx
  ON flowline.order_issue_recipients (recipient_auth_user_id, notified_at DESC);
