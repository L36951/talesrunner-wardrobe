import test from 'node:test';
import assert from 'node:assert/strict';
import { renderSitemap, renderSitemapIndex } from '../scripts/lib/sitemap.mjs';

test('wraps every URL in a loc element', () => {
  const xml = renderSitemap(['/a', '/b'], '2026-07-30');
  assert.match(xml, /<loc>https:\/\/talesrunner-wardrobe\.kennylaisk\.com\/a<\/loc>/);
  assert.equal((xml.match(/<url>/g) ?? []).length, 2);
});

test('stamps lastmod on each entry', () => {
  assert.match(renderSitemap(['/a'], '2026-07-30'), /<lastmod>2026-07-30<\/lastmod>/);
});

test('percent-encodes Chinese paths', () => {
  const xml = renderSitemap(['/set/1-青花瓷'], '2026-07-30');
  assert.match(xml, /%E9%9D%92/);
  assert.doesNotMatch(xml, /青花瓷/);
});

test('escapes ampersands so the XML stays well formed', () => {
  assert.doesNotMatch(renderSitemap(['/a?x=1&y=2'], '2026-07-30'), /&(?!amp;)/);
});

test('handles a path that is both non-ASCII and contains an ampersand', () => {
  const xml = renderSitemap(['/set/1-Love & More 男生組合'], '2026-07-30');
  assert.doesNotMatch(xml, /&(?!amp;)/);
  assert.match(xml, /%E7%94%B7/);
  assert.match(xml, /&amp;/);
});

test('the index lists each child sitemap', () => {
  const xml = renderSitemapIndex(['/sitemap-sets.xml'], '2026-07-30');
  assert.match(xml, /<sitemapindex/);
  assert.match(xml, /sitemap-sets\.xml/);
});
