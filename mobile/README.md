# mobile (Expo TypeScript)

iOS は Dashboard タブを **全画面WebView** で表示し、Web版（https://time-to-sell-web-2.vercel.app/）とUI/機能を一致させる構成です。Backtest / Push Debug タブは既存のまま残しています。

## セットアップ

```bash
cd mobile
npm install
```

## 環境変数

Expo の public env を利用します。

```bash
EXPO_PUBLIC_API_BASE_URL=https://time-to-sell-web-2.vercel.app
```

Dashboard 表示URLは以下を優先します。

```bash
EXPO_PUBLIC_DASHBOARD_URL=https://time-to-sell-web-2.vercel.app/
```

未設定時は `https://time-to-sell-web-2.vercel.app/` を使用します。

WebView 挙動:
- 同一ドメイン遷移はアプリ内WebView
- 外部ドメインはOS標準ブラウザで開く
- Pull to Refresh 有効
- 読み込み中はスピナー表示、失敗時は再読み込みボタン表示


ローカル backend に向ける場合の例:

```bash
EXPO_PUBLIC_API_BASE_URL=http://192.168.x.x:8000
```

> iPhone 実機から backend へ送る場合、`localhost` は使えません。Windows/Mac の LAN IP を使ってください。

## iOS 実機での Push 検証手順（development build 前提）

> Push は Expo Go ではなく development build を推奨します。

1. EAS 設定

```bash
cd mobile
eas build:configure
```

2. iOS development build

```bash
eas build --profile development --platform ios
```

3. 実機にインストールして起動
   - 起動時に通知権限ダイアログを許可
   - `Push Debug` タブを開く
   - 自動取得または「Push Tokenを取得」ボタンで token を取得
   - token は画面に表示され、「コピー」ボタンでクリップボードへ保存可能
   - 権限拒否時は画面上に理由を表示

4. backend 側で test 送信（最短導線）
   - backend 起動

```bash
cd backend
uvicorn main:app --reload --port 8000
```

   - Swagger: `http://localhost:8000/docs`
   - `/api/push/test` を Try it out
     - token 直指定（切り分け）
       `{"expo_push_token":"ExponentPushToken[...]"}`
     - install_id 指定（本命導線）
       `{"install_id":"<install_id>"}`

5. 実機で通知受信を確認

## Dashboard UI の確認手順（Web版一致）

1. Dashboard タブを開き、`https://time-to-sell-web-2.vercel.app/` が全画面で表示されることを確認
2. 「売り時くん」見出し、対象インデックス、総合スコア、時間軸カードがWeb版と一致することを確認
3. 「重要イベント」が表示されることを確認
4. チャート見た目がWeb版と一致することを確認
5. 外部ドメイン遷移時にOSブラウザで開くことを確認
6. 下方向スワイプでPull to Refreshが効くことを確認
7. オフライン時にエラー表示と再読み込みボタンが出ることを確認
