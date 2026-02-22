CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE services
  ADD COLUMN IF NOT EXISTS cancellation_hours int NOT NULL DEFAULT 24;

CREATE TABLE IF NOT EXISTS bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL UNIQUE REFERENCES leads(id) ON DELETE CASCADE,
  service_id text NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  scheduled_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed', 'confirmed', 'cancelled')),
  cancelled_by text CHECK (cancelled_by IN ('user', 'provider')),
  cancellation_type text CHECK (cancellation_type IN ('on_time', 'late')),
  no_show_marked boolean NOT NULL DEFAULT false,
  no_show_marked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  confirmed_at timestamptz,
  cancelled_at timestamptz
);

ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY bookings_user_select
  ON bookings
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM leads
      WHERE leads.id = bookings.lead_id
        AND leads.user_id = auth.uid()
    )
  );

CREATE POLICY bookings_provider_select
  ON bookings
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM services
      WHERE services.id = bookings.service_id
        AND services.owner_user_id = auth.uid()
    )
  );

CREATE POLICY bookings_provider_insert
  ON bookings
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM services
      WHERE services.id = bookings.service_id
        AND services.owner_user_id = auth.uid()
    )
  )
  USING (
    EXISTS (
      SELECT 1
      FROM services
      WHERE services.id = bookings.service_id
        AND services.owner_user_id = auth.uid()
    )
  );

CREATE POLICY bookings_provider_update
  ON bookings
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM services
      WHERE services.id = bookings.service_id
        AND services.owner_user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM services
      WHERE services.id = bookings.service_id
        AND services.owner_user_id = auth.uid()
    )
  );

CREATE POLICY bookings_user_cancel
  ON bookings
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM leads
      WHERE leads.id = bookings.lead_id
        AND leads.user_id = auth.uid()
    )
  )
  WITH CHECK (status = 'cancelled');

CREATE INDEX IF NOT EXISTS bookings_service_id_idx ON bookings(service_id);
CREATE INDEX IF NOT EXISTS bookings_user_id_idx ON bookings(user_id);
CREATE INDEX IF NOT EXISTS bookings_lead_id_idx ON bookings(lead_id);

CREATE TABLE IF NOT EXISTS quality_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id text NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  user_id uuid,
  booking_id uuid,
  type text NOT NULL CHECK (type IN ('late_cancellation', 'no_show')),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE quality_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY quality_events_admin_select
  ON quality_events
  FOR SELECT
  USING (auth.role() = 'service_role');

CREATE POLICY quality_events_insert_service
  ON quality_events
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role')
  USING (auth.role() = 'service_role');
