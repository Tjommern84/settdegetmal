-- ============================================
-- Migration 11: Tag backfill for category UI
-- Kjør i Supabase SQL Editor etter 10_main_category.sql
-- ============================================

-- ── trene-selv ────────────────────────────────────────────────────────────

-- crossfit: gymer med CrossFit i navn
UPDATE services SET tags = array_append(tags, 'crossfit')
WHERE main_category = 'trene-selv'
  AND NOT 'crossfit' = ANY(tags)
  AND lower(name) LIKE '%crossfit%';

-- functional: gymer med functional/kettlebell/calisthenics i navn
UPDATE services SET tags = array_append(tags, 'functional')
WHERE main_category = 'trene-selv'
  AND NOT 'functional' = ANY(tags)
  AND (
    lower(name) LIKE '%functional%'
    OR lower(name) LIKE '%kettlebell%'
    OR lower(name) LIKE '%calisthenics%'
    OR lower(name) LIKE '%funksjonell%'
  );

-- hjemmetrening: PT-er som tilbyr hjemmebesøk (home i venues) eller online
UPDATE services SET tags = array_append(tags, 'hjemmetrening')
WHERE NOT 'hjemmetrening' = ANY(tags)
  AND (
    ('home' = ANY(venues) AND type = 'pt')
    OR lower(name) LIKE '%hjemmetrening%'
    OR lower(name) LIKE '%hjemme%trening%'
  );

-- ── trene-sammen ─────────────────────────────────────────────────────────

-- bootcamp: tjenester med bootcamp i navn
UPDATE services SET tags = array_append(tags, 'bootcamp')
WHERE NOT 'bootcamp' = ANY(tags)
  AND (
    lower(name) LIKE '%bootcamp%'
    OR lower(name) LIKE '%boot camp%'
    OR lower(name) LIKE '%militærtrening%'
  );

-- løpegruppe: friidrettklubber + løpeklubb/løpelag i navn
UPDATE services SET tags = array_append(tags, 'løpegruppe')
WHERE NOT 'løpegruppe' = ANY(tags)
  AND (
    'friidrett' = ANY(tags)
    OR lower(name) LIKE '%løpeklubb%'
    OR lower(name) LIKE '%løpegruppe%'
    OR lower(name) LIKE '%løpelag%'
    OR lower(name) LIKE '%kondisklubb%'
    OR lower(name) LIKE '%maraton%'
    OR lower(name) LIKE '%halvmaraton%'
  );

-- ── oppfolging ────────────────────────────────────────────────────────────

-- rehab: type='spesialisert' + navn med rehab/fysio/kiropraktor
UPDATE services SET tags = array_append(tags, 'rehab')
WHERE NOT 'rehab' = ANY(tags)
  AND (
    type = 'spesialisert'
    OR lower(name) LIKE '%rehabilitering%'
    OR lower(name) LIKE '%fysioterapi%'
    OR lower(name) LIKE '%fysio %'
    OR lower(name) LIKE '% rehab%'
    OR lower(name) LIKE '%kiropraktor%'
    OR lower(name) LIKE '%naprapat%'
    OR lower(name) LIKE '%osteopat%'
    OR lower(name) LIKE '%sportsmedisins%'
  );

-- small-group (ingen mellomrom): PT-er med small group i navn
UPDATE services SET tags = array_append(tags, 'small-group')
WHERE main_category = 'oppfolging'
  AND NOT 'small-group' = ANY(tags)
  AND (
    lower(name) LIKE '%small group%'
    OR lower(name) LIKE '%smågruppe%'
    OR lower(name) LIKE '%minigruppe%'
    OR lower(name) LIKE '%duotrening%'
    OR lower(name) LIKE '%par-trening%'
  );

-- Fjern gammel 'small group' med mellomrom og erstatt med 'small-group'
UPDATE services
SET tags = array_replace(tags, 'small group', 'small-group')
WHERE 'small group' = ANY(tags);

-- online: bredere match enn sql/09
UPDATE services SET tags = array_append(tags, 'online')
WHERE main_category = 'oppfolging'
  AND NOT 'online' = ANY(tags)
  AND (
    lower(name) LIKE '%online%'
    OR lower(name) LIKE '%digital%'
    OR lower(name) LIKE '%nettbasert%'
    OR lower(name) LIKE '%remote%'
    OR lower(name) LIKE '%virtuell%'
    OR lower(name) LIKE '%app-basert%'
    OR (lower(name) LIKE '%coaching%' AND 'home' = ANY(venues))
  );

-- ernæring: tjenester med ernæring/kosthold/diett i navn
UPDATE services SET tags = array_append(tags, 'ernæring')
WHERE NOT 'ernæring' = ANY(tags)
  AND (
    lower(name) LIKE '%ernæring%'
    OR lower(name) LIKE '%kosthold%'
    OR lower(name) LIKE '%kostveileder%'
    OR lower(name) LIKE '%nutrition%'
    OR lower(name) LIKE '%diettist%'
    OR lower(name) LIKE '%kostrådgiver%'
    OR lower(name) LIKE '%kostholdsveileder%'
  );

-- ── aktivitet-sport ───────────────────────────────────────────────────────

-- langrenn: skiklubber med langrenn i navn (separat fra alpint)
UPDATE services SET tags = array_append(tags, 'langrenn')
WHERE NOT 'langrenn' = ANY(tags)
  AND (
    lower(name) LIKE '%langrenn%'
    OR lower(name) LIKE '%langrenns%'
    OR lower(name) LIKE '%skiforening%'
  );

-- orientering: sikre bredere dekning
UPDATE services SET tags = array_append(tags, 'orientering')
WHERE NOT 'orientering' = ANY(tags)
  AND (
    lower(name) LIKE '%orientering%'
    OR lower(name) LIKE '% ol %'
    OR lower(name) LIKE '%o-lag%'
    OR lower(name) LIKE '%ok %'  -- OK = orienteringsklubb
  );

-- friidrett: sikre bredere dekning
UPDATE services SET tags = array_append(tags, 'friidrett')
WHERE NOT 'friidrett' = ANY(tags)
  AND (
    lower(name) LIKE '%friidrett%'
    OR lower(name) LIKE '%atletklubb%'
    OR lower(name) LIKE '%løpeklubb%'
  );

-- klatring: bredere match
UPDATE services SET tags = array_append(tags, 'klatring')
WHERE NOT 'klatring' = ANY(tags)
  AND (
    lower(name) LIKE '%klatre%'
    OR lower(name) LIKE '%boulder%'
    OR lower(name) LIKE '%klatresenteret%'
    OR lower(name) LIKE '%buldring%'
  );

-- håndball: normalisering + navnematch
UPDATE services SET tags = array_append(tags, 'håndball')
WHERE NOT 'håndball' = ANY(tags)
  AND (
    'handball' = ANY(tags)
    OR lower(name) LIKE '%håndball%'
    OR lower(name) LIKE '%handball%'
  );

-- svømming: normalisering + navnematch
UPDATE services SET tags = array_append(tags, 'svømming')
WHERE NOT 'svømming' = ANY(tags)
  AND (
    'svomming' = ANY(tags)
    OR lower(name) LIKE '%svøm%'
    OR lower(name) LIKE '%swim%'
    OR lower(name) LIKE '%svømmeklubb%'
  );

-- padel: sikre alle padel-steder er tagget
UPDATE services SET tags = array_append(tags, 'padel')
WHERE NOT 'padel' = ANY(tags)
  AND lower(name) LIKE '%padel%';

-- sykkel: sikre sykkelklubber er tagget
UPDATE services SET tags = array_append(tags, 'sykkel')
WHERE NOT 'sykkel' = ANY(tags)
  AND (
    lower(name) LIKE '%sykkelklubb%'
    OR lower(name) LIKE '%sykkellag%'
    OR lower(name) LIKE '%cycling%'
    OR lower(name) LIKE '% mtb %'
    OR lower(name) LIKE '%mountainbike%'
  );

-- kampsport: sikre bredere dekning
UPDATE services SET tags = array_append(tags, 'kampsport')
WHERE NOT 'kampsport' = ANY(tags)
  AND (
    lower(name) LIKE '%kampsport%'
    OR lower(name) LIKE '%judo%'
    OR lower(name) LIKE '%karate%'
    OR lower(name) LIKE '%taekwondo%'
    OR lower(name) LIKE '%boksing%'
    OR lower(name) LIKE '%kickboks%'
    OR lower(name) LIKE '% mma%'
    OR lower(name) LIKE '%bjj%'
    OR lower(name) LIKE '%jiu-jitsu%'
    OR lower(name) LIKE '%bryting%'
  );

-- volleyball: sikre dekning
UPDATE services SET tags = array_append(tags, 'volleyball')
WHERE NOT 'volleyball' = ANY(tags)
  AND lower(name) LIKE '%volleyball%';

-- ── Rebuild search_text ───────────────────────────────────────────────────
-- Nødvendig fordi search_text trigger bare kjører på INSERT/UPDATE av name/description/tags
UPDATE services SET search_text =
  lower(
    coalesce(name, '') || ' ' ||
    coalesce(description, '') || ' ' ||
    coalesce(array_to_string(tags, ' '), '')
  );
