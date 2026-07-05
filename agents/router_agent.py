from google.adk import Agent
from google.adk.models import Gemini

router_agent = Agent(
    name="router_agent",
    model=Gemini(model="gemini-3.1-flash"),
    instruction=(
        "You are the CropPulse Intent Router. Your job is to classify the user's query into "
        "one of the following exact categories in lowercase:\n"
        "- 'vision': if the user wants to analyze crop leaf images, diagnose pests/diseases, or inspect soil from an image.\n"
        "- 'weather': if the query is specifically about weather conditions, temperature, rain, or forecasts.\n"
        "- 'market': if the query is about crop prices, grain prices, market values, or commodity values.\n"
        "- 'sheets': if the query is about logging data, reading logs, writing logs, or accessing historical crop logs.\n"
        "- 'advisory': if the user wants recommendations, crop advice, fusion advisory, or general agricultural planning.\n\n"
        "Reply with ONLY the category name. Do not include extra text."
    ),
)
