from __future__ import annotations

from datetime import date, timedelta

import pandas as pd
import yfinance as yf

from services.market_data_provider import MarketDataProvider


class YahooProvider(MarketDataProvider):
    source = "yfinance"

    def _extract_close_series(self, hist: pd.DataFrame) -> pd.Series:
        close = hist.get("Close")
        if close is None:
            close = hist.get("Adj Close")
        if close is None:
            raise ValueError("close column missing")
        if isinstance(close, pd.DataFrame):
            close = close.iloc[:, 0]
        return close.dropna()

    def _to_iso_date(self, idx) -> str:
        try:
            return idx.date().isoformat()
        except AttributeError:
            try:
                return idx.to_pydatetime().date().isoformat()  # type: ignore[attr-defined]
            except Exception:
                return str(idx)

    def get_history(self, symbol: str, start: date, end: date) -> list[tuple[str, float]]:
        hist = yf.download(symbol, start=start, end=end + timedelta(days=1), interval="1d")
        hist = hist.dropna()
        closes = self._extract_close_series(hist)
        if closes.empty:
            raise ValueError(f"empty history for {symbol}")
        return [(self._to_iso_date(idx), round(float(val), 2)) for idx, val in closes.items()]

    def get_current_price(self, symbol: str) -> tuple[float, str]:
        ticker = yf.Ticker(symbol)
        live = ticker.fast_info.get("lastPrice") if ticker.fast_info else None
        if live:
            return round(float(live), 2), self.source

        hist = ticker.history(period="5d", interval="1d")
        hist = hist.dropna()
        closes = self._extract_close_series(hist)
        if closes.empty:
            raise ValueError(f"empty current history for {symbol}")
        return round(float(closes.iloc[-1]), 2), self.source
