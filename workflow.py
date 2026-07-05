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


def compile_advisory_input(ctx: Context, node_input: str) -> str:
    """Consolidate Vision, Weather, Markets, and Sheets inputs into a single prompt for Advisory."""
    # If the input was weather or market data, save it to state
    if node_input:
        if "weather_code" in node_input or "temperature" in node_input:
            ctx.state["weather_output"] = node_input
        elif "commodity" in node_input or "price" in node_input:
            ctx.state["market_output"] = node_input

    vision_out = ctx.state.get(
        "vision_output", "No image analyzed (Not required/No photo)."
    )
    weather_out = ctx.state.get("weather_output", "No location weather data retrieved.")
    market_out = ctx.state.get(
        "market_output", "No commodity market price data retrieved."
    )
    farm_context = ctx.state.get("farm_context", "No farm context available.")

    prompt = (
        f"Input Signals for Fusion:\n\n"
        f"1. VISION ASSESSMENT:\n{vision_out}\n\n"
        f"2. WEATHER FORECAST:\n{weather_out}\n\n"
        f"3. MARKET PRICE:\n{market_out}\n\n"
        f"4. FARM CONTEXT:\n{farm_context}\n\n"
        f"Generate the comprehensive advisory recommendation report."
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
            {"vision": vision_agent, "advisory": compile_advisory_input},
        ),
        # Fan-out from vision agent
        (vision_agent, weather_node),
        (vision_agent, market_node),
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
