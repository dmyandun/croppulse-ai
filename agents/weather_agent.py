import os

from google.adk import Agent
from google.adk.models import Gemini
from google.adk.tools import McpToolset
from mcp import StdioServerParameters

weather_mcp_path = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "mcp_servers",
    "weather_mcp.py",
)

weather_tools = McpToolset(
    connection_params=StdioServerParameters(command="python", args=[weather_mcp_path])
)

weather_agent = Agent(
    name="weather_agent",
    model=Gemini(model="gemini-3.5-flash"),
    instruction=(
        "You are the CropPulse Weather Specialist. Your role is to fetch weather forecasts using your weather tools "
        "and explain the implications (temperature, rainfall, wind) for the farmer's crops and activities."
    ),
    tools=[weather_tools],
)
