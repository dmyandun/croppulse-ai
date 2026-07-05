import json
import os
from datetime import datetime

from mcp.server.fastmcp import FastMCP

mcp = FastMCP("Google Sheets Mock MCP Server")

DB_FILE = "crop_logs.json"


def _load_db() -> dict:
    if os.path.exists(DB_FILE):
        try:
            with open(DB_FILE, encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass

    # Initialize default farm database
    default_db = {
        "location": {
            "country": "Ecuador",
            "province": "Manabi",
            "canton": "El Carmen",
            "latitude": -0.2687,
            "longitude": -79.4326,
        },
        "grid": [
            {
                "parcel_id": "P1",
                "crop": "Cacao",
                "status": "Healthy",
                "neighbor_parcels": ["P2"],
            },
            {
                "parcel_id": "P2",
                "crop": "Banana",
                "status": "Healthy",
                "neighbor_parcels": ["P1", "P3"],
            },
            {
                "parcel_id": "P3",
                "crop": "Corn",
                "status": "Dry",
                "neighbor_parcels": ["P2"],
            },
        ],
        "crop_plan": [
            {"date": "2026-07-10", "parcel": "P1", "activity": "Pruning cacao trees"},
            {
                "date": "2026-07-15",
                "parcel": "P2",
                "activity": "Inspect banana leaves for Sigatoka",
            },
        ],
        "pending_actions": [
            {"parcel": "P3", "action": "Apply water/irrigate", "due_date": "2026-07-06"}
        ],
    }
    with open(DB_FILE, "w", encoding="utf-8") as f:
        json.dump(default_db, f, indent=2)
    return default_db


def _save_db(data: dict) -> None:
    with open(DB_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)


@mcp.tool()
def read_farm_context() -> str:
    """Read the current farm grid layout, crop plan, location, and pending actions from sheets."""
    db = _load_db()
    return json.dumps(db, indent=2)


@mcp.tool()
def write_farm_indicators(indicators_json: str) -> str:
    """Write updated indicators, health status, and crop plans back to sheets.

    Args:
        indicators_json: A JSON string containing updates to parcel_health, pending_actions, next_activity, and crop_plan_updates.
    """
    try:
        updates = json.loads(indicators_json)
    except Exception as e:
        return f"Error: Invalid JSON input format ({e!s})."

    db = _load_db()

    # 1. Update parcel health in grid
    health_updates = updates.get("parcel_health", {})
    for grid_item in db.get("grid", []):
        p_id = grid_item["parcel_id"]
        if p_id in health_updates:
            grid_item["status"] = health_updates[p_id]

    # 2. Add/Overwrite pending actions
    pending = updates.get("pending_actions", [])
    if pending:
        db["pending_actions"] = pending

    # 3. Apply crop plan updates
    plan_updates = updates.get("crop_plan_updates", [])
    for item in plan_updates:
        # Check if identical activity exists, else append
        exists = False
        for p in db.get("crop_plan", []):
            if (
                p.get("date") == item.get("date")
                and p.get("parcel") == item.get("parcel")
                and p.get("activity") == item.get("activity")
            ):
                exists = True
                break
        if not exists:
            db.setdefault("crop_plan", []).append(item)

    # Save the updated database
    _save_db(db)
    return f"Successfully updated sheets indicators at {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}."


if __name__ == "__main__":
    mcp.run()
