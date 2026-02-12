import logging
import os
import random
from datetime import date, timedelta
from typing import List, Optional, Tuple

import requests
from dotenv import load_dotenv

from services.market_data_provider import MarketDataProvider
from services.providers.yahoo_provider import YahooProvider


logger = logging.getLogger(__name__)


class SP500MarketService:
    """Service that fetches live pricing with an optional synthetic fallback."""

    def __init__(self, symbol: Optional[str] = None, provider: Optional[MarketDataProvider] = None):
        load_dotenv()
        self.symbol_map = {
            "SP500": symbol or os.getenv("SP500_SYMBOL", "^GSPC"),
            "TOPIX": os.getenv("TOPIX_SYMBOL", "1306.T"),
            "NIKKEI": os.getenv("NIKKEI_SYMBOL", "^N225"),
            "NIFTY50": os.getenv("NIFTY50_SYMBOL", "^NSEI"),
            "ORUKAN": os.getenv("ORUKAN_SYMBOL", "ACWI"),
            "orukan_jpy": os.getenv("ORUKAN_JPY_SYMBOL", os.getenv("ORUKAN_SYMBOL", "ACWI")),
            "sp500_jpy": os.getenv("SP500_JPY_SYMBOL", os.getenv("SP500_SYMBOL", "^GSPC")),
        }

        self.fx_symbol_map = {
            "orukan_jpy": os.getenv("ORUKAN_JPY_FX_SYMBOL", "JPY=X"),
            "sp500_jpy": os.getenv("SP500_JPY_FX_SYMBOL", "JPY=X"),
        }

        self.price_type_map = {
            "SP500": os.getenv("SP500_PRICE_TYPE", "index"),
            "TOPIX": os.getenv("TOPIX_PRICE_TYPE", "index"),
            "NIKKEI": os.getenv("NIKKEI_PRICE_TYPE", "index"),
            "NIFTY50": os.getenv("NIFTY50_PRICE_TYPE", "index"),
            "ORUKAN": "index",
            "orukan_jpy": "index_jpy",
            "sp500_jpy": "index_jpy",
        }

        self.nav_api_map = {
            "SP500": os.getenv("SP500_NAV_API_BASE"),
            "TOPIX": os.getenv("TOPIX_NAV_API_BASE"),
            "NIKKEI": os.getenv("NIKKEI_NAV_API_BASE"),
            "NIFTY50": os.getenv("NIFTY50_NAV_API_BASE"),
        }

        self.allow_synth_map = {
            "SP500": self._flag("SP500_ALLOW_SYNTHETIC_FALLBACK", default=True),
            "TOPIX": self._flag("TOPIX_ALLOW_SYNTHETIC_FALLBACK", default=True),
            "NIKKEI": self._flag("NIKKEI_ALLOW_SYNTHETIC_FALLBACK", default=True),
            "NIFTY50": self._flag("NIFTY50_ALLOW_SYNTHETIC_FALLBACK", default=True),
            "ORUKAN": True,
            "orukan_jpy": True,
            "sp500_jpy": True,
        }

        self.start_prices = {
            "SP500": 4000.0,
            "TOPIX": 1500.0,
            "NIKKEI": 15000.0,
            "NIFTY50": 4000.0,
            "ORUKAN": 15000.0,
            "orukan_jpy": 15000.0,
            "sp500_jpy": 4000.0,
        }

        self.provider = provider or self._resolve_provider_from_env()

        logger.info(
            "[MARKET CONFIG] symbols=%s fx_symbols=%s fallback=%s price_types=%s provider=%s",
            self.symbol_map,
            self.fx_symbol_map,
            self.allow_synth_map,
            self.price_type_map,
            self.provider.__class__.__name__,
        )

    def _resolve_provider_from_env(self) -> MarketDataProvider:
        provider_name = os.getenv("MARKET_DATA_PROVIDER", "yahoo").strip().lower()
        if provider_name in {"yahoo", "yfinance", ""}:
            return YahooProvider()
        raise ValueError(f"Unsupported MARKET_DATA_PROVIDER: {provider_name}")

    def _flag(self, name: str, default: bool = False) -> bool:
        raw = os.getenv(name)
        if raw is None:
            return default
        return raw.lower() in {"1", "true", "yes", "on"}

    def _resolve_symbol(self, index_type: str) -> str:
        return self.symbol_map.get(index_type, self.symbol_map["SP500"])

    def _resolve_fx_symbol(self, index_type: str) -> Optional[str]:
        return self.fx_symbol_map.get(index_type)

    def _resolve_nav_base(self, index_type: str) -> Optional[str]:
        return self.nav_api_map.get(index_type)

    def _allow_synthetic_for_index(self, index_type: str) -> bool:
        return self.allow_synth_map.get(index_type, True)

    def _resolve_price_type(self, index_type: str) -> Optional[str]:
        return self.price_type_map.get(index_type)

    def _fetch_index_history_jpy(self, start: date, end: date, index_type: str) -> List[Tuple[str, float]]:
        symbol = self._resolve_symbol(index_type)
        fx_symbol = self._resolve_fx_symbol(index_type)
        if not fx_symbol:
            raise ValueError("fx_symbol required for index_jpy")

        idx_close = self.provider.get_history(symbol, start, end)
        fx_close = self.provider.get_history(fx_symbol, start, end)

        fx_map = {d: px for d, px in fx_close}
        series = [(d, round(float(px) * float(fx_map[d]), 2)) for d, px in idx_close if d in fx_map]
        if not series:
            raise ValueError("no overlapping dates for index and fx")

        logger.info(
            "Using yfinance history for %s (symbol=%s fx_symbol=%s price_type=%s points=%d)",
            index_type,
            symbol,
            fx_symbol,
            self._resolve_price_type(index_type),
            len(series),
        )
        return series

    def _fetch_nav_history(self, start: date, end: date, index_type: str) -> List[Tuple[str, float]]:
        nav_base = self._resolve_nav_base(index_type)
        if not nav_base:
            return []

        symbol = self._resolve_symbol(index_type)
        price_type = self._resolve_price_type(index_type)

        try:
            resp = requests.get(
                f"{nav_base.rstrip('/')}/history",
                params={
                    "symbol": symbol,
                    "start": start.isoformat(),
                    "end": end.isoformat(),
                    "price_type": price_type,
                },
                timeout=10,
            )
            resp.raise_for_status()
            data = resp.json()
            if isinstance(data, list) and data:
                series = [
                    (str(item["date"]), float(item["close"]))
                    for item in data
                    if "date" in item and "close" in item
                ]
                logger.info(
                    "[NAV API] index=%s symbol=%s price_type=%s points=%d",
                    index_type,
                    symbol,
                    price_type,
                    len(series),
                )
                return series
        except Exception as exc:
            logger.warning("NAV API fallback due to error: %s", exc)
        return []

    def _fallback_history(self, start: date, end: date, index_type: str) -> List[Tuple[str, float]]:
        annual_drift_map = {
            "SP500": 0.07,
            "TOPIX": 0.04,
            "NIKKEI": 0.05,
            "NIFTY50": 0.08,
            "ORUKAN": 0.06,
            "orukan_jpy": 0.06,
            "sp500_jpy": 0.07,
        }
        annual_drift = annual_drift_map.get(index_type, 0.05)
        daily_drift = annual_drift / 260.0

        rng_seed = f"{index_type}:{start.isoformat()}:{end.isoformat()}"
        rng = random.Random(rng_seed)

        history: List[Tuple[str, float]] = []
        price = self.start_prices.get(index_type, 4000.0)

        current = start
        while current <= end:
            if current.weekday() < 5:
                noise = rng.uniform(-0.006, 0.006)
                if (current.timetuple().tm_yday // 182) % 2 == 1:
                    noise -= 0.002

                daily_change = 1 + daily_drift + noise
                price = max(1.0, price * daily_change)
                history.append((current.isoformat(), round(price, 2)))
            current += timedelta(days=1)

        return history

    def get_price_history(self, index_type: str = "SP500") -> List[Tuple[str, float]]:
        today = date.today()
        start = today - timedelta(days=365 * 5)
        allow_synth = self._allow_synthetic_for_index(index_type)
        try:
            price_type = self._resolve_price_type(index_type)
            if price_type == "index_jpy":
                return self._fetch_index_history_jpy(start, today, index_type)

            nav_hist = self._fetch_nav_history(start, today, index_type)
            if nav_hist:
                logger.info(
                    "Using NAV history for %s (symbol=%s price_type=%s points=%d)",
                    index_type,
                    self._resolve_symbol(index_type),
                    price_type,
                    len(nav_hist),
                )
                return [(d, round(v, 2)) for d, v in nav_hist]

            symbol = self._resolve_symbol(index_type)
            closes = self.provider.get_history(symbol, start, today)
            logger.info(
                "Using yfinance history for %s (symbol=%s price_type=%s points=%d)",
                index_type,
                symbol,
                price_type,
                len(closes),
            )
            return closes
        except Exception as exc:
            logger.warning("Price history fetch failed (%s)", exc, exc_info=True)
            if not allow_synth:
                raise
            fallback = self._fallback_history(start, today, index_type)
            logger.info(
                "Using synthetic history for %s (symbol=%s price_type=%s points=%d)",
                index_type,
                self._resolve_symbol(index_type),
                self._resolve_price_type(index_type),
                len(fallback),
            )
            return fallback

    def get_price_history_range(
        self, start: date, end: date, allow_fallback: bool = True, index_type: str = "SP500"
    ) -> List[Tuple[str, float]]:
        allow_synth = self._allow_synthetic_for_index(index_type)
        fallback_allowed = allow_fallback and allow_synth
        try:
            price_type = self._resolve_price_type(index_type)
            if price_type == "index_jpy":
                return self._fetch_index_history_jpy(start, end, index_type)

            nav_hist = self._fetch_nav_history(start, end, index_type)
            if nav_hist:
                logger.info(
                    "Using NAV history for %s (symbol=%s price_type=%s points=%d)",
                    index_type,
                    self._resolve_symbol(index_type),
                    price_type,
                    len(nav_hist),
                )
                return [(d, round(v, 2)) for d, v in nav_hist]

            symbol = self._resolve_symbol(index_type)
            closes = self.provider.get_history(symbol, start, end)
            logger.info(
                "Using yfinance history for %s (symbol=%s price_type=%s points=%d)",
                index_type,
                symbol,
                price_type,
                len(closes),
            )
            return closes
        except Exception as exc:
            logger.warning("Price history fetch failed (%s)", exc, exc_info=True)
            if not fallback_allowed:
                raise
            fallback = self._fallback_history(start, end, index_type)
            logger.info(
                "Using synthetic history for %s (symbol=%s price_type=%s points=%d)",
                index_type,
                self._resolve_symbol(index_type),
                self._resolve_price_type(index_type),
                len(fallback),
            )
            return fallback

    def get_usd_jpy(self) -> float:
        try:
            today = date.today()
            fx_hist = self.provider.get_history("JPY=X", today - timedelta(days=10), today)
            if fx_hist:
                return round(float(fx_hist[-1][1]), 4)
        except Exception:
            pass
        return 150.0

    def get_fund_nav_jpy(self, sp_price_usd: float, usd_jpy: float) -> float:
        fund_symbol = os.getenv("SP500_FUND_SYMBOL", "03311187.T")
        try:
            today = date.today()
            fund_hist = self.provider.get_history(fund_symbol, today - timedelta(days=40), today)
            if fund_hist:
                return round(float(fund_hist[-1][1]), 2)
        except Exception:
            pass

        return round(sp_price_usd * usd_jpy, 2)

    def get_current_price(
        self, history: Optional[List[Tuple[str, float]]] = None, index_type: str = "SP500"
    ) -> float:
        price_type = self._resolve_price_type(index_type)
        try:
            if price_type == "index_jpy":
                symbol = self._resolve_symbol(index_type)
                fx_symbol = self._resolve_fx_symbol(index_type)
                if not fx_symbol:
                    raise ValueError("fx_symbol required for index_jpy")

                live, _ = self.provider.get_current_price(symbol)
                fx_live, _ = self.provider.get_current_price(fx_symbol)
                return round(float(live) * float(fx_live), 2)

            live, _ = self.provider.get_current_price(self._resolve_symbol(index_type))
            return round(float(live), 2)
        except Exception:
            pass

        if history:
            return history[-1][1]
        today = date.today()
        synthetic = self._fallback_history(today - timedelta(days=30), today, index_type)
        return synthetic[-1][1]

    def build_price_series_with_ma(self, history: List[Tuple[str, float]]):
        closes = [p[1] for p in history]
        dates = [p[0] for p in history]

        def moving_avg(window: int) -> List[Optional[float]]:
            results: List[Optional[float]] = []
            running_sum = 0.0
            for i, price in enumerate(closes):
                running_sum += price
                if i >= window:
                    running_sum -= closes[i - window]
                if i + 1 >= window:
                    results.append(round(running_sum / window, 2))
                else:
                    results.append(None)
            return results

        ma20 = moving_avg(20)
        ma60 = moving_avg(60)
        ma200 = moving_avg(200)

        series = []
        for idx, date_str in enumerate(dates):
            series.append(
                {
                    "date": date_str,
                    "close": closes[idx],
                    "ma20": ma20[idx],
                    "ma60": ma60[idx],
                    "ma200": ma200[idx],
                }
            )
        return series
