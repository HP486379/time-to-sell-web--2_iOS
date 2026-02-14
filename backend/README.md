# backend 補足

## Market Data Provider の差し替えポイント

- 抽象インターフェース: `services/market_data_provider.py`
- デフォルト実装: `services/providers/yahoo_provider.py`
- 利用側: `services/sp500_market_service.py`（`provider` 注入対応）

`PriceHistoryService` / `BacktestService` が期待する履歴形式は次のままです。

- `list[tuple[str, float]]`（`[(date_iso, close), ...]`）

## 環境変数

- `MARKET_DATA_PROVIDER`
  - `yahoo`（デフォルト）: `YahooProvider` を利用
  - それ以外: 現時点では未実装のため例外

既存APIのレスポンス挙動は維持しており、`source` は引き続き `yfinance` / `yfinance_fx` を返します。
