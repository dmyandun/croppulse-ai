from google.adk import Workflow
from google.adk.apps import App
from google.adk.events import Event, EventActions

from agents.advisory_agent import advisory_agent
from agents.market_agent import market_agent
from agents.router_agent import router_agent
from agents.vision_agent import vision_agent
from agents.weather_agent import weather_agent
from nodes.security_screen import security_input_validation, security_output_validation
from nodes.sheets_manager import sheets_manager


def routing_func(node_input: str) -> Event:
    """Classifies user intent and routes to the appropriate agent."""
    cleaned = str(node_input).strip().lower()

    # Resolve the route based on key intent flags and wrap in EventActions for graph routing
    if "vision" in cleaned or "image" in cleaned or "crop_vision" in cleaned:
        return Event(output=cleaned, actions=EventActions(route="vision"))
    elif "weather" in cleaned:
        return Event(output=cleaned, actions=EventActions(route="weather"))
    elif "market" in cleaned or "price" in cleaned:
        return Event(output=cleaned, actions=EventActions(route="market"))
    elif "sheet" in cleaned or "log" in cleaned:
        return Event(output=cleaned, actions=EventActions(route="sheets"))
    elif "advisory" in cleaned or "recommend" in cleaned:
        return Event(output=cleaned, actions=EventActions(route="advisory"))

    # Default route fallback to advisory
    return Event(output=cleaned, actions=EventActions(route="advisory"))


# Define the graph execution flow using explicit Edges
root_workflow = Workflow(
    name="croppulse_workflow",
    edges=[
        ("START", security_input_validation),
        (security_input_validation, router_agent),
        (router_agent, routing_func),
        (
            routing_func,
            {
                "vision": vision_agent,
                "weather": weather_agent,
                "market": market_agent,
                "sheets": sheets_manager,
                "advisory": advisory_agent,
            },
        ),
        (vision_agent, security_output_validation),
        (weather_agent, security_output_validation),
        (market_agent, security_output_validation),
        (sheets_manager, security_output_validation),
        (advisory_agent, security_output_validation),
    ],
)

app = App(
    root_agent=root_workflow,
    name="croppulse-ai",
)
