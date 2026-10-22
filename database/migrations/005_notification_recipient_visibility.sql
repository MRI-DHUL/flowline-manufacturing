ALTER TABLE flowline.notification_recipients
  ADD COLUMN hidden_at timestamptz;

CREATE INDEX notification_recipients_visible_idx
  ON flowline.notification_recipients (recipient_auth_user_id, hidden_at, read_at);
