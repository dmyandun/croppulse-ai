"""
Weather Node - CropPulse AI
Calls the Weather MCP server to fetch current conditions, 7-day forecast,
and historical rainfall for the farm's location.
"""

from __future__ import annotations

import json
import os

from google.adk import Context
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

WEATHER_MCP_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "mcp_servers",
    "weather_mcp.py",
)


async def _call_weather_tool(
    session: ClientSession,
    tool_name: str,
    arguments: dict,
) -> dict:
    """Call a weather MCP tool and return parsed JSON result."""
    res = await session.call_tool(tool_name, arguments=arguments)
    raw = res.content[0].text if res.content else "{}"
    try:
        return json.loads(raw)
    except Exception:
        return {"raw": raw}


async def weather_node(ctx: Context, node_input: str) -> str:
    """Fetch comprehensive weather data via the Weather MCP server.

    Retrieves:
    - Current weather conditions
    - 7-day daily forecast
    - Historical rainfall (last 14 days) for leaching risk assessment
    """
    # Preserve vision output when flowing from the vision agent
    if node_input and "vision_output" not in ctx.state:
        ctx.state["vision_output"] = node_input

    lat = float(ctx.state.get("latitude", -0.2687))
    lon = float(ctx.state.get("longitude", -79.4326))
    location_name = ctx.state.get("canton", "el_carmen")

    params = StdioServerParameters(command="python", args=[WEATHER_MCP_PATH])

    try:
        async with stdio_client(params) as (read_stream, write_stream):
            async with ClientSession(read_stream, write_stream) as session:
                await session.initialize()

                # Tool 1: current weather
                current = await _call_weather_tool(
                    session,
                    "get_current_weather",
                    {
                        "latitude": lat,
                        "longitude": lon,
                        "location_name": location_name,
                    },
                )

                # Tool 2: 7-day forecast
                forecast = await _call_weather_tool(
                    session,
                    "get_7day_forecast",
                    {
                        "latitude": lat,
                        "longitude": lon,
                        "location_name": location_name,
                    },
                )

                # Tool 3: historical rain (14 days) for leaching risk
                hist_rain = await _call_weather_tool(
                    session,
                    "get_historical_rain",
                    {
                        "latitude": lat,
                        "longitude": lon,
                        "days_back": 14,
                        "location_name": location_name,
                    },
                )

                result = {
                    "current_weather": current,
                    "forecast_7day": forecast.get("forecast_days", []),
                    "historical_rain_14d": {
                        "total_precipitation_mm": hist_rain.get(
                            "total_precipitation_mm"
                        ),
                        "leaching_risk": hist_rain.get("leaching_risk"),
                        "period_start": hist_rain.get("period_start"),
                        "period_end": hist_rain.get("period_end"),
                    },
                }
                weather_data = json.dumps(result, indent=2)
                ctx.state["weather_output"] = weather_data
                return weather_data

    except Exception as e:
        error_msg = json.dumps(
            {
                "error": f"Weather MCP call failed: {e!s}",
                "latitude": lat,
                "longitude": lon,
            }
        )
        ctx.state["weather_output"] = error_msg
        return error_msg
