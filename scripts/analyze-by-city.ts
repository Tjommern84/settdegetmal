#!/usr/bin/env tsx
/**
 * Analyze Brønnøysund data by city
 *
 * Usage:
 *   npm run brreg:analyze:city
 */

import Database from 'better-sqlite3';
import { join } from 'path';
import { readdirSync } from 'fs';

async function main() {
  console.log('📊 Analyzing entities by city\n');

  // Find most recent export
  const dataDir = join(process.cwd(), 'data', 'brreg');
  const files = readdirSync(dataDir).filter((f) => f.startsWith('export-') && f.endsWith('.sqlite'));

  if (files.length === 0) {
    console.error('❌ No SQLite database found. Run "npm run brreg:export" first.');
    process.exit(1);
  }

  const dbPath = join(dataDir, files.sort().reverse()[0]);
  console.log(`📂 Using database: ${dbPath}\n`);

  const db = new Database(dbPath, { readonly: true });

  // Total entities
  const total = db.prepare('SELECT COUNT(*) as count FROM entities').get() as { count: number };
  console.log(`Total entities: ${total.count.toLocaleString()}\n`);

  // Entities by city (forretningsadresse_poststed)
  console.log('🏙️  Top 50 cities by number of entities:\n');

  const citiesQuery = `
    SELECT
      forretningsadresse_poststed as city,
      COUNT(*) as count,
      ROUND(COUNT(*) * 100.0 / ${total.count}, 2) as percentage,
      AVG(relevance_score) as avg_relevance,
      AVG(quality_score) as avg_quality
    FROM entities
    WHERE forretningsadresse_poststed IS NOT NULL
    GROUP BY forretningsadresse_poststed
    ORDER BY count DESC
    LIMIT 50
  `;

  const cities = db.prepare(citiesQuery).all() as Array<{
    city: string;
    count: number;
    percentage: number;
    avg_relevance: number;
    avg_quality: number;
  }>;

  console.log('Rank | City                    | Count    | %     | Avg Rel | Avg Qual');
  console.log('-----|-------------------------|----------|-------|---------|----------');

  cities.forEach((city, index) => {
    const rank = (index + 1).toString().padStart(4, ' ');
    const name = city.city.padEnd(23, ' ');
    const count = city.count.toLocaleString().padStart(8, ' ');
    const pct = city.percentage.toFixed(2).padStart(5, ' ');
    const avgRel = Math.round(city.avg_relevance).toString().padStart(7, ' ');
    const avgQual = Math.round(city.avg_quality).toString().padStart(8, ' ');

    console.log(`${rank} | ${name} | ${count} | ${pct}% | ${avgRel} | ${avgQual}`);
  });

  // Stats by category in top cities
  console.log('\n\n📈 Category breakdown in top 10 cities:\n');

  const top10Cities = cities.slice(0, 10).map(c => c.city);

  for (const city of top10Cities) {
    const categoryQuery = `
      SELECT
        category,
        COUNT(*) as count
      FROM entities
      WHERE forretningsadresse_poststed = ?
      GROUP BY category
      ORDER BY count DESC
    `;

    const categories = db.prepare(categoryQuery).all(city) as Array<{
      category: string | null;
      count: number;
    }>;

    const total = categories.reduce((sum, c) => sum + c.count, 0);

    console.log(`${city}: ${total.toLocaleString()} entities`);
    categories.slice(0, 5).forEach(cat => {
      const catName = cat.category || 'unknown';
      const pct = ((cat.count / total) * 100).toFixed(1);
      console.log(`  - ${catName}: ${cat.count} (${pct}%)`);
    });
    console.log('');
  }

  // Entities without city
  const noCityQuery = `
    SELECT COUNT(*) as count
    FROM entities
    WHERE forretningsadresse_poststed IS NULL
  `;

  const noCity = db.prepare(noCityQuery).get() as { count: number };

  if (noCity.count > 0) {
    console.log(`\n⚠️  ${noCity.count.toLocaleString()} entities (${((noCity.count / total.count) * 100).toFixed(2)}%) have no city information`);
  }

  // Export to CSV
  console.log('\n💾 Exporting to CSV...');
  const csvPath = join(dataDir, 'cities-analysis.csv');
  const header = 'rank,city,count,percentage,avg_relevance,avg_quality';
  const csvRows = cities.map((city, index) =>
    `${index + 1},"${city.city}",${city.count},${city.percentage},${Math.round(city.avg_relevance)},${Math.round(city.avg_quality)}`
  );

  const { writeFileSync } = await import('fs');
  writeFileSync(csvPath, [header, ...csvRows].join('\n'));
  console.log(`✓ Exported to ${csvPath}`);

  db.close();
  console.log('\n✅ Analysis completed!');
}

main().catch(error => {
  console.error('❌ Analysis failed:', error);
  process.exit(1);
});
