import os

import uvicorn
from dotenv import load_dotenv
from fastapi import Request
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from google.adk.agents.run_config import RunConfig, StreamingMode
from google.adk.cli.fast_api import get_fast_api_app
from google.adk.cli.utils.service_factory import create_session_service_from_options
from google.adk.runners import Runner
from google.genai import types

from workflow import root_workflow

load_dotenv()

# Set agent directory as current directory
AGENT_DIR = os.path.dirname(os.path.abspath(__file__))

# Initialize session service and runner using the same config
session_service = create_session_service_from_options(base_dir=AGENT_DIR)
runner = Runner(
    agent=root_workflow, session_service=session_service, app_name="croppulse-ai"
)

app = get_fast_api_app(
    agents_dir=AGENT_DIR,
    web=False,
    a2a=True,
    default_llm_model="gemini-3.5-flash",
    gemini_enterprise_app_name="croppulse-ai",
)

BUILD_ID = "build_20260705_0045"


@app.get("/version")
async def custom_version():
    return {
        "version": "1.0.0",
        "commit_sha": os.getenv("COMMIT_SHA", BUILD_ID),
    }


@app.post("/feedback")
async def collect_feedback():
    return {"status": "success"}


@app.post("/run")
async def legacy_run(request: Request):
    try:
        body = await request.json()
        user_id = body.get("user_id", "default_user")
        session_id = body.get("session_id", "default_session")
        new_message_raw = body.get("new_message", {})

        text = ""
        parts = new_message_raw.get("parts", [])
        if parts:
            text = parts[0].get("text", "")

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

        message = types.Content(role="user", parts=[types.Part.from_text(text=text)])

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
