// 對應 index.html 嘅 DEFAULT_CHARACTER（光光）
export const DEFAULT_CHARACTER = '1';

// 完全跟隨 index.html:197-210 blockedForSelected() 嘅規則，只係反轉返正面講。
export function canWear(item, characterId, data) {
  const numericId = Number(characterId);

  if (item.wearGroup != null) {
    const group = data.wearGroups[item.wearGroup];
    // 空 group ＝資產度睇唔出限制，當冇限制
    if (group && group.length && !group.includes(numericId)) return false;
  }

  if (item.sexLock) {
    const sex = data.characters[characterId]?.sex;
    if (sex && sex !== item.sexLock) return false;
  }

  if (Array.isArray(item.blockedFor) && item.blockedFor.includes(numericId)) return false;

  return true;
}

function orderedCharacterIds(data) {
  return Object.keys(data.characters).sort(
    (a, b) => (data.characters[a].order ?? 0) - (data.characters[b].order ?? 0)
      || a.localeCompare(b, undefined, { numeric: true })
  );
}

export function wearableCharacters(members, data) {
  return orderedCharacterIds(data)
    .filter((id) => members.every((item) => canWear(item, id, data)));
}

export function pickTryOnCharacter(members, data) {
  const match = orderedCharacterIds(data)
    .find((id) => members.every((item) => canWear(item, id, data)));
  return match
    ? { characterId: match, complete: true }
    : { characterId: DEFAULT_CHARACTER, complete: false };
}
