import { SITE_ORIGIN } from './render-set.mjs';

// encodeURI 處理中文，再手動轉 & —— XML 入面裸露嘅 & 係語法錯誤。
function absolute(path) {
  return `${SITE_ORIGIN}${encodeURI(path)}`.replace(/&/g, '&amp;');
}

export function renderSitemap(paths, lastmod) {
  const entries = paths.map((path) =>
    `  <url><loc>${absolute(path)}</loc><lastmod>${lastmod}</lastmod></url>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries}
</urlset>
`;
}

export function renderSitemapIndex(paths, lastmod) {
  const entries = paths.map((path) =>
    `  <sitemap><loc>${absolute(path)}</loc><lastmod>${lastmod}</lastmod></sitemap>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries}
</sitemapindex>
`;
}
