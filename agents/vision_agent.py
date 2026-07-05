from google.adk import Agent, Context
from google.adk.models import Gemini


async def analyze_crop_image(ctx: Context, mode: str) -> str:
    """Run multimodal analysis on the uploaded crop image using the selected mode.

    Args:
        mode: The mode of analysis. Options:
              'disease' (Pest/Disease Detection),
              'nutrient' (Nutrient Deficiency),
              'growth' (Growth Stage),
              'soil' (Soil Health),
              'weed' (Weed Detection),
              'harvest' (Harvest Readiness),
              'general' (General Health).
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
            "disease, nutrient, growth, soil, weed, harvest, and general."
        )

    img_part = await ctx.load_artifact(image_file)
    if not img_part:
        return f"Failed to load image artifact '{image_file}'."

    prompts = {
        "disease": "Identify any pests or diseases visible on the crop/leaf. Provide diagnosis and treatment recommendations.",
        "nutrient": "Analyze the leaves for yellowing, necrosis, or pattern changes indicating nutrient deficiencies (e.g., Nitrogen, Phosphorus, Potassium).",
        "growth": "Classify the plant growth stage (e.g., seedling, vegetative, flowering, fruiting, senescent) and overall vigor.",
        "soil": "Assess the soil health, moisture levels, texture, and color visible in the image.",
        "weed": "Distinguish between the cash crop and surrounding weeds. Provide advice on weed management.",
        "harvest": "Check if the crop, fruit, or vegetable is ready for harvest based on color, size, and maturation signs.",
        "general": "Perform a general health checkup of the crop and list any potential areas of concern.",
    }

    prompt = prompts.get(mode.lower().strip(), prompts["general"])

    # Use google-genai Client to run the request
    from google.genai import Client

    client = Client()

    try:
        response = client.models.generate_content(
            model="gemini-3.1-flash", contents=[img_part, prompt]
        )
        return response.text or "Vision model did not return any text analysis."
    except Exception as e:
        return f"Error executing vision model call: {e!s}"


vision_agent = Agent(
    name="vision_agent",
    model=Gemini(model="gemini-3.1-flash"),
    instruction=(
        "You are the CropPulse Vision Specialist. You support 7 modes of agricultural analysis: "
        "pest/disease detection, nutrient deficiency analysis, growth stage classification, soil health assessment, "
        "weed detection, harvest readiness check, and general health inspection. Use your tool to analyze the user's uploaded images."
    ),
    tools=[analyze_crop_image],
)
