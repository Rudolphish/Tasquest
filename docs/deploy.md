# デプロイ手順（Vercel）

> 手元だけで動かしている状態から、どこからでも使える状態にする手順をまとめる。
> コードの変更は不要である。設定のみを扱う。

---

## 1. なぜ運用検証の前にデプロイするか

実装プラン S4 の完了後、1 週間の運用検証を挟む。この検証で確かめたいのは
「記録が継続するか」である。

手元でのみ動く状態では、記録を書くたびに開発サーバーを起動して
ブラウザで localhost を開く必要がある。これでは「記録が続くか」ではなく
「開発機を開くか」を測ることになり、検証として成立しない。

記録は移動中や就寝前に携帯から書くものである。したがって、運用検証の前に
デプロイする。

---

## 2. コード側の前提

コードに `localhost` は含まれていない。ホスト名に依存する箇所は
ログイン用リンクの組み立てのみであり、これは Origin ヘッダーから
実行時に決まる。したがってデプロイにあたりコードの変更は不要である。

必要な環境変数は次の 2 つのみ。

| 変数 | 用途 |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase プロジェクトの URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | publishable キー |

いずれもブラウザへ露出する前提の値である。RLS が有効であるため、
これらが公開されても他人のデータは読めない。

---

## 3. 手順

### 3.1 デプロイ対象を main に揃える

Vercel の本番デプロイは既定で `main` を追跡する。作業ブランチの内容を
先に `main` へ取り込んでおく。

### 3.2 Vercel プロジェクトを作る

1. Vercel Dashboard → **Add New → Project**
2. GitHub の `Tasquest` リポジトリを選ぶ
3. Framework Preset が **Next.js** になっていることを確認する
4. 環境変数はこの時点では設定せず、次へ進む（3.3 で自動同期させる）

初回のデプロイは環境変数が無いため失敗しうる。3.3 の後に再実行する。

### 3.3 Supabase と接続する

1. Vercel Dashboard → 対象プロジェクト → **Settings → Integrations**
2. **Browse Marketplace** → Supabase を検索 → **Add Integration**
3. Vercel から Supabase アカウントへのアクセスを許可し、両者のプロジェクトを紐づける

`NEXT_PUBLIC_SUPABASE_URL` と `NEXT_PUBLIC_SUPABASE_ANON_KEY` が
Vercel 側へ自動で同期される。

手動で設定する場合は、Settings → Environment Variables から同じ 2 つを
Production と Preview の双方に追加する。

### 3.4 再デプロイする

Deployments → 最新のデプロイ → **Redeploy**。
環境変数が入った状態でビルドし直す。

### 3.5 Supabase 側の URL を更新する

**この作業を省略するとログインできない。**

Supabase ダッシュボード → Authentication → **URL Configuration**

| 項目 | 値 |
|---|---|
| Site URL | Vercel の本番 URL（例: `https://tasquest.vercel.app`） |
| Redirect URLs | 本番 URL に `/**` を付けたものを追加する。`http://localhost:3000/**` は手元での開発用に残す |

Site URL はメール本文中のリンクの起点になる。ここが localhost のままだと、
携帯でリンクを踏んでも手元の開発サーバーへ飛ぼうとして失敗する。

### 3.6 動作を確認する

本番 URL を携帯で開き、次を確認する。

| 操作 | 期待する結果 |
|---|---|
| 本番 URL を開く | `/login` へ転送される |
| メールアドレスを入力して送信 | リンクが届く |
| 携帯でリンクを開く | `/today` が表示される |
| 目標とクエストを 1 件ずつ作る | 保存され、再読み込みしても残る |

---

## 4. 携帯のホーム画面に追加する

毎日開く導線を短くする。ブラウザで本番 URL を開き、共有メニューから
ホーム画面へ追加する。

---

## 5. 留意点

| 項目 | 内容 |
|---|---|
| 公開範囲 | 本番 URL を知っていれば誰でもログイン画面に到達する。ただし `shouldCreateUser` が false であるため、登録済みのアドレス以外では先へ進めない |
| Supabase の一時停止 | 無料プロジェクトは 7 日間無操作で停止する。毎日使う前提であれば問題にならない |
| 送信数の上限 | 組み込みのメール送信には上限がある。ログインを繰り返し試すと一時的に届かなくなる |
| プレビュー環境 | ブランチごとに URL が変わる。プレビューでもログインしたい場合は、その URL を Redirect URLs へ追加する必要がある |

---

## 6. フレームワークの判定について

Vercel はプロジェクトの作成時にフレームワークを自動判定し、その結果を
設定として保持する。本リポジトリでは Next.js アプリより先に Vercel
プロジェクトを作成したため、判定結果が "Other" のまま固定され、
ビルドは成功するのに成果物が見つからないという失敗が起きた。

```
Error: No Output Directory named "public" found after the Build completed.
```

"Other" の場合、Vercel は `public` ディレクトリを成果物として探す。
Next.js の成果物は `.next` にあるため、見つからない。

リポジトリ直下の `vercel.json` で判定結果を上書きしている。

```json
{ "framework": "nextjs" }
```

`vercel.json` の設定はダッシュボードの設定より優先される。プロジェクトを
作り直しても同じ設定が再現されるため、ダッシュボード側での変更よりも
こちらを正とする。

ダッシュボードから直す場合は、Settings → Build and Deployment →
Framework Settings で Framework Preset を Next.js に変更し、再デプロイする。
