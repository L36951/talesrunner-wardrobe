export const RELATED_LIMIT = 8;

// setId 全部係數字字串，所以用數值比較。localeCompare(…,{numeric:true}) 語義上一樣，
// 但每次呼叫要 ~3.4µs，喺全量 build 度加起上嚟係 20 秒對 0.4 秒。
function sortKey(setId) {
  const numeric = Number(setId);
  return Number.isFinite(numeric) ? numeric : Number.POSITIVE_INFINITY;
}

// 組合加成一樣係套裝加成 —— 淨計 setStats 嘅話，159 個「全部加成都帶組合條件」
// 嘅套裝就冇嘢比得對，會跌出晒人哋嘅相關清單。
function statTexts(page) {
  return [
    ...(page.setStats ?? []).map(([text]) => text),
    ...(page.setCombos ?? []).flatMap((combo) => combo.stats.map(([text]) => text)),
  ];
}

export function relatedSets(target, pages, limit = RELATED_LIMIT) {
  const targetStats = new Set(statTexts(target));

  return pages
    .filter((page) =>
      page.setId !== target.setId && page.equipmentType === target.equipmentType)
    .map((page) => ({
      page,
      shared: statTexts(page).filter((text) => targetStats.has(text)).length,
      sizeGap: Math.abs(page.members.length - target.members.length),
      key: sortKey(page.setId),
    }))
    .sort((a, b) =>
      b.shared - a.shared
      || a.sizeGap - b.sizeGap
      || a.key - b.key
      || a.page.setId.localeCompare(b.page.setId))
    .slice(0, limit)
    .map((entry) => entry.page);
}
