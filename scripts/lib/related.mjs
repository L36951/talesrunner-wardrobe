export const RELATED_LIMIT = 8;

// setId 全部係數字字串，所以用數值比較。localeCompare(…,{numeric:true}) 語義上一樣，
// 但每次呼叫要 ~3.4µs，喺全量 build 度加起上嚟係 20 秒對 0.4 秒。
function sortKey(setId) {
  const numeric = Number(setId);
  return Number.isFinite(numeric) ? numeric : Number.POSITIVE_INFINITY;
}

export function relatedSets(target, pages, limit = RELATED_LIMIT) {
  const targetStats = new Set((target.setStats ?? []).map(([text]) => text));

  return pages
    .filter((page) =>
      page.setId !== target.setId && page.equipmentType === target.equipmentType)
    .map((page) => ({
      page,
      shared: (page.setStats ?? []).filter(([text]) => targetStats.has(text)).length,
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
