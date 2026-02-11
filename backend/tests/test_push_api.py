import os
import sys

from fastapi.testclient import TestClient

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import main


client = TestClient(main.app)


def test_push_register_minimal_payload(monkeypatch, tmp_path):
    svc = main.PushService(str(tmp_path / "push.json"))
    monkeypatch.setattr(main, "push_service", svc)

    res = client.post(
        "/api/push/register",
        json={
            "install_id": "install-1",
            "expo_push_token": "ExponentPushToken[abc]",
            "index_type": "SP500",
        },
    )
    assert res.status_code == 200
    body = res.json()
    assert body["ok"] is True
    assert body["registration"]["install_id"] == "install-1"
    assert body["registration"]["expo_push_token"] == "ExponentPushToken[abc]"
    assert body["registration"]["paid"] is False


def test_free_user_limited_to_single_index(monkeypatch, tmp_path):
    svc = main.PushService(str(tmp_path / "push.json"))
    monkeypatch.setattr(main, "push_service", svc)

    first = client.post(
        "/api/push/register",
        json={
            "install_id": "free-A",
            "expo_push_token": "ExponentPushToken[f1]",
            "index_type": "SP500",
        },
    )
    assert first.status_code == 200

    second = client.post(
        "/api/push/register",
        json={
            "install_id": "free-A",
            "expo_push_token": "ExponentPushToken[f2]",
            "index_type": "TOPIX",
        },
    )
    assert second.status_code == 403
    assert second.json()["detail"] == "upgrade_required"


def test_free_user_can_reregister_same_index(monkeypatch, tmp_path):
    svc = main.PushService(str(tmp_path / "push.json"))
    monkeypatch.setattr(main, "push_service", svc)

    first = client.post(
        "/api/push/register",
        json={
            "install_id": "free-B",
            "expo_push_token": "ExponentPushToken[same]",
            "index_type": "SP500",
            "threshold": 80,
        },
    )
    assert first.status_code == 200

    second = client.post(
        "/api/push/register",
        json={
            "install_id": "free-B",
            "expo_push_token": "ExponentPushToken[same-2]",
            "index_type": "SP500",
            "threshold": 75,
        },
    )
    assert second.status_code == 200
    assert second.json()["registration"]["threshold"] == 75


def test_paid_user_can_register_multiple_indices(monkeypatch, tmp_path):
    svc = main.PushService(str(tmp_path / "push.json"))
    monkeypatch.setattr(main, "push_service", svc)

    a = client.post(
        "/api/push/register",
        json={
            "install_id": "paid-A",
            "expo_push_token": "ExponentPushToken[p1]",
            "index_type": "SP500",
            "paid": True,
        },
    )
    b = client.post(
        "/api/push/register",
        json={
            "install_id": "paid-A",
            "expo_push_token": "ExponentPushToken[p2]",
            "index_type": "TOPIX",
            "paid": True,
        },
    )

    assert a.status_code == 200
    assert b.status_code == 200


def test_push_test_supports_direct_token(monkeypatch, tmp_path):
    svc = main.PushService(str(tmp_path / "push.json"))
    monkeypatch.setattr(main, "push_service", svc)

    def fake_send(expo_token, title, body, data=None):
        assert expo_token == "ExponentPushToken[test-direct]"
        return {"data": [{"status": "ok"}]}

    monkeypatch.setattr(svc, "send_expo_push", fake_send)

    res = client.post(
        "/api/push/test",
        json={"expo_push_token": "ExponentPushToken[test-direct]"},
    )
    assert res.status_code == 200
    body = res.json()
    assert body["ok"] is True
    assert body["expo_response"]["data"][0]["status"] == "ok"


def test_push_test_supports_install_id(monkeypatch, tmp_path):
    svc = main.PushService(str(tmp_path / "push.json"))
    monkeypatch.setattr(main, "push_service", svc)

    svc.register("install-2", "ExponentPushToken[test-by-install]", index_type="SP500")

    def fake_send(expo_token, title, body, data=None):
        assert expo_token == "ExponentPushToken[test-by-install]"
        return {"data": [{"status": "ok"}]}

    monkeypatch.setattr(svc, "send_expo_push", fake_send)

    res = client.post(
        "/api/push/test",
        json={"install_id": "install-2"},
    )
    assert res.status_code == 200
    body = res.json()
    assert body["ok"] is True
    assert body["expo_response"]["data"][0]["status"] == "ok"


def test_push_run_respects_cooldown(monkeypatch, tmp_path):
    svc = main.PushService(str(tmp_path / "push.json"))
    monkeypatch.setattr(main, "push_service", svc)

    svc.register("install-3", "ExponentPushToken[cooldown]", index_type="SP500", threshold=80.0, paid=True)

    def fake_send(expo_token, title, body, data=None):
        return {"data": [{"status": "ok"}]}

    monkeypatch.setattr(svc, "send_expo_push", fake_send)

    def fake_eval(index_type_raw):
        return {"scores": {"total": 90.0}}

    first = svc.run_for_paid_users(fake_eval)
    second = svc.run_for_paid_users(fake_eval)

    assert first[0].sent is True
    assert second[0].sent is False
    assert second[0].reason == "cooldown"
