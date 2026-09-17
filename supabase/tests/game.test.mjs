// 画面側のレベル計算が、データベース側の定義と一致することを確認する。
//
// 同じ曲線を SQL と TypeScript の 2 箇所で定義しているため、片方だけを
// 変更すると表示と実際の判定がずれる。本検査はその乖離を検出する。

import test from 'node:test';
import assert from 'node:assert/strict';
import { freshDb } from './helpers.mjs';
import { levelForXp, xpForLevel } from '../../src/lib/game.ts';

test('xp_for_level が SQL と TypeScript で一致する', async () => {
  const db = await freshDb();
  const { rows } = await db.query(`
    select lv, public.xp_for_level(lv) as need
    from generate_series(1, 40) as lv
  `);

  for (const { lv, need } of rows) {
    assert.equal(xpForLevel(lv), need, `レベル ${lv} の必要 XP`);
  }

  await db.close();
});

test('level_for_xp が SQL と TypeScript で一致する', async () => {
  const db = await freshDb();
  const { rows } = await db.query(`
    select xp, public.level_for_xp(xp) as lv
    from generate_series(0, 50000, 137) as xp
  `);

  for (const { xp, lv } of rows) {
    assert.equal(levelForXp(xp), lv, `${xp} XP のときのレベル`);
  }

  await db.close();
});
