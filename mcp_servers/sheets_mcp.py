import json
import os
from datetime import datetime

from mcp.server.fastmcp import FastMCP

mcp = FastMCP("Google Sheets Mock MCP Server")

DB_FILE = "crop_logs.json"


def _load_sheet_data() -> list:
    if os.path.exists(DB_FILE):
        try:
            with open(DB_FILE, encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass

    # Initialize mock data
    default_logs = [
        {
            "timestamp": "2026-07-01 08:00:00",
            "sheet": "crop_health",
            "crop": "Corn",
            "status": "Healthy",
            "notes": "Vegetative stage, normal watering.",
        },
        {
            "timestamp": "2026-07-02 09:30:00",
            "sheet": "crop_health",
            "crop": "Soybeans",
            "status": "Yellow Leaves",
            "notes": "Possible nitrogen deficiency in Block B.",
        },
        {
            "timestamp": "2026-07-03 14:15:00",
            "sheet": "operations",
            "action": "Fertilized",
            "target": "Soybeans Block B",
            "details": "Applied urea fertilizer.",
        },
    ]
    with open(DB_FILE, "w", encoding="utf-8") as f:
        json.dump(default_logs, f, indent=2)
    return default_logs


def _save_sheet_data(data: list) -> None:
    with open(DB_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)


@mcp.tool()
def append_log_row(sheet_name: str, row_json: str) -> str:
    """Append a new row of log data to the specified sheet.

    Args:
        sheet_name: The name of the sheet target (e.g. 'crop_health', 'operations').
        row_json: A JSON string containing keys and values for the row (e.g. '{"crop": "Wheat", "status": "Dry"}').
    """
    try:
        parsed_row = json.loads(row_json)
    except Exception:
        return "Error: Invalid row_json format. Please provide valid JSON."

    db = _load_sheet_data()
    parsed_row["sheet"] = sheet_name
    parsed_row["timestamp"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    db.append(parsed_row)
    _save_sheet_data(db)
    return (
        f"Successfully added row to sheet '{sheet_name}' at {parsed_row['timestamp']}."
    )


@mcp.tool()
def get_sheet_rows(sheet_name: str) -> str:
    """Get all rows for the specified sheet.

    Args:
        sheet_name: The name of the sheet target (e.g. 'crop_health', 'operations').
    """
    db = _load_sheet_data()
    rows = [row for row in db if row.get("sheet") == sheet_name]
    if not rows:
        return f"No rows found in sheet '{sheet_name}'."
    return json.dumps(rows, indent=2)


if __name__ == "__main__":
    mcp.run()
