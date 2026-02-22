-- ============================================
-- PostGIS matching + search function
-- Run AFTER 00_schema.sql
-- ============================================

-- Add geography column for service locations
ALTER TABLE services
  ADD COLUMN IF NOT EXISTS base_location geography(Point, 4326);

-- Normalized searchable text for fuzzy filtering
ALTER TABLE services
  ADD COLUMN IF NOT EXISTS search_text text GENERATED ALWAYS AS (
    unaccent(lower(
      coalesce(name, '') || ' ' ||
      coalesce(description, '') || ' ' ||
      coalesce(array_to_string(tags, ' '), '')
    ))
  ) STORED;

-- Normalized coverage rules
CREATE TABLE IF NOT EXISTS service_coverage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id text NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('radius', 'city', 'region')),
  radius_center geography(Point, 4326),
  radius_km numeric,
  city text,
  region text,
  created_at timestamp without time zone DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_service_coverage_service_id ON service_coverage (service_id);
CREATE INDEX IF NOT EXISTS idx_service_coverage_city ON service_coverage (city);
CREATE INDEX IF NOT EXISTS idx_service_coverage_region ON service_coverage (region);
CREATE INDEX IF NOT EXISTS idx_service_coverage_radius_center ON service_coverage USING GIST (radius_center);
CREATE INDEX IF NOT EXISTS services_search_trgm_idx ON services USING GIN (search_text gin_trgm_ops);

-- The main search function
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
  p_limit int
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
  match_reason text
) AS $$
DECLARE
  user_point geography;
  venue_key text;
  goal_candidate text := COALESCE(p_goal, 'any');
  type_candidate text := COALESCE(p_service_type, 'any');
  budget_candidate text := COALESCE(p_budget, 'any');
  venue_candidate text := COALESCE(p_venue, 'either');
  sort_mode text := COALESCE(p_sort, 'best_match');
  max_limit int := LEAST(COALESCE(p_limit, 20), 20);
  normalized_query text := NULL;
BEGIN
  IF p_lat IS NOT NULL AND p_lon IS NOT NULL THEN
    user_point := ST_SetSRID(ST_MakePoint(p_lon, p_lat), 4326);
  END IF;

  IF p_query IS NOT NULL THEN
    normalized_query := NULLIF(TRIM(p_query), '');
    IF normalized_query IS NOT NULL THEN
      normalized_query := unaccent(lower(normalized_query));
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
        normalized_query IS NULL
        OR s.search_text % normalized_query
      )
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
    rs.distance_km,
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
    END AS match_reason
  FROM (
    SELECT *,
      goal_match, type_match, budget_match, venue_match,
      rating_score, distance_score,
      CASE venue_key WHEN 'home' THEN 'Hjemme' WHEN 'gym' THEN 'Senter' ELSE NULL END AS venue_label
    FROM (
      SELECT *,
        (goal_candidate = 'any' OR goal_candidate = '' OR goal_candidate::text = ANY(goals)) AS goal_match,
        (type_candidate = 'any' OR type_candidate = '' OR type_candidate::text = type) AS type_match,
        (budget_candidate = 'any' OR budget_candidate = '' OR budget_candidate::text = price_level) AS budget_match,
        (venue_key IS NOT NULL AND venue_key = ANY(venues)) AS venue_match,
        CASE
          WHEN rating_avg >= 4.7 THEN 3 WHEN rating_avg >= 4.4 THEN 2
          WHEN rating_avg >= 4.1 THEN 1 ELSE 0
        END AS rating_score,
        CASE
          WHEN distance_km IS NULL THEN 0 WHEN distance_km <= 5 THEN 3
          WHEN distance_km <= 15 THEN 2 WHEN distance_km <= 30 THEN 1 ELSE 0
        END AS distance_score
      FROM ranked_services
    ) AS matched
  ) AS rs
  WHERE rs.goal_match OR rs.type_match OR rs.budget_match
    OR rs.venue_match OR rs.distance_score > 0 OR rs.rating_score > 0
  ORDER BY
    CASE sort_mode
      WHEN 'nearest' THEN COALESCE(rs.distance_km, 99999)
      WHEN 'rating' THEN -rs.rating_avg
      WHEN 'price_low' THEN CASE rs.price_level WHEN 'low' THEN 1 WHEN 'medium' THEN 2 WHEN 'high' THEN 3 ELSE 4 END
      WHEN 'price_high' THEN CASE rs.price_level WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 ELSE 4 END * -1
      ELSE -rs.score
    END,
    CASE sort_mode
      WHEN 'nearest' THEN -rs.rating_avg WHEN 'rating' THEN -rs.rating_count ELSE -rs.rating_avg
    END
  LIMIT max_limit;
END;
$$ LANGUAGE plpgsql STABLE;
