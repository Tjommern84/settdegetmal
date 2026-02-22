/**
 * Brønnøysundregisteret import and enrichment system
 *
 * This module provides tools to:
 * - Download bulk data from Norwegian Business Registry
 * - Filter by relevant NACE codes (health, fitness, sports)
 * - Categorize entities automatically
 * - Geocode addresses to GPS coordinates
 * - Calculate quality and relevance scores
 */

export * from './types';
export * from './downloader';
export * from './filter';
export * from './mapper';
export * from './geocoder';
