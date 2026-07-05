import os

from google.adk import Context
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

MARKET_MCP_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "mcp_servers",
    "market_mcp.py",
)


async def market_node(ctx: Context, node_input: str) -> str:
    """Fetch commodity crop market prices via market MCP server."""
    # Save vision output if it flows from the vision agent
    if node_input:
        ctx.state["vision_output"] = node_input

    # Retrieve selected crop from shared state
    crop = ctx.state.get("selected_crop", "cacao")

    params = StdioServerParameters(command="python", args=[MARKET_MCP_PATH])

    try:
        async with stdio_client(params) as (read_stream, write_stream):
            async with ClientSession(read_stream, write_stream) as session:
                await session.initialize()
                res = await session.call_tool(
                    "get_crop_market_price", arguments={"crop_name": str(crop)}
                )
                market_data = res.content[0].text
                ctx.state["market_output"] = market_data
                return market_data
    except Exception as e:
        error_msg = f"Failed to retrieve market data: {e!s}"
        ctx.state["market_output"] = error_msg
        return error_msg
