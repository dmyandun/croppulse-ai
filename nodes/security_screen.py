import io
import re

from google.adk import Context
from google.genai import types
from PIL import Image


async def security_input_validation(ctx: Context, node_input: str) -> str:
    """Validate incoming user query for prompt injection and strip EXIF GPS data from uploaded crop images."""

    # 1. Strip EXIF GPS data from all attached images
    try:
        artifacts = await ctx.list_artifacts()
        for art in artifacts:
            if art.lower().endswith((".png", ".jpg", ".jpeg", ".webp")):
                part = await ctx.load_artifact(art)
                if part and part.inline_data and part.inline_data.data:
                    # Load image in PIL
                    img = Image.open(io.BytesIO(part.inline_data.data))

                    # Creating a new image copy without metadata strips EXIF completely
                    cleaned_img = Image.new(img.mode, img.size)
                    cleaned_img.putdata(list(img.getdata()))

                    out_buf = io.BytesIO()
                    fmt = img.format or "JPEG"
                    cleaned_img.save(out_buf, format=fmt)
                    cleaned_bytes = out_buf.getvalue()

                    cleaned_part = types.Part.from_bytes(
                        data=cleaned_bytes,
                        mime_type=part.inline_data.mime_type or f"image/{fmt.lower()}",
                    )
                    await ctx.save_artifact(art, cleaned_part)
    except Exception:
        # Ignore image cleaning errors silently to keep execution robust
        pass

    # 2. Check for text prompt injections
    query = str(node_input).lower()
    injections = [
        "ignore previous instructions",
        "ignore the instructions above",
        "override prompt",
        "system settings",
        "system prompt",
    ]
    for pattern in injections:
        if pattern in query:
            raise ValueError(
                f"Security validation failed: Prohibited instructions detected ({pattern})."
            )

    return node_input


def security_output_validation(node_input: str) -> str:
    """Validate advisory output against dangerous chemical dosage recommendations."""
    text = str(node_input)

    # Identify dosage levels (e.g. over 500 kg/ha or g/ha of general chemicals)
    matches = re.findall(
        r"(\d+(?:\.\d+)?)\s*(?:kg/ha|g/ha|litres/ha|liters/ha|g/plant)",
        text,
        re.IGNORECASE,
    )
    for value_str in matches:
        try:
            value = float(value_str)
            if value > 500.0:
                return (
                    "[Security Redaction] The generated report was blocked because it recommended chemical dosage "
                    "rates that exceed safety thresholds. Please contact your local agricultural extension service."
                )
        except ValueError:
            pass

    return node_input
