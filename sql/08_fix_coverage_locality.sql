-- ============================================================
-- Fiks: Fjern 'Tilgjengelig i hele Norge' fra lokale tjenester
-- ============================================================
--
-- Problem: region='norway' ble lagt til alle importerte tjenester,
-- men lokale treningssentre betjener bare sitt område.
--
-- Regel:
--   • Tjenester med city-coverage → lokale → fjern region='norway'
--   • Tjenester uten city-coverage → behold region='norway'
--     (disse er genuint landsdekkende, f.eks. online coaching)
--
-- Kjøres én gang i Supabase SQL editor.
-- ============================================================

-- Vis hva som blir berørt FØR sletting (kjør først for å verifisere):
/*
SELECT
  s.id,
  s.name,
  s.city,
  count(*) FILTER (WHERE sc.type = 'city')   AS city_coverage_count,
  count(*) FILTER (WHERE sc.type = 'region') AS region_coverage_count
FROM services s
JOIN service_coverage sc ON sc.service_id = s.id
GROUP BY s.id, s.name, s.city
HAVING
  count(*) FILTER (WHERE sc.type = 'region') > 0
  AND count(*) FILTER (WHERE sc.type = 'city') > 0
ORDER BY s.name
LIMIT 50;
*/

-- Slett region='norway'/'nordic' fra tjenester som også har by-coverage
DELETE FROM service_coverage
WHERE type = 'region'
  AND region IN ('norway', 'nordic')
  AND service_id IN (
    SELECT DISTINCT service_id
    FROM service_coverage
    WHERE type = 'city'
      AND city IS NOT NULL
      AND city <> ''
  );

-- Sjekk hva som er igjen med region-coverage (skal bare være online-tjenester):
/*
SELECT s.id, s.name, s.city, sc.region
FROM services s
JOIN service_coverage sc ON sc.service_id = s.id
WHERE sc.type = 'region'
ORDER BY s.name;
*/

-- Forventet resultat:
-- • ~12 000+ rader slettet (alle BRREG-tjenester med by-coverage mister region='norway')
-- • ~149 gp_*-tjenester mister region='norway' (de har alle by-coverage)
-- • Kun genuint landsdekkende tjenester (NordicFit Online, etc.) beholder region='norway'
