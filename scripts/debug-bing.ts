import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ locale: 'nb-NO' });
  const page = await ctx.newPage();

  await page.goto('https://html.duckduckgo.com/html/?q=Mantra+Yoga+Wenche+Karlsen+haugesund&kl=no-no', {
    waitUntil: 'domcontentloaded',
  });

  const title = await page.title();
  console.log('title:', title);

  // Try various selectors
  const sel1 = await page.locator('a.result__a').count();
  const sel2 = await page.locator('a.result__url').count();
  const sel3 = await page.locator('.result a').count();
  console.log('a.result__a count:', sel1);
  console.log('a.result__url count:', sel2);
  console.log('.result a count:', sel3);

  const links = await page.evaluate(() =>
    Array.from(document.querySelectorAll('a')).slice(0, 10).map(a => ({
      cls: a.className,
      href: (a as HTMLAnchorElement).href.slice(0, 80),
      text: a.textContent?.trim().slice(0, 40),
    }))
  );
  console.log('links:', JSON.stringify(links, null, 2));
  await browser.close();
}
main();
