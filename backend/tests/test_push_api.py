from fastapi.testclient import TestClient

from main import app
import main


client = TestClient(app)


def test_push_register_success():
    main._push_registrations.clear()

    response = client.post(
        "/api/push/register",
        json={
            "install_id": "ios-install-1",
            "expo_push_token": "ExponentPushToken[test]",
            "index_type": "SP500",
            "threshold": 80,
            "paid": False,
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["ok"] is True
    assert body["registration"]["install_id"] == "ios-install-1"
    assert body["registration"]["expo_push_token"] == "ExponentPushToken[test]"


def test_push_test_uses_given_token(monkeypatch):
    main._push_registrations.clear()

    called = {}

    def fake_send(token: str, title: str, body: str, data=None):
        called["token"] = token
        called["title"] = title
        called["body"] = body
        called["data"] = data
        return {"data": {"status": "ok"}}

    monkeypatch.setattr(main, "_send_expo_push", fake_send)

    response = client.post(
        "/api/push/test",
        json={"expo_push_token": "ExponentPushToken[test2]", "title": "hello", "body": "world"},
    )

    assert response.status_code == 200
    assert called["token"] == "ExponentPushToken[test2]"
    assert called["title"] == "hello"
    assert called["body"] == "world"
    assert called["data"] == {"type": "test"}


def test_push_test_resolves_install_id(monkeypatch):
    main._push_registrations.clear()
    client.post(
        "/api/push/register",
        json={
            "install_id": "ios-install-a",
            "expo_push_token": "ExponentPushToken[a]",
            "index_type": "SP500",
            "threshold": 80,
            "paid": False,
        },
    )

    called = {}

    def fake_send(token: str, title: str, body: str, data=None):
        called["token"] = token
        return {"data": {"status": "ok"}}

    monkeypatch.setattr(main, "_send_expo_push", fake_send)

    response = client.post("/api/push/test", json={"install_id": "ios-install-a"})
    assert response.status_code == 200
    assert called["token"] == "ExponentPushToken[a]"


def test_push_test_install_id_not_found():
    main._push_registrations.clear()

    response = client.post("/api/push/test", json={"install_id": "missing"})

    assert response.status_code == 404
    assert response.json()["detail"]["reason"] == "install_id_not_found"


def test_push_run_sends_when_threshold_met(monkeypatch):
    main._push_registrations.clear()
    client.post(
        "/api/push/register",
        json={
            "install_id": "ios-install-run",
            "expo_push_token": "ExponentPushToken[run]",
            "index_type": "SP500",
            "threshold": 70,
            "paid": False,
        },
    )

    monkeypatch.setattr(main, "_evaluate", lambda _payload: {"scores": {"total": 85.0}})

    called = {}

    def fake_send(token: str, title: str, body: str, data=None):
        called["token"] = token
        return {"data": {"status": "ok"}}

    monkeypatch.setattr(main, "_send_expo_push", fake_send)

    response = client.post("/api/push/run", json={"index_type": "SP500"})

    assert response.status_code == 200
    body = response.json()
    assert body["processed"] == 1
    assert body["sent"] == 1
    assert called["token"] == "ExponentPushToken[run]"
    assert main._push_registrations["ios-install-run"]["last_notified_on"] is not None


def test_push_run_respects_24h_cooldown(monkeypatch):
    main._push_registrations.clear()
    client.post(
        "/api/push/register",
        json={
            "install_id": "ios-install-cooldown",
            "expo_push_token": "ExponentPushToken[cooldown]",
            "index_type": "SP500",
            "threshold": 70,
            "paid": False,
        },
    )

    monkeypatch.setattr(main, "_evaluate", lambda _payload: {"scores": {"total": 90.0}})

    send_count = {"value": 0}

    def fake_send(token: str, title: str, body: str, data=None):
        send_count["value"] += 1
        return {"data": {"status": "ok"}}

    monkeypatch.setattr(main, "_send_expo_push", fake_send)

    first = client.post("/api/push/run", json={"index_type": "SP500"})
    second = client.post("/api/push/run", json={"index_type": "SP500"})

    assert first.status_code == 200
    assert second.status_code == 200
    assert send_count["value"] == 1
    second_result = second.json()["results"][0]
    assert second_result["reason"] == "cooldown_24h"
