const MARKER = /[（(]([男女])[）)]/;
const MARKER_GLOBAL = /[（(][男女][）)]/g;

export function genderOf(name) {
  const match = MARKER.exec(String(name));
  return match ? match[1] : null;
}

export function stemOf(name) {
  return String(name).replace(MARKER_GLOBAL, '').trim();
}

export function buildCounterpartIndex(pages) {
  const byStem = new Map();
  for (const page of pages) {
    if (!genderOf(page.name)) continue;
    const stem = stemOf(page.name);
    const bucket = byStem.get(stem);
    if (bucket) bucket.push(page);
    else byStem.set(stem, [page]);
  }

  const index = new Map();
  for (const group of byStem.values()) {
    // 只處理乾淨嘅一男一女配對；其他情況寧願唔連，唔好連錯。
    if (group.length !== 2) continue;
    const genders = new Set(group.map((page) => genderOf(page.name)));
    if (genders.size !== 2) continue;
    index.set(group[0].setId, group[1]);
    index.set(group[1].setId, group[0]);
  }
  return index;
}
