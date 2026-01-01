from datetime import date, datetime, timedelta
from typing import Dict, List
import json
import os


class EventService:
    def __init__(self) -> None:
        # 起動時に一度だけ手動イベントを読み込んでキャッシュ
        self.manual_events = self._load_manual_events()

    # ======================
    # 手動イベント JSON 読み込み
    # ======================

    def _load_manual_events(self) -> List[Dict]:
        """
        backend/data/us_events.json から手動イベントを読み込む。

        想定フォーマット（どちらでもOK）:
        1) [ { "date": "2025-01-29", "name": "FOMC", "importance": 5 }, ... ]
        2) { "events": [ {...}, {...} ] }
        """
        # backend/ から見た data ディレクトリを想定
        base_dir = os.path.dirname(os.path.dirname(__file__))  # .../backend
        data_path = os.path.join(base_dir, "data", "us_events.json")
        events: List[Dict] = []

        if not os.path.exists(data_path):
            print(f"[EventService] manual events file not found: {data_path}")
            return events

        try:
            with open(data_path, "r", encoding="utf-8") as f:
                raw = json.load(f)
        except Exception as e:
            print(f"[EventService] failed to load manual events from {data_path}: {e}")
            return events

        # 1) list 形式 or 2) {"events": [...]} の両対応
        if isinstance(raw, dict):
            raw_events = raw.get("events", [])
        else:
            raw_events = raw

        for item in raw_events:
            try:
                date_str = item.get("date")
                if not date_str:
                    continue
                d = datetime.strptime(date_str, "%Y-%m-%d").date()
                name = item.get("name", "Unknown")
                importance = int(item.get("importance", 3))
                events.append(
                    {
                        "name": name,
                        "importance": importance,
                        "date": d,
                        "source": "manual",
                    }
                )
            except Exception as e:
                print(f"[EventService] skip invalid manual event {item}: {e}")

        print(f"[EventService] loaded {len(events)} manual events from {data_path}")
        return events

    # ======================
    # ヒューリスティックイベント（従来ロジック）
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
        # Approximate: 10日をデフォルトとする（実運用ではAPI差し替え）
        day = 10
        return target.replace(day=day)

    def _monthly_events(self, today: date) -> List[Dict]:
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
                        "source": "heuristic",
                    },
                    {
                        "name": "CPI Release",
                        "importance": 4,
                        "date": self._cpi_release_day(month),
                        "source": "heuristic",
                    },
                    {
                        "name": "Nonfarm Payrolls",
                        "importance": 3,
                        "date": self._first_friday(month),
                        "source": "heuristic",
                    },
                ]
            )
        return events

    # ======================
    # 公開 API
    # ======================

    def get_events_for_date(self, target: date) -> List[Dict]:
        """
        指定日の前後7日〜30日先までのイベントを返す。
        手動イベントを優先し、不足分をヒューリスティックで補う。
        """
        window_days = 30
        events: List[Dict] = []

        # --- 1) 手動イベント（最優先） ---
        for e in self.manual_events:
            delta = (e["date"] - target).days
            if -7 <= delta <= window_days:
                events.append(e)

        # --- 2) ヒューリスティック（重複しないものだけ追加） ---
        heuristic_events = self._monthly_events(target)
        for e in heuristic_events:
            delta = (e["date"] - target).days
            if not (-7 <= delta <= window_days):
                continue
            if any(ex["name"] == e["name"] and ex["date"] == e["date"] for ex in events):
                # 同じ name + date が既に手動イベントにあればスキップ
                continue
            events.append(e)

        return sorted(events, key=lambda e: e["date"])

    def get_events(self) -> List[Dict]:
        return self.get_events_for_date(date.today())
