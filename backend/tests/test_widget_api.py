from fastapi.testclient import TestClient

from main import app
import main


client = TestClient(app)


def test_widget_summary_sp500_success(monkeypatch):
    main._widget_summary_cache.clear()
    main._widget_summary_cached_at.clear()

    def fake_evaluate(_payload):
        return {
            "scores": {"total": 82.3},
            "status": "HOLD",
            "as_of": "2026-01-01T00:00:00+00:00",
        }

    monkeypatch.setattr(main, "_evaluate", fake_evaluate)

    response = client.get("/api/widget/summary", params={"index_type": "sp500"})

    assert response.status_code == 200
    body = response.json()
    assert body["score"] == 82.3
    assert body["judgment"] == "HOLD"
    assert body["updated_at"] == "2026-01-01T00:00:00+00:00"


def test_widget_summary_rejects_non_sp500():
    response = client.get("/api/widget/summary", params={"index_type": "NIKKEI"})

    assert response.status_code == 400
    detail = response.json()["detail"]
    assert detail["reason"] == "unsupported_index_type"
    assert detail["supported"] == ["SP500"]
