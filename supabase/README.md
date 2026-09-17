# supabase

Tasquest のデータベース定義と、その検証。

## 構成

| パス | 内容 |
|---|---|
| `migrations/0001_init.sql` | 初期スキーマ。テーブル、RLS、制約、RPC のシグネチャ |
| `migrations/0002_quests_xp_value_not_null.sql` | `quests.xp_value` に NOT NULL を付与する |
| `migrations/0003_propose_quests.sql` | 日付の基準と、AI からのクエスト提案を受ける RPC |
| `migrations/0004_goal_background.sql` | 目標ごとの現在地と、その書き戻しを受ける RPC |
| `tests/schema.test.mjs` | スキーマの検証。制約が違反を拒否することを確認する |
| `tests/types.test.mjs` | 型定義がマイグレーションと一致していることの検証 |
| `tests/rpc.test.mjs` | propose_quests の検証。拒否すべき入力を拒否すること |
| `tests/background.test.mjs` | 現在地の保存と record_background の検証 |
| `tests/clock.test.mjs` | 「今日」の定義がアプリと一致していることの検証 |
| `tests/game.test.mjs` | レベル曲線がアプリと一致していることの検証 |
| `tests/helpers.mjs` | PGlite 上に Supabase 相当の最小環境を用意する補助 |
| `tools/gen-types.mjs` | マイグレーションから TypeScript の型定義を生成する |

## 検証の実行

```bash
npm install
npm run test:schema
```

Docker を用いず、PGlite（WebAssembly 版 PostgreSQL）上でマイグレーションを実際に適用して検証する。
Supabase 固有の `auth.users` と `auth.uid()`、および `anon` / `authenticated` ロールはテスト側で再現している。

検証は「記述したこと」ではなく「違反を拒否したこと」を確認する方針を取る。
アクティブ枠の 4 件目、他人名義での作成、XP 値の直接書き込みなどが、いずれも拒否されることを確認している。

なお PostgreSQL のスーパーユーザーは RLS を迂回する。
そのため検証では `authenticated` ロールへ `set role` してから確認している。

## 型定義の生成

```bash
npm run gen:types
```

`src/lib/database.types.ts` を生成する。

`supabase gen types` は CLI へのログインかデータベースパスワードを要求するため採用していない。
代わりに PGlite 上へマイグレーションを適用し、その内省結果から生成する。
認証情報を持たない環境でも再生成でき、スキーマとの乖離を検査で検出できる。
出力形式は `supabase gen types` と互換であり、必要になれば差し替えられる。

生成列は `Insert` と `Update` から除外される。
これにより `xp_value` への代入は型検査の段階で落ちる。
この保証は `src/lib/db/type-guarantees.ts` が `@ts-expect-error` で固定している。

## 本番への適用

Supabase ダッシュボードの SQL Editor に `migrations/` 配下の SQL をファイル名順に貼り付けて実行する。
API キーもデータベースパスワードも不要であり、失敗時のエラーがその場で確認できる。

適用後、次を確認する。

```sql
-- テーブルが 8 つ作成されていること
select table_name from information_schema.tables
where table_schema = 'public' and table_type = 'BASE TABLE'
order by table_name;

-- すべてのテーブルで RLS が有効であること（rowsecurity がすべて true）
select tablename, rowsecurity from pg_tables
where schemaname = 'public' order by tablename;
```

適用の成否を画面表示で判断してはいけない。
Next.js のキャッシュを経由した確認では、テーブルが存在しない状態でもページが正常に見えることがある
（`docs/implementation-plan.md` の S-1 を参照）。

## 設計上の要点

- **XP 値は生成列である。** 工数区分（S / M / L）から導出され、直接の書き込みは PostgreSQL が拒否する。
  AI が XP を操作できないことを、アプリ層の約束ではなくスキーマで保証している（D-4）。
  値の変更には明示的なマイグレーションを要する。これは変更履歴が残る利点でもある。
- **アクティブ枠は `active_slot` の範囲制約と部分一意索引で保証する。** アプリ層の検証を迂回した
  書き込みでも 4 件目は拒否される（D-1）。
- **累計 XP は `xp_events` の集計から導出する。** `player` 表に累計値を持たないため、
  台帳を経由しない加算が成立しない。
- **`ai_runs` は成功した実行のみを一意とする。** 失敗した実行が「本日は生成済み」と
  判定される事故を防ぐ（実装プラン S-4）。
- **ビューには `security_invoker` を指定している。** 既定ではビューは所有者の権限で実行され、
  参照元テーブルの RLS が適用されない。
