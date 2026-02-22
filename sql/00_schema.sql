-- ============================================
-- SettDegEtMål – Complete Database Schema
-- Run this FIRST in Supabase SQL Editor
-- ============================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- ============================================
-- 1. PROFILES (references auth.users)
-- ============================================
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  full_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- 2. SERVICES
-- ============================================
CREATE TABLE IF NOT EXISTS services (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name text NOT NULL,
  type text NOT NULL DEFAULT 'pt',
  description text NOT NULL DEFAULT '',
  price_level text NOT NULL DEFAULT 'medium' CHECK (price_level IN ('low', 'medium', 'high')),
  goals text[] NOT NULL DEFAULT '{}',
  venues text[] NOT NULL DEFAULT '{}',
  coverage jsonb NOT NULL DEFAULT '[]'::jsonb,
  tags text[] NOT NULL DEFAULT '{}',
  owner_user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  subscription_status text DEFAULT 'active',
  is_active boolean NOT NULL DEFAULT true,
  cover_image_url text,
  logo_image_url text,
  cancellation_hours int NOT NULL DEFAULT 24,
  stripe_customer_id text,
  rating_avg numeric NOT NULL DEFAULT 0,
  rating_count int NOT NULL DEFAULT 0,
  is_featured boolean DEFAULT false,
  featured_rank int DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================
-- 3. LEADS
-- ============================================
CREATE TABLE IF NOT EXISTS leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id text NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text NOT NULL,
  message text NOT NULL DEFAULT '',
  status text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================
-- 4. LEAD_MESSAGES
-- ============================================
CREATE TABLE IF NOT EXISTS lead_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  sender_role text NOT NULL CHECK (sender_role IN ('user', 'provider')),
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================
-- 5. REVIEWS
-- ============================================
CREATE TABLE IF NOT EXISTS reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES leads(id) ON DELETE SET NULL,
  service_id text NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  rating int NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================
-- 6. ORGANIZATIONS
-- ============================================
CREATE TABLE IF NOT EXISTS organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  join_code text UNIQUE DEFAULT encode(gen_random_bytes(6), 'hex'),
  subscription_status text DEFAULT 'inactive',
  stripe_customer_id text,
  stripe_subscription_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================
-- 7. ORGANIZATION_MEMBERS
-- ============================================
CREATE TABLE IF NOT EXISTS organization_members (
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, user_id)
);

-- ============================================
-- 8. ORGANIZATION_LEAD_STATS
-- ============================================
CREATE TABLE IF NOT EXISTS organization_lead_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================
-- 9. EVENTS (analytics)
-- ============================================
CREATE TABLE IF NOT EXISTS events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL,
  user_id uuid,
  service_id text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================
-- 10. PROVIDER_INVITES
-- ============================================
CREATE TABLE IF NOT EXISTS provider_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  service_id text NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  created_by uuid REFERENCES profiles(id),
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================
-- 11. NOTIFICATION_PREFERENCES
-- ============================================
CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  email_lead_created boolean NOT NULL DEFAULT true,
  email_provider_replied boolean NOT NULL DEFAULT true,
  email_booking_confirmed boolean NOT NULL DEFAULT true,
  email_booking_cancelled boolean NOT NULL DEFAULT true,
  updated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================
-- 12. EMAIL_EVENTS
-- ============================================
CREATE TABLE IF NOT EXISTS email_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL,
  lead_id uuid REFERENCES leads(id) ON DELETE CASCADE,
  recipient_email text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================
-- 13. USER_CONSENTS
-- ============================================
CREATE TABLE IF NOT EXISTS user_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  consent_type text NOT NULL,
  accepted_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================
-- 14. FEEDBACK
-- ============================================
CREATE TABLE IF NOT EXISTS feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  role text DEFAULT 'user',
  page text,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================
-- 15. APP_ERRORS (error logging)
-- ============================================
CREATE TABLE IF NOT EXISTS app_errors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  level text NOT NULL DEFAULT 'error',
  source text,
  context text,
  message text NOT NULL,
  stack text,
  metadata jsonb DEFAULT '{}'::jsonb,
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================
-- 16. DELETION_REQUESTS (GDPR)
-- ============================================
CREATE TABLE IF NOT EXISTS deletion_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'cancelled')),
  requested_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

-- ============================================
-- 17. BOOKINGS
-- ============================================
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

-- ============================================
-- 18. LEAD_TIME_SUGGESTIONS
-- ============================================
CREATE TABLE IF NOT EXISTS lead_time_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  suggested_at timestamptz NOT NULL
);

-- ============================================
-- 19. PROVIDER_AVAILABILITY
-- ============================================
CREATE TABLE IF NOT EXISTS provider_availability (
  service_id text NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  weekday int NOT NULL CHECK (weekday BETWEEN 1 AND 7),
  start_time time NOT NULL,
  end_time time NOT NULL,
  PRIMARY KEY (service_id, weekday, start_time, end_time)
);

-- ============================================
-- 20. USER_PREFERENCES
-- ============================================
CREATE TABLE IF NOT EXISTS user_preferences (
  user_id uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  last_location_label text,
  last_lat double precision,
  last_lon double precision,
  last_goal text,
  last_service_type text,
  last_budget text,
  last_venue text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================
-- 21. QUALITY_EVENTS
-- ============================================
CREATE TABLE IF NOT EXISTS quality_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id text NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  user_id uuid,
  booking_id uuid,
  type text NOT NULL CHECK (type IN ('late_cancellation', 'no_show')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================
-- 22. LOCATIONS (geocoding cache)
-- ============================================
CREATE TABLE IF NOT EXISTS locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  city text,
  country text,
  lat double precision NOT NULL,
  lon double precision NOT NULL,
  source text NOT NULL,
  created_at timestamp without time zone DEFAULT timezone('utc'::text, now()),
  UNIQUE (label, lat, lon)
);

-- ============================================
-- 23. SEARCH_CACHE
-- ============================================
CREATE TABLE IF NOT EXISTS search_cache (
  cache_key text PRIMARY KEY,
  response jsonb NOT NULL,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS service_cache (
  service_id text PRIMARY KEY,
  payload jsonb NOT NULL,
  updated_at timestamptz DEFAULT now()
);

-- ============================================
-- 24. CATEGORIES
-- ============================================
CREATE TABLE IF NOT EXISTS categories (
  id text PRIMARY KEY,
  name text NOT NULL,
  description text,
  created_at timestamp without time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS service_categories (
  service_id text NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  category_id text NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  PRIMARY KEY (service_id, category_id)
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_services_is_active ON services (is_active);
CREATE INDEX IF NOT EXISTS idx_services_owner_user_id ON services (owner_user_id);
CREATE INDEX IF NOT EXISTS idx_services_price_level ON services (price_level);
CREATE INDEX IF NOT EXISTS idx_services_rating_avg ON services (rating_avg);

CREATE INDEX IF NOT EXISTS idx_leads_service_id ON leads (service_id);
CREATE INDEX IF NOT EXISTS idx_leads_user_created_at ON leads (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_service_created_at ON leads (service_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_reviews_service_id ON reviews (service_id);
CREATE INDEX IF NOT EXISTS idx_reviews_lead_id ON reviews (lead_id);

CREATE INDEX IF NOT EXISTS idx_events_type_created_at ON events (type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_service_id ON events (service_id);

CREATE INDEX IF NOT EXISTS idx_organization_members_user_id ON organization_members (user_id);
CREATE INDEX IF NOT EXISTS idx_organization_members_organization_id ON organization_members (organization_id);
CREATE INDEX IF NOT EXISTS idx_organization_lead_stats_organization_id ON organization_lead_stats (organization_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_organization_lead_stats_unique ON organization_lead_stats (organization_id, lead_id);

CREATE INDEX IF NOT EXISTS idx_provider_invites_email ON provider_invites (email);

CREATE INDEX IF NOT EXISTS idx_locations_label ON locations (lower(label));
CREATE INDEX IF NOT EXISTS idx_locations_city ON locations (lower(city));
CREATE INDEX IF NOT EXISTS idx_locations_lat_lon ON locations (lat, lon);

CREATE INDEX IF NOT EXISTS bookings_service_id_idx ON bookings(service_id);
CREATE INDEX IF NOT EXISTS bookings_user_id_idx ON bookings(user_id);
CREATE INDEX IF NOT EXISTS bookings_lead_id_idx ON bookings(lead_id);

CREATE INDEX IF NOT EXISTS idx_search_cache_expires_at ON search_cache (expires_at);
