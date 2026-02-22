-- RLS Policies for settdegetmal.no
-- Run this in Supabase SQL Editor to enable row-level security
--
-- IMPORTANT: Run in order - tables must exist before policies
--
-- Tested with roles: anon, authenticated (user), authenticated (provider), service_role (admin)

-- ============================================
-- 1. SERVICES TABLE
-- ============================================
-- Public read, owner write

ALTER TABLE services ENABLE ROW LEVEL SECURITY;

-- Anyone can read active services (for search/browse)
CREATE POLICY IF NOT EXISTS services_public_read
  ON services
  FOR SELECT
  USING (is_active = true);

-- Owners can read all their services (including inactive)
CREATE POLICY IF NOT EXISTS services_owner_read
  ON services
  FOR SELECT
  USING (owner_user_id = auth.uid());

-- Owners can update their own services
CREATE POLICY IF NOT EXISTS services_owner_update
  ON services
  FOR UPDATE
  USING (owner_user_id = auth.uid())
  WITH CHECK (owner_user_id = auth.uid());

-- Service role (admin) has full access
CREATE POLICY IF NOT EXISTS services_admin_all
  ON services
  FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================
-- 2. LEADS TABLE
-- ============================================
-- Users see their own leads, providers see leads for their services

ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

-- Users can see their own leads
CREATE POLICY IF NOT EXISTS leads_user_select
  ON leads
  FOR SELECT
  USING (user_id = auth.uid());

-- Providers can see leads for their services
CREATE POLICY IF NOT EXISTS leads_provider_select
  ON leads
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM services
      WHERE services.id = leads.service_id
        AND services.owner_user_id = auth.uid()
    )
  );

-- Users can create leads (express interest)
CREATE POLICY IF NOT EXISTS leads_user_insert
  ON leads
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Providers can update lead status
CREATE POLICY IF NOT EXISTS leads_provider_update
  ON leads
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM services
      WHERE services.id = leads.service_id
        AND services.owner_user_id = auth.uid()
    )
  );

-- Service role (admin) has full access
CREATE POLICY IF NOT EXISTS leads_admin_all
  ON leads
  FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================
-- 3. LEAD_MESSAGES TABLE
-- ============================================
-- Only participants in the lead conversation can see/create messages

ALTER TABLE lead_messages ENABLE ROW LEVEL SECURITY;

-- Users can see messages for their own leads
CREATE POLICY IF NOT EXISTS lead_messages_user_select
  ON lead_messages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM leads
      WHERE leads.id = lead_messages.lead_id
        AND leads.user_id = auth.uid()
    )
  );

-- Providers can see messages for leads on their services
CREATE POLICY IF NOT EXISTS lead_messages_provider_select
  ON lead_messages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM leads
      JOIN services ON services.id = leads.service_id
      WHERE leads.id = lead_messages.lead_id
        AND services.owner_user_id = auth.uid()
    )
  );

-- Users can create messages on their leads
CREATE POLICY IF NOT EXISTS lead_messages_user_insert
  ON lead_messages
  FOR INSERT
  WITH CHECK (
    sender_role = 'user'
    AND EXISTS (
      SELECT 1 FROM leads
      WHERE leads.id = lead_messages.lead_id
        AND leads.user_id = auth.uid()
    )
  );

-- Providers can create messages on their leads
CREATE POLICY IF NOT EXISTS lead_messages_provider_insert
  ON lead_messages
  FOR INSERT
  WITH CHECK (
    sender_role = 'provider'
    AND EXISTS (
      SELECT 1 FROM leads
      JOIN services ON services.id = leads.service_id
      WHERE leads.id = lead_messages.lead_id
        AND services.owner_user_id = auth.uid()
    )
  );

-- Service role (admin) has full access
CREATE POLICY IF NOT EXISTS lead_messages_admin_all
  ON lead_messages
  FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================
-- 4. REVIEWS TABLE
-- ============================================
-- Public read, author can create/update own reviews

ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

-- Anyone can read published reviews
CREATE POLICY IF NOT EXISTS reviews_public_read
  ON reviews
  FOR SELECT
  USING (true);

-- Users can create reviews
CREATE POLICY IF NOT EXISTS reviews_user_insert
  ON reviews
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Users can update their own reviews
CREATE POLICY IF NOT EXISTS reviews_user_update
  ON reviews
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Users can delete their own reviews
CREATE POLICY IF NOT EXISTS reviews_user_delete
  ON reviews
  FOR DELETE
  USING (user_id = auth.uid());

-- Service role (admin) has full access (for moderation)
CREATE POLICY IF NOT EXISTS reviews_admin_all
  ON reviews
  FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================
-- 5. ORGANIZATIONS TABLE
-- ============================================
-- Members can read, admins can update

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

-- Organization members can read their org
CREATE POLICY IF NOT EXISTS organizations_member_select
  ON organizations
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = organizations.id
        AND organization_members.user_id = auth.uid()
    )
  );

-- Organization admins can update
CREATE POLICY IF NOT EXISTS organizations_admin_update
  ON organizations
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = organizations.id
        AND organization_members.user_id = auth.uid()
        AND organization_members.role = 'admin'
    )
  );

-- Service role (admin) has full access
CREATE POLICY IF NOT EXISTS organizations_admin_all
  ON organizations
  FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================
-- 6. APP_ERRORS TABLE
-- ============================================
-- Admin only (for error tracking)

ALTER TABLE app_errors ENABLE ROW LEVEL SECURITY;

-- Only service role can read errors
CREATE POLICY IF NOT EXISTS app_errors_admin_select
  ON app_errors
  FOR SELECT
  USING (auth.role() = 'service_role');

-- Service role can insert (for error logging)
CREATE POLICY IF NOT EXISTS app_errors_admin_insert
  ON app_errors
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- ============================================
-- 7. PROFILES TABLE (if not already set)
-- ============================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Users can read their own profile
CREATE POLICY IF NOT EXISTS profiles_user_select
  ON profiles
  FOR SELECT
  USING (id = auth.uid());

-- Users can update their own profile
CREATE POLICY IF NOT EXISTS profiles_user_update
  ON profiles
  FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Service role has full access
CREATE POLICY IF NOT EXISTS profiles_admin_all
  ON profiles
  FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================
-- VERIFICATION QUERIES
-- ============================================
-- Run these to verify RLS is enabled:

-- SELECT tablename, rowsecurity
-- FROM pg_tables
-- WHERE schemaname = 'public'
--   AND tablename IN ('services', 'leads', 'lead_messages', 'reviews', 'organizations', 'bookings', 'app_errors', 'profiles');

-- Check policies:
-- SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
-- FROM pg_policies
-- WHERE schemaname = 'public';
