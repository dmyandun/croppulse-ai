import json
import os
import re

from google.adk import Context
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

# Get absolute path to the sheets MCP server file
SHEETS_MCP_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "mcp_servers",
    "sheets_mcp.py",
)


async def sheets_read_node(ctx: Context, node_input: str) -> str:
    """Read farm grid layout, crop plan, and location context from Sheets."""
    params = StdioServerParameters(command="python", args=[SHEETS_MCP_PATH])

    async with stdio_client(params) as (read_stream, write_stream):
        async with ClientSession(read_stream, write_stream) as session:
            await session.initialize()
            res = await session.call_tool("read_farm_context")
            farm_context_json = res.content[0].text

            # Save parsed data to shared state
            try:
                db = json.loads(farm_context_json)
                ctx.state["farm_context"] = farm_context_json
                ctx.state["latitude"] = db["location"]["latitude"]
                ctx.state["longitude"] = db["location"]["longitude"]

                # Pick the first dry/non-healthy crop or default to first crop in grid for price query
                grid = db.get("grid", [])
                if grid:
                    ctx.state["crops"] = [item["crop"] for item in grid]
                    dry_crops = [
                        item["crop"]
                        for item in grid
                        if item["status"].lower() != "healthy"
                    ]
                    ctx.state["selected_crop"] = (
                        dry_crops[0] if dry_crops else grid[0]["crop"]
                    )
                else:
                    ctx.state["crops"] = ["cacao"]
                    ctx.state["selected_crop"] = "cacao"
            except Exception:
                ctx.state["farm_context"] = farm_context_json
                ctx.state["latitude"] = -0.2687
                ctx.state["longitude"] = -79.4326
                ctx.state["selected_crop"] = "cacao"

            return farm_context_json


async def sheets_write_node(ctx: Context, node_input: str) -> str:
    """Parse output indicators from Advisory agent and update Sheets database."""
    advisory_text = str(node_input)

    # Extract JSON tagged as [INDICATORS]
    match = re.search(r"\[INDICATORS\]:\s*(\{.*\})", advisory_text, re.DOTALL)
    if not match:
        # Fallback to general JSON find in text if tag is missing
        match = re.search(r"(\{.*\})", advisory_text, re.DOTALL)

    indicators_json = "{}"
    if match:
        indicators_json = match.group(1).strip()

    params = StdioServerParameters(command="python", args=[SHEETS_MCP_PATH])
    async with stdio_client(params) as (read_stream, write_stream):
        async with ClientSession(read_stream, write_stream) as session:
            await session.initialize()
            res = await session.call_tool(
                "write_farm_indicators", arguments={"indicators_json": indicators_json}
            )
            return res.content[0].text
