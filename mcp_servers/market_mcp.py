"""
Market MCP Server - CropPulse AI
Provides realistic commodity price data for smallholder crops.
Uses a mock-service base with daily-seeded pseudo-random variation to simulate
real market movement. Supports both spot prices and price trend history.
Commodities: cacao, banana, coffee, palm_oil, rice, maize, plantain, cassava.
"""

import hashlib
import json
import random
from datetime import date, timedelta

from mcp.server.fastmcp import FastMCP

mcp = FastMCP("CropPulse Market MCP Server")

# ---------------------------------------------------------------------------
# Base commodity data (USD prices, realistic as of 2025-2026 references)
# ---------------------------------------------------------------------------
COMMODITIES: dict[str, dict] = {
    "cacao": {
        "base_price": 8_450.00,
        "unit": "metric ton",
        "currency": "USD",
        "volatility": 0.025,  # ±2.5% daily swing
        "description": "Raw cacao beans — world market ICCO reference",
        "aliases": ["cacao", "cocoa", "cocao"],
    },
    "banana": {
        "base_price": 760.00,
        "unit": "metric ton",
        "currency": "USD",
        "volatility": 0.018,
        "description": "Export-grade Cavendish banana (FOB Ecuador)",
        "aliases": ["banana", "banano", "bananas"],
    },
    "coffee": {
        "base_price": 5_200.00,
        "unit": "metric ton",
        "currency": "USD",
        "volatility": 0.030,
        "description": "Arabica green coffee beans — ICO composite price",
        "aliases": ["coffee", "cafe", "arabica", "robusta"],
    },
    "palm_oil": {
        "base_price": 1_020.00,
        "unit": "metric ton",
        "currency": "USD",
        "volatility": 0.022,
        "description": "Crude palm oil (CPO) — Bursa Malaysia reference",
        "aliases": ["palm_oil", "palma", "aceite_de_palma"],
    },
    "rice": {
        "base_price": 520.00,
        "unit": "metric ton",
        "currency": "USD",
        "volatility": 0.015,
        "description": "Milled white rice — FAO world rice price index",
        "aliases": ["rice", "arroz"],
    },
    "maize": {
        "base_price": 210.00,
        "unit": "metric ton",
        "currency": "USD",
        "volatility": 0.020,
        "description": "Yellow corn / maize — CBOT reference",
        "aliases": ["maize", "corn", "maiz", "corn_yellow"],
    },
    "plantain": {
        "base_price": 280.00,
        "unit": "metric ton",
        "currency": "USD",
        "volatility": 0.012,
        "description": "Green plantain (plátano verde) — regional market",
        "aliases": ["plantain", "platano", "plátano"],
    },
    "cassava": {
        "base_price": 185.00,
        "unit": "metric ton",
        "currency": "USD",
        "volatility": 0.014,
        "description": "Cassava / yuca — regional commodity exchange",
        "aliases": ["cassava", "yuca", "manioc", "tapioca"],
    },
}


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------
def _normalise_commodity(name: str) -> str | None:
    """Map any alias or canonical name to the primary commodity key."""
    key = name.lower().strip().replace("-", "_").replace(" ", "_")
    for commodity_key, meta in COMMODITIES.items():
        if key in meta["aliases"] or key == commodity_key:
            return commodity_key
    return None


def _deterministic_price(commodity_key: str, day: date) -> float:
    """Generate a repeatable, date-seeded price for the given commodity."""
    meta = COMMODITIES[commodity_key]
    base = meta["base_price"]
    vol = meta["volatility"]
    # Hash the commodity + date to get a stable seed
    seed_str = f"{commodity_key}:{day.isoformat()}"
    h = int(hashlib.md5(seed_str.encode()).hexdigest(), 16)
    rng = random.Random(h)
    factor = 1.0 + rng.uniform(-vol, vol)
    return round(base * factor, 2)


# ---------------------------------------------------------------------------
# Tool 1: Current spot price
# ---------------------------------------------------------------------------
@mcp.tool()
def get_current_price(commodity: str) -> str:
    """Get the current spot price for an agricultural commodity.

    Args:
        commodity: Commodity name. Supported: cacao, banana, coffee, palm_oil,
                   rice, maize, plantain, cassava (and Spanish aliases).

    Returns:
        JSON with current_price_usd, unit, currency, daily_change_pct,
        trend_direction (up/down/stable).
    """
    key = _normalise_commodity(commodity)
    if key is None:
        supported = list(COMMODITIES.keys())
        return json.dumps(
            {
                "error": f"Commodity '{commodity}' not found.",
                "supported_commodities": supported,
            }
        )

    meta = COMMODITIES[key]
    today = date.today()
    yesterday = today - timedelta(days=1)

    price_today = _deterministic_price(key, today)
    price_yesterday = _deterministic_price(key, yesterday)
    change_pct = round((price_today - price_yesterday) / price_yesterday * 100, 2)

    if change_pct > 0.5:
        direction = "up"
    elif change_pct < -0.5:
        direction = "down"
    else:
        direction = "stable"

    return json.dumps(
        {
            "commodity": key,
            "description": meta["description"],
            "current_price_usd": price_today,
            "unit": meta["unit"],
            "currency": meta["currency"],
            "daily_change_pct": change_pct,
            "trend_direction": direction,
            "date": today.isoformat(),
        },
        indent=2,
    )


# ---------------------------------------------------------------------------
# Tool 2: Price trend history
# ---------------------------------------------------------------------------
@mcp.tool()
def get_price_trend(commodity: str, days: int = 30) -> str:
    """Get price trend history for a commodity over the last N days.

    Args:
        commodity: Commodity name (cacao, banana, coffee, palm_oil, rice,
                   maize, plantain, cassava).
        days: Number of historical days to return (1-365). Default 30.

    Returns:
        JSON with price_history list [{date, price_usd}], overall_change_pct,
        trend_direction, min_price, max_price, avg_price.
    """
    key = _normalise_commodity(commodity)
    if key is None:
        return json.dumps(
            {
                "error": f"Commodity '{commodity}' not found.",
                "supported_commodities": list(COMMODITIES.keys()),
            }
        )

    meta = COMMODITIES[key]
    days = max(1, min(days, 365))
    today = date.today()
    history = []
    prices: list[float] = []
    for i in range(days - 1, -1, -1):
        d = today - timedelta(days=i)
        p = _deterministic_price(key, d)
        prices.append(p)
        history.append({"date": d.isoformat(), "price_usd": p})

    first_price = prices[0]
    last_price = prices[-1]
    overall_change_pct = round((last_price - first_price) / first_price * 100, 2)

    if overall_change_pct > 1:
        direction = "up"
    elif overall_change_pct < -1:
        direction = "down"
    else:
        direction = "stable"

    return json.dumps(
        {
            "commodity": key,
            "description": meta["description"],
            "unit": meta["unit"],
            "currency": meta["currency"],
            "period_days": days,
            "period_start": history[0]["date"],
            "period_end": history[-1]["date"],
            "overall_change_pct": overall_change_pct,
            "trend_direction": direction,
            "min_price_usd": min(prices),
            "max_price_usd": max(prices),
            "avg_price_usd": round(sum(prices) / len(prices), 2),
            "current_price_usd": last_price,
            "price_history": history,
        },
        indent=2,
    )


# ---------------------------------------------------------------------------
# Helper tool: list supported commodities
# ---------------------------------------------------------------------------
@mcp.tool()
def list_commodities() -> str:
    """List all commodities supported by the market MCP server.

    Returns:
        JSON list of commodity names, descriptions, and units.
    """
    result = [
        {
            "name": k,
            "description": v["description"],
            "unit": v["unit"],
            "base_price_usd": v["base_price"],
            "aliases": v["aliases"],
        }
        for k, v in COMMODITIES.items()
    ]
    return json.dumps(result, indent=2)


if __name__ == "__main__":
    mcp.run()
