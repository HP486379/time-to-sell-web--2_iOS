from __future__ import annotations

import json
import os
from dataclasses import asdict, dataclass
from datetime import date
from threading import Lock
from typing import Callable, List, Optional

import requests


@dataclass
class PushRegistration:
    install_id: str
    expo_push_token: str
    index_type: str = "SP500"
    threshold: float = 80.0
    paid: bool = False
    last_notified_on: Optional[str] = None


@dataclass
class PushSendResult:
    install_id: str
    sent: bool
    reason: str
    score: Optional[float] = None


class PushService:
    def __init__(self, storage_path: str):
        self.storage_path = storage_path
        self._lock = Lock()
        os.makedirs(os.path.dirname(self.storage_path), exist_ok=True)
        if not os.path.exists(self.storage_path):
            self._write([])

    def _read(self) -> List[PushRegistration]:
        with self._lock:
            try:
                with open(self.storage_path, "r", encoding="utf-8") as f:
                    raw = json.load(f)
            except (json.JSONDecodeError, FileNotFoundError):
                raw = []
            rows: List[PushRegistration] = []
            for item in raw:
                token = item.get("expo_push_token") or item.get("push_token")
                if not token or not item.get("install_id"):
                    continue
                rows.append(
                    PushRegistration(
                        install_id=item["install_id"],
                        expo_push_token=token,
                        index_type=item.get("index_type", "SP500"),
                        threshold=float(item.get("threshold", 80.0)),
                        paid=bool(item.get("paid", False)),
                        last_notified_on=item.get("last_notified_on"),
                    )
                )
            return rows

    def _write(self, rows: List[PushRegistration]) -> None:
        with self._lock:
            with open(self.storage_path, "w", encoding="utf-8") as f:
                json.dump([asdict(r) for r in rows], f, ensure_ascii=False, indent=2)

    def register(
        self,
        install_id: str,
        expo_push_token: str,
        index_type: str = "SP500",
        threshold: float = 80.0,
        paid: bool = False,
    ) -> PushRegistration:
        rows = self._read()
        matched = next(
            (r for r in rows if r.install_id == install_id and r.index_type == index_type),
            None,
        )

        existing_indices = {r.index_type for r in rows if r.install_id == install_id}
        if not paid and existing_indices and index_type not in existing_indices:
            raise ValueError("upgrade_required")

        if matched:
            matched.expo_push_token = expo_push_token
            matched.threshold = threshold
            matched.paid = paid
            reg = matched
        else:
            reg = PushRegistration(
                install_id=install_id,
                expo_push_token=expo_push_token,
                index_type=index_type,
                threshold=threshold,
                paid=paid,
            )
            rows.append(reg)

        self._write(rows)
        return reg

    def find_by_install_id(self, install_id: str) -> Optional[PushRegistration]:
        rows = [r for r in self._read() if r.install_id == install_id]
        return rows[-1] if rows else None

    def list_paid(self) -> List[PushRegistration]:
        return [r for r in self._read() if r.paid]

    def can_send_today(self, reg: PushRegistration, today: date) -> bool:
        return reg.last_notified_on != today.isoformat()

    def mark_sent_today(self, reg: PushRegistration, today: date) -> None:
        rows = self._read()
        for row in rows:
            if (
                row.install_id == reg.install_id
                and row.index_type == reg.index_type
                and row.threshold == reg.threshold
            ):
                row.last_notified_on = today.isoformat()
                break
        self._write(rows)

    def send_expo_push(self, expo_token: str, title: str, body: str, data: Optional[dict] = None) -> dict:
        payload = {
            "to": expo_token,
            "title": title,
            "body": body,
            "data": data or {},
        }
        r = requests.post("https://exp.host/--/api/v2/push/send", json=payload, timeout=10)
        r.raise_for_status()
        return r.json()

    def run_for_paid_users(
        self,
        evaluate_func: Callable[[str], dict],
        today: Optional[date] = None,
    ) -> List[PushSendResult]:
        run_date = today or date.today()
        results: List[PushSendResult] = []

        for reg in self.list_paid():
            if not self.can_send_today(reg, run_date):
                results.append(PushSendResult(reg.install_id, False, "cooldown"))
                continue

            evaluated = evaluate_func(reg.index_type)
            score = float(evaluated.get("scores", {}).get("total", 0.0))
            if score < reg.threshold:
                results.append(PushSendResult(reg.install_id, False, "below_threshold", score=score))
                continue

            try:
                self.send_expo_push(
                    reg.expo_push_token,
                    "売り時くん通知",
                    f"{reg.index_type} の総合スコアが {score:.1f}（閾値 {reg.threshold:.1f}）に到達しました",
                    data={"index_type": reg.index_type, "score": score, "threshold": reg.threshold},
                )
            except requests.RequestException as exc:
                results.append(PushSendResult(reg.install_id, False, f"push_failed:{exc.__class__.__name__}", score=score))
                continue

            self.mark_sent_today(reg, run_date)
            results.append(PushSendResult(reg.install_id, True, "sent", score=score))

        return results
