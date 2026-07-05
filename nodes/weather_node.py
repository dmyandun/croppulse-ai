import os

from google.adk import Context
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

WEATHER_MCP_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "mcp_servers",
    "weather_mcp.py",
)


async def weather_node(ctx: Context, node_input: str) -> str:
    """Fetch location-specific weather forecast via weather MCP server."""
    # Save vision output if it flows from the vision agent
    if node_input:
        ctx.state["vision_output"] = node_input

    # Retrieve coordinates from shared state
    lat = ctx.state.get("latitude", -0.2687)
    lng = ctx.state.get("longitude", -79.4326)

    params = StdioServerParameters(command="python", args=[WEATHER_MCP_PATH])

    try:
        async with stdio_client(params) as (read_stream, write_stream):
            async with ClientSession(read_stream, write_stream) as session:
                await session.initialize()
                res = await session.call_tool(
                    "get_weather_forecast",
                    arguments={"latitude": float(lat), "longitude": float(lng)},
                )
                weather_data = res.content[0].text
                ctx.state["weather_output"] = weather_data
                return weather_data
    except Exception as e:
        error_msg = f"Failed to retrieve weather data: {e!s}"
        ctx.state["weather_output"] = error_msg
        return error_msg
