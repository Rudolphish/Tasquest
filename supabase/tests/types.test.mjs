// 生成された型定義が、マイグレーションの現状と一致していることを確認する。
//
// スキーマを変更したまま型を再生成し忘れると、型検査は通るのに実行時に
// 列が存在しない、という食い違いが起きる。本検査はその乖離を検出する。

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { generate } from '../tools/gen-types.mjs';

const CHECKED_IN = fileURLToPath(
  new URL('../../src/lib/database.types.ts', import.meta.url),
);

test('database.types.ts がマイグレーションと一致している', async () => {
  const [generated, committed] = await Promise.all([
    generate(),
    readFile(CHECKED_IN, 'utf8'),
  ]);

  assert.equal(
    generated,
    committed,
    'マイグレーションと型定義が食い違っている。npm run gen:types で再生成すること。',
  );
});
