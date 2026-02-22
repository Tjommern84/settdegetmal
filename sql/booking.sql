-- Booking and scheduling support tables
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS provider_availability (
  service_id text NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  weekday int NOT NULL CHECK (weekday BETWEEN 1 AND 7),
  start_time time NOT NULL,
  end_time time NOT NULL,
  PRIMARY KEY (service_id, weekday, start_time, end_time)
);

ALTER TABLE provider_availability ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS provider_availability_public_select
  ON provider_availability
  FOR SELECT
  USING (true);

CREATE POLICY IF NOT EXISTS provider_availability_owner
  ON provider_availability
  FOR INSERT, UPDATE, DELETE
  USING (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM services
      WHERE id = provider_availability.service_id
        AND owner_user_id = auth.uid()
    )
  )
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM services
      WHERE id = provider_availability.service_id
        AND owner_user_id = auth.uid()
    )
  );

CREATE TABLE IF NOT EXISTS lead_time_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  suggested_at timestamptz NOT NULL
);

ALTER TABLE lead_time_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS lead_time_suggestions_user_insert
  ON lead_time_suggestions
  FOR INSERT
  USING (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM leads
      WHERE id = lead_time_suggestions.lead_id
        AND user_id = auth.uid()
    )
  )
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM leads
      WHERE id = lead_time_suggestions.lead_id
        AND user_id = auth.uid()
    )
  );

CREATE POLICY IF NOT EXISTS lead_time_suggestions_role_select_user
  ON lead_time_suggestions
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM leads
      WHERE id = lead_time_suggestions.lead_id
        AND user_id = auth.uid()
    )
  );

CREATE POLICY IF NOT EXISTS lead_time_suggestions_role_select_provider
  ON lead_time_suggestions
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM leads
      JOIN services ON services.id = leads.service_id
      WHERE leads.id = lead_time_suggestions.lead_id
        AND services.owner_user_id = auth.uid()
    )
  );
