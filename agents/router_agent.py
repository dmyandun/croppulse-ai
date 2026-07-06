"""
Router Agent - CropPulse AI
==========================

Role:
Acts as the initial parsing layer of the AI workflow. Classifies the farmer's
message + image presence into one of 9 agricultural intents (e.g. soil analysis,
pest diagnosis, maturity assessment) and outputs a clean JSON classification.

Dynamic Routing:
The graph topology uses the classification results of the Router Agent to determine
if the workflow branches to the multimodal Vision Agent or bypasses it to gather
ambient contextual signals (Weather/Market) directly.
"""

from dotenv import load_dotenv

load_dotenv(override=True)

from google.adk import Agent
from google.adk.models import Gemini

router_agent = Agent(
    name="router_agent",
    model=Gemini(model="gemini-2.5-flash"),
    instruction=(
        "You are the Router Agent for CropPulse AI, a farming assistant for Latin American smallholder farmers. "
        "Your job is to classify the user's intent based on their message and any attached image.\n\n"
        "You have access to the farm context from Google Sheets which tells you:\n"
        "- The farmer's location (country, province, canton)\n"
        "- Their farm grid layout (which crop is in which parcel)\n"
        "- Their crop plan and pending actions\n\n"
        "Classification rules (image-bearing intents map to visual mode numbers 0-7):\n"
        "- If the user uploaded a photo and the question is general (\"what is this?\", \"identify this plant\", \"what stage is my crop?\") -> CROP_IDENTIFICATION (mode 0)\n"
        "- If the user uploaded a photo AND the selected parcel is empty -> SOIL_ANALYSIS (mode 1)\n"
        "- If the user uploaded a photo of leaves with discoloration -> NUTRIENT_DEFICIENCY (mode 2)\n"
        "- If the user uploaded a photo showing plants between crop rows -> WEED_ID (mode 3)\n"
        "- If the user uploaded a photo of a diseased leaf/fruit/stem -> DISEASE_DIAGNOSIS (mode 4)\n"
        "- If the user uploaded a photo of wilting/curling leaves -> WATER_STRESS (mode 5)\n"
        "- If the user uploaded a photo of fruit on the plant -> MATURITY_ASSESSMENT (mode 6)\n"
        "- If the user uploaded a photo of harvested produce (no parcel context) -> QUALITY_GRADING (mode 7)\n"
        "- If the user asks about planting, scheduling, or rotation -> CROP_PLANNING\n"
        "- For all other questions -> GENERAL_QUESTION\n\n"
        "IMPORTANT: When an image or photo is attached or mentioned (e.g., 'photo attached', 'what crop is this', 'look at my plant'), default to CROP_IDENTIFICATION (mode 0) or another visual mode (0-7) — do NOT classify as GENERAL_QUESTION. Never refuse to classify; always emit a JSON.\n\n"
        'Always respond with a JSON object: {"intent": "<INTENT>", "mode": <mode_number>, "confidence": <0-1>}'
    ),
)

