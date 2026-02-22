-- Matching and service dashboards queries rely heavily on filtering by activity status, owner, and price/rating.
-- Keeping these columns indexed avoids full table scans when matching or exporting services.
CREATE INDEX IF NOT EXISTS idx_services_is_active ON services (is_active);
CREATE INDEX IF NOT EXISTS idx_services_owner_user_id ON services (owner_user_id);
CREATE INDEX IF NOT EXISTS idx_services_price_level ON services (price_level);
CREATE INDEX IF NOT EXISTS idx_services_rating_avg ON services (rating_avg);

-- Leads are often looked up by service_id or user_id within short time windows for rate limiting and dashboards.
CREATE INDEX IF NOT EXISTS idx_leads_service_id ON leads (service_id);
CREATE INDEX IF NOT EXISTS idx_leads_user_created_at ON leads (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_service_created_at ON leads (service_id, created_at DESC);

-- Reviews tie directly to services and leads; indexing both keeps eligibility checks fast.
CREATE INDEX IF NOT EXISTS idx_reviews_service_id ON reviews (service_id);
CREATE INDEX IF NOT EXISTS idx_reviews_lead_id ON reviews (lead_id);

-- Events table is scanned for time windows and aggregation; compound indexes speed up admin metrics.
CREATE INDEX IF NOT EXISTS idx_events_type_created_at ON events (type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_service_id ON events (service_id);

-- Org-related lookups surface by user or organization.
CREATE INDEX IF NOT EXISTS idx_organization_members_user_id ON organization_members (user_id);
CREATE INDEX IF NOT EXISTS idx_organization_members_organization_id ON organization_members (organization_id);
CREATE INDEX IF NOT EXISTS idx_organization_lead_stats_organization_id ON organization_lead_stats (organization_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_organization_lead_stats_unique ON organization_lead_stats (organization_id, lead_id);

-- Provider invites are validated by e-mail address frequently.
CREATE INDEX IF NOT EXISTS idx_provider_invites_email ON provider_invites (email);
