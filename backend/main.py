from datetime import date, datetime, time, timedelta, timezone
from enum import Enum
from pathlib import Path
from typing import List, Optional
import logging

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from scoring.technical import calculate_technical_score
from scoring.macro import calculate_macro_score
from scoring.events import calculate_event_adjustment
from scoring.total_score import calculate_total_score, get_label
from services.sp500_market_service import SP500MarketService
from services.macro_data_service import MacroDataService
from services.event_service import EventService
from services.nav_service import FundNavService
from services.backtest_service import BacktestService


logger = logging.getLogger(__name__)

# ======================
# CORS
# ======================

ALLOWED_ORIGINS = [
    "https://time-to-sell-web-2.vercel.app",  # Vercel 本番
    "http://localhost:5173",                  # Vite dev
    "http://127.0.0.1:5173",
]

app = FastAPI(title="Time to Sell API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ======================
# Enums / Schemas
# ======================

class IndexType(str, Enum):
    SP500 = "SP500"
    TOPIX = "TOPIX"
    NASDAQ100 = "NASDAQ100"
    NIKKEI225 = "NIKKEI225"


class PositionRequest(BaseModel):
    index_type: IndexType = Field(description="対象インデックス")
    score_ma: int = Field(50, description="スコア算出に使う移動平均（日数）")
    as_of: Optional[date] = Field(
        default=None,
        description="評価基準日（省略時は最新）",
    )


class PricePoint(BaseModel):
    date: date
    close: float


class ScoreBreakdown(BaseModel):
    technical_score: float
    macro_score: float
    event_adjustment: float
    total_score: float
    label: str


class EvaluateResponse(BaseModel):
    index_type: IndexType
    as_of: date
    current_price: float
    scores: ScoreBreakdown
    price_history: List[PricePoint]
    event_details: dict


class BacktestRequest(BaseModel):
    index_type: IndexType
    start_date: date
    end_date: date
    initial_capital: float
    sell_threshold: float
    buy_threshold: float
    score_ma: int


class BacktestSummary(BaseModel):
    final_equity: float
    hold_equity: float
    total_return: float
    max_drawdown: float
    trade_count: int


class BacktestResponse(BaseModel):
    summary: BacktestSummary
    equity_curve: List[PricePoint]


class SyntheticNavResponse(BaseModel):
    dates: List[date]
    values: List[float]


class FundNavResponse(BaseModel):
    dates: List[date]
    values: List[float]
    latest_nav: float


# ======================
# Services
# ======================

# 手動イベント JSON のパス（例: backend/data/us_events.json）
MANUAL_EVENTS_PATH = Path(__file__).parent / "data" / "us_events.json"

market_service = SP500MarketService()
macro_service = MacroDataService()
event_service = EventService(manual_events_path=MANUAL_EVENTS_PATH)
nav_service = FundNavService()
backtest_service = BacktestService(market_service, macro_service, event_service)


# ======================
# Helper
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
    macro_snapshot = macro_service.get_macro_snapshot()
    today = date.today()
    events = event_service.get_events_for_date(today)

    technical_score, technical_details = calculate_technical_score(
        price_history,
        base_window=50,
    )
    macro_score = calculate_macro_score(macro_snapshot)
    event_adjustment, event_details = calculate_event_adjustment(events)

    total_score = calculate_total_score(
        technical_score=technical_score,
        macro_score=macro_score,
        event_adjustment=event_adjustment,
    )
    label = get_label(total_score)

    current_price = price_history[-1]["close"] if price_history else 0.0

    return {
        "as_of": today,
        "current_price": current_price,
        "price_history": price_history,
        "scores": {
            "technical": technical_score,
            "macro": macro_score,
            "event_adjustment": event_adjustment,
            "total": total_score,
            "label": label,
        },
        "technical_details": technical_details,
        "event_details": event_details,
    }


# ======================
# Evaluate Endpoints
# ======================

def _evaluate(position: PositionRequest) -> EvaluateResponse:
    snapshot = get_cached_snapshot(position.index_type)
    current_price = snapshot["current_price"]

    technical_score = snapshot["scores"]["technical"]
    macro_score = snapshot["scores"]["macro"]
    event_adjustment = snapshot["scores"]["event_adjustment"]
    total_score = snapshot["scores"]["total"]
    label = snapshot["scores"]["label"]

    breakdown = ScoreBreakdown(
        technical_score=technical_score,
        macro_score=macro_score,
        event_adjustment=event_adjustment,
        total_score=total_score,
        label=label,
    )

    price_points = [
        PricePoint(date=p["date"], close=p["close"])
        for p in snapshot["price_history"]
    ]

    response = EvaluateResponse(
        index_type=position.index_type,
        as_of=snapshot["as_of"],
        current_price=current_price,
        scores=breakdown,
        price_history=price_points,
        event_details=snapshot["event_details"],
    )
    return response


@app.post("/api/evaluate", response_model=EvaluateResponse)
def evaluate_index(position: PositionRequest):
    try:
        return _evaluate(position)
    except Exception:
        logger.exception("Failed to evaluate index")
        raise HTTPException(
            status_code=502,
            detail="Evaluation failed: external data unavailable.",
        )


@app.post("/api/sp500/evaluate", response_model=EvaluateResponse)
def evaluate_sp500(position: Optional[PositionRequest] = None):
    # フロント互換のため SP500 固定エンドポイントを残す
    payload = position or PositionRequest(index_type=IndexType.SP500, score_ma=50)
    payload.index_type = IndexType.SP500
    try:
        return _evaluate(payload)
    except Exception:
        logger.exception("Failed to evaluate SP500")
        raise HTTPException(
            status_code=502,
            detail="Evaluation for SP500 failed.",
        )


# ======================
# Backtest Endpoints
# ======================

@app.post("/api/backtest", response_model=BacktestResponse)
def run_backtest(request: BacktestRequest):
    try:
        result = backtest_service.run_backtest(request)
        return result
    except Exception:
        logger.exception("Backtest failed")
        raise HTTPException(
            status_code=502,
            detail="Backtest failed: external data unavailable.",
        )


# ======================
# NAV Endpoints
# ======================

@app.get("/api/nav/sp500-synthetic", response_model=SyntheticNavResponse)
def get_synthetic_nav():
    return nav_service.get_synthetic_nav()


@app.get("/api/nav/emaxis-slim-sp500", response_model=FundNavResponse)
def get_fund_nav():
    return nav_service.get_fund_nav()


# ======================
# Health
# ======================

@app.get("/api/health")
def health_check():
    return {"status": "ok"}


# ======================
# Standalone Run
# ======================

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
