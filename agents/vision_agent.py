"""
Vision Agent - CropPulse AI
========================

Role:
A specialized multimodal agent. It handles raw image artifacts uploaded by the
farmer and executes visual diagnostics using one of 7 distinct agricultural analysis
modes (Soil, Nutrient, Weed, Disease, Water stress, Maturity, Quality grading).

Design Isolation:
The Vision Agent is completely isolated from direct user conversation. It outputs a
structured diagnostic JSON payload that is ingested by the compile advisory node.
This ensures visual findings are fused with weather, market, and farm grid data
before final advice is composed, avoiding context pollution.
"""

from google.adk import Agent, Context
from google.adk.models import Gemini


async def analyze_crop_image(ctx: Context, mode: int, crop_type: str) -> str:
    """Run multimodal diagnostic on the uploaded image using one of the 7 specialized modes.

    Args:
        mode: Mode number (1-7).
        crop_type: The type of crop in the selected parcel (e.g. Cacao, Banana, Corn).
    """
    artifacts = await ctx.list_artifacts()
    image_file = None
    for art in artifacts:
        if art.lower().endswith((".png", ".jpg", ".jpeg", ".webp")):
            image_file = art
            break

    if not image_file:
        return (
            "No crop image found in this session. Please upload a leaf, plant, or soil image "
            "so that I can run the vision diagnostics. Currently, I support 7 modes of analysis: "
            "soil analysis, nutrient deficiency, weed identification, disease diagnosis, water stress, "
            "maturity assessment, and quality grading."
        )

    img_part = await ctx.load_artifact(image_file)
    if not img_part:
        return f"Failed to load image artifact '{image_file}'."

    prompts = {
        1: (
            "Mode 1 - SOIL_ANALYSIS: Analyze bare soil photo. Assess color (RGB-based pH estimation, organic matter), "
            "texture (clay/sand/loam), moisture level, and structure. Output a structured JSON assessment."
        ),
        2: (
            f"Mode 2 - NUTRIENT_DEFICIENCY: Analyze leaf photo. Knowing the crop type is '{crop_type}', "
            "identify deficiency patterns:\n"
            "- Intervenal yellowing on young leaves -> Iron (Fe) or Manganese (Mn)\n"
            "- Intervenal yellowing on old leaves -> Magnesium (Mg)\n"
            "- Uniform yellowing -> Nitrogen (N)\n"
            "- Burnt/necrotic edges -> Potassium (K)\n"
            "- Purple/red discoloration on old leaves -> Phosphorus (P)\n"
            "- Small deformed leaves -> Zinc (Zn) or Boron (B)"
        ),
        3: (
            f"Mode 3 - WEED_ID: Distinguish weeds from crops in the photo. Identify the weed species "
            f"and recommend control methods compatible with the crop '{crop_type}' in that parcel."
        ),
        4: (
            "Mode 4 - DISEASE_DIAGNOSIS: Identify plant diseases or pest damage. Estimate severity (mild/moderate/severe). "
            "For cacao: moniliasis, black pod, witches' broom. For banana: Fusarium TR4, black sigatoka. "
            "Output diagnosis with confidence level."
        ),
        5: (
            "Mode 5 - WATER_STRESS: Detect signs of dehydration (leaf curling, wilting, drooping). "
            "Distinguish true drought stress from temporary midday wilting."
        ),
        6: (
            "Mode 6 - MATURITY_ASSESSMENT: Evaluate fruit maturity against standard grading scales. "
            "For banana: Von Loesecke scale. For cacao: pod color and size assessment. Estimate days to optimal harvest grade."
        ),
        7: (
            "Mode 7 - QUALITY_GRADING: Classify harvested produce into quality grades (Grade 1/export, Grade 2/local market, "
            "Reject/subproducts). Estimate percentage distribution and lot value."
        ),
    }

    prompt = prompts.get(mode, prompts[1])

    # Use google-genai Client to run the request
    from google.genai import Client

    client = Client()

    try:
        response = client.models.generate_content(
            model="gemini-3.5-flash",
            contents=[
                img_part,
                (
                    "You are the Vision Agent for CropPulse AI. You analyze farm images using 7 specialized modes. "
                    f"You receive the mode ({mode}) and the crop type ('{crop_type}').\n\n"
                    f"Specific instruction for this run:\n{prompt}\n\n"
                    "CRITICAL: You do NOT return a final user-facing answer. You return a structured JSON assessment with: "
                    '{"mode": <number>, "diagnosis": "...", "confidence": <0-1>, "severity": "...", "details": {...}} '
                    "that feeds into the Advisory Agent."
                ),
            ],
        )
        return response.text or "Vision model did not return any text analysis."
    except Exception as e:
        return f"Error executing vision model call: {e!s}"


vision_agent = Agent(
    name="vision_agent",
    model=Gemini(model="gemini-3.5-flash"),
    instruction=(
        "You are the Vision Agent for CropPulse AI. You analyze farm images using 7 specialized modes. "
        "You receive the mode from the Router Agent and the farm context (which crop is in the selected parcel).\n\n"
        "Mode 1 - SOIL_ANALYSIS: Analyze bare soil photo. Assess color (RGB-based pH estimation, organic matter), texture (clay/sand/loam), moisture level, and structure. Output a structured JSON assessment.\n\n"
        "Mode 2 - NUTRIENT_DEFICIENCY: Analyze leaf photo. Knowing the crop type from the farm grid, identify deficiency patterns:\n"
        "- Intervenal yellowing on young leaves -> Iron (Fe) or Manganese (Mn)\n"
        "- Intervenal yellowing on old leaves -> Magnesium (Mg)\n"
        "- Uniform yellowing -> Nitrogen (N)\n"
        "- Burnt/necrotic edges -> Potassium (K)\n"
        "- Purple/red discoloration on old leaves -> Phosphorus (P)\n"
        "- Small deformed leaves -> Zinc (Zn) or Boron (B)\n\n"
        "Mode 3 - WEED_ID: Distinguish weeds from crops in the photo. Identify the weed species and recommend control methods compatible with the crop in that parcel.\n\n"
        "Mode 4 - DISEASE_DIAGNOSIS: Identify plant diseases or pest damage. Estimate severity (mild/moderate/severe). For cacao: moniliasis, black pod, witches' broom. For banana: Fusarium TR4, black sigatoka. Output diagnosis with confidence level.\n\n"
        "Mode 5 - WATER_STRESS: Detect signs of dehydration (leaf curling, wilting, drooping). Distinguish true drought stress from temporary midday wilting.\n\n"
        "Mode 6 - MATURITY_ASSESSMENT: Evaluate fruit maturity against standard grading scales. For banana: Von Loesecke scale. For cacao: pod color and size assessment. Estimate days to optimal harvest grade.\n\n"
        "Mode 7 - QUALITY_GRADING: Classify harvested produce into quality grades (Grade 1/export, Grade 2/local market, Reject/subproducts). Estimate percentage distribution and lot value.\n\n"
        'CRITICAL: You do NOT return a final user-facing answer. You return a structured JSON assessment with: {"mode": <number>, "diagnosis": "...", "confidence": <0-1>, "severity": "...", "details": {...}} that feeds into the Advisory Agent.'
    ),
    tools=[analyze_crop_image],
)
