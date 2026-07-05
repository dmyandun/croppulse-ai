import os

from google.adk import Agent
from google.adk.models import Gemini
from google.adk.tools import McpToolset
from mcp import StdioServerParameters

root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
weather_mcp_path = os.path.join(root_dir, "mcp_servers", "weather_mcp.py")
market_mcp_path = os.path.join(root_dir, "mcp_servers", "market_mcp.py")
sheets_mcp_path = os.path.join(root_dir, "mcp_servers", "sheets_mcp.py")

weather_tools = McpToolset(
    connection_params=StdioServerParameters(command="python", args=[weather_mcp_path]),
    tool_name_prefix="weather_",
)
market_tools = McpToolset(
    connection_params=StdioServerParameters(command="python", args=[market_mcp_path]),
    tool_name_prefix="market_",
)
sheets_tools = McpToolset(
    connection_params=StdioServerParameters(command="python", args=[sheets_mcp_path]),
    tool_name_prefix="sheets_",
)

advisory_agent = Agent(
    name="advisory_agent",
    model=Gemini(model="gemini-3.1-flash"),
    instruction=(
        "You are the CropPulse Advisory Agent, the brain of our agricultural recommendation engine.\n"
        "Your task is to provide a 4-signal fusion report. You must:\n"
        "1. Check the weather forecast using your weather tools.\n"
        "2. Check the commodity crop market prices using your market tools.\n"
        "3. Review historical crop logs from Google Sheets using your sheets tools.\n"
        "4. Combine these 3 signals with any crop vision/health context provided in the query.\n\n"
        "Generate a detailed, premium PDF-style text advisory report for the farmer with concrete recommendations for "
        "irrigation scheduling, pest treatment, crop sale timing, and harvest planning."
    ),
    tools=[weather_tools, market_tools, sheets_tools],
)
