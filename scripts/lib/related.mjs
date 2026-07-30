export const RELATED_LIMIT = 8;

export function relatedSets(target, pages, limit = RELATED_LIMIT) {
  const targetStats = new Set((target.setStats ?? []).map(([text]) => text));

  return pages
    .filter((page) =>
      page.setId !== target.setId && page.equipmentType === target.equipmentType)
    .map((page) => ({
      page,
      shared: (page.setStats ?? []).filter(([text]) => targetStats.has(text)).length,
      sizeGap: Math.abs(page.members.length - target.members.length),
    }))
    .sort((a, b) =>
      b.shared - a.shared
      || a.sizeGap - b.sizeGap
      || a.page.setId.localeCompare(b.page.setId, undefined, { numeric: true }))
    .slice(0, limit)
    .map((entry) => entry.page);
}
