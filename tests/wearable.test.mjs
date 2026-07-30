import test from 'node:test';
import assert from 'node:assert/strict';
import { canWear, wearableCharacters, pickTryOnCharacter, DEFAULT_CHARACTER }
  from '../scripts/lib/wearable.mjs';

const data = {
  characters: {
    '1': { name: '光光', sex: 'M', order: 0 },
    '2': { name: '小美', sex: 'F', order: 1 },
    '3': { name: '阿寶', sex: 'M', order: 2 },
  },
  wearGroups: [
    [1, 2, 3],   // 0: 全部
    [2],         // 1: 淨係小美
    [],          // 2: 空 = 冇限制
  ],
};

test('an unrestricted item fits everyone', () => {
  assert.equal(canWear({}, '1', data), true);
});

test('wearGroup is a whitelist', () => {
  assert.equal(canWear({ wearGroup: 1 }, '2', data), true);
  assert.equal(canWear({ wearGroup: 1 }, '1', data), false);
});

test('an empty wearGroup means no restriction, not a total block', () => {
  assert.equal(canWear({ wearGroup: 2 }, '1', data), true);
});

test('sexLock rejects the other sex', () => {
  assert.equal(canWear({ sexLock: 'F' }, '2', data), true);
  assert.equal(canWear({ sexLock: 'F' }, '1', data), false);
});

test('blockedFor is a blacklist keyed by number', () => {
  assert.equal(canWear({ blockedFor: [3] }, '3', data), false);
  assert.equal(canWear({ blockedFor: [3] }, '1', data), true);
});

test('restrictions compose - any one failing blocks the item', () => {
  assert.equal(canWear({ wearGroup: 0, sexLock: 'M', blockedFor: [3] }, '1', data), true);
  assert.equal(canWear({ wearGroup: 0, sexLock: 'M', blockedFor: [3] }, '3', data), false);
});

test('wearableCharacters keeps only characters who can wear every member', () => {
  const members = [{ sexLock: 'M' }, { blockedFor: [3] }];
  assert.deepEqual(wearableCharacters(members, data), ['1']);
});

test('pickTryOnCharacter takes the lowest-order full match', () => {
  const members = [{ sexLock: 'F' }];
  assert.deepEqual(pickTryOnCharacter(members, data), { characterId: '2', complete: true });
});

test('pickTryOnCharacter falls back and flags an incomplete set', () => {
  const members = [{ sexLock: 'M' }, { sexLock: 'F' }];
  assert.deepEqual(pickTryOnCharacter(members, data),
    { characterId: DEFAULT_CHARACTER, complete: false });
});
