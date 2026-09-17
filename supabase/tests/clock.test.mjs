// 「今日」の定義が、アプリとデータベースで一致することを確認する。
//
// 実行環境の時刻帯は UTC である。利用者の生活時間（Asia/Tokyo）で日付を
// 決めないと、朝に書いた記録が前日として保存され、連続記録の判定が狂う。

import test from 'node:test';
import assert from 'node:assert/strict';
import { freshDb } from './helpers.mjs';
import { APP_TIME_ZONE, dateInAppZone } from '../../src/lib/clock.ts';

/** 境界をまたぐ時刻を含む検体。 */
const SAMPLES = [
  '2026-09-16T14:59:59Z', // 東京では 23:59、まだ 16 日
  '2026-09-16T15:00:00Z', // 東京では翌 0:00、17 日へ変わる
  '2026-09-16T23:00:00Z', // 東京では 17 日の 8:00。実行環境の日付とずれる
  '2026-01-01T00:00:00Z', // 年をまたぐ
  '2026-06-30T16:30:00Z',
];

test('アプリ側が利用者の生活時間で日付を決めている', () => {
  assert.equal(APP_TIME_ZONE, 'Asia/Tokyo');

  assert.equal(dateInAppZone(new Date('2026-09-16T14:59:59Z')), '2026-09-16');
  assert.equal(dateInAppZone(new Date('2026-09-16T15:00:00Z')), '2026-09-17');

  // 実行環境の既定（UTC）とは異なることを明示する
  const morningInTokyo = new Date('2026-09-16T23:00:00Z');
  assert.equal(morningInTokyo.toLocaleDateString('sv-SE', { timeZone: 'UTC' }), '2026-09-16');
  assert.equal(dateInAppZone(morningInTokyo), '2026-09-17');
});

test('app_today の定義がアプリ側と一致する', async () => {
  const db = await freshDb();

  for (const iso of SAMPLES) {
    const { rows } = await db.query(
      `select ($1::timestamptz at time zone 'Asia/Tokyo')::date::text as day`, [iso]);
    assert.equal(
      rows[0].day,
      dateInAppZone(new Date(iso)),
      `${iso} の日付`,
    );
  }

  await db.close();
});

test('app_today が実行時にも同じ日付を返す', async () => {
  const db = await freshDb();

  const { rows } = await db.query('select public.app_today()::text as day');
  assert.equal(rows[0].day, dateInAppZone(new Date()));

  await db.close();
});
