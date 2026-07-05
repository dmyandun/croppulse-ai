import json
import random

from mcp.server.fastmcp import FastMCP

mcp = FastMCP("Commodity Prices Market MCP Server")

# Base crop/commodity prices per standard unit
CROP_MARKET_DATABASE = {
    "corn": {"price": 4.52, "unit": "bushel", "currency": "USD"},
    "wheat": {"price": 6.18, "unit": "bushel", "currency": "USD"},
    "soybeans": {"price": 11.75, "unit": "bushel", "currency": "USD"},
    "coffee": {"price": 2.24, "unit": "pound", "currency": "USD"},
    "cocoa": {"price": 8450.00, "unit": "metric ton", "currency": "USD"},
    "rice": {"price": 18.25, "unit": "cwt", "currency": "USD"},
}


@mcp.tool()
def get_crop_market_price(crop_name: str) -> str:
    """Get the current crop/commodity market price details.

    Args:
        crop_name: The crop name (e.g. corn, wheat, soybeans, coffee, cocoa, rice).
    """
    key = crop_name.lower().strip()
    if key in CROP_MARKET_DATABASE:
        data = CROP_MARKET_DATABASE[key]
        # Introduce small random variations (-3% to +3%) to simulate a live market ticker
        base_price = float(data["price"])
        variation = random.uniform(-0.03, 0.03) * base_price
        current_price = round(base_price + variation, 2)
        return json.dumps(
            {
                "commodity": crop_name,
                "current_price": current_price,
                "unit": data["unit"],
                "currency": data["currency"],
                "status": "up" if variation > 0 else "down",
            },
            indent=2,
        )

    return f"Crop '{crop_name}' not found. Supported commodities: {', '.join(CROP_MARKET_DATABASE.keys())}."


if __name__ == "__main__":
    mcp.run()
