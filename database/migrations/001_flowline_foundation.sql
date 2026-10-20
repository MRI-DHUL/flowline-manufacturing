CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE SCHEMA IF NOT EXISTS flowline;

CREATE OR REPLACE FUNCTION flowline.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = clock_timestamp();
  RETURN NEW;
END;
$$;

CREATE TABLE flowline.roles (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT roles_code_format CHECK (code ~ '^[A-Z][A-Z_&]*$')
);

CREATE TABLE flowline.user_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id text NOT NULL UNIQUE,
  email text NOT NULL,
  display_name text NOT NULL,
  status text NOT NULL DEFAULT 'PENDING',
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT user_profiles_email_normalized CHECK (email = lower(email)),
  CONSTRAINT user_profiles_status CHECK (status IN ('PENDING', 'ACTIVE', 'DISABLED'))
);

CREATE UNIQUE INDEX user_profiles_email_unique ON flowline.user_profiles (lower(email));

CREATE TRIGGER user_profiles_set_updated_at
BEFORE UPDATE ON flowline.user_profiles
FOR EACH ROW EXECUTE FUNCTION flowline.set_updated_at();

CREATE TABLE flowline.user_roles (
  user_profile_id uuid NOT NULL REFERENCES flowline.user_profiles(id) ON DELETE CASCADE,
  role_id bigint NOT NULL REFERENCES flowline.roles(id) ON DELETE RESTRICT,
  assigned_by_auth_user_id text,
  assigned_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (user_profile_id, role_id)
);

CREATE TABLE flowline.production_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE TRIGGER production_lines_set_updated_at
BEFORE UPDATE ON flowline.production_lines
FOR EACH ROW EXECUTE FUNCTION flowline.set_updated_at();

CREATE TABLE flowline.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number text NOT NULL UNIQUE,
  customer_name text NOT NULL,
  destination text,
  product_name text NOT NULL,
  product_description text,
  order_type text,
  packaging_type text,
  dimensions text,
  material text,
  print_colors text,
  requested_quantity numeric(14, 3) NOT NULL,
  requested_delivery_date date NOT NULL,
  technical_notes text,
  status text NOT NULL DEFAULT 'Draft',
  stage text NOT NULL DEFAULT 'CSR',
  owner_role_id bigint REFERENCES flowline.roles(id) ON DELETE RESTRICT,
  owner_auth_user_id text,
  priority text,
  version integer NOT NULL DEFAULT 1,
  created_by_auth_user_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT orders_quantity_positive CHECK (requested_quantity > 0),
  CONSTRAINT orders_version_positive CHECK (version > 0),
  CONSTRAINT orders_status CHECK (status IN (
    'Draft', 'Submitted', 'R&D Review', 'Planning Review', 'Scheduled',
    'In Production', 'Ready to Ship', 'Dispatched', 'Delivered',
    'On Hold', 'Rework Required', 'Cancelled'
  )),
  CONSTRAINT orders_stage CHECK (stage IN ('CSR', 'R&D', 'Planning', 'Press', 'Shipping', 'Delivered'))
);

CREATE INDEX orders_queue_idx ON flowline.orders (stage, status, updated_at);
CREATE INDEX orders_owner_idx ON flowline.orders (owner_role_id, owner_auth_user_id);
CREATE INDEX orders_delivery_date_idx ON flowline.orders (requested_delivery_date);

CREATE TRIGGER orders_set_updated_at
BEFORE UPDATE ON flowline.orders
FOR EACH ROW EXECUTE FUNCTION flowline.set_updated_at();

CREATE TABLE flowline.order_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES flowline.orders(id) ON DELETE RESTRICT,
  revision_number integer NOT NULL,
  snapshot jsonb NOT NULL,
  reason text,
  created_by_auth_user_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (order_id, revision_number),
  CONSTRAINT order_revisions_number_positive CHECK (revision_number > 0)
);

CREATE TABLE flowline.technical_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES flowline.orders(id) ON DELETE RESTRICT,
  reviewer_auth_user_id text NOT NULL,
  decision text NOT NULL,
  technical_comments text NOT NULL,
  tooling_requirements text,
  material_recommendation text,
  constraints_and_risks text,
  decided_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT technical_reviews_decision CHECK (
    decision IN ('APPROVED', 'CLARIFICATION_REQUESTED', 'REJECTED', 'ON_HOLD')
  )
);

CREATE INDEX technical_reviews_order_idx ON flowline.technical_reviews (order_id, decided_at DESC);

CREATE TABLE flowline.planning_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES flowline.orders(id) ON DELETE RESTRICT,
  planner_auth_user_id text NOT NULL,
  material_status text NOT NULL,
  shortage_reason text,
  expected_material_date date,
  production_line_id uuid REFERENCES flowline.production_lines(id) ON DELETE RESTRICT,
  planned_production_date date,
  capacity_status text,
  readiness_status text,
  planning_notes text,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT planning_material_status CHECK (material_status IN ('PENDING', 'AVAILABLE', 'SHORTAGE')),
  CONSTRAINT planning_shortage_details CHECK (
    material_status <> 'SHORTAGE'
    OR (shortage_reason IS NOT NULL AND expected_material_date IS NOT NULL)
  )
);

CREATE INDEX planning_reviews_order_idx ON flowline.planning_reviews (order_id, created_at DESC);

CREATE TRIGGER planning_reviews_set_updated_at
BEFORE UPDATE ON flowline.planning_reviews
FOR EACH ROW EXECUTE FUNCTION flowline.set_updated_at();

CREATE TABLE flowline.production_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES flowline.orders(id) ON DELETE RESTRICT,
  production_line_id uuid REFERENCES flowline.production_lines(id) ON DELETE RESTRICT,
  operator_auth_user_id text,
  status text NOT NULL DEFAULT 'SCHEDULED',
  planned_quantity numeric(14, 3) NOT NULL,
  good_quantity numeric(14, 3),
  waste_quantity numeric(14, 3),
  started_at timestamptz,
  completed_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT production_runs_status CHECK (
    status IN ('SCHEDULED', 'ACCEPTED', 'IN_PRODUCTION', 'PAUSED', 'COMPLETED', 'ISSUE')
  ),
  CONSTRAINT production_runs_quantities CHECK (
    planned_quantity > 0
    AND (good_quantity IS NULL OR good_quantity >= 0)
    AND (waste_quantity IS NULL OR waste_quantity >= 0)
  ),
  CONSTRAINT production_runs_completion CHECK (
    status <> 'COMPLETED'
    OR (good_quantity IS NOT NULL AND waste_quantity IS NOT NULL AND completed_at IS NOT NULL)
  )
);

CREATE INDEX production_runs_order_idx ON flowline.production_runs (order_id, created_at DESC);

CREATE TRIGGER production_runs_set_updated_at
BEFORE UPDATE ON flowline.production_runs
FOR EACH ROW EXECUTE FUNCTION flowline.set_updated_at();

CREATE TABLE flowline.production_issues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES flowline.orders(id) ON DELETE RESTRICT,
  production_run_id uuid REFERENCES flowline.production_runs(id) ON DELETE RESTRICT,
  category text NOT NULL,
  notes text NOT NULL,
  corrective_action text,
  reported_by_auth_user_id text NOT NULL,
  reported_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  resolved_at timestamptz
);

CREATE TABLE flowline.shipments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES flowline.orders(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'PENDING',
  carrier text,
  tracking_or_vehicle_number text,
  dispatch_at timestamptz,
  shipped_quantity numeric(14, 3),
  destination text,
  expected_delivery_at timestamptz,
  actual_delivery_at timestamptz,
  received_by text,
  created_by_auth_user_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT shipments_status CHECK (status IN ('PENDING', 'READY', 'DISPATCHED', 'DELIVERED', 'ISSUE')),
  CONSTRAINT shipments_quantity_nonnegative CHECK (shipped_quantity IS NULL OR shipped_quantity >= 0),
  CONSTRAINT shipments_dispatch_gate CHECK (
    status NOT IN ('DISPATCHED', 'DELIVERED')
    OR (carrier IS NOT NULL AND tracking_or_vehicle_number IS NOT NULL
        AND dispatch_at IS NOT NULL AND shipped_quantity IS NOT NULL AND destination IS NOT NULL)
  ),
  CONSTRAINT shipments_delivery_gate CHECK (status <> 'DELIVERED' OR actual_delivery_at IS NOT NULL)
);

CREATE INDEX shipments_order_idx ON flowline.shipments (order_id, created_at DESC);
CREATE INDEX shipments_delivery_idx ON flowline.shipments (expected_delivery_at, status);

CREATE TRIGGER shipments_set_updated_at
BEFORE UPDATE ON flowline.shipments
FOR EACH ROW EXECUTE FUNCTION flowline.set_updated_at();

CREATE TABLE flowline.delivery_issues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES flowline.orders(id) ON DELETE RESTRICT,
  shipment_id uuid NOT NULL REFERENCES flowline.shipments(id) ON DELETE RESTRICT,
  category text NOT NULL,
  notes text NOT NULL,
  reported_by_auth_user_id text NOT NULL,
  reported_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  resolved_at timestamptz
);

CREATE TABLE flowline.attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES flowline.orders(id) ON DELETE RESTRICT,
  related_entity_type text NOT NULL,
  related_entity_id uuid,
  revision_number integer,
  file_name text NOT NULL,
  media_type text NOT NULL,
  size_bytes bigint NOT NULL,
  storage_key text NOT NULL UNIQUE,
  uploaded_by_auth_user_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT attachments_size_positive CHECK (size_bytes > 0),
  CONSTRAINT attachments_revision_positive CHECK (revision_number IS NULL OR revision_number > 0)
);

CREATE INDEX attachments_order_idx ON flowline.attachments (order_id, created_at DESC);

CREATE TABLE flowline.holds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES flowline.orders(id) ON DELETE RESTRICT,
  category text NOT NULL,
  reason text NOT NULL,
  responsible_role_id bigint REFERENCES flowline.roles(id) ON DELETE RESTRICT,
  responsible_auth_user_id text,
  target_resolution_date date NOT NULL,
  corrective_action text,
  status text NOT NULL DEFAULT 'OPEN',
  raised_by_auth_user_id text NOT NULL,
  raised_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  resolved_by_auth_user_id text,
  resolution text,
  resolved_at timestamptz,
  CONSTRAINT holds_status CHECK (status IN ('OPEN', 'RESOLVED', 'CANCELLED')),
  CONSTRAINT holds_resolution_gate CHECK (
    status = 'OPEN'
    OR (resolved_by_auth_user_id IS NOT NULL AND resolution IS NOT NULL AND resolved_at IS NOT NULL)
  )
);

CREATE INDEX holds_open_idx ON flowline.holds (status, target_resolution_date) WHERE status = 'OPEN';
CREATE INDEX holds_order_idx ON flowline.holds (order_id, raised_at DESC);

CREATE TABLE flowline.rework_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES flowline.orders(id) ON DELETE RESTRICT,
  reason text NOT NULL,
  responsible_role_id bigint REFERENCES flowline.roles(id) ON DELETE RESTRICT,
  responsible_auth_user_id text,
  return_stage text,
  status text NOT NULL DEFAULT 'OPEN',
  requested_by_auth_user_id text NOT NULL,
  requested_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  resolved_by_auth_user_id text,
  resolution text,
  resolved_at timestamptz,
  CONSTRAINT rework_cases_status CHECK (status IN ('OPEN', 'RESOLVED', 'CANCELLED')),
  CONSTRAINT rework_cases_return_stage CHECK (
    return_stage IS NULL OR return_stage IN ('CSR', 'R&D', 'Planning', 'Press', 'Shipping')
  )
);

CREATE INDEX rework_cases_order_idx ON flowline.rework_cases (order_id, requested_at DESC);

CREATE TABLE flowline.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES flowline.orders(id) ON DELETE RESTRICT,
  type text NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'ACTIVE',
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  resolved_at timestamptz,
  CONSTRAINT notifications_status CHECK (status IN ('ACTIVE', 'RESOLVED', 'CANCELLED'))
);

CREATE TABLE flowline.notification_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id uuid NOT NULL REFERENCES flowline.notifications(id) ON DELETE CASCADE,
  recipient_auth_user_id text,
  recipient_role_id bigint REFERENCES flowline.roles(id) ON DELETE CASCADE,
  read_at timestamptz,
  CONSTRAINT notification_recipient_target CHECK (
    (recipient_auth_user_id IS NOT NULL)::integer + (recipient_role_id IS NOT NULL)::integer = 1
  )
);

CREATE UNIQUE INDEX notification_recipients_user_unique
  ON flowline.notification_recipients (notification_id, recipient_auth_user_id)
  WHERE recipient_auth_user_id IS NOT NULL;
CREATE UNIQUE INDEX notification_recipients_role_unique
  ON flowline.notification_recipients (notification_id, recipient_role_id)
  WHERE recipient_role_id IS NOT NULL;
CREATE INDEX notification_recipients_user_idx
  ON flowline.notification_recipients (recipient_auth_user_id, read_at);
CREATE INDEX notification_recipients_role_idx
  ON flowline.notification_recipients (recipient_role_id, read_at);

CREATE TABLE flowline.audit_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id uuid REFERENCES flowline.orders(id) ON DELETE RESTRICT,
  actor_auth_user_id text NOT NULL,
  action text NOT NULL,
  previous_status text,
  new_status text,
  reason text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX audit_events_order_idx ON flowline.audit_events (order_id, occurred_at DESC);
CREATE INDEX audit_events_actor_idx ON flowline.audit_events (actor_auth_user_id, occurred_at DESC);

CREATE OR REPLACE FUNCTION flowline.reject_audit_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'flowline.audit_events is append-only';
END;
$$;

CREATE TRIGGER audit_events_append_only
BEFORE UPDATE OR DELETE ON flowline.audit_events
FOR EACH ROW EXECUTE FUNCTION flowline.reject_audit_mutation();

INSERT INTO flowline.roles (code, name)
VALUES
  ('CSR', 'Requestor / CSR'),
  ('R&D', 'R&D Expert'),
  ('PLANNING', 'Planning'),
  ('PRESS', 'Press'),
  ('SHIPPING', 'Shipping'),
  ('MANAGER', 'Manager / Supervisor'),
  ('SYSTEM_ADMIN', 'System administrator')
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name;