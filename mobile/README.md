# mobile (Expo TypeScript)

iOS 向けに Web Dashboard と同等の「構造・挙動」を再現しつつ、Push 通知MVP（トークン取得→register→test受信）を含む構成です。

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

## Dashboard UI の確認手順

1. Dashboard タブを開く
2. 対象インデックスを選択して evaluate を取得
3. 総合スコアカードで `scores.total` が固定で表示されることを確認
4. 時間軸タブ（短期/中期/長期）を切り替え、以下が連動することを確認
   - `period_breakdowns[viewKey]` の内訳
   - 指標（d / T_base / T_trend / macro_M）
   - `period_scores[viewKey]`
   - 期間説明文
5. チャート表示期間がタブに応じて切り替わることを確認
   - short: 1ヶ月
   - mid: 6ヶ月
   - long: 1年
