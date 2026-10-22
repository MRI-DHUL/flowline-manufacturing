ALTER TABLE flowline.planning_reviews
  ADD COLUMN press_operator_auth_user_id text;

ALTER TABLE flowline.planning_reviews
  ADD CONSTRAINT planning_capacity_status CHECK (
    capacity_status IS NULL OR capacity_status IN ('PENDING', 'AVAILABLE', 'UNAVAILABLE')
  ),
  ADD CONSTRAINT planning_readiness_status CHECK (
    readiness_status IS NULL OR readiness_status IN ('PENDING', 'READY', 'BLOCKED')
  );

CREATE INDEX planning_reviews_press_operator_idx
  ON flowline.planning_reviews (press_operator_auth_user_id)
  WHERE press_operator_auth_user_id IS NOT NULL;
