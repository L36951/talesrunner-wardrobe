import test from 'node:test';
import assert from 'node:assert/strict';
import { relatedSets, RELATED_LIMIT } from '../scripts/lib/related.mjs';

const page = (setId, equipmentType, statTexts, memberCount) => ({
  setId,
  equipmentType,
  setStats: statTexts.map((text) => [text, 'blue']),
  members: Array.from({ length: memberCount }, (_, i) => ({ id: `${setId}-${i}` })),
});

test('never returns the page itself or a different equipment type', () => {
  const target = page('1', 'role', ['S'], 3);
  const result = relatedSets(target, [target, page('2', 'avatar', ['S'], 3)]);
  assert.deepEqual(result, []);
});

test('ranks by shared stat lines first', () => {
  const target = page('1', 'role', ['A', 'B'], 3);
  const result = relatedSets(target, [
    target,
    page('2', 'role', ['A'], 3),
    page('3', 'role', ['A', 'B'], 9),
  ]);
  assert.deepEqual(result.map((p) => p.setId), ['3', '2']);
});

test('breaks a shared-stat tie on member-count distance', () => {
  const target = page('1', 'role', ['A'], 3);
  const result = relatedSets(target, [
    target,
    page('2', 'role', ['A'], 8),
    page('3', 'role', ['A'], 4),
  ]);
  assert.deepEqual(result.map((p) => p.setId), ['3', '2']);
});

test('breaks a full tie on numeric set id for reproducible builds', () => {
  const target = page('1', 'role', [], 3);
  const result = relatedSets(target, [
    target,
    page('30', 'role', [], 3),
    page('4', 'role', [], 3),
  ]);
  assert.deepEqual(result.map((p) => p.setId), ['4', '30']);
});

test('caps the list at RELATED_LIMIT', () => {
  const target = page('1', 'role', [], 3);
  const others = Array.from({ length: 20 }, (_, i) => page(`${i + 2}`, 'role', [], 3));
  assert.equal(relatedSets(target, [target, ...others]).length, RELATED_LIMIT);
  assert.equal(RELATED_LIMIT, 8);
});
