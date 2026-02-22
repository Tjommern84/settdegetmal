import type { BrregEnhet, BrregEntityRow } from './types';
import { categorizeEntity, calculateRelevanceScore } from './filter';

/**
 * Map a Brønnøysundregisteret entity to our database format
 */
export function mapEntityToRow(entity: BrregEnhet): Omit<BrregEntityRow, 'imported_at' | 'updated_at'> {
  const { category, subcategories, tags } = categorizeEntity(entity);
  const relevanceScore = calculateRelevanceScore(entity);

  return {
    orgnr: entity.organisasjonsnummer,
    navn: entity.navn,

    organisasjonsform_kode: entity.organisasjonsform?.kode || null,
    organisasjonsform_beskrivelse: entity.organisasjonsform?.beskrivelse || null,

    naeringskode1_kode: entity.naeringskode1?.kode || null,
    naeringskode1_beskrivelse: entity.naeringskode1?.beskrivelse || null,
    naeringskode2_kode: entity.naeringskode2?.kode || null,
    naeringskode2_beskrivelse: entity.naeringskode2?.beskrivelse || null,
    naeringskode3_kode: entity.naeringskode3?.kode || null,
    naeringskode3_beskrivelse: entity.naeringskode3?.beskrivelse || null,

    forretningsadresse_adresse: entity.forretningsadresse?.adresse || null,
    forretningsadresse_postnummer: entity.forretningsadresse?.postnummer || null,
    forretningsadresse_poststed: entity.forretningsadresse?.poststed || null,
    forretningsadresse_kommune: entity.forretningsadresse?.kommune || null,
    forretningsadresse_kommunenummer: entity.forretningsadresse?.kommunenummer || null,
    forretningsadresse_land: entity.forretningsadresse?.land || null,
    forretningsadresse_landkode: entity.forretningsadresse?.landkode || null,

    postadresse_adresse: entity.postadresse?.adresse || null,
    postadresse_postnummer: entity.postadresse?.postnummer || null,
    postadresse_poststed: entity.postadresse?.poststed || null,
    postadresse_kommune: entity.postadresse?.kommune || null,
    postadresse_kommunenummer: entity.postadresse?.kommunenummer || null,
    postadresse_land: entity.postadresse?.land || null,
    postadresse_landkode: entity.postadresse?.landkode || null,

    hjemmeside: entity.hjemmeside || null,
    location: null, // Will be set by geocoding

    registrert_i_enhetsregisteret: entity.registrertIEnhetsregisteret || false,
    registrert_i_foretaksregisteret: entity.registrertIForetaksregisteret || false,
    registrert_i_mvaregisteret: entity.registrertIMvaregisteret || false,
    registrert_i_frivillighetsregisteret: entity.registrertIFrivillighetsregisteret || false,
    registrert_i_stiftelsesregisteret: entity.registrertIStiftelsesregisteret || false,

    antall_ansatte: entity.antallAnsatte || null,
    konkurs: entity.konkurs || false,
    under_avvikling: entity.underAvvikling || false,
    under_tvangsavvikling_eller_tvangsopplosning:
      entity.underTvangsavviklingEllerTvangsopplosning || false,

    stiftelsesdato: entity.stiftelsesdato || null,
    registreringsdato_enhetsregisteret: entity.registreringsdatoEnhetsregisteret || null,
    registreringsdato_foretaksregisteret: entity.registreringsdatoForetaksregisteret || null,
    registreringsdato_mvaregisteret: entity.registreringsdatoMvaregisteret || null,

    raw_data: entity as unknown as Record<string, unknown>,

    category,
    subcategories: subcategories.length > 0 ? subcategories : null,
    tags: tags.length > 0 ? tags : null,

    quality_score: 0, // Will be calculated later
    relevance_score: relevanceScore,
    verified: false,
    verification_notes: null,
    verified_at: null,
    verified_by: null,
  };
}

/**
 * Calculate quality score based on data completeness
 */
export function calculateQualityScore(row: Partial<BrregEntityRow>): number {
  let score = 0;

  // Basic info (25 points)
  if (row.navn) score += 10;
  if (row.organisasjonsform_kode) score += 5;
  if (row.naeringskode1_kode) score += 10;

  // Contact info (30 points)
  if (row.forretningsadresse_adresse && row.forretningsadresse_adresse.length > 0) score += 10;
  if (row.forretningsadresse_postnummer && row.forretningsadresse_poststed) score += 10;
  if (row.hjemmeside) score += 10;

  // Geolocation (20 points)
  if (row.location) score += 20;

  // Business status (15 points)
  if (row.registrert_i_foretaksregisteret) score += 5;
  if (row.registrert_i_mvaregisteret) score += 5;
  if (!row.konkurs && !row.under_avvikling) score += 5;

  // Additional data (10 points)
  if (row.antall_ansatte && row.antall_ansatte > 0) score += 5;
  if (row.stiftelsesdato) score += 5;

  return Math.min(score, 100);
}
