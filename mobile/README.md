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
EXPO_PUBLIC_BACKEND_URL=https://time-to-sell-web-ios.onrender.com
# 任意: WebViewのデバッグログ
EXPO_PUBLIC_WEBVIEW_DEBUG=1
```

Dashboard 表示URLは以下を優先します。

```bash
EXPO_PUBLIC_DASHBOARD_URL=https://time-to-sell-web-2.vercel.app/
```

未設定時は `https://time-to-sell-web-2.vercel.app/` を使用します。

Push登録先の backend は `EXPO_PUBLIC_BACKEND_URL` を優先し、未設定時は
`https://time-to-sell-web-ios.onrender.com` を使用します。

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
   - `/api/push/register` を Try it out
       `{"install_id":"<install_id>","expo_push_token":"ExponentPushToken[...]","index_type":"SP500","threshold":80,"paid":false}`
   - `/api/push/test` を Try it out
     - token 直指定（切り分け）
       `{"expo_push_token":"ExponentPushToken[...]","title":"テスト","body":"通知テスト"}`
     - install_id 指定（本命導線）
       `{"install_id":"<install_id>","title":"テスト","body":"通知テスト"}`

5. 実機で通知受信を確認

## Dashboard UI の確認手順（Web版一致）

1. Dashboard タブを開き、`https://time-to-sell-web-2.vercel.app/` が全画面で表示されることを確認
2. 「売り時くん」見出し、対象インデックス、総合スコア、時間軸カードがWeb版と一致することを確認
3. 「重要イベント」が表示されることを確認
4. チャート見た目がWeb版と一致することを確認
5. 外部ドメイン遷移時にOSブラウザで開くことを確認
6. 下方向スワイプでPull to Refreshが効くことを確認
7. オフライン時にエラー表示と再読み込みボタンが出ることを確認

## Push 通知の確認（backend API）

1. iOS の通知権限を許可してアプリ起動
2. Xcode / EAS logs で `"[push] token 取得成功"` を確認
3. `"[push] register 成功"` が出れば backend 登録完了（install_id も同時に確認）

curl 例:

```bash
curl -X POST https://time-to-sell-web-ios.onrender.com/api/push/register \
  -H "Content-Type: application/json" \
  -d '{"install_id":"ios-install-xxxx","expo_push_token":"ExponentPushToken[xxxx]","index_type":"SP500","threshold":80,"paid":false}'

curl -X POST https://time-to-sell-web-ios.onrender.com/api/push/test \
  -H "Content-Type: application/json" \
  -d '{"install_id":"ios-install-xxxx","title":"テスト","body":"通知テスト"}'
```

`/api/push/test` は token 省略時、最後に登録された token に送信します。

PowerShell (Invoke-WebRequest) 例:

```powershell
$registerBody = @{
  install_id = "ios-install-xxxx"
  expo_push_token = "ExponentPushToken[xxxx]"
  index_type = "SP500"
  threshold = 80
  paid = $false
} | ConvertTo-Json

Invoke-WebRequest -UseBasicParsing `
  -Uri "https://time-to-sell-web-ios.onrender.com/api/push/register" `
  -Method POST `
  -ContentType "application/json" `
  -Body $registerBody

$testBody = @{
  install_id = "ios-install-xxxx"
  title = "テスト"
  body = "通知テスト"
} | ConvertTo-Json

Invoke-WebRequest -UseBasicParsing `
  -Uri "https://time-to-sell-web-ios.onrender.com/api/push/test" `
  -Method POST `
  -ContentType "application/json" `
  -Body $testBody
```


## 検証手順（Expo Goは使用しない）

> このプロジェクトは SDK 52 のため、iOS Expo Go（SDK 54）では検証しません。development build または TestFlight を使用してください。

### Windows PowerShell

```powershell
cd mobile
npm install
npx expo start --dev-client
```

### iOS development build

```powershell
cd mobile
eas build --profile development --platform ios
```

### TestFlight向け production build

```powershell
cd mobile
eas build --profile production --platform ios
```

確認観点:
- DashboardタブでWeb版と同一の見た目（見出し、重要イベント、チャート）
- Pull to Refresh が動作
- 外部URLがSafariで開く
- オフライン時にエラー表示＋再読み込みボタン
- ノッチ/ステータスバーで上部が欠けない


> Expo Push Token は `getExpoPushTokenAsync({ projectId })` で取得しています。`projectId` が取れない場合は Push Debug 画面に理由が表示されます。
