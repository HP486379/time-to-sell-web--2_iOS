from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import date, timedelta
from pathlib import Path
from typing import Dict, List, Optional


@dataclass
class ManualCalendarProvider:
    """手動で管理する経済イベントカレンダー."""

    path: Path

    def load_events(self) -> List[Dict]:
        """JSON ファイルからイベント一覧を読み込む。

        期待するフォーマット:
        [
          { "name": "FOMC", "date": "2025-01-29", "importance": 5 },
          ...
        ]
        """
        try:
            with self.path.open("r", encoding="utf-8") as f:
                raw = json.load(f)
        except FileNotFoundError:
            return []
        except Exception:
            # もし壊れた JSON でもアプリ全体が落ちないようにする
            return []

        events: List[Dict] = []
        for ev in raw:
            try:
                d = date.fromisoformat(ev["date"])
            except Exception:
                # 日付がおかしいレコードはスキップ
                continue

            events.append(
                {
                    "name": ev.get("name", ""),
                    "date": d,
                    "importance": int(ev.get("importance", 3)),
                }
            )
        return events


def load_manual_events(path: Path) -> List[Dict]:
    """main.py から使うユーティリティ関数."""
    provider = ManualCalendarProvider(path=path)
    return provider.load_events()


class EventService:
    """FOMC / 雇用統計 / CPI をヒューリスティックに生成しつつ、
    あれば手動カレンダー JSON を優先して使うサービス。
    """

    def __init__(self, manual_events: Optional[List[Dict]] = None):
        # manual_events は date 型を持つ dict のリストを想定
        self._manual_events = manual_events or []

    # ===== ヒューリスティック生成 =====

    def _compute_third_wednesday(self, target: date) -> date:
        first_day = target.replace(day=1)
        weekday = first_day.weekday()  # Monday=0
        # Wednesday is 2
        offset = (2 - weekday) % 7
        third_wed = first_day + timedelta(days=offset + 14)
        return third_wed

    def _first_friday(self, target: date) -> date:
        first_day = target.replace(day=1)
        weekday = first_day.weekday()
        # Friday is 4
        offset = (4 - weekday) % 7
        first_fri = first_day + timedelta(days=offset)
        return first_fri

    def _tenth_day(self, target: date) -> date:
        return target.replace(day=10)

    def _monthly_events_fallback(self, target: date) -> List[Dict]:
        """与えられた月を中心に FOMC / 雇用統計 / CPI を生成."""
        base = target.replace(day=1)

        fomc = self._compute_third_wednesday(base)
        nfp = self._first_friday(base)
        cpi = self._tenth_day(base)

        events = [
            {"name": "FOMC", "date": fomc, "importance": 5},
            {"name": "Nonfarm Payrolls", "date": nfp, "importance": 4},
            {"name": "CPI", "date": cpi, "importance": 4},
        ]
        return events

    # ===== パブリック API =====

    def _filter_window(self, events: List[Dict], target: date) -> List[Dict]:
        """target の前後 [-7, +30] 日に入るイベントだけに絞る."""
        window_days = 30
        windowed = [
            ev
            for ev in events
            if -7 <= (ev["date"] - target).days <= window_days
        ]
        return sorted(windowed, key=lambda e: e["date"])

    def get_events_for_date(self, target: date) -> List[Dict]:
        # 1. 手動カレンダーを優先
        manual = self._filter_window(self._manual_events, target) if self._manual_events else []

        if manual:
            return manual

        # 2. 無ければヒューリスティック生成にフォールバック
        fallback_events = self._monthly_events_fallback(target)
        return self._filter_window(fallback_events, target)

    def get_events(self) -> List[Dict]:
        return self.get_events_for_date(date.today())
