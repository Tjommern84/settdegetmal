-- ============================================
-- Sport & fokus-tag berikelse + p_tag i search_services()
-- Kjør i Supabase SQL Editor
-- ============================================

-- ── 0. Manglende kolonner (kjøres trygt flere ganger) ────────────────────
ALTER TABLE services ADD COLUMN IF NOT EXISTS oslo_bydel text;
ALTER TABLE services ADD COLUMN IF NOT EXISTS search_text text;

-- ── 1. GIN-indeks på tags for rask tag-filtrering ────────────────────────
CREATE INDEX IF NOT EXISTS idx_services_tags ON services USING GIN (tags);

-- ── 2. Normaliser Serper sport-tags (ASCII → norsk) ──────────────────────

-- handball → håndball (Serper bruker engelsk)
UPDATE services
SET tags = array_append(tags, 'håndball')
WHERE 'handball' = ANY(tags) AND NOT 'håndball' = ANY(tags);

-- svomming → svømming
UPDATE services
SET tags = array_append(tags, 'svømming')
WHERE 'svomming' = ANY(tags) AND NOT 'svømming' = ANY(tags);

-- basketball → basket (norsk term)
UPDATE services
SET tags = array_append(tags, 'basket')
WHERE 'basketball' = ANY(tags) AND NOT 'basket' = ANY(tags);

-- ── 3. Legg til sport-tags på BRREG idrettslag (fra navn) ────────────────
-- Serper-clubs har allerede sport-tags; NOT X = ANY(tags) hindrer duplikat.

UPDATE services SET tags = array_append(tags, 'fotball')
WHERE type = 'sport' AND NOT 'fotball' = ANY(tags)
  AND (lower(name) LIKE '%fotball%' OR lower(name) LIKE '%soccer%');

UPDATE services SET tags = array_append(tags, 'håndball')
WHERE type = 'sport' AND NOT 'håndball' = ANY(tags)
  AND (lower(name) LIKE '%håndball%' OR lower(name) LIKE '%handball%');

UPDATE services SET tags = array_append(tags, 'basket')
WHERE type = 'sport' AND NOT 'basket' = ANY(tags)
  AND (lower(name) LIKE '%basket%');

UPDATE services SET tags = array_append(tags, 'volleyball')
WHERE type = 'sport' AND NOT 'volleyball' = ANY(tags)
  AND (lower(name) LIKE '%volleyball%' OR lower(name) LIKE '%volley%');

UPDATE services SET tags = array_append(tags, 'svømming')
WHERE type = 'sport' AND NOT 'svømming' = ANY(tags)
  AND (lower(name) LIKE '%svøm%' OR lower(name) LIKE '%swim%');

UPDATE services SET tags = array_append(tags, 'tennis')
WHERE type = 'sport' AND NOT 'tennis' = ANY(tags)
  AND lower(name) LIKE '%tennis%';

UPDATE services SET tags = array_append(tags, 'badminton')
WHERE type = 'sport' AND NOT 'badminton' = ANY(tags)
  AND lower(name) LIKE '%badminton%';

UPDATE services SET tags = array_append(tags, 'golf')
WHERE type = 'sport' AND NOT 'golf' = ANY(tags)
  AND lower(name) LIKE '%golf%';

UPDATE services SET tags = array_append(tags, 'ski')
WHERE type = 'sport' AND NOT 'ski' = ANY(tags)
  AND (lower(name) LIKE '%skiklubb%' OR lower(name) LIKE '%skilag%'
    OR lower(name) LIKE '%langrenn%' OR lower(name) LIKE '%alpinlag%'
    OR lower(name) LIKE '%slalom%' OR lower(name) LIKE '%snowboard%');

UPDATE services SET tags = array_append(tags, 'ishockey')
WHERE type = 'sport' AND NOT 'ishockey' = ANY(tags)
  AND (lower(name) LIKE '%ishockey%' OR lower(name) LIKE '% hockey%');

UPDATE services SET tags = array_append(tags, 'friidrett')
WHERE type = 'sport' AND NOT 'friidrett' = ANY(tags)
  AND lower(name) LIKE '%friidrett%';

UPDATE services SET tags = array_append(tags, 'kampsport')
WHERE type = 'sport' AND NOT 'kampsport' = ANY(tags)
  AND (lower(name) LIKE '%judo%' OR lower(name) LIKE '%karate%'
    OR lower(name) LIKE '%taekwondo%' OR lower(name) LIKE '%boksing%'
    OR lower(name) LIKE '%bryting%' OR lower(name) LIKE '%kampsport%'
    OR lower(name) LIKE '%kickboks%' OR lower(name) LIKE '% mma%');

UPDATE services SET tags = array_append(tags, 'turn')
WHERE type = 'sport' AND NOT 'turn' = ANY(tags)
  AND (lower(name) LIKE '%turnklubb%' OR lower(name) LIKE '%turnlag%'
    OR lower(name) LIKE '%gymnastklubb%' OR lower(name) LIKE '%gymnastics%');

UPDATE services SET tags = array_append(tags, 'padel')
WHERE type = 'sport' AND NOT 'padel' = ANY(tags)
  AND lower(name) LIKE '%padel%';

UPDATE services SET tags = array_append(tags, 'orientering')
WHERE type = 'sport' AND NOT 'orientering' = ANY(tags)
  AND lower(name) LIKE '%orientering%';

UPDATE services SET tags = array_append(tags, 'sykkel')
WHERE type = 'sport' AND NOT 'sykkel' = ANY(tags)
  AND (lower(name) LIKE '%sykkelklubb%' OR lower(name) LIKE '%sykkellag%'
    OR lower(name) LIKE '%cycling%');

UPDATE services SET tags = array_append(tags, 'rugby')
WHERE type = 'sport' AND NOT 'rugby' = ANY(tags)
  AND lower(name) LIKE '%rugby%';

UPDATE services SET tags = array_append(tags, 'roing')
WHERE type = 'sport' AND NOT 'roing' = ANY(tags)
  AND (lower(name) LIKE '%roklubb%' OR lower(name) LIKE '%rolag%'
    OR lower(name) LIKE '%kajak%' OR lower(name) LIKE '%kano%'
    OR lower(name) LIKE '% roing%');

UPDATE services SET tags = array_append(tags, 'seiling')
WHERE type = 'sport' AND NOT 'seiling' = ANY(tags)
  AND (lower(name) LIKE '%seilklubb%' OR lower(name) LIKE '%seillag%'
    OR lower(name) LIKE '%seilforening%');

UPDATE services SET tags = array_append(tags, 'squash')
WHERE type = 'sport' AND NOT 'squash' = ANY(tags)
  AND lower(name) LIKE '%squash%';

UPDATE services SET tags = array_append(tags, 'klatring')
WHERE type = 'sport' AND NOT 'klatring' = ANY(tags)
  AND (lower(name) LIKE '%klatreklubb%' OR lower(name) LIKE '%klatrelag%'
    OR lower(name) LIKE '%klatring%');

-- ── 4. Fokus-tags på PT-leverandører (fra navn) ──────────────────────────

UPDATE services SET tags = array_append(tags, 'styrke')
WHERE type = 'pt' AND NOT 'styrke' = ANY(tags)
  AND (lower(name) LIKE '%styrke%' OR lower(name) LIKE '%strength%'
    OR lower(name) LIKE '%powerlifting%' OR lower(name) LIKE '%vekttrening%'
    OR lower(name) LIKE '%crossfit%');

UPDATE services SET tags = array_append(tags, 'kondisjon')
WHERE type = 'pt' AND NOT 'kondisjon' = ANY(tags)
  AND (lower(name) LIKE '%kondisjon%' OR lower(name) LIKE '%cardio%'
    OR lower(name) LIKE '%løping%' OR lower(name) LIKE '%triathlon%'
    OR lower(name) LIKE '%running%');

UPDATE services SET tags = array_append(tags, 'vektnedgang')
WHERE type = 'pt' AND NOT 'vektnedgang' = ANY(tags)
  AND (lower(name) LIKE '%vektnedgang%' OR lower(name) LIKE '%slimming%'
    OR lower(name) LIKE '%vektreduksjon%');

UPDATE services SET tags = array_append(tags, 'online')
WHERE type = 'pt' AND NOT 'online' = ANY(tags)
  AND (lower(name) LIKE '%online%' OR lower(name) LIKE '%digital%'
    OR lower(name) LIKE '%remote%' OR lower(name) LIKE '%virtuell%');

-- ── 5. Oppdater search_services() med p_tag parameter ───────────────────

DROP FUNCTION IF EXISTS search_services(text,double precision,double precision,text,text,text,text,text,text,integer);
DROP FUNCTION IF EXISTS search_services(text,double precision,double precision,text,text,text,text,text,text,integer,text);
DROP FUNCTION IF EXISTS search_services(text,double precision,double precision,text,text,text,text,text,text,integer,text,text);

CREATE OR REPLACE FUNCTION search_services(
  p_city text,
  p_lat double precision,
  p_lon double precision,
  p_goal text,
  p_service_type text,
  p_budget text,
  p_venue text,
  p_sort text,
  p_query text,
  p_limit int,
  p_borough text DEFAULT NULL,
  p_tag text DEFAULT NULL
) RETURNS TABLE (
  service_id text,
  name text,
  type text,
  description text,
  coverage jsonb,
  price_level text,
  rating_avg numeric,
  rating_count int,
  tags text[],
  goals text[],
  venues text[],
  is_active boolean,
  distance_km numeric,
  score numeric,
  reasons text[],
  match_reason text,
  address text,
  phone text,
  email text,
  website text,
  orgnr text
) AS $$
#variable_conflict use_column
DECLARE
  user_point geography;
  venue_key text;
  goal_candidate text := COALESCE(p_goal, 'any');
  type_candidate text := COALESCE(p_service_type, 'any');
  budget_candidate text := COALESCE(p_budget, 'any');
  venue_candidate text := COALESCE(p_venue, 'either');
  sort_mode text := COALESCE(p_sort, 'best_match');
  max_limit int := LEAST(GREATEST(COALESCE(p_limit, 20), 1), 100);
  normalized_query text := NULL;
  borough_candidate text := NULL;
  tag_candidate text := NULL;
BEGIN
  IF p_lat IS NOT NULL AND p_lon IS NOT NULL THEN
    user_point := ST_SetSRID(ST_MakePoint(p_lon, p_lat), 4326);
  END IF;

  IF p_query IS NOT NULL THEN
    normalized_query := NULLIF(TRIM(p_query), '');
    IF normalized_query IS NOT NULL THEN
      normalized_query := lower(normalized_query);
    END IF;
  END IF;

  IF p_borough IS NOT NULL THEN
    borough_candidate := NULLIF(TRIM(p_borough), '');
    IF borough_candidate IS NOT NULL THEN
      borough_candidate := lower(borough_candidate);
    END IF;
  END IF;

  IF p_tag IS NOT NULL THEN
    tag_candidate := NULLIF(TRIM(p_tag), '');
    IF tag_candidate IS NOT NULL THEN
      tag_candidate := lower(tag_candidate);
    END IF;
  END IF;

  IF venue_candidate = 'home' THEN
    venue_key := 'home';
  ELSIF venue_candidate = 'gym' THEN
    venue_key := 'gym';
  ELSE
    venue_key := NULL;
  END IF;

  RETURN QUERY
  WITH matched_coverage AS (
    SELECT DISTINCT ON (sc.service_id)
      sc.service_id,
      sc.type,
      sc.radius_km,
      sc.city,
      sc.region,
      sc.radius_center,
      CASE
        WHEN sc.type = 'radius'
             AND user_point IS NOT NULL
             AND sc.radius_center IS NOT NULL
             AND sc.radius_km IS NOT NULL
             AND ST_DWithin(sc.radius_center, user_point, sc.radius_km * 1000) THEN
          ST_Distance(sc.radius_center, user_point) / 1000
        ELSE NULL
      END AS distance_km,
      CASE
        WHEN sc.type = 'radius' THEN 1
        WHEN sc.type = 'city' THEN 2
        ELSE 3
      END AS coverage_rank
    FROM service_coverage sc
    WHERE (
      sc.type = 'radius'
      AND user_point IS NOT NULL
      AND sc.radius_center IS NOT NULL
      AND sc.radius_km IS NOT NULL
      AND ST_DWithin(sc.radius_center, user_point, sc.radius_km * 1000)
    )
    OR (
      sc.type = 'city'
      AND p_city IS NOT NULL
      AND p_city <> ''
      AND sc.city IS NOT NULL
      AND lower(sc.city) = lower(p_city)
    )
    OR (
      sc.type = 'region'
      AND sc.region IS NOT NULL
      AND lower(sc.region) IN ('norway', 'nordic')
    )
    ORDER BY sc.service_id, coverage_rank, COALESCE(ST_Distance(sc.radius_center, user_point) / 1000, 0)
  ),
  ranked_services AS (
    SELECT
      s.*,
      mc.distance_km,
      mc.type AS coverage_type,
      mc.radius_km,
      mc.city AS coverage_city,
      mc.region AS coverage_region,
      CASE
        WHEN normalized_query IS NOT NULL THEN similarity(s.search_text, normalized_query)
        ELSE 0
      END AS query_similarity
    FROM services s
    JOIN matched_coverage mc ON mc.service_id = s.id
    WHERE s.is_active = true
      AND (
        borough_candidate IS NULL
        OR lower(coalesce(s.oslo_bydel, '')) = borough_candidate
      )
      AND (
        normalized_query IS NULL
        OR s.search_text % normalized_query
      )
      AND (tag_candidate IS NULL OR tag_candidate = ANY(s.tags))
  )
  SELECT
    rs.id,
    rs.name,
    rs.type,
    rs.description,
    rs.coverage,
    rs.price_level,
    rs.rating_avg,
    rs.rating_count,
    rs.tags,
    rs.goals,
    rs.venues,
    rs.is_active,
    rs.distance_km::numeric,
    (
      (CASE WHEN goal_match THEN 4 ELSE 0 END)
      + (CASE WHEN type_match THEN 3 ELSE 0 END)
      + (CASE WHEN budget_match THEN 2 ELSE 0 END)
      + (CASE WHEN venue_match THEN 2 ELSE 0 END)
      + rating_score
      + distance_score
      + (CASE WHEN rs.query_similarity > 0 THEN rs.query_similarity * 4 ELSE 0 END)
    )::numeric(12,4) AS score,
    (
      SELECT array_agg(reason)
      FROM (
        SELECT reason FROM (
          SELECT unnest(ARRAY[
            CASE WHEN goal_match THEN 'Mål match' ELSE NULL END,
            CASE WHEN type_match THEN 'Type match' ELSE NULL END,
            CASE WHEN budget_match THEN 'Budsjett match' ELSE NULL END,
            CASE WHEN venue_match THEN 'Passer ' || venue_label ELSE NULL END,
            CASE WHEN rating_score > 0 THEN 'God rating' ELSE NULL END,
            CASE WHEN distance_score > 0 THEN 'Nær deg' ELSE NULL END,
            CASE WHEN rs.query_similarity > 0 THEN 'Treff på søk' ELSE NULL END
          ]) AS reason
        ) AS populated WHERE reason IS NOT NULL LIMIT 4
      ) AS reason_list
    ) AS reasons,
    CASE
      WHEN rs.coverage_type = 'radius' THEN 'Innenfor ' || rs.radius_km::text || ' km'
      WHEN rs.coverage_type = 'city' THEN 'Dekker ' || rs.coverage_city
      WHEN lower(rs.coverage_region) = 'nordic' THEN 'Tilgjengelig i hele Norden'
      ELSE 'Tilgjengelig i hele Norge'
    END AS match_reason,
    rs.address,
    rs.phone,
    rs.email,
    rs.website,
    rs.orgnr
  FROM (
    SELECT *,
      CASE venue_key WHEN 'home' THEN 'Hjemme' WHEN 'gym' THEN 'Senter' ELSE NULL END AS venue_label
    FROM (
      SELECT rs0.*,
        (goal_candidate = 'any' OR goal_candidate = '' OR goal_candidate::text = ANY(rs0.goals)) AS goal_match,
        (type_candidate = 'any' OR type_candidate = '' OR EXISTS (
          SELECT 1 FROM service_types st
          WHERE st.service_id = rs0.id AND st.type = type_candidate
        )) AS type_match,
        (budget_candidate = 'any' OR budget_candidate = '' OR budget_candidate::text = rs0.price_level) AS budget_match,
        (venue_key IS NOT NULL AND venue_key = ANY(rs0.venues)) AS venue_match,
        CASE
          WHEN rs0.rating_avg >= 4.7 THEN 3 WHEN rs0.rating_avg >= 4.4 THEN 2
          WHEN rs0.rating_avg >= 4.1 THEN 1 ELSE 0
        END AS rating_score,
        CASE
          WHEN rs0.distance_km IS NULL THEN 0 WHEN rs0.distance_km <= 5 THEN 3
          WHEN rs0.distance_km <= 15 THEN 2 WHEN rs0.distance_km <= 30 THEN 1 ELSE 0
        END AS distance_score
      FROM ranked_services rs0
    ) AS matched
  ) AS rs
  WHERE (goal_candidate IN ('any', '') OR rs.goal_match)
    AND (type_candidate IN ('any', '') OR rs.type_match)
    AND (budget_candidate IN ('any', '') OR rs.budget_match)
    AND (venue_key IS NULL OR rs.venue_match)
  ORDER BY
    CASE sort_mode
      WHEN 'nearest' THEN COALESCE(rs.distance_km, 99999)
      WHEN 'rating' THEN -rs.rating_avg
      WHEN 'price_low' THEN CASE rs.price_level WHEN 'low' THEN 1 WHEN 'medium' THEN 2 WHEN 'high' THEN 3 ELSE 4 END
      WHEN 'price_high' THEN CASE rs.price_level WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 ELSE 4 END * -1
      ELSE -(
        (CASE WHEN rs.goal_match THEN 4 ELSE 0 END)
        + (CASE WHEN rs.type_match THEN 3 ELSE 0 END)
        + (CASE WHEN rs.budget_match THEN 2 ELSE 0 END)
        + (CASE WHEN rs.venue_match THEN 2 ELSE 0 END)
        + rs.rating_score + rs.distance_score
        + (CASE WHEN rs.query_similarity > 0 THEN rs.query_similarity * 4 ELSE 0 END)
      )
    END,
    CASE sort_mode
      WHEN 'nearest' THEN -rs.rating_avg WHEN 'rating' THEN -rs.rating_count ELSE -rs.rating_avg
    END
  LIMIT max_limit;
END;
$$ LANGUAGE plpgsql STABLE;

GRANT EXECUTE ON FUNCTION search_services(text, double precision, double precision, text, text, text, text, text, text, integer, text, text) TO anon, authenticated;
