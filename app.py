import os

import uvicorn
from dotenv import load_dotenv
from fastapi import Request
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from google.adk.agents.run_config import RunConfig, StreamingMode
from google.adk.artifacts import InMemoryArtifactService
from google.adk.cli.fast_api import get_fast_api_app
from google.adk.cli.utils.service_factory import create_session_service_from_options
from google.adk.events import Event, EventActions
from google.adk.runners import Runner
from google.genai import types

from mcp_servers.market_mcp import COMMODITIES, _normalise_commodity
from workflow import root_workflow

load_dotenv()

# Set agent directory as current directory
AGENT_DIR = os.path.dirname(os.path.abspath(__file__))

# Initialize session service, artifact service, and runner using the same config.
# Without an artifact_service, ctx.list_artifacts() raises "Artifact service is
# not initialized" and the vision agent is never reached — Phase 18 fix.
session_service = create_session_service_from_options(base_dir=AGENT_DIR)
artifact_service = InMemoryArtifactService()
runner = Runner(
    agent=root_workflow,
    session_service=session_service,
    artifact_service=artifact_service,
    app_name="croppulse-ai",
)

app = get_fast_api_app(
    agents_dir=AGENT_DIR,
    web=False,
    a2a=True,
    default_llm_model="gemini-2.5-flash",
    gemini_enterprise_app_name="croppulse-ai",
)

# Unregister default ADK /run route to allow our custom legacy_run route override
app.router.routes = [r for r in app.router.routes if r.path != "/run"]

BUILD_ID = "build_20260705_2100"


@app.get("/version")
async def custom_version():
    return {
        "version": "1.0.0",
        "commit_sha": os.getenv("COMMIT_SHA", BUILD_ID),
    }


@app.get("/api/market/validate-crop")
async def validate_crop(name: str):
    name_clean = name.strip()
    match_key = _normalise_commodity(name_clean)
    if match_key:
        return {"status": "exact", "match": match_key}

    name_lower = name_clean.lower()
    matches = []
    for key, meta in COMMODITIES.items():
        if (
            name_lower in key
            or any(name_lower in alias for alias in meta["aliases"])
            or key in name_lower
        ):
            matches.append(key)

    if matches:
        return {"status": "suggest", "matches": matches}
    return {"status": "none"}


@app.post("/feedback")
async def collect_feedback():
    return {"status": "success"}


@app.post("/run")
async def legacy_run(request: Request):
    try:
        import base64

        body = await request.json()
        user_id = body.get("user_id", "default_user")
        session_id = body.get("session_id", "default_session")
        new_message_raw = body.get("new_message", {})
        # Optional client-supplied state envelope. Used to seed farm_context,
        # sheet_id, crops, and coordinates so the workflow does not fall back
        # to the demo mock DB when Cloud Run has no Sheets credentials.
        state_delta = body.get("state_delta") or {}

        text = ""
        image_inline_parts = []
        for p in new_message_raw.get("parts", []) or []:
            if not text and isinstance(p.get("text"), str):
                text = p.get("text", "")
            inline = p.get("inline_data") or p.get("inlineData")
            if isinstance(inline, dict) and inline.get("data"):
                image_inline_parts.append(inline)

        try:
            session = await session_service.get_session(
                app_name="croppulse-ai", user_id=user_id, session_id=session_id
            )
        except Exception:
            session = None

        if not session:
            session = await session_service.create_session(
                app_name="croppulse-ai", user_id=user_id, session_id=session_id
            )

        if isinstance(state_delta, dict) and state_delta:
            try:
                # Persist the client-supplied state envelope via the session
                # service so the workflow's ctx.state reflects it. In-memory
                # session.state mutation is not enough — some session backends
                # re-load state on run_async, and only append_event actually
                # commits state_delta through the session's persistence layer.
                seed_event = Event(
                    author="user",
                    actions=EventActions(state_delta=state_delta),
                )
                await session_service.append_event(session, seed_event)
            except Exception:
                logging_mod = __import__("logging")
                logging_mod.getLogger(__name__).warning(
                    "legacy_run: failed to apply state_delta (%d keys)",
                    len(state_delta),
                )
                # Fallback: best-effort direct mutation for backends that keep
                # session.state fresh across run_async.
                try:
                    session.state.update(state_delta)
                except Exception:
                    pass

        # Persist uploaded images as ADK artifacts so nodes downstream can
        # discover them via ctx.list_artifacts() / ctx.load_artifact(). We
        # deliberately keep the workflow Content text-only — the vision agent
        # loads its image from the artifact channel, not from message parts,
        # and function nodes like security_input_validation would otherwise
        # trip ADK's "non-text parts dropped during auto-conversion" warning.
        for idx, inline in enumerate(image_inline_parts):
            try:
                raw = base64.b64decode(inline["data"])
                mime = (
                    inline.get("mime_type")
                    or inline.get("mimeType")
                    or "image/jpeg"
                )
                ext = mime.split("/")[-1] if "/" in mime else "bin"
                filename = f"user_upload_{idx}.{ext}"
                part = types.Part.from_bytes(data=raw, mime_type=mime)
                await artifact_service.save_artifact(
                    app_name="croppulse-ai",
                    user_id=user_id,
                    session_id=session_id,
                    filename=filename,
                    artifact=part,
                )
            except Exception:
                logging_mod = __import__("logging")
                logging_mod.getLogger(__name__).warning(
                    "legacy_run: failed to save inline image as artifact"
                )

        message = types.Content(
            role="user", parts=[types.Part.from_text(text=text)]
        )

        events = []
        async for event in runner.run_async(
            new_message=message,
            user_id=user_id,
            session_id=session_id,
            run_config=RunConfig(streaming_mode=StreamingMode.NONE),
        ):
            events.append(event)

        return JSONResponse(content=jsonable_encoder(events))
    except Exception as e:
        import logging

        logging.exception("Error in custom /run route")
        return JSONResponse(status_code=500, content={"error": str(e)})


# Mount custom frontend static files
frontend_path = os.path.join(AGENT_DIR, "frontend")
if os.path.exists(frontend_path):
    app.mount("/ui", StaticFiles(directory=frontend_path, html=True), name="frontend")

    @app.get("/")
    async def redirect_to_ui():
        return RedirectResponse(url="/ui/index.html")


if __name__ == "__main__":
    port = int(os.getenv("PORT", 8000))
    print(f"Starting CropPulse AI App wrapper on port {port}...")
    print(f"Custom UI will be served at http://localhost:{port}/ui/index.html")
    uvicorn.run(app, host="0.0.0.0", port=port)
