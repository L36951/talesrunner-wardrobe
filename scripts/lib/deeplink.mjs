// 對應 index.html:311-317 buildShareUrl() 嘅 hash 格式。
export function buildTryOnUrl(page, characterId) {
  const ids = page.members.map((item) => item.id).join(',');
  const layer = page.equipmentType === 'avatar' ? 'avatar' : 'role';
  const avatar = layer === 'avatar' ? ids : '';
  const role = layer === 'role' ? ids : '';
  return `/#v=1&char=${characterId}&avatar=${avatar}&role=${role}&view=${layer}`;
}
