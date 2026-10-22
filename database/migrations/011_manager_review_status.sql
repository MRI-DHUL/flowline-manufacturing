ALTER TABLE flowline.orders DROP CONSTRAINT orders_status;

ALTER TABLE flowline.orders
  ADD CONSTRAINT orders_status CHECK (status IN (
    'Draft', 'Submitted', 'R&D Review', 'Planning Review', 'Scheduled',
    'In Production', 'Ready to Ship', 'Dispatched', 'Delivered',
    'On Hold', 'Rework Required', 'Manager Review', 'Cancelled'
  ));