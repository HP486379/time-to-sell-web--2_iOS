# mobile (Expo TypeScript)

iOS は Dashboard を **全画面 WebView** で表示し、iOS専用 frontend（https://time-to-sell-web-ios.vercel.app/）と UI/機能を一致させる構成です。

## セットアップ

```bash
cd mobile
npm install
```

## 環境変数

```bash
EXPO_PUBLIC_API_BASE_URL=https://time-to-sell-web-2.vercel.app
EXPO_PUBLIC_BACKEND_URL=https://time-to-sell-web-ios.onrender.com
EXPO_PUBLIC_DASHBOARD_URL=https://time-to-sell-web-ios.vercel.app/
# 任意: WebView ログ
EXPO_PUBLIC_WEBVIEW_DEBUG=1
```

## 実装メモ

- アプリ内画面は Dashboard のみ表示
- Dashboard は同一ドメインを WebView 内で表示
- 外部ドメイン遷移は OS ブラウザで開く
- Pull to Refresh 有効
- 読み込み中スピナー、失敗時は再読み込み UI を表示
- 通知許可を拒否しても Dashboard の利用は継続可能
- 通知登録処理は失敗してもアプリ動作を継続する

## アイコン運用

- 現在 `expo.icon` / `expo.ios.icon` は `../frontend/public/assets/icon.png` を参照
- アイコン画像バイナリの差し替えはこのPRでは行わず、必要に応じてユーザー側で実施

## iOS build

```bash
cd mobile
eas build --profile production --platform ios
```

## 検証観点

- Dashboard が正常に表示される
- 外部 URL が Safari で開く
- Pull to Refresh が動作する
- オフライン時にエラー UI が表示される
- 通知許可を拒否してもアプリが継続利用できる
