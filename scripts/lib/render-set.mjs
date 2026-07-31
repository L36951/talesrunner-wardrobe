import { escapeHtml } from './escape.mjs';
import { setPath } from './slug.mjs';
import { summariseStats } from './stats.mjs';
import { wearableCharacters, pickTryOnCharacter } from './wearable.mjs';
import { buildTryOnUrl } from './deeplink.mjs';
import { SITE_ORIGIN } from './site.mjs';
import { buildLead } from './lead.mjs';
import { renderInfobox } from './infobox.mjs';

// tests/render-set.test.mjs imports SITE_ORIGIN from here — re-export so that
// file doesn't need to change alongside this refactor.
export { SITE_ORIGIN } from './site.mjs';
const ICON_BASE = '/assets/itemimage/';

const statRow = ([text, colour]) =>
  `<tr><td class="${escapeHtml(colour)}">${escapeHtml(text)}</td></tr>`;

// 部位 slot key -> 中文標籤。同 index.html 嘅 slotDefs 對齊。
const SLOT_LABEL = {
  hair: '髮型', upper: '上衣', lower: '褲/裙', shoes: '鞋子', head: '頭部',
  face: '臉部', hands: '手部', back: '背部', neck: '頸部', pet: '寵物',
  special: '特殊', bracelet: '手環', booster: '助推器', tail: '尾',
  jewelry: '珠寶',
};

// 「夾中呢兩件就發動」嘅加成 —— 唔使成套齊（客戶端嘅 fdComplexKey）
const comboRow = (combo) =>
  `<tr><td class="combo-when">${combo.slots
    .map((slot) => escapeHtml(SLOT_LABEL[slot] ?? slot)).join('＋')}</td>`
  + `<td>${combo.stats
    .map(([text, colour]) => `<span class="${escapeHtml(colour)}">${escapeHtml(text)}</span>`)
    .join('<br>')}</td></tr>`;

const totalRow = (entry) =>
  `<tr><td>${escapeHtml(entry.name)}</td>`
  + `<td class="num ${escapeHtml(entry.colour)}">`
  + `${entry.value >= 0 ? '+' : ''}${entry.value}${escapeHtml(entry.unit)}</td></tr>`;

function memberRow(item) {
  const icon = item.icon
    ? `<td class="icon"><img src="${ICON_BASE}${escapeHtml(item.icon)}"`
      + ` alt="${escapeHtml(item.name)}" width="36" height="36" loading="lazy"></td>`
    : '<td class="icon"></td>';
  const line = ([text, colour]) =>
    `<span class="${escapeHtml(colour)}">${escapeHtml(text)}</span>`;
  // 活動頻道加成淨係得說明文字，冇結構化來源，所以標明係參考、亦唔入加總
  const channel = (item.channelStats ?? []).map(
    ([text, colour]) => `<span class="channel ${escapeHtml(colour)}">${escapeHtml(text)}</span>`);
  const stats = (item.stats ?? []).length || channel.length
    ? [...(item.stats ?? []).map(line), ...channel].join('<br>')
    : '<span class="empty">—</span>';
  return `<tr>${icon}`
    + `<td><b>${escapeHtml(item.name)}</b>`
    + (item.description ? `<br><span class="mdesc">${escapeHtml(item.description)}</span>` : '')
    + `</td>`
    + `<td>${escapeHtml(item.subcategory ?? '')}</td>`
    + `<td class="mstats">${stats}</td></tr>`;
}

function description(page, totals) {
  const bonus = page.setStats.length
    ? page.setStats.map(([text]) => text).join('、')
    : (page.setCombos ?? []).length
      ? page.setCombos.flatMap((combo) => combo.stats.map(([text]) => text)).slice(0, 3).join('、')
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
  const lead = buildLead(page, wearers.length);
  const infobox = renderInfobox({
    page,
    wearerCount: wearers.length,
    characterCount: Object.keys(data.characters).length,
    counterpart,
    tryOnUrl: buildTryOnUrl(page, tryOn.characterId),
  });

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
<link rel="stylesheet" href="/assets/set-page.css">
<script type="application/ld+json">${jsonLd}</script>
</head>
<body>
<div class="topbar"><div class="topbar-in">
<span class="brand"><a href="/">跑Online 配裝分享器</a></span>
<nav><a href="/sets">套裝一覽</a><a href="/sets/role">角色裝備</a><a href="/sets/avatar">Avatar</a></nav>
</div></div>
<div class="page">
<div class="crumb"><a href="/">首頁</a> › <a href="/sets">套裝</a> › ${escapeHtml(page.name)}</div>
<h1>${escapeHtml(page.name)}</h1>
<p class="subtitle">《跑Online》${page.equipmentType === 'avatar' ? 'Avatar' : '角色裝備'}套裝，共 ${page.members.length} 件</p>
<div class="layout">
<div class="main">
${counterpart
    ? `<p class="hatnote">本套裝有另一個版本：<a href="${escapeHtml(setPath(counterpart.setId, counterpart.name))}">${escapeHtml(counterpart.name)}</a>。兩者成員裝備完全不同。</p>`
    : ''}
<p class="lead">${escapeHtml(lead)}</p>
${tryOn.complete ? '' : '<p class="hatnote">冇角色可以著齊呢套裝備。</p>'}

<h2>套裝效果</h2>
${page.setStats.length
    ? `<div class="tablewrap"><table class="data"><tbody>${page.setStats.map(statRow).join('')}</tbody></table></div>`
    : (page.setCombos ?? []).length
      ? '<p class="hint">呢套裝備冇成套加成，淨係有下面嘅組合加成。</p>'
      : '<p class="empty">呢套裝備冇套裝效果，能力值淨係計每件裝備自己嘅數值。</p>'}
${(page.setCombos ?? []).length
    ? `<h3>組合加成</h3>\n<p class="hint">唔使成套齊 —— 夾中下面嘅部位就發動。</p>\n`
      + `<div class="tablewrap"><table class="data combos">`
      + `<thead><tr><th>夾中呢啲部位</th><th>加成</th></tr></thead>`
      + `<tbody>${page.setCombos.map(comboRow).join('')}</tbody></table></div>`
    : ''}

<h2>成員裝備（${page.members.length} 件）</h2>
<div class="tablewrap"><table class="data members">
<thead><tr><th colspan="2">裝備</th><th>部位</th><th>能力值</th></tr></thead>
<tbody>${page.members.map(memberRow).join('')}</tbody>
</table></div>

<h2>著齊全套合計</h2>
${totals.length
    ? `<div class="tablewrap"><table class="data totals"><thead><tr><th>能力值</th><th>合計</th></tr></thead>`
      + `<tbody>${totals.map(totalRow).join('')}</tbody></table></div>`
    : '<p class="empty">冇可加總嘅能力值。</p>'}
${others.length
    ? `<h3>其他效果</h3><p class="hint">以下項目無法加總，原文列出：</p>`
      + `<ul class="plain">${others.map((o) =>
        `<li class="${escapeHtml(o.colour)}">${escapeHtml(o.text)}</li>`).join('')}</ul>`
    : ''}

<h2>可穿著角色</h2>
${wearers.length
    ? `<p class="charlist">${wearers.map((id) => escapeHtml(data.characters[id].name)).join('、')}</p>`
    : '<p class="empty">冇角色可以著齊呢套裝備。</p>'}

${related.length
    ? `<h2>相關套裝</h2><ul class="tags">${related.map((r) =>
        `<li><a href="${escapeHtml(setPath(r.setId, r.name))}">${escapeHtml(r.name)}</a></li>`).join('')}</ul>`
    : ''}
</div>
${infobox}
</div>
</div>
</body>
</html>
`;
}
