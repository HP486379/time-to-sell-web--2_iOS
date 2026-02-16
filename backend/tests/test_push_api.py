from fastapi.testclient import TestClient

from main import app
import main


client = TestClient(app)


def test_push_register_success():
    main._push_registrations.clear()

    response = client.post(
        "/api/push/register",
        json={"token": "ExponentPushToken[test]", "platform": "ios", "appVersion": "1.0.0"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["ok"] is True
    assert body["registered"]["token"] == "ExponentPushToken[test]"
    assert body["registered"]["platform"] == "ios"


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
        json={"token": "ExponentPushToken[test2]", "title": "hello", "body": "world"},
    )

    assert response.status_code == 200
    assert called["token"] == "ExponentPushToken[test2]"
    assert called["title"] == "hello"
    assert called["body"] == "world"
    assert called["data"] == {"type": "test"}


def test_push_test_falls_back_to_latest_registered(monkeypatch):
    main._push_registrations.clear()
    client.post("/api/push/register", json={"token": "ExponentPushToken[first]", "platform": "ios"})
    client.post("/api/push/register", json={"token": "ExponentPushToken[last]", "platform": "ios"})

    called = {}

    def fake_send(token: str, title: str, body: str, data=None):
        called["token"] = token
        return {"data": {"status": "ok"}}

    monkeypatch.setattr(main, "_send_expo_push", fake_send)

    response = client.post("/api/push/test", json={})
    assert response.status_code == 200
    assert called["token"] == "ExponentPushToken[last]"


def test_push_register_rejects_unsupported_platform():
    main._push_registrations.clear()

    response = client.post(
        "/api/push/register",
        json={"token": "ExponentPushToken[test]", "platform": "android"},
    )

    assert response.status_code == 400
    assert response.json()["detail"]["reason"] == "unsupported_platform"
