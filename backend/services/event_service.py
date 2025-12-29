# backend/services/event_service.py
from __future__ import annotations

from datetime import date, timedelta
from pathlib import Path
from typing import Dict, List, Optional
import json
import logging

logger = logging.getLogger(__name__)


class EventService:
    """
    経済イベント取得サービス

    優先順位:
      1. 手動イベント JSON (例: backend/data/us_events.json)
      2. ヒューリスティック（月次の近似スケジュール）

    ※ TradingEconomics など外部カレンダー API には依存しない。
    """

    def __init__(self, manual_events_path: Optional[Path] = None) -> None:
        # デフォルト: backend/services/ から見て ../data/us_events.json
        if manual_events_path is None:
            manual_events_path = (
                Path(__file__).resolve().parent.parent / "data" / "us_events.json"
            )

        self.manual_events_path = manual_events_path
        self._manual_events: List[Dict] = self._load_manual_events()

    # ======================
    # 手動イベント JSON 読み込み
    # ======================

    def _load_manual_events(self) -> List[Dict]:
        """
        us_events.json を読み込み、内部的に
        {"name": str, "date": date, "importance": int}
        の形にして返す。
        """
        if not self.manual_events_path.exists():
            logger.warning(
                "Manual events JSON not found: %s", self.manual_events_path
            )
            return []

        try:
            with self.manual_events_path.open("r", encoding="utf-8") as f:
                raw = json.load(f)
        except Exception:
            logger.exception("Failed to load manual events JSON")
            return []

        events: List[Dict] = []
        for item in raw:
            try:
                name = (item.get("name") or "").strip()
                date_str = item.get("date")
                importance = int(item.get("importance", 1))

                if not name or not date_str:
                    continue

                d = date.fromisoformat(date_str)

                events.append(
                    {
                        "name": name,
                        "date": d,
                        "importance": importance,
                    }
                )
            except Exception:
                logger.exception("Failed to parse manual event item: %s", item)
                continue

        logger.info("Loaded %d manual events from %s", len(events), self.manual_events_path)
        return events

    # ======================
    # ヒューリスティック（既存ロジックを温存）
    # ======================

    def _compute_third_wednesday(self, target: date) -> date:
        first_day = target.replace(day=1)
        weekday = first_day.weekday()
        # Wednesday is 2
        offset = (2 - weekday) % 7
        third_wed = first_day + timedelta(days=offset + 14)
        return third_wed

    def _first_friday(self, target: date) -> date:
        first_day = target.replace(day=1)
        weekday = first_day.weekday()
        offset = (4 - weekday) % 7  # Friday is 4
        return first_day + timedelta(days=offset)

    def _cpi_release_day(self, target: date) -> date:
        # Approximate: 10日をデフォルトとする（実運用では手動 JSON を優先）
        day = 10
        return target.replace(day=day)

    def _monthly_events_fallback(self, today: date) -> List[Dict]:
        """
        手動 JSON にイベントがない場合のための近似スケジュール。
        2ヶ月分の FOMC / CPI / NFP を吐き出す。
        """
        month_ref = today.replace(day=1)
        next_month = (month_ref.replace(day=28) + timedelta(days=4)).replace(day=1)
        candidates = [month_ref, next_month]
        events: List[Dict] = []
        for month in candidates:
            events.extend(
                [
                    {
                        "name": "FOMC",
                        "importance": 5,
                        "date": self._compute_third_wednesday(month),
                    },
                    {
                        "name": "CPI Release",
                        "importance": 4,
                        "date": self._cpi_release_day(month),
                    },
                    {
                        "name": "Nonfarm Payrolls",
                        "importance": 3,
                        "date": self._first_friday(month),
                    },
                ]
            )
        return events

    # ======================
    # 公開メソッド
    # ======================

    def get_events_for_date(self, target: date) -> List[Dict]:
        """
        指定日 target の前後を対象に、重要イベント一覧を返す。

        - まず手動イベント JSON から [-7日, +30日] に入るものを取得
        - 1件もなければヒューリスティックで補完
        """
        window_days = 30
        events: List[Dict] = []

        # 1) 手動イベント優先
        for ev in self._manual_events:
            delta = (ev["date"] - target).days
            if -7 <= delta <= window_days:
                events.append(ev)

        # 2) 何もヒットしない場合だけヒューリスティックにフォールバック
        if not events:
            fallback_events = self._monthly_events_fallback(target)
            for ev in fallback_events:
                delta = (ev["date"] - target).days
                if -7 <= delta <= window_days:
                    events.append(ev)

        # 日付順にソートして返す
        events_sorted = sorted(events, key=lambda e: e["date"])
        return events_sorted

    def get_events(self) -> List[Dict]:
        """
        今日を基準にしたイベント一覧を返す。
        （既存コードのインターフェース互換）
        """
        return self.get_events_for_date(date.today())
