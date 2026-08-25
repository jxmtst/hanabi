import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatText, parseSegments } from '../src/receiver/formatter.js';

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

test('parseSegments: テキストとカスタム絵文字を分割する', () => {
  assert.deepEqual(parseSegments('やっほー <:wave:123>'), [
    { type: 'text', value: 'やっほー ' },
    { type: 'emoji', url: 'https://cdn.discordapp.com/emojis/123.png', name: 'wave' },
  ]);
});

test('parseSegments: アニメーション絵文字は gif になる', () => {
  assert.deepEqual(parseSegments('<a:dance:456>'), [
    { type: 'emoji', url: 'https://cdn.discordapp.com/emojis/456.gif', name: 'dance' },
  ]);
});

test('parseSegments: テキスト部分には URL 短縮が適用される', () => {
  assert.deepEqual(parseSegments('https://example.com/x <:wave:123>'), [
    { type: 'text', value: 'example.com/… ' },
    { type: 'emoji', url: 'https://cdn.discordapp.com/emojis/123.png', name: 'wave' },
  ]);
});
