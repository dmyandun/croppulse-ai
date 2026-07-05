import json

import requests
from mcp.server.fastmcp import FastMCP

mcp = FastMCP("Open-Meteo Weather MCP Server")


@mcp.tool()
def get_weather_forecast(latitude: float, longitude: float) -> str:
    """Get the current weather forecast for a given latitude and longitude.

    Args:
        latitude: Latitude of the location (e.g. 37.7749 for San Francisco, 40.7128 for NY).
        longitude: Longitude of the location (e.g. -122.4194 for San Francisco, -74.0060 for NY).
    """
    url = f"https://api.open-meteo.com/v1/forecast?latitude={latitude}&longitude={longitude}&current_weather=true"
    try:
        response = requests.get(url, timeout=10)
        if response.status_code != 200:
            return f"Error: API returned status code {response.status_code}."
        data = response.json()
        if "current_weather" in data:
            cw = data["current_weather"]
            return json.dumps(
                {
                    "temperature_celsius": cw.get("temperature"),
                    "windspeed_kmh": cw.get("windspeed"),
                    "weather_code": cw.get("weathercode"),
                    "time": cw.get("time"),
                },
                indent=2,
            )
        return "Weather forecast data is not available."
    except Exception as e:
        return f"Error executing weather request: {e!s}"


if __name__ == "__main__":
    mcp.run()
