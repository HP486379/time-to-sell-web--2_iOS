from __future__ import annotations

from abc import ABC, abstractmethod
from datetime import date


class MarketDataProvider(ABC):
    @abstractmethod
    def get_current_price(self, symbol: str) -> tuple[float, str]:
        """Return (price, provider_source)."""

    @abstractmethod
    def get_history(self, symbol: str, start: date, end: date) -> list[tuple[str, float]]:
        """Return [(date_iso, close), ...]."""
