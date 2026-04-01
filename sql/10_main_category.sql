-- ============================================
-- Migration 10: main_category column
-- + update search_services() to 14 params
-- Run AFTER 09_sport_tags.sql
-- ============================================

-- 1. Add main_category column
ALTER TABLE services ADD COLUMN IF NOT EXISTS main_category text;

-- 2. Populate main_category from existing type values
UPDATE services
SET main_category = CASE
  WHEN type IN ('styrke', 'kondisjon', 'teknologi') THEN 'trene-selv'
  WHEN type IN ('gruppe', 'yoga', 'mindbody', 'outdoor') THEN 'trene-sammen'
  WHEN type IN ('pt', 'spesialisert', 'livsstil') THEN 'oppfolging'
  WHEN type = 'sport' THEN 'aktivitet-sport'
  ELSE NULL
END
WHERE main_category IS NULL;

-- 3. Add type-based tags so tag-filtering within a category works
--    (adds the type value as a tag if it's not already present)
UPDATE services
SET tags = array(
  SELECT DISTINCT unnest(
    tags ||
    ARRAY[type] ||
    CASE type
      WHEN 'gruppe'  THEN ARRAY['gruppetime']
      WHEN 'yoga'    THEN ARRAY['yoga']
      WHEN 'outdoor' THEN ARRAY['outdoor']
      WHEN 'pt'      THEN ARRAY['pt']
      ELSE ARRAY[]::text[]
    END
  )
)
WHERE type IS NOT NULL
  AND type IN (
    'styrke','pt','yoga','gruppe','kondisjon','outdoor',
    'sport','mindbody','spesialisert','livsstil','teknologi'
  );

-- 4. Index for main_category
CREATE INDEX IF NOT EXISTS idx_services_main_category ON services (main_category);

-- ============================================
-- Update search_services() – add p_main_category + p_tags
-- New signature: 14 params (was 12)
-- ============================================

-- Drop old 12-param version
DROP FUNCTION IF EXISTS search_services(
  text, double precision, double precision,
  text, text, text, text, text, text,
  integer, text, text
);

CREATE OR REPLACE FUNCTION search_services(
  p_city             text,
  p_lat              double precision,
  p_lon              double precision,
  p_goal             text,
  p_service_type     text,
  p_budget           text,
  p_venue            text,
  p_sort             text,
  p_query            text,
  p_limit            int,
  p_borough          text    DEFAULT NULL,
  p_tag              text    DEFAULT NULL,
  p_main_category    text    DEFAULT NULL,
  p_tags             text[]  DEFAULT NULL
) RETURNS TABLE (
  service_id   text,
  name         text,
  type         text,
  description  text,
  coverage     jsonb,
  price_level  text,
  rating_avg   numeric,
  rating_count int,
  tags         text[],
  goals        text[],
  venues       text[],
  is_active    boolean,
  distance_km  numeric,
  score        numeric,
  reasons      text[],
  match_reason text,
  address      text,
  phone        text,
  email        text,
  website      text,
  orgnr        text
) AS $$
#variable_conflict use_column
DECLARE
  user_point        geography;
  venue_key         text;
  goal_candidate    text := COALESCE(p_goal, 'any');
  type_candidate    text := COALESCE(p_service_type, 'any');
  budget_candidate  text := COALESCE(p_budget, 'any');
  venue_candidate   text := COALESCE(p_venue, 'either');
  sort_mode         text := COALESCE(p_sort, 'best_match');
  max_limit         int  := LEAST(GREATEST(COALESCE(p_limit, 20), 1), 100);
  normalized_query  text := NULL;
  borough_candidate text := NULL;
  tag_candidate     text := NULL;
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
    ORDER BY sc.service_id, coverage_rank,
      COALESCE(ST_Distance(sc.radius_center, user_point) / 1000, 0)
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
      AND (p_main_category IS NULL OR s.main_category = p_main_category)
      AND (p_tags IS NULL OR s.tags && p_tags)
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
            CASE WHEN goal_match   THEN 'Mål match'    ELSE NULL END,
            CASE WHEN type_match   THEN 'Type match'   ELSE NULL END,
            CASE WHEN budget_match THEN 'Budsjett match' ELSE NULL END,
            CASE WHEN venue_match  THEN 'Passer ' || venue_label ELSE NULL END,
            CASE WHEN rating_score > 0 THEN 'God rating' ELSE NULL END,
            CASE WHEN distance_score > 0 THEN 'Nær deg'  ELSE NULL END,
            CASE WHEN rs.query_similarity > 0 THEN 'Treff på søk' ELSE NULL END
          ]) AS reason
        ) AS populated WHERE reason IS NOT NULL LIMIT 4
      ) AS reason_list
    ) AS reasons,
    CASE
      WHEN rs.coverage_type = 'radius' THEN 'Innenfor ' || rs.radius_km::text || ' km'
      WHEN rs.coverage_type = 'city'   THEN 'Dekker ' || rs.coverage_city
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
      WHEN 'rating'  THEN -rs.rating_avg
      WHEN 'price_low'  THEN CASE rs.price_level WHEN 'low' THEN 1 WHEN 'medium' THEN 2 WHEN 'high' THEN 3 ELSE 4 END
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
      WHEN 'nearest' THEN -rs.rating_avg
      WHEN 'rating'  THEN -rs.rating_count
      ELSE -rs.rating_avg
    END
  LIMIT max_limit;
END;
$$ LANGUAGE plpgsql STABLE;

-- Grant execute on new 14-param signature
GRANT EXECUTE ON FUNCTION search_services(
  text, double precision, double precision,
  text, text, text, text, text, text,
  integer, text, text, text, text[]
) TO anon, authenticated;
