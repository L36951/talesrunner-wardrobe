import test from 'node:test';
import assert from 'node:assert/strict';
import { renderSetPage } from '../scripts/lib/render-set.mjs';
import { relatedSets } from '../scripts/lib/related.mjs';
import { renderInfobox } from '../scripts/lib/infobox.mjs';
import { buildLead } from '../scripts/lib/lead.mjs';
import { readFileSync } from 'node:fs';

// 客戶端嘅 fdComplexKey：套裝入面有啲加成係「夾中呢兩件」就發動，唔使成套齊。
const data = {
  characters: { 1: { name: '光光', sex: 'M', order: 0 } },
  wearGroups: [[]],
};

const members = [
  { id: '1', name: '魔鬼國王的頭髮', subcategory: '髮型', slot: 'hair', slots: ['hair'], stats: [] },
  { id: '2', name: '魔鬼國王的紋樣', subcategory: '上衣', slot: 'upper', slots: ['upper'], stats: [] },
];

const comboOnly = {
  setId: '7458',
  name: '解開封印的魔鬼1次組合',
  equipmentType: 'role',
  setStats: [],
  setCombos: [{ slots: ['hair', 'upper'], stats: [['幸運 +10%', 'green']] }],
  members,
};

test('組合加成喺套裝頁列得出，同埋講明唔使成套', () => {
  const html = renderSetPage({ page: comboOnly, data, related: [], counterpart: null });
  assert.match(html, /組合加成/);
  assert.match(html, /唔使成套齊/);
  assert.match(html, /髮型＋上衣/);
  assert.match(html, /幸運 \+10%/);
});

test('冇成套加成但有組合加成，唔可以講「冇套裝效果」', () => {
  const html = renderSetPage({ page: comboOnly, data, related: [], counterpart: null });
  assert.doesNotMatch(html, /呢套裝備冇套裝效果/);
});

test('lead 講返係組合加成', () => {
  assert.match(buildLead(comboOnly, 1), /夾中指定部位就有組合加成/);
});

test('infobox 唔會就咁寫「冇」', () => {
  const html = renderInfobox({
    page: comboOnly, wearerCount: 1, characterCount: 1,
    counterpart: null, tryOnUrl: '/',
  });
  assert.match(html, /1 條組合加成/);
});

test('真係冇加成先講冇套裝效果', () => {
  const bare = { ...comboOnly, setCombos: [] };
  const html = renderSetPage({ page: bare, data, related: [], counterpart: null });
  assert.match(html, /呢套裝備冇套裝效果/);
  assert.doesNotMatch(html, /組合加成/);
});

test('套裝生效嘅欄位可以同成員唔同 —— 判斷要睇套裝，唔係睇件裝備', () => {
  // 「龍騎衛隊套裝」係 avatar 套裝，但四件成員 avatarOnlyStats 都係 false（＝role）。
  // 一度攞錯咗件裝備嘅 equipmentType 嚟判斷，組合加成就永遠達唔到。
  const real = JSON.parse(
    readFileSync(new URL('../data/items.json', import.meta.url), 'utf8'));
  const mismatched = Object.entries(real.sets).filter(([setId, set]) => {
    if (!set.comboStats) return false;
    return real.items.some(
      (item) => item.setId === setId
        && (item.avatarOnlyStats ? 'avatar' : 'role') !== set.equipmentType);
  });
  assert.ok(mismatched.length > 0,
    '如果冇呢種情況，呢個 test 就守唔到嘢，要重新諗');
});

test('相關套裝計埋組合加成 —— 唔係就淨得組合加成嘅套裝會冇嘢比得對', () => {
  const target = comboOnly;
  const sharesCombo = {
    setId: '7459', name: '解開封印的魔鬼2次組合', equipmentType: 'role',
    setStats: [],
    setCombos: [{ slots: ['hair', 'upper'], stats: [['幸運 +10%', 'green']] }],
    members,
  };
  const unrelated = {
    setId: '7460', name: '完全無關組合', equipmentType: 'role',
    setStats: [], setCombos: [{ slots: ['shoes', 'head'], stats: [['力量 +1', 'blue']] }],
    members,
  };
  const [first] = relatedSets(target, [unrelated, sharesCombo]);
  assert.equal(first.setId, '7459', '有相同組合加成嗰個要排前面');
});
