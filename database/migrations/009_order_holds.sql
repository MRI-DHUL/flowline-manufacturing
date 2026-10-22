CREATE TABLE flowline.order_holds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES flowline.orders(id) ON DELETE RESTRICT,
  category text NOT NULL,
  reason text NOT NULL,
  responsible_team text NOT NULL,
  owner_auth_user_id text NOT NULL,
  corrective_action text,
  target_resolution_date date NOT NULL,
  previous_status text NOT NULL,
  previous_stage text NOT NULL,
  status text NOT NULL DEFAULT 'OPEN',
  placed_by_auth_user_id text NOT NULL,
  placed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  resolved_by_auth_user_id text,
  resolution text,
  resolved_at timestamptz,
  CONSTRAINT order_holds_status CHECK (status IN ('OPEN', 'RESOLVED', 'CANCELLED')),
  CONSTRAINT order_holds_reason_length CHECK (char_length(btrim(reason)) BETWEEN 10 AND 2000),
  CONSTRAINT order_holds_resolution_gate CHECK (
    status = 'OPEN'
    OR (resolved_by_auth_user_id IS NOT NULL AND resolution IS NOT NULL AND resolved_at IS NOT NULL)
  )
);

CREATE INDEX order_holds_order_idx ON flowline.order_holds (order_id, placed_at DESC);
CREATE INDEX order_holds_open_idx ON flowline.order_holds (status, target_resolution_date)
  WHERE status = 'OPEN';

CREATE TABLE flowline.order_hold_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hold_id uuid NOT NULL REFERENCES flowline.order_holds(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES flowline.orders(id) ON DELETE RESTRICT,
  action text NOT NULL,
  actor_auth_user_id text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX order_hold_events_hold_idx ON flowline.order_hold_events (hold_id, occurred_at DESC);