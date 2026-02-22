// Types for Brønnøysundregisteret API responses

export type BrregAdresse = {
  adresse?: string[];
  postnummer?: string;
  poststed?: string;
  kommune?: string;
  kommunenummer?: string;
  land?: string;
  landkode?: string;
};

export type BrregNaeringskode = {
  kode: string;
  beskrivelse: string;
};

export type BrregOrganisasjonsform = {
  kode: string;
  beskrivelse: string;
};

export type BrregEnhet = {
  organisasjonsnummer: string;
  navn: string;
  organisasjonsform?: BrregOrganisasjonsform;

  hjemmeside?: string;
  postadresse?: BrregAdresse;
  forretningsadresse?: BrregAdresse;

  naeringskode1?: BrregNaeringskode;
  naeringskode2?: BrregNaeringskode;
  naeringskode3?: BrregNaeringskode;

  antallAnsatte?: number;
  stiftelsesdato?: string;

  registrertIEnhetsregisteret?: boolean;
  registrertIForetaksregisteret?: boolean;
  registrertIMvaregisteret?: boolean;
  registrertIFrivillighetsregisteret?: boolean;
  registrertIStiftelsesregisteret?: boolean;

  registreringsdatoEnhetsregisteret?: string;
  registreringsdatoForetaksregisteret?: string;
  registreringsdatoMvaregisteret?: string;

  konkurs?: boolean;
  underAvvikling?: boolean;
  underTvangsavviklingEllerTvangsopplosning?: boolean;
};

export type BrregUnderenhet = {
  organisasjonsnummer: string;
  navn: string;
  overordnetEnhet: string;

  naeringskode1?: BrregNaeringskode;
  beliggenhetsadresse?: BrregAdresse;
  antallAnsatte?: number;
};

// Database entity types
export type BrregEntityRow = {
  orgnr: string;
  navn: string;
  organisasjonsform_kode: string | null;
  organisasjonsform_beskrivelse: string | null;

  naeringskode1_kode: string | null;
  naeringskode1_beskrivelse: string | null;
  naeringskode2_kode: string | null;
  naeringskode2_beskrivelse: string | null;
  naeringskode3_kode: string | null;
  naeringskode3_beskrivelse: string | null;

  forretningsadresse_adresse: string[] | null;
  forretningsadresse_postnummer: string | null;
  forretningsadresse_poststed: string | null;
  forretningsadresse_kommune: string | null;
  forretningsadresse_kommunenummer: string | null;
  forretningsadresse_land: string | null;
  forretningsadresse_landkode: string | null;

  postadresse_adresse: string[] | null;
  postadresse_postnummer: string | null;
  postadresse_poststed: string | null;
  postadresse_kommune: string | null;
  postadresse_kommunenummer: string | null;
  postadresse_land: string | null;
  postadresse_landkode: string | null;

  hjemmeside: string | null;
  location: string | null; // WKT format

  registrert_i_enhetsregisteret: boolean;
  registrert_i_foretaksregisteret: boolean;
  registrert_i_mvaregisteret: boolean;
  registrert_i_frivillighetsregisteret: boolean;
  registrert_i_stiftelsesregisteret: boolean;

  antall_ansatte: number | null;
  konkurs: boolean;
  under_avvikling: boolean;
  under_tvangsavvikling_eller_tvangsopplosning: boolean;

  stiftelsesdato: string | null;
  registreringsdato_enhetsregisteret: string | null;
  registreringsdato_foretaksregisteret: string | null;
  registreringsdato_mvaregisteret: string | null;

  imported_at: string;
  updated_at: string | null;
  raw_data: Record<string, unknown>;

  category: string | null;
  subcategories: string[] | null;
  tags: string[] | null;

  quality_score: number;
  relevance_score: number | null;
  verified: boolean;
  verification_notes: string | null;
  verified_at: string | null;
  verified_by: string | null;
};

// Relevant NACE codes for health and fitness
export const RELEVANT_NACE_CODES = [
  // Direct fitness/sports
  '93.130', // Treningssentre og gymsaler
  '93.199', // Andre sportsaktiviteter ikke nevnt annet sted
  '93.110', // Drift av idrettsanlegg
  '93.120', // Aktiviteter tilknyttet sportsklubber
  '93.190', // Andre sportsaktiviteter
  '93.299', // Andre fritids- og fornøyelsesaktiviteter ikke nevnt annet sted

  // Health services
  '86.901', // Fysioterapivirksomhet
  '86.909', // Annen helsetjeneste
  '86.903', // Kiropraktikk
  '86.904', // Psykologtjenester
  '86.906', // Ergoterapivirksomhet

  // Personal wellness
  '96.040', // Virksomhet tilknyttet personlig velvære
  '96.099', // Annen personlig tjenesteyting ikke nevnt annet sted

  // Related activities
  '47.641', // Detaljhandel med sportsutstyr
  '85.510', // Idrettsinstruksjon og undervisning

  // Broader categories to check
  '93.1',   // Sportsaktiviteter
  '86.9',   // Andre helsetjenester
] as const;

export type RelevantNaceCode = (typeof RELEVANT_NACE_CODES)[number];
