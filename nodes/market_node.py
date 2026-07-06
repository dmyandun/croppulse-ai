"""
Market Node - CropPulse AI
=========================

Calls the Market MCP server to fetch current commodity spot prices
and price trend history for all crops on the farm.

Why MCP instead of hardcoded API calls?
1.  **Decoupling:** Standardizes tool execution under the Model Context Protocol (MCP).
    Changes to market endpoints or commodities data logic do not require rebuilding
    or altering the core node orchestration scripts.
2.  **Modularity:** Multiple agents or nodes can request market prices through the
    standardized `StdioServerParameters` process management, creating a clean service-oriented
    architecture.
3.  **Harness Compatibility:** Allows the ADK system to inspect, mock, and auto-grade
    external database calls cleanly during evaluation phases.
"""

from __future__ import annotations

import json
import os

from google.adk import Context
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

MARKET_MCP_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "mcp_servers",
    "market_mcp.py",
)


async def _call_market_tool(
    session: ClientSession,
    tool_name: str,
    arguments: dict,
) -> dict:
    """Call a market MCP tool and return parsed JSON result."""
    res = await session.call_tool(tool_name, arguments=arguments)
    raw = res.content[0].text if res.content else "{}"
    try:
        return json.loads(raw)
    except Exception:
        return {"raw": raw}


async def market_node(ctx: Context, node_input: str) -> str:
    """Fetch commodity market data via the Market MCP server.

    For each crop on the farm, retrieves:
    - Current spot price
    - 30-day price trend and percentage change
    """
    # Vision output is stored directly in ctx.state by the vision agent's
    # analyze_crop_image tool. No need to relay it here.

    # Gather all crops on the farm (from Sheets context)
    crops: list[str] = ctx.state.get("crops", [ctx.state.get("selected_crop", "cacao")])
    # De-duplicate while preserving order
    seen: set[str] = set()
    unique_crops: list[str] = []
    for c in crops:
        cl = c.lower()
        if cl not in seen:
            seen.add(cl)
            unique_crops.append(cl)

    params = StdioServerParameters(command="python", args=[MARKET_MCP_PATH])

    try:
        async with stdio_client(params) as (read_stream, write_stream):
            async with ClientSession(read_stream, write_stream) as session:
                await session.initialize()

                market_results: list[dict] = []
                for crop in unique_crops:
                    # Spot price
                    price_data = await _call_market_tool(
                        session,
                        "get_current_price",
                        {"commodity": crop},
                    )
                    if "error" in price_data:
                        # Skip unsupported commodities silently
                        continue

                    # 30-day trend
                    trend_data = await _call_market_tool(
                        session,
                        "get_price_trend",
                        {"commodity": crop, "days": 30},
                    )

                    market_results.append(
                        {
                            "commodity": price_data.get("commodity", crop),
                            "description": price_data.get("description", ""),
                            "current_price_usd": price_data.get("current_price_usd"),
                            "unit": price_data.get("unit"),
                            "daily_change_pct": price_data.get("daily_change_pct"),
                            "trend_direction": price_data.get("trend_direction"),
                            "trend_30d": {
                                "overall_change_pct": trend_data.get(
                                    "overall_change_pct"
                                ),
                                "direction": trend_data.get("trend_direction"),
                                "min_price_usd": trend_data.get("min_price_usd"),
                                "max_price_usd": trend_data.get("max_price_usd"),
                                "avg_price_usd": trend_data.get("avg_price_usd"),
                            },
                        }
                    )

                market_data = json.dumps(
                    {
                        "commodities": market_results,
                        "crops_analyzed": len(market_results),
                    },
                    indent=2,
                )
                ctx.state["market_output"] = market_data
                return market_data

    except Exception as e:
        error_msg = json.dumps(
            {"error": f"Market MCP call failed: {e!s}", "crops": unique_crops}
        )
        ctx.state["market_output"] = error_msg
        return error_msg
