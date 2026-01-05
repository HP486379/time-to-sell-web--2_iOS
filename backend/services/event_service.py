from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from pathlib import Path
from typing import Dict, List
import json
import logging

logger = logging.getLogger(__name__)


@dataclass
class EventItem:
  name: str
  importance: int
  date: date
  source: str  # "manual"


class EventService:
  """
  経済イベントを管理するサービス。

  - 手動 JSON (backend/data/us_events.json) のみを使用
  """

  def __init__(self) -> None:
    self.manual_events: List[EventItem] = self._load_manual_events()
    logger.info("[EventService] loaded %d manual events", len(self.manual_events))

  # =============== manual JSON 読み込み ===============

  def _load_manual_events(self) -> List[EventItem]:
    """
    backend/data/us_events.json からイベントを読み込む。

    期待フォーマット（実際のファイルと一致）:
    [
      { "date": "2025-01-29", "name": "FOMC",    "importance": 5 },
      { "date": "2025-02-14", "name": "CPI (US)", "importance": 4 },
      ...
    ]
    """
    events: List[EventItem] = []
    data_path = Path(__file__).resolve().parent.parent / "data" / "us_events.json"

    if not data_path.exists():
      logger.warning("[EventService] manual events file not found: %s", data_path)
      return events

    try:
      with data_path.open("r", encoding="utf-8") as f:
        raw = json.load(f)
    except Exception as exc:
      logger.error("[EventService] failed to load manual events json: %s", exc)
      return events

    # 配列 or { "events": [...] } の両方を許容
    if isinstance(raw, list):
      raw_events = raw
    elif isinstance(raw, dict) and isinstance(raw.get("events"), list):
      raw_events = raw["events"]
    else:
      logger.error("[EventService] invalid manual events format in %s", data_path)
      return events

    for item in raw_events:
      try:
        dt_str = item["date"]
        name = str(item.get("name", "")).strip()
        importance = int(item.get("importance", 3))

        # 💡 ここが重要：文字列 → datetime.date に確実に変換
        dt = date.fromisoformat(dt_str)

        events.append(
          EventItem(
            name=name or "Unknown",
            importance=importance,
            date=dt,
            source="manual",
          )
        )
      except Exception as exc:  # フォーマットがおかしい行はスキップ
        logger.warning("[EventService] skip invalid manual event %s (%s)", item, exc)

    # 日付順にしておく
    events.sort(key=lambda e: e.date)
    return events

  # =============== 公開 API ===============

  def get_events_for_date(self, target: date) -> List[Dict]:
    """
    外部公開用。辞書形式のリストで返す。

    ここでもう一段ガードを入れておくことで、
    仮に self.manual_events に文字列 date が紛れ込んでも TypeError を防ぐ。
    """
    past_events = [e for e in self.manual_events if e.date < target]
    future_events = [e for e in self.manual_events if e.date >= target]

    past_events.sort(key=lambda e: e.date)
    future_events.sort(key=lambda e: e.date)

    merged = past_events + future_events
    events: List[Dict] = []

    for it in merged:
      # 念のため型をチェックしてから使う
      event_date = it.date
      if isinstance(event_date, str):
        try:
          event_date = date.fromisoformat(event_date)
        except Exception:
          logger.warning("[EventService] invalid date format in runtime: %s", event_date)
          continue

      events.append(
        {
          "name": it.name,
          "importance": it.importance,
          "date": event_date,
          "source": it.source,
        }
      )

    return events

  def get_events(self) -> List[Dict]:
    """今日を基準にイベントを取得（既存 API 互換用）"""
    return self.get_events_for_date(date.today())
