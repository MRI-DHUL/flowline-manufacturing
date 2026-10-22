ALTER TABLE flowline.orders
  ADD CONSTRAINT orders_owner_auth_user_fk
  FOREIGN KEY (owner_auth_user_id)
  REFERENCES flowline.user_profiles(auth_user_id)
  ON DELETE SET NULL;