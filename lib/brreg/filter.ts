import type { BrregEnhet } from './types';
import { RELEVANT_NACE_CODES } from './types';

/**
 * Check if an entity has any of the relevant NACE codes
 */
export function isRelevantEntity(entity: BrregEnhet): boolean {
  const codes = [
    entity.naeringskode1?.kode,
    entity.naeringskode2?.kode,
    entity.naeringskode3?.kode,
  ].filter(Boolean) as string[];

  return codes.some((code) => isRelevantNaceCode(code));
}

/**
 * Check if a NACE code matches our relevant codes
 * Supports both exact match and prefix match (e.g., "93.1" matches "93.110", "93.130", etc.)
 */
export function isRelevantNaceCode(code: string): boolean {
  // Direct match
  if (RELEVANT_NACE_CODES.includes(code as any)) {
    return true;
  }

  // Prefix match (e.g., code "93.110" matches filter "93.1")
  return RELEVANT_NACE_CODES.some((relevantCode) => {
    // If the relevant code is shorter, it's a prefix
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
      '93.199', // Other sports
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
    'pt ',
    'yoga',
    'pilates',
    'crossfit',
  ];
  const mediumValueKeywords = [
    'helse',
    'fysioterapi',
    'rehabilitering',
    'velvære',
    'wellness',
    'sport',
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
  const nace2 = entity.naeringskode2?.kode || '';
  const nace3 = entity.naeringskode3?.kode || '';

  let category: string | null = null;
  const subcategories: string[] = [];
  const tags: string[] = [];

  // Determine primary category
  if (nace1 === '93.130' || name.includes('fitness') || name.includes('treningssenter')) {
    category = 'gym';
  } else if (name.includes('yoga') || name.includes('pilates')) {
    category = 'yoga';
  } else if (name.includes('crossfit')) {
    category = 'gym';
    subcategories.push('crossfit');
  } else if (nace1 === '86.901' || name.includes('fysioterapi')) {
    category = 'physio';
  } else if (
    name.includes('personlig trener') ||
    name.includes(' pt ') ||
    name.includes('personal training')
  ) {
    category = 'pt';
  } else if (name.includes('ernæring') || name.includes('kosthold') || name.includes('nutrition')) {
    category = 'nutrition';
  } else if (name.includes('rehabilitering') || name.includes('rehab')) {
    category = 'rehab';
  } else if (nace1.startsWith('93.')) {
    category = 'sports';
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
