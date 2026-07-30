import { escapeHtml } from './escape.mjs';
import { setPath } from './slug.mjs';
import { summariseStats } from './stats.mjs';
import { wearableCharacters, pickTryOnCharacter } from './wearable.mjs';
import { buildTryOnUrl } from './deeplink.mjs';
import { SITE_ORIGIN } from './site.mjs';

// tests/render-set.test.mjs imports SITE_ORIGIN from here — re-export so that
// file doesn't need to change alongside this refactor.
export { SITE_ORIGIN } from './site.mjs';
const ICON_BASE = '/assets/itemimage/';

const statLine = ([text, colour]) =>
  `<li class="stat ${escapeHtml(colour)}">${escapeHtml(text)}</li>`;

const totalLine = (entry) =>
  `<li class="stat ${escapeHtml(entry.colour)}">${escapeHtml(entry.name)} `
  + `${entry.value >= 0 ? '+' : ''}${entry.value}${escapeHtml(entry.unit)}</li>`;

function memberCard(item) {
  const icon = item.icon
    ? `<img src="${ICON_BASE}${escapeHtml(item.icon)}" alt="${escapeHtml(item.name)}"`
      + ` width="54" height="54" loading="lazy">`
    : '';
  const stats = (item.stats ?? []).map(statLine).join('');
  return `<li class="member">${icon}<h3>${escapeHtml(item.name)}</h3>`
    + `<p class="slot">${escapeHtml(item.subcategory ?? '')}</p>`
    + (stats ? `<ul class="stats">${stats}</ul>` : '')
    + `</li>`;
}

function description(page, totals) {
  const bonus = page.setStats.length
    ? page.setStats.map(([text]) => text).join('、')
    : totals.slice(0, 3).map((entry) => `${entry.name} ${entry.value}${entry.unit}`).join('、');
  return `《跑Online》${page.name}：共 ${page.members.length} 件`
    + (bonus ? `，${bonus}` : '')
    + '。查看每件裝備能力值、可穿著角色，並一鍵試身。';
}

export function renderSetPage({ page, data, related, counterpart }) {
  const path = setPath(page.setId, page.name);
  const url = `${SITE_ORIGIN}${path}`;
  const { totals, others } = summariseStats(page.members);
  const wearers = wearableCharacters(page.members, data);
  const tryOn = pickTryOnCharacter(page.members, data);
  const title = `${page.name}｜套裝效果・能力值・可穿著角色 - 跑Online 配裝分享器`;
  const summary = description(page, totals);

  // JSON.stringify 唔會 escape "<"，所以一個叫 "</script>" 嘅裝備名可以標走個 script
  // block。目前 items.json 冇任何 "<" 或 ">"，但生成器唔可以繼承呢個假設。
  const jsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: page.name,
    description: summary,
    url,
    numberOfItems: page.members.length,
    itemListElement: page.members.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
    })),
  }).replace(/</g, '\\u003c');

  return `<!doctype html>
<html lang="zh-Hant">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(summary)}">
<link rel="canonical" href="${escapeHtml(url)}">
<meta property="og:type" content="article">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(summary)}">
<meta property="og:url" content="${escapeHtml(url)}">
<meta property="og:image" content="${SITE_ORIGIN}/assets/og-image.jpg">
<script type="application/ld+json">${jsonLd}</script>
</head>
<body>
<nav><a href="/">跑Online 配裝分享器</a> › <a href="/sets/">套裝</a></nav>
<main>
<h1>${escapeHtml(page.name)}</h1>
<p class="lead">${escapeHtml(summary)}</p>

<p><a class="try-on" href="${escapeHtml(buildTryOnUrl(page, tryOn.characterId))}">立即試身</a>
${tryOn.complete ? '' : '<em>冇角色可以著齊呢套裝備</em>'}</p>

<section>
<h2>套裝效果</h2>
${page.setStats.length
    ? `<ul class="stats">${page.setStats.map(statLine).join('')}</ul>`
    : '<p>呢套裝備冇套裝效果，能力值淨係計每件裝備自己嘅數值。</p>'}
</section>

<section>
<h2>成員裝備（${page.members.length} 件）</h2>
<ul class="members">${page.members.map(memberCard).join('')}</ul>
</section>

<section>
<h2>著齊全套合計</h2>
${totals.length ? `<ul class="stats">${totals.map(totalLine).join('')}</ul>` : '<p>冇可加總嘅能力值。</p>'}
${others.length
    ? `<h3>其他效果</h3><ul class="stats">${others.map((o) => statLine([o.text, o.colour])).join('')}</ul>`
    : ''}
</section>

<section>
<h2>可穿著角色</h2>
${wearers.length
    ? `<p>${wearers.map((id) => escapeHtml(data.characters[id].name)).join('、')}</p>`
    : '<p>冇角色可以著齊呢套裝備。</p>'}
</section>

${counterpart
    ? `<section><h2>另一個版本</h2><p><a href="${escapeHtml(setPath(counterpart.setId, counterpart.name))}">${escapeHtml(counterpart.name)}</a></p></section>`
    : ''}

${related.length
    ? `<section><h2>相關套裝</h2><ul>${related.map((r) =>
        `<li><a href="${escapeHtml(setPath(r.setId, r.name))}">${escapeHtml(r.name)}</a></li>`).join('')}</ul></section>`
    : ''}
</main>
</body>
</html>
`;
}
