"""
Router Agent - CropPulse AI
==========================

Role:
Acts as the initial parsing layer of the AI workflow. Classifies the farmer's
message into one of several agricultural intents and outputs a clean JSON
classification that determines how the Advisory Agent responds.
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
        "Your job is to classify the user's intent based on their message.\n\n"
        "You have access to the farm context from Google Sheets which tells you:\n"
        "- The farmer's location (country, province, canton)\n"
        "- Their farm grid layout (which crop is in which parcel)\n"
        "- Their crop plan and pending actions\n\n"
        "Classification rules:\n"
        "- If the message starts with 'Save my farm profile' -> PROFILE_SAVE\n"
        "- If the user asks about weather, rain, temperature, irrigation timing -> WEATHER_INQUIRY\n"
        "- If the user asks about prices, selling, market trends, best time to sell -> MARKET_INQUIRY\n"
        "- If the user asks about planting, scheduling, rotation, or what to plant -> CROP_PLANNING\n"
        "- If the user asks about harvest readiness, maturity, or when to harvest -> HARVEST_ASSESSMENT\n"
        "- If the user asks for a full farm assessment, audit, or general advice -> FARM_AUDIT\n"
        "- If the user asks about fertilizers, nutrients, soil health -> NUTRIENT_MANAGEMENT\n"
        "- If the user asks about pests, diseases, or treatments -> PEST_MANAGEMENT\n"
        "- For all other questions -> GENERAL_QUESTION\n\n"
        "CRITICAL: You MUST always respond with exactly one JSON object. Never return an empty response.\n\n"
        'Always respond with a JSON object: {"intent": "<INTENT>", "confidence": <0-1>}'
    ),
)

