import os

import uvicorn
from dotenv import load_dotenv
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles
from google.adk.cli.fast_api import get_fast_api_app

load_dotenv()

# Set agent directory as current directory
AGENT_DIR = os.path.dirname(os.path.abspath(__file__))

app = get_fast_api_app(
    agents_dir=AGENT_DIR,
    web=True,
    default_llm_model="gemini-3.1-flash",
)

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
