import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatText } from '../src/receiver/formatter.js';

test('formatText: パス付き URL はホスト+省略記号に短縮する', () => {
  assert.equal(
    formatText('見て https://www.example.com/very/long/path これ'),
    '見て example.com/… これ',
  );
});

test('formatText: パスなし URL はホストのみにする', () => {
  assert.equal(formatText('https://example.com'), 'example.com');
});

test('formatText: URL を含まない文字列はそのまま返す', () => {
  assert.equal(formatText('やっほー'), 'やっほー');
});
