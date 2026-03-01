from fastapi.testclient import TestClient

from main import app
import main

client = TestClient(app)


def _mock_evaluate_response(index_type: str = "SP500"):
    return {
        "current_price": 100.0,
        "market_value": 100.0,
        "unrealized_pnl": 0.0,
        "status": "ready",
        "reasons": [],
        "as_of": "2024-01-01T00:00:00+00:00",
        "request_id": "test-request-id",
        "used_index_type": index_type,
        "source": "test",
        "currency": "USD",
        "unit": "index",
        "symbol": "^GSPC",
        "period_scores": {"short": 50.0, "mid": 55.0, "long": 60.0},
        "period_meta": {"short_window": 20, "mid_window": 60, "long_window": 200},
        "period_breakdowns": {
            "short": {
                "scores": {"technical": 50.0, "macro": 50.0, "event_adjustment": 0.0},
                "technical_details": {"d": 0.0, "T_base": 50.0, "T_trend": 50.0, "T_conv_adj": 0.0},
                "macro_details": {"macro_M": 50.0, "M": 50.0, "p_r": 0.0, "p_cpi": 0.0, "p_vix": 0.0},
            },
            "mid": {
                "scores": {"technical": 55.0, "macro": 50.0, "event_adjustment": 0.0},
                "technical_details": {"d": 0.0, "T_base": 55.0, "T_trend": 55.0, "T_conv_adj": 0.0},
                "macro_details": {"macro_M": 50.0, "M": 50.0, "p_r": 0.0, "p_cpi": 0.0, "p_vix": 0.0},
            },
            "long": {
                "scores": {"technical": 60.0, "macro": 50.0, "event_adjustment": 0.0},
                "technical_details": {"d": 0.0, "T_base": 60.0, "T_trend": 60.0, "T_conv_adj": 0.0},
                "macro_details": {"macro_M": 50.0, "M": 50.0, "p_r": 0.0, "p_cpi": 0.0, "p_vix": 0.0},
            },
        },
        "scores": {
            "technical": 60.0,
            "macro": 50.0,
            "event_adjustment": 0.0,
            "total": 55.0,
            "label": "中立",
            "period_total": 60.0,
        },
        "technical_details": {"d": 0.0, "T_base": 60.0, "T_trend": 60.0, "T_conv_adj": 0.0},
        "macro_details": {"p_r": 0.0, "p_cpi": 0.0, "p_vix": 0.0, "M": 50.0},
        "event_details": {"E_adj": 0.0, "R_max": 0.0, "effective_event": None, "events": []},
        "price_series": [{"date": "2024-01-01", "close": 100.0, "ma20": 99.0, "ma60": 98.0, "ma200": 97.0}],
    }


def test_entitlements_endpoint_returns_free_plan():
    response = client.get("/api/entitlements")

    assert response.status_code == 200
    assert response.json() == {
        "plan": "free",
        "plan_source": "internal",
        "plan_expires_at": None,
        "available_index_types": ["SP500"],
        "features": {"multi_index": False},
    }


def test_indices_endpoint_is_filtered_by_entitlements():
    response = client.get("/api/indices")

    assert response.status_code == 200
    assert response.json() == ["SP500"]


def test_evaluate_allows_sp500(monkeypatch):
    monkeypatch.setattr(main, "_evaluate", lambda _position, _requested_index_type: _mock_evaluate_response("SP500"))

    response = client.post(
        "/api/evaluate",
        json={"total_quantity": 1, "avg_cost": 100, "index_type": "SP500", "score_ma": 200},
    )

    assert response.status_code == 200
    assert response.json()["used_index_type"] == "SP500"


def test_evaluate_forbidden_for_non_entitled_index(monkeypatch):
    called = {"value": False}

    def _should_not_run(_position, _requested_index_type):
        called["value"] = True
        return _mock_evaluate_response()

    monkeypatch.setattr(main, "_evaluate", _should_not_run)

    response = client.post(
        "/api/evaluate",
        json={"total_quantity": 1, "avg_cost": 100, "index_type": "NASDAQ", "score_ma": 200},
    )

    assert response.status_code == 403
    assert response.json()["detail"] == "Index not allowed"
    assert called["value"] is False


def test_sp500_evaluate_forces_sp500_and_uses_common_path(monkeypatch):
    captured = {"requested_index_type": None}

    def _capture(_position, _requested_index_type):
        captured["requested_index_type"] = _requested_index_type.value
        return _mock_evaluate_response("SP500")

    monkeypatch.setattr(main, "_evaluate", _capture)

    response = client.post(
        "/api/sp500/evaluate",
        json={"total_quantity": 1, "avg_cost": 100, "index_type": "NIKKEI", "score_ma": 200},
    )

    assert response.status_code == 200
    assert response.json()["used_index_type"] == "SP500"
    assert captured["requested_index_type"] == "SP500"
