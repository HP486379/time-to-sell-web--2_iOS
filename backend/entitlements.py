from typing import Any


def get_current_entitlements() -> dict[str, Any]:
    return {
        "plan": "free",
        "plan_source": "internal",
        "plan_expires_at": None,
        "available_index_types": ["SP500"],
        "features": {"multi_index": False},
    }

