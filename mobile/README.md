# mobile (Expo TypeScript)

iOS 向けに Web Dashboard と同等の「構造・挙動」を再現する MVP です。

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
EXPO_PUBLIC_API_BASE_URL=http://localhost:8000
```

## 起動（iOS）

```bash
cd mobile
npm run ios
```

シミュレータなしで Metro のみ起動する場合:

```bash
npm run start
```

## Web 同等 UI の確認手順

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

## 実装メモ

- Push 通知は本 PR の対象外
- 型は `../shared/types.ts` を利用し、mobile 内の二重定義を避ける
- API 呼び出しは `../shared/api.ts` の `evaluateIndex` を利用
