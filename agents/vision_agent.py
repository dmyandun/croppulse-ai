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

from dotenv import load_dotenv

load_dotenv(override=True)

from google.adk import Agent, Context
from google.adk.models import Gemini


async def analyze_crop_image(ctx: Context, mode: int, crop_type: str) -> str:
    """Run multimodal diagnostic on the uploaded image using one of the 7 specialized modes.

    Args:
        mode: Mode number (1-7).
        crop_type: The type of crop in the selected parcel (e.g. Cacao, Banana, Corn).
    """
    image_file = None
    img_part = None

    # Try listing artifacts (if artifact service is initialized)
    try:
        artifacts = await ctx.list_artifacts()
        for art in artifacts:
            if any(art.lower().endswith(ext) for ext in (".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp", ".tiff")) or art.startswith("user_upload_"):
                image_file = art
                break
        if image_file:
            img_part = await ctx.load_artifact(image_file)
    except Exception as e:
        import logging
        logging.getLogger(__name__).warning("analyze_crop_image: failed to load artifact: %s", e)

    # Fallback to checking user_content parts directly if no artifact was loaded
    if not img_part:
        ALLOWED_IMAGE_MIMES = {
            "image/jpeg",
            "image/png",
            "image/webp",
            "image/gif",
            "image/bmp",
            "image/tiff",
        }
        try:
            user_content = ctx.user_content
            if user_content and user_content.parts:
                for part in user_content.parts:
                    if hasattr(part, "inline_data") and part.inline_data is not None:
                        mime = (part.inline_data.mime_type or "").lower()
                        if mime in ALLOWED_IMAGE_MIMES:
                            img_part = part
                            break
        except Exception as e:
            import logging
            logging.getLogger(__name__).warning("analyze_crop_image: failed to load from user_content: %s", e)

    if not img_part:
        # No image uploaded — still emit a valid JSON so Advisory can respond
        # helpfully instead of refusing.
        return (
            '{"mode": 0, "identified_crop": "unknown", "growth_stage": "unknown", '
            '"condition": "unknown", "confidence": 0.0, '
            '"human_description": "No image was provided; unable to run vision analysis."}'
        )

    # Strip EXIF metadata inline if not already done (e.g. under native execution)
    if hasattr(img_part, "inline_data") and img_part.inline_data is not None:
        mime = (img_part.inline_data.mime_type or "").lower()
        raw_bytes = img_part.inline_data.data or b""
        if mime in ("image/jpeg", "image/png") and raw_bytes:
            try:
                from nodes.security_screen import strip_exif
                cleaned_bytes = strip_exif(raw_bytes, mime)
                if len(cleaned_bytes) != len(raw_bytes):
                    from google.genai import types
                    img_part = types.Part.from_bytes(data=cleaned_bytes, mime_type=mime)
            except Exception as exc:
                import logging
                logging.getLogger(__name__).warning("analyze_crop_image: inline EXIF stripping failed: %s", exc)

    prompts = {
        0: (
            f"Mode 0 - CROP_IDENTIFICATION: Look at the photo and identify the crop plant, its growth stage, "
            f"and its general condition. The farmer's declared context is crop='{crop_type}'. "
            "Even if the image is imperfect, produce a best-guess identification — do NOT refuse. "
            "Growth stages available: seedling, vegetative, flowering_fruiting, harvesting. "
            "Condition options: healthy, stressed, diseased, damaged."
        ),
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

    prompt = prompts.get(mode, prompts[0])

    # Use the authenticated api_client from the agent's model to support Vertex AI on Cloud Run
    client = getattr(getattr(ctx, "agent", None), "model", None)
    if client is not None and hasattr(client, "api_client"):
        genai_client = client.api_client
    else:
        from google.genai import Client
        genai_client = Client()

    try:
        response = genai_client.models.generate_content(
            model="gemini-2.5-flash",
            contents=[
                img_part,
                (
                    "You are the Vision Agent for CropPulse AI. You analyze farm images.\n\n"
                    f"Selected mode: {mode}. Declared crop context: '{crop_type}'.\n\n"
                    f"Specific instruction for this run:\n{prompt}\n\n"
                    "CRITICAL — YOU MUST ALWAYS EMIT VALID JSON, NEVER PROSE. NEVER REFUSE. "
                    "If uncertainty is high, still output a best-guess with a low confidence value.\n\n"
                    "Mode 0 output schema:\n"
                    '  {"mode": 0, "identified_crop": "<crop name>", '
                    '"growth_stage": "seedling|vegetative|flowering_fruiting|harvesting", '
                    '"condition": "healthy|stressed|diseased|damaged", '
                    '"confidence": <0.0-1.0>, '
                    '"human_description": "<1-2 friendly sentences>"}\n\n'
                    "Modes 1-7 output schema (specialised diagnostics):\n"
                    '  {"mode": <number>, "diagnosis": "<short>", "confidence": <0.0-1.0>, '
                    '"severity": "<mild|moderate|severe>", "details": {<key facts>}, '
                    '"human_description": "<1-2 friendly sentences>"}\n\n'
                    "This JSON is consumed by the Advisory Agent, which will turn `human_description` "
                    "into the farmer-facing reply. Never leave `human_description` empty."
                ),
            ],
        )
        return response.text or (
            '{"mode": 0, "identified_crop": "unknown", "growth_stage": "unknown", '
            '"condition": "unknown", "confidence": 0.0, '
            '"human_description": "Vision model did not return any output."}'
        )
    except Exception as e:
        return (
            '{"mode": 0, "identified_crop": "unknown", "growth_stage": "unknown", '
            '"condition": "unknown", "confidence": 0.0, '
            f'"human_description": "Vision model error: {e!s}"}}'
        )


vision_agent = Agent(
    name="vision_agent",
    model=Gemini(model="gemini-2.5-flash"),
    instruction=(
        "You are the Vision Agent for CropPulse AI. You analyze farm images across 8 specialized modes. "
        "You receive the mode from the Router Agent and the farm context (which crop is in the selected parcel).\n\n"
        "Mode 0 - CROP_IDENTIFICATION (default when the user just wants to know what plant they're looking at, "
        "or during onboarding when they don't know the growth stage): identify the crop and its growth stage. "
        "Growth stages: seedling, vegetative, flowering_fruiting, harvesting. Also report overall condition.\n\n"
        "Mode 1 - SOIL_ANALYSIS: Analyze bare soil photo. Assess color (RGB-based pH estimation, organic matter), texture (clay/sand/loam), moisture level, and structure.\n\n"
        "Mode 2 - NUTRIENT_DEFICIENCY: Analyze leaf photo. Knowing the crop type from the farm grid, identify deficiency patterns:\n"
        "- Intervenal yellowing on young leaves -> Iron (Fe) or Manganese (Mn)\n"
        "- Intervenal yellowing on old leaves -> Magnesium (Mg)\n"
        "- Uniform yellowing -> Nitrogen (N)\n"
        "- Burnt/necrotic edges -> Potassium (K)\n"
        "- Purple/red discoloration on old leaves -> Phosphorus (P)\n"
        "- Small deformed leaves -> Zinc (Zn) or Boron (B)\n\n"
        "Mode 3 - WEED_ID: Distinguish weeds from crops in the photo.\n\n"
        "Mode 4 - DISEASE_DIAGNOSIS: Identify plant diseases or pest damage. Estimate severity. "
        "For cacao: moniliasis, black pod, witches' broom. For banana: Fusarium TR4, black sigatoka.\n\n"
        "Mode 5 - WATER_STRESS: Detect signs of dehydration.\n\n"
        "Mode 6 - MATURITY_ASSESSMENT: Evaluate fruit maturity. Banana: Von Loesecke scale. Cacao: pod color and size.\n\n"
        "Mode 7 - QUALITY_GRADING: Grade harvested produce.\n\n"
        "OPERATION:\n"
        "- ALWAYS call the `analyze_crop_image` tool with the mode number and the crop type. Never answer without calling it.\n"
        "- If the router did not provide a mode or provided one that does not clearly fit the user question, call with mode=0.\n"
        "- Return the tool's raw JSON output verbatim as your final response. Do NOT wrap it in prose. Do NOT add commentary. "
        "The Advisory Agent will consume the `human_description` field.\n"
        "- NEVER refuse. NEVER return apology text. If the image is unclear, the tool JSON will still contain a best-guess with a low `confidence` value."
    ),
    tools=[analyze_crop_image],
)
