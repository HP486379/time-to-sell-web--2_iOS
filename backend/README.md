# backend 運用メモ

## Push 自動通知（SP500）

登録済みデバイス（`/api/push/register`）を対象に、手動または定期実行で判定・送信します。

### エンドポイント

- `POST /api/push/register`
  - body: `{ install_id, expo_push_token, index_type, threshold, paid }`
- `POST /api/push/test`
  - body: `{ expo_push_token?, install_id?, title, body }`
- `POST /api/push/run`
  - body省略可（または `{ "index_type": "SP500" }`）
  - 判定: `score >= threshold` の端末へ送信
  - スパム抑制: `last_notified_on` から24時間以内は再通知しない

### 手動トリガ（curl）

```bash
curl -X POST http://localhost:8000/api/push/run \
  -H "Content-Type: application/json" \
  -d '{"index_type":"SP500"}'
```

### 手動トリガ（PowerShell）

```powershell
$body = @{ index_type = "SP500" } | ConvertTo-Json
Invoke-WebRequest -UseBasicParsing `
  -Uri "http://localhost:8000/api/push/run" `
  -Method POST `
  -ContentType "application/json" `
  -Body $body
```

### Render Cron 運用例

1. Web Service をデプロイ
2. Render Cron Job（または外部cron）から `/api/push/run` を定期POST
3. 最初は5〜15分間隔で様子を見て、必要に応じて間隔を調整

例（外部cron）:

```bash
curl -X POST https://time-to-sell-web-ios.onrender.com/api/push/run \
  -H "Content-Type: application/json" \
  -d '{"index_type":"SP500"}'
```

> 無料プランではスリープ復帰遅延があるため、初回レスポンスが遅い場合があります。


## Widget API (iOS WidgetKit)

### エンドポイント

- `GET /api/widget/summary?index_type=sp500`
  - `index_type` は `SP500` のみ許可（それ以外は `400`）
  - response: `{ score, judgment, updated_at }`

### 動作確認（curl）

```bash
curl "https://time-to-sell-web-ios.onrender.com/api/widget/summary?index_type=sp500"
```

### 動作確認（PowerShell）

```powershell
Invoke-WebRequest -UseBasicParsing `
  -Uri "https://time-to-sell-web-ios.onrender.com/api/widget/summary?index_type=sp500" `
  -Method GET
```
