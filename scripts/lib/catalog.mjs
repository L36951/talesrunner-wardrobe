export const MIN_MEMBERS = 2;
export const EXPECTED_PAGE_COUNT = 1978;

export function buildCatalog(data) {
  const membersBySetId = new Map();
  for (const item of data.items) {
    if (item.setId == null || item.setId === '') continue;
    const bucket = membersBySetId.get(item.setId);
    if (bucket) bucket.push(item);
    else membersBySetId.set(item.setId, [item]);
  }

  const pages = [];
  for (const [setId, definition] of Object.entries(data.sets)) {
    const members = membersBySetId.get(setId) ?? [];
    if (members.length < MIN_MEMBERS) continue;
    pages.push({
      setId,
      name: definition.name,
      equipmentType: definition.equipmentType ?? 'role',
      setStats: definition.stats ?? [],
      members,
    });
  }

  pages.sort((a, b) => a.setId.localeCompare(b.setId, undefined, { numeric: true }));
  return pages;
}
