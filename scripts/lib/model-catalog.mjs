// 邊個角色有 3D 模型、模型檔喺邊。
//
// 只有人手核對過嘅角色先會喺 manifest 入面 —— 其餘角色嘅基本造型
// 客戶端冇統一定義，推導唔到。所以呢度嘅判斷一律以 manifest 為準，
// 唔好靠角色 id 範圍或者命名規律估。

export const MODEL_BASE = 'assets/model/';

/** manifest 有冇呢個角色 */
export function isSupported(characterId, manifest) {
  return modelPathFor(characterId, manifest) !== null;
}

/** → 可以直接 fetch 嘅路徑，冇就 null */
export function modelPathFor(characterId, manifest) {
  const table = manifest && manifest.characters;
  if (!table || typeof table !== 'object') return null;
  // 角色 id 喺 items.json 係字串 key，但呼叫者可能傳 number
  const entry = table[String(characterId)];
  if (typeof entry !== 'string' || entry === '') return null;
  return MODEL_BASE + entry;
}

/** manifest 入面全部角色 id（字串），順序照 manifest */
export function supportedCharacters(manifest) {
  const table = manifest && manifest.characters;
  if (!table || typeof table !== 'object') return [];
  return Object.keys(table).filter((id) => typeof table[id] === 'string' && table[id] !== '');
}
