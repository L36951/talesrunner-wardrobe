import test from 'node:test';
import assert from 'node:assert/strict';
import { parseStatLine, summariseStats } from '../scripts/lib/stats.mjs';

test('parses a plain numeric stat', () => {
  assert.deepEqual(parseStatLine('最高速度 +1'),
    { name: '最高速度', value: 1, unit: '' });
});

test('parses a percentage stat', () => {
  assert.deepEqual(parseStatLine('幸運 +20%'),
    { name: '幸運', value: 20, unit: '%' });
});

test('parses a stat with no space before the sign', () => {
  assert.deepEqual(parseStatLine('推進力增加+20%'),
    { name: '推進力增加', value: 20, unit: '%' });
});

test('tolerates a trailing decimal point', () => {
  assert.deepEqual(parseStatLine('憤怒持續時間 +55.%'),
    { name: '憤怒持續時間', value: 55, unit: '%' });
});

test('parses negatives', () => {
  assert.deepEqual(parseStatLine('控制 -2'),
    { name: '控制', value: -2, unit: '' });
});

test('returns null for prose with no number', () => {
  assert.equal(parseStatLine('產生專屬腳印效果'), null);
  assert.equal(parseStatLine('★6月24日維護前'), null);
});

test('sums matching names and keeps units apart', () => {
  const { totals } = summariseStats([
    { stats: [['最高速度 +1', 'blue'], ['幸運 +20%', 'green']] },
    { stats: [['最高速度 +2', 'blue'], ['幸運 +5%', 'green']] },
  ]);
  assert.deepEqual(totals, [
    { name: '幸運', unit: '%', value: 25, colour: 'green' },
    { name: '最高速度', unit: '', value: 3, colour: 'blue' },
  ]);
});

test('rounds away floating point noise', () => {
  const { totals } = summariseStats([
    { stats: [['A +0.1', 'blue']] },
    { stats: [['A +0.2', 'blue']] },
  ]);
  assert.equal(totals[0].value, 0.3);
});

test('collects unparseable lines separately and de-duplicates them', () => {
  const { others } = summariseStats([
    { stats: [['產生專屬腳印效果', 'gold']] },
    { stats: [['產生專屬腳印效果', 'gold']] },
  ]);
  assert.deepEqual(others, [{ text: '產生專屬腳印效果', colour: 'gold' }]);
});

test('handles members with no stats at all', () => {
  const result = summariseStats([{ name: 'X' }, { stats: [] }]);
  assert.deepEqual(result, { totals: [], others: [] });
});

test('rejects a line carrying two stats rather than mis-attributing the last one', () => {
  assert.equal(parseStatLine('攻擊力 +140  防禦力 +120  生命力 +120'), null);
  assert.equal(parseStatLine('EXP +100%、最高速度 +1'), null);
  assert.equal(parseStatLine('TR +20% +1'), null);
});

test('keeps parsing a single stat whose name contains CJK punctuation', () => {
  assert.deepEqual(parseStatLine('被巫毒娃娃攻擊時，持續時間 -10%'),
    { name: '被巫毒娃娃攻擊時，持續時間', value: -10, unit: '%' });
  assert.deepEqual(parseStatLine('且淘汰全部玩家， TR、 經驗值 +60%'),
    { name: '且淘汰全部玩家， TR、 經驗值', value: 60, unit: '%' });
});
