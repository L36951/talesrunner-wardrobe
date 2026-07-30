import test from 'node:test';
import assert from 'node:assert/strict';
import { escapeHtml } from '../scripts/lib/escape.mjs';

test('escapes the five HTML-significant characters', () => {
  assert.equal(escapeHtml('<a href="x">&\'</a>'),
    '&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;');
});

test('leaves Chinese equipment names untouched', () => {
  assert.equal(escapeHtml('青花瓷套裝(男)'), '青花瓷套裝(男)');
});

test('coerces non-strings', () => {
  assert.equal(escapeHtml(42), '42');
  assert.equal(escapeHtml(null), 'null');
});
