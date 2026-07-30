import { mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildCatalog, EXPECTED_PAGE_COUNT } from './lib/catalog.mjs';
import { buildCounterpartIndex } from './lib/gender.mjs';
import { relatedSets } from './lib/related.mjs';
import { setPath } from './lib/slug.mjs';
import { renderSetPage } from './lib/render-set.mjs';
import { renderHub, renderListing, LISTINGS } from './lib/render-listing.mjs';
import { renderSitemap, renderSitemapIndex } from './lib/sitemap.mjs';

export function collectLinkTargets(pages, relatedBySetId, counterparts) {
  const inbound = new Map(pages.map((page) => [page.setId, 1])); // 列表頁連晒全部
  for (const targets of relatedBySetId.values()) {
    for (const target of targets) {
      inbound.set(target.setId, (inbound.get(target.setId) ?? 0) + 1);
    }
  }
  for (const target of counterparts.values()) {
    inbound.set(target.setId, (inbound.get(target.setId) ?? 0) + 1);
  }
  return inbound;
}

export function assertEveryPageReachable(pages, inbound) {
  const orphans = pages.filter((page) => !(inbound.get(page.setId) > 0));
  if (orphans.length) {
    throw new Error(
      `${orphans.length} set page(s) have no inbound link: `
      + orphans.slice(0, 10).map((page) => page.setId).join(', '));
  }
}

function write(path, contents) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents, 'utf8');
}

function main() {
  const today = new Date().toISOString().slice(0, 10);
  const data = JSON.parse(readFileSync('data/items.json', 'utf8'));
  const pages = buildCatalog(data);

  if (pages.length !== EXPECTED_PAGE_COUNT) {
    throw new Error(
      `Expected ${EXPECTED_PAGE_COUNT} set pages, got ${pages.length}. `
      + 'If data/items.json changed on purpose, update EXPECTED_PAGE_COUNT in '
      + 'scripts/lib/catalog.mjs and the figures in the spec.');
  }

  const counterparts = buildCounterpartIndex(pages);
  const relatedBySetId = new Map(
    pages.map((page) => [page.setId, relatedSets(page, pages)]));

  const inbound = collectLinkTargets(pages, relatedBySetId, counterparts);
  assertEveryPageReachable(pages, inbound);

  const withoutRelatedInbound = pages.filter((page) =>
    inbound.get(page.setId) === 1 && !counterparts.has(page.setId)).length;

  rmSync('set', { recursive: true, force: true });
  rmSync('sets', { recursive: true, force: true });

  for (const page of pages) {
    write(`.${setPath(page.setId, page.name)}/index.html`, renderSetPage({
      page,
      data,
      related: relatedBySetId.get(page.setId),
      counterpart: counterparts.get(page.setId) ?? null,
    }));
  }

  write('./sets/index.html', renderHub(pages));
  for (const listing of LISTINGS) {
    write(`.${listing.path}/index.html`, renderListing(listing, pages));
  }

  const paths = ['/sets', ...LISTINGS.map((l) => l.path),
    ...pages.map((page) => setPath(page.setId, page.name))];
  write('./sitemap-sets.xml', renderSitemap(paths, today));
  write('./sitemap-index.xml', renderSitemapIndex(['/sitemap-sets.xml'], today));

  console.log(`Built ${pages.length} set pages, ${LISTINGS.length} listings, 1 hub.`);
  console.log(`${withoutRelatedInbound} page(s) reachable only from their listing.`);
}

// 只有直接行呢個檔先執行 main()。測試 import 佢嗰陣唔可以觸發 build。
// 用 fileURLToPath 而唔係字串比對 —— Windows 路徑分隔符會令字串比對失敗。
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
