// 成員多過呢個數就唔逐個列，避免導語變成一條清單。
export const LEAD_MEMBER_LIMIT = 6;

export function buildLead(page, wearerCount) {
  const kind = page.equipmentType === 'avatar' ? 'Avatar' : '角色裝備';
  const names = page.members.map((item) => item.name);
  const shown = names.slice(0, LEAD_MEMBER_LIMIT).join('、');
  const listing = names.length > LEAD_MEMBER_LIMIT
    ? `${shown} 等 ${names.length} 件`
    : shown;

  const bonus = page.setStats.length
    ? '著齊全套會觸發套裝效果，'
    : (page.setCombos ?? []).length
      ? '唔使著齊全套，夾中指定部位就有組合加成，'
      : '呢套裝備冇套裝效果，';

  const wearers = wearerCount > 0
    ? `共 ${wearerCount} 個角色可以著齊。`
    : '暫時冇角色可以著齊全套。';

  return `${page.name} 係《跑Online》嘅${kind}套裝，由 ${names.length} 件裝備組成：`
    + `${listing}。${bonus}${wearers}`;
}
