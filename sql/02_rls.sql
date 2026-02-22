-- ============================================
-- Row Level Security Policies
-- Run AFTER 00_schema.sql
-- ============================================

-- SERVICES
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
CREATE POLICY services_public_read ON services FOR SELECT USING (is_active = true);
CREATE POLICY services_owner_read ON services FOR SELECT USING (owner_user_id = auth.uid());
CREATE POLICY services_owner_update ON services FOR UPDATE USING (owner_user_id = auth.uid()) WITH CHECK (owner_user_id = auth.uid());
CREATE POLICY services_admin_all ON services FOR ALL USING (auth.role() = 'service_role');

-- LEADS
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY leads_user_select ON leads FOR SELECT USING (user_id = auth.uid());
CREATE POLICY leads_provider_select ON leads FOR SELECT USING (EXISTS (SELECT 1 FROM services WHERE services.id = leads.service_id AND services.owner_user_id = auth.uid()));
CREATE POLICY leads_user_insert ON leads FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY leads_provider_update ON leads FOR UPDATE USING (EXISTS (SELECT 1 FROM services WHERE services.id = leads.service_id AND services.owner_user_id = auth.uid()));
CREATE POLICY leads_admin_all ON leads FOR ALL USING (auth.role() = 'service_role');

-- LEAD_MESSAGES
ALTER TABLE lead_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY lead_messages_user_select ON lead_messages FOR SELECT USING (EXISTS (SELECT 1 FROM leads WHERE leads.id = lead_messages.lead_id AND leads.user_id = auth.uid()));
CREATE POLICY lead_messages_provider_select ON lead_messages FOR SELECT USING (EXISTS (SELECT 1 FROM leads JOIN services ON services.id = leads.service_id WHERE leads.id = lead_messages.lead_id AND services.owner_user_id = auth.uid()));
CREATE POLICY lead_messages_user_insert ON lead_messages FOR INSERT WITH CHECK (sender_role = 'user' AND EXISTS (SELECT 1 FROM leads WHERE leads.id = lead_messages.lead_id AND leads.user_id = auth.uid()));
CREATE POLICY lead_messages_provider_insert ON lead_messages FOR INSERT WITH CHECK (sender_role = 'provider' AND EXISTS (SELECT 1 FROM leads JOIN services ON services.id = leads.service_id WHERE leads.id = lead_messages.lead_id AND services.owner_user_id = auth.uid()));
CREATE POLICY lead_messages_admin_all ON lead_messages FOR ALL USING (auth.role() = 'service_role');

-- REVIEWS
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY reviews_public_read ON reviews FOR SELECT USING (true);
CREATE POLICY reviews_user_insert ON reviews FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY reviews_user_update ON reviews FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY reviews_user_delete ON reviews FOR DELETE USING (user_id = auth.uid());
CREATE POLICY reviews_admin_all ON reviews FOR ALL USING (auth.role() = 'service_role');

-- ORGANIZATIONS
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
CREATE POLICY organizations_member_select ON organizations FOR SELECT USING (EXISTS (SELECT 1 FROM organization_members WHERE organization_members.organization_id = organizations.id AND organization_members.user_id = auth.uid()));
CREATE POLICY organizations_admin_update ON organizations FOR UPDATE USING (EXISTS (SELECT 1 FROM organization_members WHERE organization_members.organization_id = organizations.id AND organization_members.user_id = auth.uid() AND organization_members.role = 'admin'));
CREATE POLICY organizations_admin_all ON organizations FOR ALL USING (auth.role() = 'service_role');

-- APP_ERRORS
ALTER TABLE app_errors ENABLE ROW LEVEL SECURITY;
CREATE POLICY app_errors_admin_select ON app_errors FOR SELECT USING (auth.role() = 'service_role');
CREATE POLICY app_errors_admin_insert ON app_errors FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- PROFILES
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY profiles_user_select ON profiles FOR SELECT USING (id = auth.uid());
CREATE POLICY profiles_user_update ON profiles FOR UPDATE USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY profiles_admin_all ON profiles FOR ALL USING (auth.role() = 'service_role');

-- BOOKINGS
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
CREATE POLICY bookings_user_select ON bookings FOR SELECT USING (EXISTS (SELECT 1 FROM leads WHERE leads.id = bookings.lead_id AND leads.user_id = auth.uid()));
CREATE POLICY bookings_provider_select ON bookings FOR SELECT USING (EXISTS (SELECT 1 FROM services WHERE services.id = bookings.service_id AND services.owner_user_id = auth.uid()));
CREATE POLICY bookings_provider_insert ON bookings FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM services WHERE services.id = bookings.service_id AND services.owner_user_id = auth.uid()));
CREATE POLICY bookings_provider_update ON bookings FOR UPDATE USING (EXISTS (SELECT 1 FROM services WHERE services.id = bookings.service_id AND services.owner_user_id = auth.uid()));
CREATE POLICY bookings_user_cancel ON bookings FOR UPDATE USING (EXISTS (SELECT 1 FROM leads WHERE leads.id = bookings.lead_id AND leads.user_id = auth.uid()));

-- PROVIDER_AVAILABILITY
ALTER TABLE provider_availability ENABLE ROW LEVEL SECURITY;
CREATE POLICY provider_availability_public_select ON provider_availability FOR SELECT USING (true);
CREATE POLICY provider_availability_owner ON provider_availability FOR ALL USING (auth.uid() IS NOT NULL AND EXISTS (SELECT 1 FROM services WHERE id = provider_availability.service_id AND owner_user_id = auth.uid()));

-- LEAD_TIME_SUGGESTIONS
ALTER TABLE lead_time_suggestions ENABLE ROW LEVEL SECURITY;
CREATE POLICY lead_time_suggestions_user_insert ON lead_time_suggestions FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND EXISTS (SELECT 1 FROM leads WHERE id = lead_time_suggestions.lead_id AND user_id = auth.uid()));
CREATE POLICY lead_time_suggestions_user_select ON lead_time_suggestions FOR SELECT USING (auth.uid() IS NOT NULL AND EXISTS (SELECT 1 FROM leads WHERE id = lead_time_suggestions.lead_id AND user_id = auth.uid()));
CREATE POLICY lead_time_suggestions_provider_select ON lead_time_suggestions FOR SELECT USING (auth.uid() IS NOT NULL AND EXISTS (SELECT 1 FROM leads JOIN services ON services.id = leads.service_id WHERE leads.id = lead_time_suggestions.lead_id AND services.owner_user_id = auth.uid()));

-- USER_PREFERENCES
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY user_preferences_owner_select ON user_preferences FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY user_preferences_owner_upsert ON user_preferences FOR ALL USING (auth.uid() = user_id);

-- QUALITY_EVENTS
ALTER TABLE quality_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY quality_events_admin_select ON quality_events FOR SELECT USING (auth.role() = 'service_role');
CREATE POLICY quality_events_insert_service ON quality_events FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- FEEDBACK
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY feedback_insert ON feedback FOR INSERT WITH CHECK (true);
CREATE POLICY feedback_admin_select ON feedback FOR SELECT USING (auth.role() = 'service_role');
