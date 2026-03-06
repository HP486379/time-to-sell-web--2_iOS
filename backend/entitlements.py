from typing import Any

ALL_INDEX_TYPES = ["SP500", "sp500_jpy", "TOPIX", "NIKKEI", "NIFTY50", "ORUKAN", "orukan_jpy"]


def get_current_entitlements() -> dict[str, Any]:
    return {
        "plan": "free",
        "plan_source": "internal",
        "plan_expires_at": None,
        "available_index_types": ALL_INDEX_TYPES,
        "features": {"multi_index": True},
    }
