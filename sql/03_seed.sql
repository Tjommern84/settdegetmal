-- ============================================
-- Seed data for testing
-- Run AFTER 00_schema.sql + 01_postgis_and_search.sql + 02_rls.sql
-- ============================================

-- Test services (no owner_user_id so they show for everyone)
INSERT INTO services (id, name, type, description, price_level, goals, venues, coverage, tags, rating_avg, rating_count, is_active)
VALUES
  ('seed-pt-horten', 'FitForm PT Horten', 'pt',
   'Personlig trener i Horten med fokus på styrke og vektnedgang. Erfaren PT med over 10 års erfaring.',
   'medium', ARRAY['weight_loss', 'strength', 'general_health'], ARRAY['gym', 'home'],
   '[{"type": "radius", "center": {"lat": 59.4167, "lon": 10.4833}, "radius_km": 30}]'::jsonb,
   ARRAY['styrketrening', 'personlig trener', 'horten', 'vestfold'],
   4.7, 23, true),

  ('seed-pt-oslo', 'Oslo Strength Lab', 'pt',
   'Profesjonell PT-studio i Oslo sentrum. Spesialisert på styrketrening og kroppsomforming.',
   'high', ARRAY['strength', 'muscle_gain'], ARRAY['gym'],
   '[{"type": "radius", "center": {"lat": 59.9139, "lon": 10.7522}, "radius_km": 15}]'::jsonb,
   ARRAY['styrketrening', 'oslo', 'pt studio'],
   4.9, 47, true),

  ('seed-yoga-oslo', 'Zen Yoga Oslo', 'yoga',
   'Yogastudio med fokus på mindfulness og fleksibilitet. Tilbyr kurs for alle nivåer.',
   'medium', ARRAY['flexibility', 'general_health'], ARRAY['gym', 'online'],
   '[{"type": "radius", "center": {"lat": 59.9139, "lon": 10.7522}, "radius_km": 20}]'::jsonb,
   ARRAY['yoga', 'mindfulness', 'oslo'],
   4.5, 31, true),

  ('seed-pt-bergen', 'Bergen Athletic PT', 'pt',
   'Din personlige trener i Bergen. Tilpassede treningsprogram for alle mål.',
   'medium', ARRAY['weight_loss', 'strength', 'general_health'], ARRAY['gym', 'home', 'online'],
   '[{"type": "radius", "center": {"lat": 60.3913, "lon": 5.3221}, "radius_km": 25}]'::jsonb,
   ARRAY['personlig trener', 'bergen', 'online trening'],
   4.6, 18, true),

  ('seed-pt-tonsberg', 'Tønsberg Trening AS', 'pt',
   'Profesjonell personlig trening i Tønsberg og omegn. Vi hjelper deg å nå dine mål.',
   'low', ARRAY['weight_loss', 'general_health', 'rehabilitation'], ARRAY['gym', 'home'],
   '[{"type": "radius", "center": {"lat": 59.2669, "lon": 10.4076}, "radius_km": 25}]'::jsonb,
   ARRAY['personlig trener', 'tønsberg', 'vestfold', 'rehabilitering'],
   4.4, 12, true),

  ('seed-online-coach', 'NordicFit Online', 'online_coaching',
   'Online coaching med ukentlig oppfølging. Treningsprogram og kostholdsrådgivning.',
   'low', ARRAY['weight_loss', 'strength', 'muscle_gain', 'general_health'], ARRAY['online'],
   '[{"type": "region", "region": "norway"}]'::jsonb,
   ARRAY['online coaching', 'kosthold', 'treningsprogram'],
   4.3, 56, true),

  ('seed-group-oslo', 'CrossFit Bjørvika', 'group',
   'CrossFit-senter i Bjørvika. Gruppetimer og open gym. Motiverende fellesskap.',
   'medium', ARRAY['strength', 'general_health', 'muscle_gain'], ARRAY['gym'],
   '[{"type": "radius", "center": {"lat": 59.9070, "lon": 10.7570}, "radius_km": 10}]'::jsonb,
   ARRAY['crossfit', 'gruppetrening', 'oslo', 'bjørvika'],
   4.8, 89, true),

  ('seed-pt-trondheim', 'Trondheim PT Studio', 'pt',
   'Personlig trening i Trondheim. Spesialisert på styrke og idrettsprestasjoner.',
   'high', ARRAY['strength', 'muscle_gain', 'sports_performance'], ARRAY['gym'],
   '[{"type": "radius", "center": {"lat": 63.4305, "lon": 10.3951}, "radius_km": 20}]'::jsonb,
   ARRAY['personlig trener', 'trondheim', 'idrettsprestasjon'],
   4.6, 15, true)
ON CONFLICT (id) DO NOTHING;

-- Create service_coverage entries from the JSON coverage data
INSERT INTO service_coverage (service_id, type, radius_center, radius_km, city, region)
SELECT
  s.id,
  cov.value ->> 'type',
  CASE
    WHEN cov.value ->> 'type' = 'radius' THEN
      ST_SetSRID(ST_MakePoint(
        ((cov.value -> 'center' ->> 'lon')::double precision),
        ((cov.value -> 'center' ->> 'lat')::double precision)
      ), 4326)
    ELSE NULL
  END,
  (cov.value ->> 'radius_km')::numeric,
  NULL,
  CASE WHEN cov.value ->> 'type' = 'region' THEN cov.value ->> 'region' ELSE NULL END
FROM services s
CROSS JOIN LATERAL jsonb_array_elements(s.coverage) AS cov(value)
WHERE s.id LIKE 'seed-%'
ON CONFLICT DO NOTHING;

-- Remove legacy demo services so result pages only use scraper/imported data.
-- Keeps category metadata below, but purges old `seed-*` test listings.
DELETE FROM services
WHERE id LIKE 'seed-%';

-- Seed some categories
INSERT INTO categories (id, name, description) VALUES
  ('pt', 'Personlig trener', 'En-til-en personlig trening'),
  ('yoga', 'Yoga', 'Yoga og mindfulness'),
  ('group', 'Gruppetrening', 'Gruppetimer og fellestreninger'),
  ('online', 'Online coaching', 'Digital oppfølging og trening'),
  ('rehab', 'Rehabilitering', 'Trening for rehabilitering og skadeforebygging')
ON CONFLICT (id) DO NOTHING;
