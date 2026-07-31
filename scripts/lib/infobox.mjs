import { escapeHtml } from './escape.mjs';
import { setPath } from './slug.mjs';

const ICON_BASE = '/assets/itemimage/';

const row = (label, value) =>
  `<tr><th>${escapeHtml(label)}</th><td>${value}</td></tr>`;

export function renderInfobox({ page, wearerCount, characterCount, counterpart, tryOnUrl }) {
  const kind = page.equipmentType === 'avatar' ? 'Avatar' : '角色裝備';

  const icons = page.members
    .filter((item) => item.icon)
    .map((item) =>
      `<img src="${ICON_BASE}${escapeHtml(item.icon)}" alt="${escapeHtml(item.name)}"`
      + ` width="48" height="48" loading="lazy">`)
    .join('');

  // 去重但保持成員次序 —— Set 會保留插入次序。
  const slots = [...new Set(page.members.map((item) => item.subcategory).filter(Boolean))]
    .map(escapeHtml).join('、');

  // 159 個套裝全部加成都帶組合條件，setStats 係空嘅 —— 唔可以就咁寫「冇」
  const combos = page.setCombos ?? [];
  const bonus = page.setStats.length
    ? page.setStats
      .map(([text, colour]) => `<span class="${escapeHtml(colour)}">${escapeHtml(text)}</span>`)
      .join('<br>')
    : combos.length
      ? `<span class="empty">冇成套加成</span><br><span>${combos.length} 條組合加成</span>`
      : '<span class="empty">冇</span>';

  return `<aside class="infobox">
<div class="ib-title">${escapeHtml(page.name)}</div>
${icons ? `<div class="ib-imgs">${icons}</div>` : ''}
<table>
${row('類型', escapeHtml(kind))}
${row('件數', `${page.members.length} 件`)}
${slots ? row('部位', slots) : ''}
${row('套裝效果', bonus)}
${row('可穿著', `${wearerCount} / ${characterCount} 個角色`)}
${counterpart
    ? row('另一版本',
      `<a href="${escapeHtml(setPath(counterpart.setId, counterpart.name))}">`
      + `${escapeHtml(counterpart.name)}</a>`)
    : ''}
</table>
<div class="ib-cta"><a href="${escapeHtml(tryOnUrl)}">🔗 立即試身</a></div>
</aside>`;
}
