INSERT INTO flowline.production_lines (code, name, active)
VALUES
  ('PRESS-01', 'Press Line 01', true),
  ('PRESS-02', 'Press Line 02', true),
  ('PRESS-03', 'Press Line 03', true)
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name,
    active = EXCLUDED.active;
