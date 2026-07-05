import os

from google.adk import Agent
from google.adk.models import Gemini
from google.adk.tools import McpToolset
from mcp import StdioServerParameters

market_mcp_path = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "mcp_servers",
    "market_mcp.py",
)

market_tools = McpToolset(
    connection_params=StdioServerParameters(command="python", args=[market_mcp_path])
)

market_agent = Agent(
    name="market_agent",
    model=Gemini(model="gemini-3.5-flash"),
    instruction=(
        "You are the CropPulse Market Analyst. Your role is to check commodity prices for crops and explain the "
        "implications (financial outlook, selling recommendations, price trends) for the farmer."
    ),
    tools=[market_tools],
)
