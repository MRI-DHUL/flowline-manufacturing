ALTER TABLE flowline.production_issues
  ADD COLUMN status text NOT NULL DEFAULT 'OPEN',
  ADD COLUMN rework_owner_auth_user_id text,
  ADD COLUMN resolved_by_auth_user_id text,
  ADD COLUMN resolution text;

ALTER TABLE flowline.production_issues
  ADD CONSTRAINT production_issues_status CHECK (status IN ('OPEN', 'RESOLVED', 'CANCELLED')),
  ADD CONSTRAINT production_issues_resolution_gate CHECK (
    status = 'OPEN'
    OR (resolved_by_auth_user_id IS NOT NULL AND resolution IS NOT NULL AND resolved_at IS NOT NULL)
  );

CREATE INDEX production_issues_open_idx
  ON flowline.production_issues (order_id, reported_at DESC)
  WHERE status = 'OPEN';