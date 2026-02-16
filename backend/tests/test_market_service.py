import os
import sys
from datetime import date

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from services.market_data_provider import MarketDataProvider
from services.price_history_service import PriceHistoryService
from services.providers.yahoo_provider import YahooProvider
from services.sp500_market_service import SP500MarketService


class MockProvider(MarketDataProvider):
    def get_current_price(self, symbol: str) -> tuple[float, str]:
        return 123.45, "mock"

    def get_history(self, symbol: str, start: date, end: date) -> list[tuple[str, float]]:
        return [
            (start.isoformat(), 100.0),
            (end.isoformat(), 101.5),
        ]


def test_market_service_uses_yahoo_provider_by_default(monkeypatch):
    monkeypatch.delenv("MARKET_DATA_PROVIDER", raising=False)
    service = SP500MarketService(symbol="TEST")
    assert isinstance(service.provider, YahooProvider)


def test_price_history_service_works_with_mock_provider():
    market_service = SP500MarketService(symbol="TEST", provider=MockProvider())
    price_history_service = PriceHistoryService(market_service)

    start = date(2020, 1, 1)
    end = date(2020, 1, 3)
    history = price_history_service.get_history("SP500", start, end)

    assert history == [
        (start.isoformat(), 100.0),
        (end.isoformat(), 101.5),
    ]
