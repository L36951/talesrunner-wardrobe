import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  MODEL_BASE,
  isSupported,
  modelPathFor,
  supportedCharacters,
} from '../scripts/lib/model-catalog.mjs';

const manifest = JSON.parse(readFileSync(new URL('../data/models.json', import.meta.url)));

test('modelPathFor returns a fetchable path for a supported character', () => {
  assert.equal(modelPathFor('1', manifest), MODEL_BASE + 'char/1.glb');
});

test('modelPathFor accepts a numeric id', () => {
  assert.equal(modelPathFor(1, manifest), modelPathFor('1', manifest));
});

test('modelPathFor returns null for a character with no model', () => {
  // 3 = 莉娜，基本造型推導唔到，刻意冇入 manifest
  assert.equal(modelPathFor('3', manifest), null);
  assert.equal(isSupported('3', manifest), false);
});

test('a broken or missing manifest never throws', () => {
  for (const bad of [null, undefined, {}, { characters: null }, { characters: 'nope' }]) {
    assert.equal(modelPathFor('1', bad), null);
    assert.equal(isSupported('1', bad), false);
    assert.deepEqual(supportedCharacters(bad), []);
  }
});

test('an empty entry counts as unsupported', () => {
  assert.equal(modelPathFor('9', { characters: { 9: '' } }), null);
});

test('the manifest ships exactly the hand-verified characters', () => {
  assert.deepEqual(supportedCharacters(manifest).sort(), ['1', '44', '45', '46', '47', '48']);
});

test('every manifest entry points at a glb under the model base', () => {
  for (const id of supportedCharacters(manifest)) {
    const path = modelPathFor(id, manifest);
    assert.ok(path.startsWith(MODEL_BASE), `${id} 唔喺 ${MODEL_BASE} 之下`);
    assert.ok(path.endsWith('.glb'), `${id} 唔係 .glb`);
  }
});
