import os

from google.adk import Agent
from google.adk.models import Gemini
from google.adk.tools import McpToolset
from mcp import StdioServerParameters

sheets_mcp_path = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "mcp_servers",
    "sheets_mcp.py",
)

sheets_tools = McpToolset(
    connection_params=StdioServerParameters(command="python", args=[sheets_mcp_path])
)

sheets_manager = Agent(
    name="sheets_manager",
    model=Gemini(model="gemini-3.1-flash"),
    instruction=(
        "You are the CropPulse Sheets Manager. Your role is to write crop logs, read historical agricultural records, "
        "and modify data sheets using your sheets tools."
    ),
    tools=[sheets_tools],
)
