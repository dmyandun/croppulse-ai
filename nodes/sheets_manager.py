"""
Sheets Manager Node - CropPulse AI
Calls the Google Sheets MCP server to read/write farm data across
the Profile, FarmGrid, CropPlan, Indicators, and InteractionLog tabs.
"""

from __future__ import annotations

import json
import os
import re

from google.adk import Context
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

SHEETS_MCP_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "mcp_servers",
    "sheets_mcp.py",
)

# Read from env or leave empty (triggers mock mode)
_SHEET_ID = os.environ.get("FARM_SHEET_ID", "")


async def _call_sheets_tool(
    session: ClientSession,
    tool_name: str,
    arguments: dict | None = None,
) -> dict | list:
    """Call a Sheets MCP tool and return parsed JSON result."""
    res = await session.call_tool(tool_name, arguments=arguments or {})
    raw = res.content[0].text if res.content else "{}"
    try:
        return json.loads(raw)
    except Exception:
        return {"raw": raw}


async def sheets_read_node(ctx: Context, node_input: str) -> str:
    """Read full farm context (profile, grid, plan, indicators) from Sheets.

    Populates ctx.state with:
      - farm_context (raw JSON)
      - latitude / longitude
      - canton / province / country
      - crops (list of all crop names on the farm)
      - selected_crop (first problematic crop or first crop)
      - sheet_id
    """
    sheet_id = _SHEET_ID

    params = StdioServerParameters(command="python", args=[SHEETS_MCP_PATH])

    try:
        async with stdio_client(params) as (read_stream, write_stream):
            async with ClientSession(read_stream, write_stream) as session:
                await session.initialize()

                # Read full context in one composite call
                full = await _call_sheets_tool(
                    session,
                    "read_full_farm_context",
                    {"sheet_id": sheet_id},
                )

                profile = full.get("profile", {})
                grid = full.get("farm_grid", {})
                plan = full.get("crop_plan", [])
                indicators = full.get("indicators", [])

                # Populate coordinates from profile
                ctx.state["latitude"] = float(profile.get("latitude", -0.2687))
                ctx.state["longitude"] = float(profile.get("longitude", -79.4326))
                ctx.state["canton"] = (
                    profile.get("canton", "el_carmen").lower().replace(" ", "_")
                )
                ctx.state["province"] = profile.get("province", "Manabí")
                ctx.state["country"] = profile.get("country", "Ecuador")
                ctx.state["sheet_id"] = sheet_id

                # Populate crop lists from grid
                parcels = grid.get("parcels", [])
                all_crops = [p["crop"] for p in parcels if p.get("crop")]
                ctx.state["crops"] = all_crops

                # Select the first unhealthy crop, or fallback to first crop
                unhealthy = [
                    p["crop"]
                    for p in parcels
                    if p.get("status", "Healthy").lower() not in ("healthy", "")
                ]
                ctx.state["selected_crop"] = (
                    unhealthy[0]
                    if unhealthy
                    else (all_crops[0] if all_crops else "cacao")
                )

                # Store full context for downstream agents
                farm_context = json.dumps(
                    {
                        "profile": profile,
                        "farm_grid": grid,
                        "crop_plan": plan,
                        "indicators": indicators,
                    },
                    indent=2,
                )
                ctx.state["farm_context"] = farm_context
                return farm_context

    except Exception as e:
        # Graceful fallback so the workflow can still continue
        fallback = json.dumps({"error": f"sheets_read_node failed: {e!s}"})
        ctx.state.setdefault("latitude", -0.2687)
        ctx.state.setdefault("longitude", -79.4326)
        ctx.state.setdefault("canton", "el_carmen")
        ctx.state.setdefault("crops", ["cacao"])
        ctx.state.setdefault("selected_crop", "cacao")
        ctx.state["farm_context"] = fallback
        return fallback


async def sheets_write_node(ctx: Context, node_input: str) -> str:
    """Parse advisory output and write indicators, plan updates, and interaction log.

    Reads the [INDICATORS] block from the advisory agent's response and
    writes it to the Indicators and CropPlan tabs. Also appends a summary
    record to the InteractionLog tab.
    """
    advisory_text = str(node_input)
    sheet_id = ctx.state.get("sheet_id", _SHEET_ID)

    # ── 1. Extract [INDICATORS] JSON block ──────────────────────────────────
    match = re.search(r"\[INDICATORS\]:\s*(\{.*?\})\s*$", advisory_text, re.DOTALL)
    if not match:
        match = re.search(r"(\{[^{}]*parcel_health[^{}]*\})", advisory_text, re.DOTALL)

    indicators_json = "{}"
    if match:
        indicators_json = match.group(1).strip()

    # ── 2. Build interaction log entry ──────────────────────────────────────
    intent = ctx.state.get("intent", "GENERAL_QUESTION")
    parcel = ctx.state.get("selected_crop", "unknown")
    mode = ctx.state.get("router_mode", 0)

    # Extract a short diagnosis and recommendation from the advisory text
    def _extract_section(text: str, label: str, max_chars: int = 200) -> str:
        m = re.search(
            rf"{label}[:\s]+(.+?)(?:\n\n|\Z)", text, re.DOTALL | re.IGNORECASE
        )
        return m.group(1).strip()[:max_chars] if m else ""

    diagnosis = _extract_section(advisory_text, "OBSERVATION")
    recommendation = _extract_section(advisory_text, "ACTION")

    log_entry = json.dumps(
        {
            "parcel": parcel,
            "mode": f"Mode {mode} — {intent}",
            "diagnosis": diagnosis,
            "recommendation": recommendation,
        }
    )

    params = StdioServerParameters(command="python", args=[SHEETS_MCP_PATH])

    try:
        async with stdio_client(params) as (read_stream, write_stream):
            async with ClientSession(read_stream, write_stream) as session:
                await session.initialize()

                # Write indicators and plan updates
                ind_result = await _call_sheets_tool(
                    session,
                    "write_indicators",
                    {"sheet_id": sheet_id, "indicators_json": indicators_json},
                )

                # Append interaction log
                log_result = await _call_sheets_tool(
                    session,
                    "append_interaction_log",
                    {"sheet_id": sheet_id, "log_entry_json": log_entry},
                )

                return json.dumps(
                    {
                        "indicators_write": ind_result,
                        "interaction_log": log_result,
                    },
                    indent=2,
                )

    except Exception as e:
        return json.dumps({"error": f"sheets_write_node failed: {e!s}"})
