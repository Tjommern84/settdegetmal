import type { BrregEnhet } from './types';
import { RELEVANT_NACE_CODES } from './types';

/**
 * Exclusion keywords - these indicate irrelevant businesses
 */
const EXCLUSION_KEYWORDS = [
  // Dental/medical (not fitness related)
  'tann',
  'dental',
  'odonto',
  'kjeveortoped',

  // Therapy (mental health, not physical)
  'psykolog',
  'psykoterapi',
  'gestalt',
  'familieterapi',
  'par-terapi',
  'parterapi',
  'kognitiv',
  'mindfulness-terapi',

  // Shooting/weapons
  'skyte',
  'jakt',
  'våpen',
  'rifle',
  'pistol',

  // Non-physical activities
  'bridge',
  'sjakk',
  'chess',
  'poker',
  'esport',
  'gaming',

  // Medical clinics (not fitness)
  'legesenter',
  'helsestasjon',
  'klinikk', // Keep this, but we'll allow physio clinics
  'røntgen',
  'laboratorium',

  // Other
  'dyreklinikk',
  'veterinær',
  'frisør',
  'hudpleie',
  'skjønnhet',
  'makeup',
  'tatovering',
  'piercing',
];

/**
 * Allow these even if they contain exclusion keywords
 */
const FORCE_INCLUDE_KEYWORDS = [
  'fysioterapi',
  'fysio',
  'physio',
  'kiropraktikk',
  'osteopati',
  'naprapati',
  'treningssenter',
  'fitness',
  'gym',
  'yoga',
  'pilates',
];

/**
 * Check if an entity should be excluded based on name
 */
function isExcluded(entity: BrregEnhet): boolean {
  const name = entity.navn.toLowerCase();

  // Check if force include (always allow)
  const hasForceInclude = FORCE_INCLUDE_KEYWORDS.some(kw => name.includes(kw));
  if (hasForceInclude) {
    return false;
  }

  // Check exclusions
  const hasExclusion = EXCLUSION_KEYWORDS.some(kw => name.includes(kw));
  return hasExclusion;
}

/**
 * Check if an entity has any of the relevant NACE codes AND isn't excluded
 */
export function isRelevantEntity(entity: BrregEnhet): boolean {
  const codes = [
    entity.naeringskode1?.kode,
    entity.naeringskode2?.kode,
    entity.naeringskode3?.kode,
  ].filter(Boolean) as string[];

  const hasRelevantCode = codes.some((code) => isRelevantNaceCode(code));

  if (!hasRelevantCode) {
    return false;
  }

  // Check if excluded
  return !isExcluded(entity);
}

/**
 * Check if a NACE code matches our relevant codes
 */
export function isRelevantNaceCode(code: string): boolean {
  if (RELEVANT_NACE_CODES.includes(code as any)) {
    return true;
  }

  return RELEVANT_NACE_CODES.some((relevantCode) => {
    if (relevantCode.length < code.length && code.startsWith(relevantCode)) {
      return true;
    }
    return false;
  });
}

/**
 * Calculate a relevance score based on various factors
 * Returns a score from 0-100
 */
export function calculateRelevanceScore(entity: BrregEnhet): number {
  let score = 0;

  // Primary NACE code match (40 points)
  if (entity.naeringskode1?.kode) {
    const primaryCodes = [
      '93.130', // Fitness centers
      '86.901', // Physiotherapy
      '85.510', // Sports instruction
    ];
    if (primaryCodes.includes(entity.naeringskode1.kode)) {
      score += 40;
    } else if (isRelevantNaceCode(entity.naeringskode1.kode)) {
      score += 25;
    }
  }

  // Keywords in name (30 points)
  const name = entity.navn.toLowerCase();
  const highValueKeywords = [
    'fitness',
    'gym',
    'trening',
    'treningssenter',
    'personlig trener',
    ' pt ',
    'yoga',
    'pilates',
    'crossfit',
    'bodysds',
    'form og fysikk',
  ];
  const mediumValueKeywords = [
    'fysioterapi',
    'kiropraktikk',
    'naprapati',
    'osteopati',
    'massasje',
    'idrett',
    'sport',
    'dans',
    'kampsport',
    'styrke',
    'kondisjon',
  ];

  const hasHighValueKeyword = highValueKeywords.some((kw) => name.includes(kw));
  const hasMediumValueKeyword = mediumValueKeywords.some((kw) => name.includes(kw));

  if (hasHighValueKeyword) {
    score += 30;
  } else if (hasMediumValueKeyword) {
    score += 15;
  }

  // Active in multiple registers (10 points)
  if (entity.registrertIForetaksregisteret) score += 5;
  if (entity.registrertIMvaregisteret) score += 5;

  // Has employees (10 points)
  if (entity.antallAnsatte) {
    if (entity.antallAnsatte >= 10) {
      score += 10;
    } else if (entity.antallAnsatte >= 3) {
      score += 7;
    } else if (entity.antallAnsatte >= 1) {
      score += 5;
    }
  }

  // Has website (5 points)
  if (entity.hjemmeside) {
    score += 5;
  }

  // Not in bankruptcy or liquidation (5 points)
  if (!entity.konkurs && !entity.underAvvikling && !entity.underTvangsavviklingEllerTvangsopplosning) {
    score += 5;
  }

  return Math.min(score, 100);
}

/**
 * Automatically categorize entity based on NACE code and name
 */
export function categorizeEntity(entity: BrregEnhet): {
  category: string | null;
  subcategories: string[];
  tags: string[];
} {
  const name = entity.navn.toLowerCase();
  const nace1 = entity.naeringskode1?.kode || '';
  const nace1desc = (entity.naeringskode1?.beskrivelse || '').toLowerCase();
  const nace2 = entity.naeringskode2?.kode || '';

  let category: string | null = null;
  const subcategories: string[] = [];
  const tags: string[] = [];

  // Gym/Fitness
  if (
    nace1 === '93.130' ||
    name.includes('fitness') ||
    name.includes('treningssenter') ||
    name.includes('gym') ||
    name.includes('bodysds') ||
    name.includes('form og fysikk')
  ) {
    category = 'gym';
  }

  // Yoga/Pilates
  else if (
    name.includes('yoga') ||
    name.includes('pilates')
  ) {
    category = 'yoga';
  }

  // CrossFit (specific type of gym)
  else if (name.includes('crossfit')) {
    category = 'gym';
    subcategories.push('crossfit');
  }

  // Physiotherapy
  else if (
    nace1 === '86.901' ||
    name.includes('fysioterapi') ||
    name.includes('fysio ')
  ) {
    category = 'physio';
  }

  // Chiropractic
  else if (
    nace1 === '86.903' ||
    name.includes('kiropraktikk')
  ) {
    category = 'chiro';
  }

  // Naprapathy
  else if (name.includes('naprapati')) {
    category = 'naprapathy';
  }

  // Osteopathy
  else if (name.includes('osteopati')) {
    category = 'osteopathy';
  }

  // Massage
  else if (
    name.includes('massasje') ||
    name.includes('massage')
  ) {
    category = 'massage';
  }

  // Personal Trainer
  else if (
    name.includes('personlig trener') ||
    name.includes(' pt ') ||
    name.includes('personal training') ||
    name.includes('pt og ')
  ) {
    category = 'pt';
  }

  // Nutrition/Diet
  else if (
    name.includes('ernæring') ||
    name.includes('kosthold') ||
    name.includes('nutrition') ||
    name.includes('diett')
  ) {
    category = 'nutrition';
  }

  // Rehabilitation
  else if (
    name.includes('rehabilitering') ||
    name.includes('rehab')
  ) {
    category = 'rehab';
  }

  // Dance
  else if (
    name.includes('dans') ||
    name.includes('dance') ||
    name.includes('balett')
  ) {
    category = 'dance';
  }

  // Martial Arts
  else if (
    name.includes('kampsport') ||
    name.includes('martial arts') ||
    name.includes('karate') ||
    name.includes('taekwondo') ||
    name.includes('judo') ||
    name.includes('jiu-jitsu') ||
    name.includes('kickboxing') ||
    name.includes('boksing') ||
    name.includes('boxing')
  ) {
    category = 'martial_arts';
  }

  // Swimming
  else if (
    name.includes('svømming') ||
    name.includes('swimming') ||
    name.includes('svømmehall') ||
    name.includes('svømmeklubb')
  ) {
    category = 'swimming';
  }

  // Cycling
  else if (
    name.includes('sykkl') ||
    name.includes('cycling') ||
    name.includes('spinning')
  ) {
    category = 'cycling';
  }

  // Running
  else if (
    name.includes('løp') ||
    name.includes('running') ||
    name.includes('jogging')
  ) {
    category = 'running';
  }

  // Climbing
  else if (
    name.includes('klatr') ||
    name.includes('climbing') ||
    name.includes('buldring')
  ) {
    category = 'climbing';
  }

  // Ball sports (soccer, basketball, etc.)
  else if (
    name.includes('fotball') ||
    name.includes('håndball') ||
    name.includes('basketball') ||
    name.includes('volleyball')
  ) {
    category = 'ball_sports';
  }

  // Winter sports
  else if (
    name.includes('ski') ||
    name.includes('skøyte') ||
    name.includes('skating')
  ) {
    category = 'winter_sports';
  }

  // Sports instruction
  else if (
    nace1 === '85.510' ||
    nace1desc.includes('idrettsinstruksjon')
  ) {
    category = 'sports_instruction';
  }

  // General sports clubs
  else if (
    nace1.startsWith('93.1') ||
    name.includes('idrettslag') ||
    name.includes('idrettsklubb') ||
    name.includes('sportsclub')
  ) {
    category = 'sports_club';
  }

  // Wellness/SPA
  else if (
    name.includes('velvære') ||
    name.includes('wellness') ||
    name.includes('spa')
  ) {
    category = 'wellness';
  }

  // Add subcategories
  if (name.includes('styrke') || name.includes('strength')) subcategories.push('strength');
  if (name.includes('kondisjon') || name.includes('cardio')) subcategories.push('cardio');
  if (name.includes('gruppe') || name.includes('group')) subcategories.push('group_training');
  if (name.includes('online') || name.includes('digital')) subcategories.push('online');
  if (name.includes('utendørs') || name.includes('outdoor')) subcategories.push('outdoor');

  // Add tags
  if (name.includes('dame') || name.includes('kvinne')) tags.push('women_only');
  if (name.includes('senior') || name.includes('eldre')) tags.push('senior_friendly');
  if (name.includes('familie')) tags.push('family_friendly');
  if (name.includes('nybegynner') || name.includes('beginner')) tags.push('beginner_friendly');
  if (entity.antallAnsatte && entity.antallAnsatte >= 20) tags.push('large_facility');

  return { category, subcategories, tags };
}
