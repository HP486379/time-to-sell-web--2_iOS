from __future__ import annotations

from datetime import date, datetime, time, timedelta, timezone
from pathlib import Path
from typing import List, Optional
from pathlib import Path
import logging
from enum import Enum

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from scoring.technical import calculate_technical_score
from scoring.macro import calculate_macro_score
from scoring.events import calculate_event_adjustment
from scoring.total_score import calculate_total_score, get_label
from services.sp500_market_service import SP500MarketService
from services.macro_data_service import MacroDataService
from services.event_service import EventService, load_manual_events
from services.nav_service import FundNavService
from services.backtest_service import BacktestService

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)


# ======================
# FastAPI & CORS Config
# ======================

app = FastAPI(title="S&P500 Timing API")

ALLOWED_ORIGINS = [
    "https://time-to-sell-web-2.vercel.app",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ======================
# Models & Enums
# ======================


class IndexType(str, Enum):
    SP500 = "SP500"
    SP500_JPY = "sp500_jpy"
    TOPIX = "TOPIX"
    NIKKEI = "NIKKEI"
    NIFTY50 = "NIFTY50"
    ORUKAN = "ORUKAN"
    ORUKAN_JPY = "orukan_jpy"


class PositionRequest(BaseModel):
    index_type: IndexType = IndexType.SP500
    total_quantity: int = 0
    avg_cost: float = 0.0
    score_ma: int = Field(200, description="スコア計算に使う移動平均日数")


class PricePoint(BaseModel):
    date: str
    close: float
    ma20: Optional[float] = None
    ma60: Optional[float] = None
    ma200: Optional[float] = None


class EvaluateResponse(BaseModel):
    current_price: float
    market_value: float
    unrealized_pnl: float
    scores: Dict
    technical_details: Dict
    macro_details: Dict
    event_details: List[Dict]
    price_series: List[PricePoint]


class SyntheticNavResponse(BaseModel):
    asOf: str
    priceUsd: float
    usdJpy: float
    navJpy: float
    source: str


class FundNavResponse(BaseModel):
    asOf: str
    navJpy: float
    source: str


class BacktestRequest(BaseModel):
    index_type: IndexType = IndexType.SP500
    start_date: date
    end_date: date
    initial_cash: float
    buy_threshold: float = 40.0
    sell_threshold: float = 80.0
    score_ma: int = Field(200)


class BacktestSummary(BaseModel):
    final_equity: float
    hold_equity: float
    total_return: float
    max_drawdown: float
    trade_count: int


class BacktestPoint(BaseModel):
    date: date
    close: float
    ma20: Optional[float] = None
    ma60: Optional[float] = None
    ma200: Optional[float] = None


class BacktestResponse(BaseModel):
    summary: BacktestSummary
    equity_curve: List[BacktestPoint]


# ======================
# Services
# ======================

# 手動イベント JSON のパス（例: backend/data/us_events.json）
MANUAL_EVENTS_PATH = Path(__file__).parent / "data" / "us_events.json"

MANUAL_EVENTS_PATH = Path(__file__).parent / "data" / "us_events.json"

market_service = SP500MarketService()
macro_service = MacroDataService()

# 手動イベント JSON をロード
MANUAL_EVENTS_PATH = Path(__file__).parent / "data" / "us_events.json"
manual_events = load_manual_events(MANUAL_EVENTS_PATH)

event_service = EventService(manual_events=manual_events)
nav_service = FundNavService()
backtest_service = BacktestService(market_service, macro_service, event_service)


# ======================
# Time & Helpers
# ======================

def get_cached_snapshot(index_type: IndexType) -> dict:
    """
    インデックスごとのスナップショットを返すヘルパー。
    ※ 実装はプロジェクトの既存ロジックに合わせて、
      SP500MarketService / MacroDataService / EventService を使う。
    """
    # ここは既存 main.py と同等の実装で OK。
    # 必要に応じてキャッシュ（lru_cache 等）を入れてもよい。
    price_history = market_service.get_price_history(index_type.value)
    macro_snapshot = macro_service.get_macro_series()
    today = date.today()
    events = event_service.get_events_for_date(today)


def to_jst_iso(value: date) -> str:
    return datetime.combine(value, time.min, tzinfo=JST).isoformat()


# ======================
# Cache
# ======================

_cache_ttl = timedelta(seconds=60)
_cached_snapshot: Dict[str, Dict] = {}
_cached_at: Dict[str, datetime] = {}


# ======================
# Health Check
# ======================


@app.get("/api/health")
def health():
    return {"status": "ok"}


# ======================
# NAV Endpoints
# ======================


@app.get("/api/nav/sp500-synthetic")
def get_synthetic_nav():
    return nav_service.get_synthetic_nav()


@app.get("/api/nav/emaxis-slim-sp500")
def get_fund_nav():
    nav = nav_service.get_official_nav()
    if nav:
        return nav
    synthetic = nav_service.get_synthetic_nav()
    return {
        "asOf": synthetic["asOf"],
        "navJpy": synthetic["navJpy"],
        "source": "synthetic",
    }


# ======================
# Snapshot Builder
# ======================


def _build_snapshot(index_type: IndexType = IndexType.SP500) -> Dict:
    # 価格データ & 為替
    price_history = market_service.get_price_history(index_type=index_type.value)
    market_service.get_current_price(price_history, index_type=index_type.value)
    market_service.get_usd_jpy()

    if index_type == IndexType.SP500:
        # S&P500 は投信 NAV ベースで評価
        fund_nav = nav_service.get_official_nav() or nav_service.get_synthetic_nav()
        current_price = fund_nav["navJpy"]
    else:
        # それ以外は終値ベース
        current_price = price_history[-1][1]

    # テクニカル
    technical_score, technical_details = calculate_technical_score(price_history)

    # マクロ
    macro_data = macro_service.get_macro_series()
    macro_score, macro_details = calculate_macro_score(
        macro_data["r_10y"], macro_data["cpi"], macro_data["vix"]
    )
    macro_score, macro_details = calculate_macro_score(
        macro_snapshot["r_10y"],
        macro_snapshot["cpi"],
        macro_snapshot["vix"],
    )
    event_adjustment, event_details = calculate_event_adjustment(today, events)

    total_score = calculate_total_score(technical_score, macro_score, event_adjustment)
    label = get_label(total_score)

    current_price = price_history[-1][1] if price_history else 0.0
    price_history_points = [
        {"date": price_date, "close": close} for price_date, close in price_history
    ]

    snapshot = {
        "current_price": current_price,
        "price_history": price_history_points,
        "scores": {
            "technical": technical_score,
            "macro": macro_score,
            "event_adjustment": event_adjustment,
            "total": total_score,
            "label": label,
        },
        "technical_details": technical_details,
        "macro_details": macro_details,
        "event_details": event_details,
        "price_history": price_history,
        "price_series": market_service.build_price_series_with_ma(price_history),
    }

    return snapshot


# ======================
# Price History Endpoints
# ======================


@app.get("/api/sp500/price-history", response_model=List[PricePoint])
def get_sp500_history():
    return get_cached_snapshot(IndexType.SP500)["price_series"]


@app.get("/api/sp500-jpy/price-history", response_model=List[PricePoint])
def get_sp500_jpy_history():
    return get_cached_snapshot(IndexType.SP500_JPY)["price_series"]


@app.get("/api/topix/price-history", response_model=List[PricePoint])
def get_topix_history():
    return get_cached_snapshot(IndexType.TOPIX)["price_series"]


@app.get("/api/nikkei/price-history", response_model=List[PricePoint])
def get_nikkei_history():
    return get_cached_snapshot(IndexType.NIKKEI)["price_series"]


@app.get("/api/nifty50/price-history", response_model=List[PricePoint])
def get_nifty_history():
    return get_cached_snapshot(IndexType.NIFTY50)["price_series"]


@app.get("/api/orukan/price-history", response_model=List[PricePoint])
def get_orukan_history():
    return get_cached_snapshot(IndexType.ORUKAN)["price_series"]


@app.get("/api/orukan-jpy/price-history", response_model=List[PricePoint])
def get_orukan_jpy_history():
    return get_cached_snapshot(IndexType.ORUKAN_JPY)["price_series"]


# ======================
# Snapshot Cache
# ======================

def _build_equity_curve(price_history: List[tuple]) -> List[BacktestPoint]:
    closes = [close for _, close in price_history]

    def moving_average(values: List[float], window: int) -> List[Optional[float]]:
        averaged: List[Optional[float]] = []
        for idx in range(len(values)):
            if idx + 1 < window:
                averaged.append(None)
                continue
            window_values = values[idx + 1 - window : idx + 1]
            averaged.append(round(sum(window_values) / window, 2))
        return averaged

    ma20 = moving_average(closes, 20)
    ma60 = moving_average(closes, 60)
    ma200 = moving_average(closes, 200)

    return [
        BacktestPoint(
            date=date.fromisoformat(date_str),
            close=close,
            ma20=ma20[idx],
            ma60=ma60[idx],
            ma200=ma200[idx],
        )
        for idx, (date_str, close) in enumerate(price_history)
    ]


@app.post("/api/backtest", response_model=BacktestResponse)
def run_backtest(payload: BacktestRequest):
    try:
        result = backtest_service.run_backtest(
            payload.start_date,
            payload.end_date,
            payload.initial_cash,
            payload.buy_threshold,
            payload.sell_threshold,
            payload.index_type.value,
            payload.score_ma,
        )
        price_history = result.get("price_history", [])
        equity_curve = _build_equity_curve(price_history)
        summary = BacktestSummary(
            final_equity=result["final_value"],
            hold_equity=result["buy_and_hold_final"],
            total_return=result["total_return_pct"],
            max_drawdown=result["max_drawdown_pct"],
            trade_count=result["trade_count"],
        )
        return BacktestResponse(summary=summary, equity_curve=equity_curve)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception:
        logger.exception("Backtest failed", exc_info=True)
        raise HTTPException(
            status_code=502,
            detail="Backtest failed: external data unavailable.",
        )


# ======================
# Evaluate Endpoints
# ======================


def _evaluate(position: PositionRequest) -> Dict:
    snapshot = get_cached_snapshot(position.index_type)
    current_price = snapshot["current_price"]

    technical_score, technical_details = calculate_technical_score(
        snapshot["price_history"], base_window=position.score_ma
    )
    macro_score = snapshot["scores"]["macro"]
    event_adjustment = snapshot["scores"]["event_adjustment"]
    total_score = calculate_total_score(technical_score, macro_score, event_adjustment)
    label = get_label(total_score)

    market_value = position.total_quantity * current_price
    unrealized_pnl = market_value - (position.total_quantity * position.avg_cost)

    return {
        "current_price": current_price,
        "market_value": round(market_value, 2),
        "unrealized_pnl": round(unrealized_pnl, 2),
        "scores": {
            "technical": technical_score,
            "macro": macro_score,
            "event_adjustment": event_adjustment,
            "total": total_score,
            "label": label,
        },
        "technical_details": technical_details,
        "macro_details": snapshot["macro_details"],
        "event_details": snapshot["event_details"],
        "price_series": snapshot["price_series"],
    }


@app.post("/api/sp500/evaluate", response_model=EvaluateResponse)
def evaluate_sp500(position: PositionRequest):
    try:
        return _evaluate(position)
    except Exception:
        logger.exception("Evaluation failed for /api/sp500/evaluate", exc_info=True)
        raise HTTPException(status_code=502, detail="Evaluation failed")


@app.post("/api/evaluate", response_model=EvaluateResponse)
def evaluate(position: PositionRequest):
    try:
        return _evaluate(position)
    except Exception:
        logger.exception("Evaluation failed for /api/evaluate", exc_info=True)
        raise HTTPException(status_code=502, detail="Evaluation failed")


# ======================
# Backtest Endpoint
# ======================


@app.post("/api/backtest")
def backtest(payload: BacktestRequest):
    """
    デバッグ用：まずは CORS ＆ルーティングが正しいかだけ確認する簡易版。
    本番ロジックは一旦コメントアウトしている。
    """
    # ここではバックテストの本当の計算はせず、
    # フロントから受け取った値をそのまま返すだけにしておく。
    return {
        "summary": {
            "final_equity": float(payload.initial_cash),
            "hold_equity": float(payload.initial_cash),
            "total_return": 0.0,
            "max_drawdown": 0.0,
            "trade_count": 0,
        },
        "equity_curve": [],
    }


# ======================
# Standalone Run
# ======================

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
