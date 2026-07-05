"""
CropPulse AI Workflow & Architecture Configuration (ADK 2.0)
============================================================

This module defines the execution graph, conditional routing, and context compiling
pipelines for CropPulse AI.

Architecture Overview
---------------------
We chose a directed graph workflow (ADK 2.0 Graph) rather than a linear or conversational
chain for several critical reasons:
1.  **Deterministic Control Flow:** Agriculture advice demands strict execution patterns.
    By defining explicit edges, we ensure that security screens run first and last,
    and sheets database lookups happen before the routing decisions.
2.  **Conditional Branching:** Depending on whether an image is attached and the user's intent
    (classified by the Router Agent), execution must branch. For example, text-only questions
    bypass the Vision Agent and go directly to compile advisory inputs, saving time and API cost.
3.  **Parallel Execution:** Independent context-gathering nodes (Weather and Markets) run
    concurrently once the primary image or intent is resolved, maximizing throughput.
4.  **State Isolation & Context Fusion:** The graph uses a shared `ctx.state` object to
    accumulate context across nodes, preventing LLM context pollution and ensuring the final
    Advisory Agent receives clean, structured data.

Agent Roles and System Interaction
----------------------------------
-   **Router Agent (agents/router_agent.py):** The gateway agent. It inspects the farmer's
    query and image metadata to classify user intent into one of 9 modes (e.g. Soil Analysis,
    Disease Diagnosis). It returns a structured JSON classification used by the router function
    `route_after_router` to dynamically direct graph traversal.
-   **Vision Agent (agents/vision_agent.py):** A multimodal specialist. It executes deep
    visual diagnostics on uploaded photos using 7 specialized agronomy modes (e.g., Von
    Loesecke banana maturity scale, leaf necrosis pattern matching). Crucially, the Vision Agent
    does not talk to the user; it outputs a raw JSON assessment that feeds into the fusion layer.
-   **Advisory Agent (agents/advisory_agent.py):** The only farmer-facing agent. It takes
    the compiled input prompt, fuses all available data, and writes a highly structured,
    personable response back to the farmer in simple, jargon-free English.

Cross-Signal Intelligence (4-Signal Fusion)
-------------------------------------------
The core intelligence layer relies on fusing 4 distinct signals in `compile_advisory_input`:
1.  **Vision assessment:** Localised plant, leaf, or soil visual characteristics.
2.  **Weather conditions:** Current data + 7-day forecast + 14-day historical rain.
3.  **Market trends:** Spot commodity prices + 30-day historical trajectories.
4.  **Farm context:** The physical farm grid layout, crop plan, and historical performance.
Fusing these allows the Advisory Agent to make cross-domain insights. For example, if a leaf shows
mild dehydration (Vision Signal) but the weather forecast predicts 80mm of rain (Weather Signal)
and market prices for the crop are falling (Market Signal), the agent will recommend *delaying*
costly supplemental irrigation to optimize the farmer's bottom line.

Model Context Protocol (MCP) Modularity
---------------------------------------
Instead of hardcoding external API clients (like weather or market databases) directly into
the agent instructions or codebase, CropPulse AI uses Model Context Protocol (MCP) servers:
-   `weather_mcp.py` dynamically queries meteorology services.
-   `market_mcp.py` runs date-seeded deterministic price history generators.
-   `sheets_mcp.py` acts as our persistent relational database layer.
MCP decouples the agent logic from data ingestion, allowing servers to be updated, sandboxed,
or swapped out without rebuilding or re-tuning the core LLM agents.

Security Screen Implementation
------------------------------
To ensure safety in agricultural recommendations and protect against standard LLM failures:
-   **Security Input Node (`security_input_validation`):** Runs immediately at `START` to
    truncate input length (guarding against cost bloating/token-stuffing), detect prompt injection
    techniques, and strip EXIF location metadata from uploaded images.
-   **Security Output Node (`security_output_validation`):** Runs after the advisory text is written
    and saved. It scans for excessive chemical dosage recommendations, appends disclaimers if
    the diagnosis confidence is low (<70% or prose-based uncertainty), and redacts PII data
    (cédulas, email, phone) to prevent sheets-sourced privacy leaks.
"""

import json

from google.adk import Context, Workflow
from google.adk.apps import App
from google.adk.events import Event, EventActions

from agents.advisory_agent import advisory_agent
from agents.router_agent import router_agent
from agents.vision_agent import vision_agent
from nodes.market_node import market_node
from nodes.security_screen import security_input_validation, security_output_validation
from nodes.sheets_manager import sheets_read_node, sheets_write_node
from nodes.weather_node import weather_node


def route_after_router(ctx: Context, node_input: str) -> Event:
    """Classify the user intent and check for image presence, then routing appropriately."""
    router_text = str(node_input)
    ctx.state["router_output"] = router_text

    # Attempt to parse router intent and mode from JSON
    try:
        cleaned_json = router_text.strip()
        if cleaned_json.startswith("```"):
            cleaned_json = cleaned_json.split("```")[1]
            if cleaned_json.startswith("json"):
                cleaned_json = cleaned_json[4:]
        cleaned_json = cleaned_json.strip()

        parsed = json.loads(cleaned_json)
        ctx.state["intent"] = parsed.get("intent", "GENERAL_QUESTION")
        ctx.state["router_mode"] = int(parsed.get("mode", 7))
        ctx.state["confidence"] = float(parsed.get("confidence", 1.0))
    except Exception:
        ctx.state["intent"] = "GENERAL_QUESTION"
        ctx.state["router_mode"] = 7
        ctx.state["confidence"] = 1.0

    has_image = ctx.state.get("has_image", False)
    intent = ctx.state.get("intent", "GENERAL_QUESTION")
    mode = ctx.state.get("router_mode", 7)
    selected_crop = ctx.state.get("selected_crop", "cacao")

    visual_intents = {
        "SOIL_ANALYSIS",
        "NUTRIENT_DEFICIENCY",
        "WEED_ID",
        "DISEASE_DIAGNOSIS",
        "WATER_STRESS",
        "MATURITY_ASSESSMENT",
        "QUALITY_GRADING",
    }

    if has_image and intent in visual_intents:
        # Prompt visual agent with mode and crop context
        prompt = f"Selected Mode: Mode {mode}\nSelected Crop: {selected_crop}\n\nRun visual analysis on crop."
        return Event(output=prompt, actions=EventActions(route="vision"))
    else:
        return Event(output=router_text, actions=EventActions(route="advisory"))


def dispatch_advisory_signals(ctx: Context, node_input: str) -> str:
    """Fan-out anchor for the text-only advisory branch.

    The vision branch fans out to weather + market via edges from `vision_agent`.
    Text-only questions skip vision, so without this passthrough the weather and
    market MCP nodes would never fire and the Advisory Agent would receive
    "No weather data retrieved." / "No market price data retrieved."
    """
    return node_input or ""


def compile_advisory_input(ctx: Context, node_input: str) -> str:
    """Consolidate Vision, Weather, Markets, and Sheets inputs into a single prompt for Advisory."""
    # Stash incoming data into state keyed by signal type
    if node_input:
        try:
            parsed = json.loads(node_input)
            # Detect weather payload by presence of 'current_weather' key
            if isinstance(parsed, dict) and "current_weather" in parsed:
                ctx.state["weather_output"] = node_input
            # Detect market payload by presence of 'commodities' key
            elif isinstance(parsed, dict) and "commodities" in parsed:
                ctx.state["market_output"] = node_input
        except Exception:
            # Plain text (e.g. vision agent output)
            if "vision_output" not in ctx.state:
                ctx.state["vision_output"] = node_input

    vision_out = ctx.state.get(
        "vision_output", "No image analyzed (not required / no photo submitted)."
    )
    weather_out = ctx.state.get("weather_output", "No weather data retrieved.")
    market_out = ctx.state.get("market_output", "No market price data retrieved.")
    farm_context = ctx.state.get("farm_context", "No farm context available.")
    user_message = ctx.state.get("user_message", "").strip()

    # Pretty-print JSON signals if they are valid JSON blobs
    def _fmt(raw: str) -> str:
        try:
            return json.dumps(json.loads(raw), indent=2)
        except Exception:
            return raw

    # Extract the real parcel roster from the farm grid so the Advisory Agent
    # can be grounded and cannot invent parcel IDs like "A1/B2/C2".
    valid_parcels: list[str] = []
    try:
        fc = json.loads(farm_context) if isinstance(farm_context, str) else farm_context
        for p in (fc.get("farm_grid", {}) or {}).get("parcels", []) or []:
            pid = p.get("id")
            crop = p.get("crop", "unknown")
            if pid:
                valid_parcels.append(f"{pid} ({crop})")
    except Exception:
        pass
    parcel_roster = ", ".join(valid_parcels) if valid_parcels else "none registered"

    prompt = (
        f"USER QUESTION (answer THIS, verbatim in intent):\n{user_message or '[no user question provided]'}\n\n"
        f"VALID PARCELS ON THIS FARM (the ONLY parcel IDs and crops you may reference): {parcel_roster}\n\n"
        "Input Signals for Cross-Signal Intelligence Fusion:\n\n"
        f"1. VISION ASSESSMENT:\n{vision_out}\n\n"
        f"2. WEATHER DATA (current + 7-day forecast + historical rain):\n{_fmt(weather_out)}\n\n"
        f"3. MARKET PRICES (spot + 30-day trend for all farm crops):\n{_fmt(market_out)}\n\n"
        f"4. FARM CONTEXT (profile, grid, crop plan, indicators):\n{_fmt(farm_context)}\n\n"
        "Now respond. If the USER QUESTION is a simple, direct question, answer it conversationally in 1-4 sentences using ONLY the valid parcels listed above — do NOT use the OBSERVATION/CONTEXT/ACTION template and do NOT emit an [INDICATORS] block. "
        "Only use the full template + [INDICATORS] block when the user explicitly asked for a comprehensive farm audit, general advice, or a diagnostic assessment of the whole farm."
    )
    return prompt


# Define graph execution flow
root_workflow = Workflow(
    name="croppulse_workflow",
    edges=[
        # START through security input and sheets read
        ("START", security_input_validation),
        (security_input_validation, sheets_read_node),
        # Read Sheets context feeds into Router Agent
        (sheets_read_node, router_agent),
        (router_agent, route_after_router),
        # Route options from Router branch
        (
            route_after_router,
            {"vision": vision_agent, "advisory": dispatch_advisory_signals},
        ),
        # Fan-out from vision agent (image-bearing intents)
        (vision_agent, weather_node),
        (vision_agent, market_node),
        # Fan-out from dispatch (text-only intents) — mirrors vision_agent so
        # weather and market signals always reach the Advisory Agent
        (dispatch_advisory_signals, weather_node),
        (dispatch_advisory_signals, market_node),
        # Fan-in from parallel nodes to advisory compile
        (weather_node, compile_advisory_input),
        (market_node, compile_advisory_input),
        # Trigger Advisory Agent with compiled prompt
        (compile_advisory_input, advisory_agent),
        # Post-advisory actions
        (advisory_agent, sheets_write_node),
        (sheets_write_node, security_output_validation),
    ],
)

app = App(
    root_agent=root_workflow,
    name="croppulse-ai",
)
