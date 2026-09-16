# Supabase と Vercel の設定手順

> S3（認証と画面の骨組み）を動かすために必要な、ダッシュボード側の設定をまとめる。
> コードの変更を伴わない作業のみを扱う。

---

## 1. 環境変数

リポジトリ直下で雛形を複製する。

```bash
cp .env.local.example .env.local
```

`.env.local` に次の 2 つを設定する。いずれも Supabase ダッシュボードから取得する。

| 変数 | 取得元 |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Settings → API Keys → Publishable and secret API keys → publishable キー |

`.env.local` は `.gitignore` の対象であり、コミットされない。

---

## 2. 認証の設定

### 2.1 URL の許可

Authentication → URL Configuration を開く。

| 項目 | 値 |
|---|---|
| Site URL | `http://localhost:3000`（本番公開後は Vercel の URL に変更する） |
| Redirect URLs | `http://localhost:3000/**` を追加する。本番公開後は Vercel の URL も追加する |

ここに登録されていない URL へは転送されない。ログインのリンクを踏んでも
戻ってこられない場合、まずここを疑う。

### 2.2 メールテンプレートの差し替え（必須）

Authentication → Emails → **Magic Link** を開き、本文中のリンクを次のように差し替える。

```html
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=magiclink">
  ログインする
</a>
```

**この差し替えを省略するとログインできない。**

既定のテンプレートは `{{ .ConfirmationURL }}` を使う。この URL はトークンを
URL のフラグメント（`#` 以降）に載せて返す。フラグメントはサーバーへ送られない
仕様であるため、サーバー側でセッションを確立できない。
`token_hash` を問い合わせ文字列で受け取り、サーバー側で検証する形にする必要がある。

### 2.3 最初の利用者を作る

Authentication → Users → **Add user** → **Create new user** から、自分の
メールアドレスで利用者を 1 件作る。

アプリ側は `shouldCreateUser: false` で動作する。メールアドレスを入力するだけで
誰でも登録できる状態にしないためである。したがって最初の 1 人は手で作る。

利用者を作成すると、`public.player` の行がトリガーによって自動生成される。
次で確認できる。

```sql
select user_id, rest_tokens, current_streak from public.player;
```

---

## 3. 動作確認

```bash
npm install
npm run dev
```

`http://localhost:3000` を開き、次を確認する。

| 操作 | 期待する結果 |
|---|---|
| `/` を開く | `/login` へ転送される |
| `/today` を開く | `/login` へ転送される |
| 登録済みのメールアドレスを入力して送信 | 「リンクを送りました」と表示される |
| 届いたメールのリンクを開く | `/today` が表示される |
| 未登録のメールアドレスを入力して送信 | エラーが表示される（利用者は作られない） |

`/today` が表示された時点で、データアクセス層が実データに対して動作している
ことになる。空状態の文言が出ていれば、クエリ自体は成功している。

---

## 4. Vercel との接続

アプリが動くようになってから行う。

1. Vercel Dashboard → 対象プロジェクト → **Settings → Integrations**
2. **Browse Marketplace** → Supabase を検索 → **Add Integration**
3. Vercel から Supabase アカウントへのアクセスを許可し、両者のプロジェクトを紐づける

`NEXT_PUBLIC_SUPABASE_URL` と `NEXT_PUBLIC_SUPABASE_ANON_KEY` が自動で同期される。

接続後、Supabase 側の Site URL と Redirect URLs に Vercel の URL を追加すること。
これを忘れると、本番環境でログインのリンクが機能しない。

---

## 5. うまくいかないとき

| 症状 | 確認する箇所 |
|---|---|
| リンクを踏んでも `/login` に戻される | メールテンプレートを差し替えたか（2.2） |
| リンクを踏むと `error=expired_link` | リンクは一度しか使えない。再送する |
| 「送信に失敗しました」と出る | 利用者を作成済みか（2.3）。未登録のアドレスでは送信されない |
| ログイン直後に再びログイン画面へ戻る | Redirect URLs に登録済みか（2.1） |
| メールが届かない | 無料枠の送信数には上限がある。Authentication → Logs を確認する |
