import { escapeHtml } from './escape.mjs';
import { setPath } from './slug.mjs';
import { SITE_ORIGIN } from './site.mjs';

export const LISTINGS = [
  { equipmentType: 'role', path: '/sets/role', label: '角色裝備套裝' },
  { equipmentType: 'avatar', path: '/sets/avatar', label: 'Avatar 套裝' },
];

function shell({ title, description, path, body }) {
  const url = `${SITE_ORIGIN}${path}`;
  return `<!doctype html>
<html lang="zh-Hant">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}">
<link rel="canonical" href="${escapeHtml(url)}">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:url" content="${escapeHtml(url)}">
<meta property="og:image" content="${SITE_ORIGIN}/assets/og-image.jpg">
</head>
<body>
<nav><a href="/">跑Online 配裝分享器</a></nav>
<main>${body}</main>
</body>
</html>
`;
}

const countFor = (listing, pages) =>
  pages.filter((page) => page.equipmentType === listing.equipmentType).length;

export function renderHub(pages) {
  const cards = LISTINGS.map((listing) =>
    `<li><a href="${listing.path}">${escapeHtml(listing.label)}</a>`
    + `（${countFor(listing, pages)} 個）</li>`).join('');

  return shell({
    title: '《跑Online》套裝一覽｜套裝效果與能力值 - 跑Online 配裝分享器',
    description: `《跑Online》全部 ${pages.length} 套套裝，分角色裝備同 Avatar 兩類，`
      + '每套列出成員裝備、套裝效果同可穿著角色。',
    path: '/sets',
    body: `<h1>《跑Online》套裝一覽</h1>
<p>共 ${pages.length} 套。</p>
<ul>${cards}</ul>`,
  });
}

export function renderListing(listing, pages) {
  const mine = pages.filter((page) => page.equipmentType === listing.equipmentType);
  const items = mine.map((page) =>
    `<li><a href="${escapeHtml(setPath(page.setId, page.name))}">${escapeHtml(page.name)}</a>`
    + `（${page.members.length} 件）</li>`).join('');

  return shell({
    title: `${listing.label}一覽（${mine.length} 套）- 跑Online 配裝分享器`,
    description: `《跑Online》${listing.label}共 ${mine.length} 套，`
      + '每套列出成員裝備、套裝效果同可穿著角色。',
    path: listing.path,
    body: `<h1>${escapeHtml(listing.label)}</h1>
<p>共 ${mine.length} 套。</p>
<ul class="set-list">${items}</ul>`,
  });
}
