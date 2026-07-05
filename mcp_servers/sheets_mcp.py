"""
Google Sheets MCP Server - CropPulse AI
Wraps the Google Sheets API v4 to read/write structured farm data.

Sheet structure expected:
  Tab "Profile"        — farmer location data
  Tab "FarmGrid"       — parcel layout with crop assignments
  Tab "CropPlan"       — calendar of activities
  Tab "Indicators"     — health status, pending actions, inspection history
  Tab "InteractionLog" — summary of each agent interaction

Authentication:
  Set the environment variable GOOGLE_SERVICE_ACCOUNT_JSON to the path of
  a service-account credentials JSON file with Sheets API access, or set
  GOOGLE_SHEETS_CREDENTIALS_JSON to the raw JSON string.

Fallback (no credentials):
  The server falls back to a local JSON file (crop_logs.json) as a mock.
"""

from __future__ import annotations

import json
import os
from datetime import datetime
from typing import Any

from mcp.server.fastmcp import FastMCP

mcp = FastMCP("CropPulse Google Sheets MCP Server")

# ---------------------------------------------------------------------------
# Internal helpers - Google Sheets v4 client
# ---------------------------------------------------------------------------
_SHEETS_CLIENT = None  # cached gspread client


def _get_sheets_client():
    """Return an authenticated gspread client, or None on failure."""
    global _SHEETS_CLIENT
    if _SHEETS_CLIENT is not None:
        return _SHEETS_CLIENT
    try:
        import gspread
        from google.oauth2.service_account import Credentials

        SCOPES = [
            "https://www.googleapis.com/auth/spreadsheets",
            "https://www.googleapis.com/auth/drive.readonly",
        ]

        cred_path = os.environ.get("GOOGLE_SERVICE_ACCOUNT_JSON")
        cred_json = os.environ.get("GOOGLE_SHEETS_CREDENTIALS_JSON")

        if cred_path and os.path.exists(cred_path):
            creds = Credentials.from_service_account_file(cred_path, scopes=SCOPES)
        elif cred_json:
            info = json.loads(cred_json)
            creds = Credentials.from_service_account_info(info, scopes=SCOPES)
        else:
            return None  # No credentials → fallback mode

        _SHEETS_CLIENT = gspread.authorize(creds)
        return _SHEETS_CLIENT
    except Exception:
        return None


def _use_mock() -> bool:
    """Return True when Google Sheets credentials are unavailable."""
    return _get_sheets_client() is None


# ---------------------------------------------------------------------------
# Local JSON mock store (fallback)
# ---------------------------------------------------------------------------
_MOCK_DB_FILE = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "crop_logs.json",
)

_DEFAULT_MOCK_DB: dict[str, Any] = {
    "Profile": {
        "country": "Ecuador",
        "province": "Manabí",
        "canton": "El Carmen",
        "latitude": -0.2687,
        "longitude": -79.4326,
        "farmer_name": "Demo Farmer",
        "farm_name": "Finca Demo",
        "total_hectares": 10.0,
    },
    "FarmGrid": {
        "rows": 3,
        "cols": 2,
        "parcels": [
            {"id": "A1", "crop": "cacao", "area_ha": 2.0, "status": "Healthy"},
            {"id": "A2", "crop": "banana", "area_ha": 1.5, "status": "Healthy"},
            {"id": "B1", "crop": "plantain", "area_ha": 1.5, "status": "Water Stress"},
            {"id": "B2", "crop": "maize", "area_ha": 2.0, "status": "Healthy"},
            {"id": "C1", "crop": "cassava", "area_ha": 1.5, "status": "Healthy"},
            {
                "id": "C2",
                "crop": "coffee",
                "area_ha": 1.5,
                "status": "Nutrient Deficiency",
            },
        ],
    },
    "CropPlan": [
        {
            "date": "2026-07-10",
            "parcel": "A1",
            "activity": "Pruning cacao trees",
            "status": "Pending",
        },
        {
            "date": "2026-07-12",
            "parcel": "B1",
            "activity": "Irrigation — water stress",
            "status": "Pending",
        },
        {
            "date": "2026-07-15",
            "parcel": "A2",
            "activity": "Sigatoka inspection",
            "status": "Pending",
        },
        {
            "date": "2026-07-18",
            "parcel": "C2",
            "activity": "Apply NPK fertiliser",
            "status": "Pending",
        },
    ],
    "Indicators": [
        {
            "parcel": "A1",
            "health_status": "Healthy",
            "last_inspection": "2026-07-01",
            "pending_action": "None",
        },
        {
            "parcel": "A2",
            "health_status": "Healthy",
            "last_inspection": "2026-07-01",
            "pending_action": "None",
        },
        {
            "parcel": "B1",
            "health_status": "Water Stress",
            "last_inspection": "2026-07-01",
            "pending_action": "Irrigate immediately",
        },
        {
            "parcel": "B2",
            "health_status": "Healthy",
            "last_inspection": "2026-07-01",
            "pending_action": "None",
        },
        {
            "parcel": "C1",
            "health_status": "Healthy",
            "last_inspection": "2026-07-01",
            "pending_action": "None",
        },
        {
            "parcel": "C2",
            "health_status": "Nutrient Deficiency",
            "last_inspection": "2026-07-01",
            "pending_action": "Apply NPK 15-15-15",
        },
    ],
    "InteractionLog": [],
}


def _load_mock() -> dict[str, Any]:
    if os.path.exists(_MOCK_DB_FILE):
        try:
            with open(_MOCK_DB_FILE, encoding="utf-8") as f:
                db = json.load(f)
                # Migrate old flat schema to new tabbed schema if needed
                if "Profile" not in db:
                    old = db
                    db = dict(_DEFAULT_MOCK_DB)
                    if "location" in old:
                        db["Profile"].update(old["location"])
                    if "grid" in old:
                        db["FarmGrid"]["parcels"] = [
                            {
                                "id": p["parcel_id"],
                                "crop": p["crop"],
                                "status": p.get("status", "Healthy"),
                                "area_ha": 1.0,
                            }
                            for p in old["grid"]
                        ]
                    if "crop_plan" in old:
                        db["CropPlan"] = [
                            {**e, "status": "Pending"} for e in old["crop_plan"]
                        ]
                return db
        except Exception:
            pass
    return dict(_DEFAULT_MOCK_DB)


def _save_mock(db: dict[str, Any]) -> None:
    with open(_MOCK_DB_FILE, "w", encoding="utf-8") as f:
        json.dump(db, f, indent=2, ensure_ascii=False)


# ---------------------------------------------------------------------------
# Google Sheets helpers (live mode)
# ---------------------------------------------------------------------------
def _sheet_to_records(ws) -> list[dict]:
    """Convert a worksheet to a list of dicts (header = row 1)."""
    rows = ws.get_all_values()
    if not rows:
        return []
    headers = rows[0]
    return [dict(zip(headers, row, strict=False)) for row in rows[1:] if any(row)]


def _append_rows(ws, rows: list[list]) -> None:
    ws.append_rows(rows, value_input_option="USER_ENTERED")


def _clear_and_write(ws, headers: list[str], rows: list[list]) -> None:
    ws.clear()
    ws.append_row(headers, value_input_option="USER_ENTERED")
    if rows:
        ws.append_rows(rows, value_input_option="USER_ENTERED")


# ---------------------------------------------------------------------------
# Tool 1: read_farm_profile
# ---------------------------------------------------------------------------
@mcp.tool()
def read_farm_profile(sheet_id: str = "") -> str:
    """Read farmer and farm location profile from the 'Profile' tab.

    Args:
        sheet_id: Google Spreadsheet ID. If empty, uses mock data.

    Returns:
        JSON with country, province, canton, lat/lon, farmer_name, farm_name.
    """
    if not sheet_id or _use_mock():
        db = _load_mock()
        return json.dumps(db.get("Profile", {}), indent=2)

    try:
        gc = _get_sheets_client()
        ss = gc.open_by_key(sheet_id)
        ws = ss.worksheet("Profile")
        records = _sheet_to_records(ws)
        # Profile tab: key-value pairs in columns A and B
        profile = {
            r.get("key", ""): r.get("value", "") for r in records if r.get("key")
        }
        return json.dumps(profile, indent=2)
    except Exception as e:
        return json.dumps({"error": f"read_farm_profile failed: {e!s}"})


# ---------------------------------------------------------------------------
# Tool 2: read_farm_grid
# ---------------------------------------------------------------------------
@mcp.tool()
def read_farm_grid(sheet_id: str = "") -> str:
    """Read the farm grid layout from the 'FarmGrid' tab.

    Args:
        sheet_id: Google Spreadsheet ID. Empty → mock data.

    Returns:
        JSON with rows, cols, and parcels list [{id, crop, area_ha, status}].
    """
    if not sheet_id or _use_mock():
        db = _load_mock()
        return json.dumps(db.get("FarmGrid", {}), indent=2)

    try:
        gc = _get_sheets_client()
        ss = gc.open_by_key(sheet_id)
        ws = ss.worksheet("FarmGrid")
        records = _sheet_to_records(ws)
        # Compute grid dimensions
        ids = [r.get("id", "") for r in records if r.get("id")]
        rows_count = max((ord(i[0]) - ord("A") + 1) for i in ids if i) if ids else 0
        cols_count = max(int(i[1:]) for i in ids if i and i[1:].isdigit()) if ids else 0
        return json.dumps(
            {"rows": rows_count, "cols": cols_count, "parcels": records}, indent=2
        )
    except Exception as e:
        return json.dumps({"error": f"read_farm_grid failed: {e!s}"})


# ---------------------------------------------------------------------------
# Tool 3: read_crop_plan
# ---------------------------------------------------------------------------
@mcp.tool()
def read_crop_plan(sheet_id: str = "") -> str:
    """Read the crop activity calendar from the 'CropPlan' tab.

    Args:
        sheet_id: Google Spreadsheet ID. Empty → mock data.

    Returns:
        JSON list of activities [{date, parcel, activity, status}].
    """
    if not sheet_id or _use_mock():
        db = _load_mock()
        return json.dumps(db.get("CropPlan", []), indent=2)

    try:
        gc = _get_sheets_client()
        ss = gc.open_by_key(sheet_id)
        ws = ss.worksheet("CropPlan")
        return json.dumps(_sheet_to_records(ws), indent=2)
    except Exception as e:
        return json.dumps({"error": f"read_crop_plan failed: {e!s}"})


# ---------------------------------------------------------------------------
# Tool 4: read_indicators
# ---------------------------------------------------------------------------
@mcp.tool()
def read_indicators(sheet_id: str = "") -> str:
    """Read parcel health indicators from the 'Indicators' tab.

    Args:
        sheet_id: Google Spreadsheet ID. Empty → mock data.

    Returns:
        JSON list of [{parcel, health_status, last_inspection, pending_action}].
    """
    if not sheet_id or _use_mock():
        db = _load_mock()
        return json.dumps(db.get("Indicators", []), indent=2)

    try:
        gc = _get_sheets_client()
        ss = gc.open_by_key(sheet_id)
        ws = ss.worksheet("Indicators")
        return json.dumps(_sheet_to_records(ws), indent=2)
    except Exception as e:
        return json.dumps({"error": f"read_indicators failed: {e!s}"})


# ---------------------------------------------------------------------------
# Tool 5: write_crop_plan
# ---------------------------------------------------------------------------
@mcp.tool()
def write_crop_plan(sheet_id: str, activities_json: str) -> str:
    """Write or append activities to the 'CropPlan' tab.

    Args:
        sheet_id: Google Spreadsheet ID. Empty → writes to mock.
        activities_json: JSON list of activities:
            [{date: YYYY-MM-DD, parcel: str, activity: str, status: str}]

    Returns:
        Confirmation string with timestamp.
    """
    try:
        activities = json.loads(activities_json)
        if not isinstance(activities, list):
            activities = [activities]
    except Exception as e:
        return json.dumps({"error": f"Invalid JSON: {e!s}"})

    if not sheet_id or _use_mock():
        db = _load_mock()
        existing = db.get("CropPlan", [])
        for act in activities:
            # Deduplicate by date + parcel + activity
            duplicate = any(
                e.get("date") == act.get("date")
                and e.get("parcel") == act.get("parcel")
                and e.get("activity") == act.get("activity")
                for e in existing
            )
            if not duplicate:
                existing.append(act)
        db["CropPlan"] = sorted(existing, key=lambda x: x.get("date", ""))
        _save_mock(db)
        return json.dumps(
            {
                "status": "ok",
                "records_written": len(activities),
                "timestamp": datetime.now().isoformat(),
            }
        )

    try:
        gc = _get_sheets_client()
        ss = gc.open_by_key(sheet_id)
        ws = ss.worksheet("CropPlan")
        rows = [
            [
                a.get("date", ""),
                a.get("parcel", ""),
                a.get("activity", ""),
                a.get("status", "Pending"),
            ]
            for a in activities
        ]
        _append_rows(ws, rows)
        return json.dumps(
            {
                "status": "ok",
                "records_written": len(rows),
                "timestamp": datetime.now().isoformat(),
            }
        )
    except Exception as e:
        return json.dumps({"error": f"write_crop_plan failed: {e!s}"})


# ---------------------------------------------------------------------------
# Tool 6: write_indicators
# ---------------------------------------------------------------------------
@mcp.tool()
def write_indicators(sheet_id: str, indicators_json: str) -> str:
    """Update parcel health indicators in the 'Indicators' tab.

    Args:
        sheet_id: Google Spreadsheet ID. Empty → writes to mock.
        indicators_json: JSON list or dict.
            As a list: [{parcel, health_status, last_inspection, pending_action}]
            As a dict with keys parcel_health / pending_actions / crop_plan_updates
              (legacy advisory agent format also accepted).

    Returns:
        Confirmation JSON.
    """
    try:
        payload = json.loads(indicators_json)
    except Exception as e:
        return json.dumps({"error": f"Invalid JSON: {e!s}"})

    # Normalise: accept both list format and advisory-agent dict format
    indicator_list: list[dict] = []
    plan_updates: list[dict] = []
    if isinstance(payload, list):
        indicator_list = payload
    elif isinstance(payload, dict):
        # Advisory-agent style: {"parcel_health": {}, "pending_actions": [], ...}
        health = payload.get("parcel_health", {})
        pending = payload.get("pending_actions", [])
        plan_updates = payload.get("crop_plan_updates", [])
        for parcel_id, status in health.items():
            action = next(
                (p.get("action", "") for p in pending if p.get("parcel") == parcel_id),
                "",
            )
            indicator_list.append(
                {
                    "parcel": parcel_id,
                    "health_status": status,
                    "last_inspection": datetime.now().strftime("%Y-%m-%d"),
                    "pending_action": action,
                }
            )

    if not sheet_id or _use_mock():
        db = _load_mock()
        existing: list[dict] = db.get("Indicators", [])
        for upd in indicator_list:
            found = False
            for rec in existing:
                if rec.get("parcel") == upd.get("parcel"):
                    rec.update(upd)
                    found = True
                    break
            if not found:
                existing.append(upd)
        db["Indicators"] = existing
        # Also apply plan updates
        if plan_updates:
            plan = db.get("CropPlan", [])
            for act in plan_updates:
                dup = any(
                    e.get("date") == act.get("date")
                    and e.get("parcel") == act.get("parcel")
                    and e.get("activity") == act.get("activity")
                    for e in plan
                )
                if not dup:
                    plan.append(act)
            db["CropPlan"] = sorted(plan, key=lambda x: x.get("date", ""))
        _save_mock(db)
        return json.dumps(
            {
                "status": "ok",
                "records_updated": len(indicator_list),
                "timestamp": datetime.now().isoformat(),
            }
        )

    try:
        gc = _get_sheets_client()
        ss = gc.open_by_key(sheet_id)
        ws = ss.worksheet("Indicators")
        headers = ["parcel", "health_status", "last_inspection", "pending_action"]
        rows = [[i.get(h, "") for h in headers] for i in indicator_list]
        _clear_and_write(ws, headers, rows)
        return json.dumps(
            {
                "status": "ok",
                "records_updated": len(rows),
                "timestamp": datetime.now().isoformat(),
            }
        )
    except Exception as e:
        return json.dumps({"error": f"write_indicators failed: {e!s}"})


# ---------------------------------------------------------------------------
# Tool 7: write_farm_grid
# ---------------------------------------------------------------------------
@mcp.tool()
def write_farm_grid(sheet_id: str, grid_json: str) -> str:
    """Write or update the farm grid layout in the 'FarmGrid' tab.

    Args:
        sheet_id: Google Spreadsheet ID. Empty → writes to mock.
        grid_json: JSON dict: {rows: int, cols: int,
                               parcels: [{id, crop, area_ha, status}]}

    Returns:
        Confirmation JSON.
    """
    try:
        grid = json.loads(grid_json)
    except Exception as e:
        return json.dumps({"error": f"Invalid JSON: {e!s}"})

    if not sheet_id or _use_mock():
        db = _load_mock()
        db["FarmGrid"] = grid
        _save_mock(db)
        parcels = grid.get("parcels", [])
        return json.dumps(
            {
                "status": "ok",
                "parcels_written": len(parcels),
                "timestamp": datetime.now().isoformat(),
            }
        )

    try:
        gc = _get_sheets_client()
        ss = gc.open_by_key(sheet_id)
        ws = ss.worksheet("FarmGrid")
        headers = ["id", "crop", "area_ha", "status"]
        rows = [[p.get(h, "") for h in headers] for p in grid.get("parcels", [])]
        _clear_and_write(ws, headers, rows)
        return json.dumps(
            {
                "status": "ok",
                "parcels_written": len(rows),
                "timestamp": datetime.now().isoformat(),
            }
        )
    except Exception as e:
        return json.dumps({"error": f"write_farm_grid failed: {e!s}"})


# ---------------------------------------------------------------------------
# Bonus tool: append_interaction_log
# ---------------------------------------------------------------------------
@mcp.tool()
def append_interaction_log(sheet_id: str, log_entry_json: str) -> str:
    """Append a summary record to the 'InteractionLog' tab.

    Args:
        sheet_id: Google Spreadsheet ID. Empty → writes to mock.
        log_entry_json: JSON dict with keys:
            date, parcel, mode, diagnosis, recommendation

    Returns:
        Confirmation JSON.
    """
    try:
        entry = json.loads(log_entry_json)
    except Exception as e:
        return json.dumps({"error": f"Invalid JSON: {e!s}"})

    entry.setdefault("date", datetime.now().strftime("%Y-%m-%d %H:%M"))

    if not sheet_id or _use_mock():
        db = _load_mock()
        db.setdefault("InteractionLog", []).append(entry)
        _save_mock(db)
        return json.dumps({"status": "ok", "timestamp": entry["date"]})

    try:
        gc = _get_sheets_client()
        ss = gc.open_by_key(sheet_id)
        ws = ss.worksheet("InteractionLog")
        row = [
            entry.get("date", ""),
            entry.get("parcel", ""),
            entry.get("mode", ""),
            entry.get("diagnosis", ""),
            entry.get("recommendation", ""),
        ]
        _append_rows(ws, [row])
        return json.dumps({"status": "ok", "timestamp": entry["date"]})
    except Exception as e:
        return json.dumps({"error": f"append_interaction_log failed: {e!s}"})


# ---------------------------------------------------------------------------
# Composite tool: read full farm context (profile + grid + plan + indicators)
# ---------------------------------------------------------------------------
@mcp.tool()
def read_full_farm_context(sheet_id: str = "") -> str:
    """Read the complete farm context across all tabs in one call.

    Args:
        sheet_id: Google Spreadsheet ID. Empty → mock data.

    Returns:
        JSON with profile, farm_grid, crop_plan, indicators.
    """
    profile = json.loads(read_farm_profile(sheet_id))
    grid = json.loads(read_farm_grid(sheet_id))
    plan = json.loads(read_crop_plan(sheet_id))
    indicators = json.loads(read_indicators(sheet_id))

    return json.dumps(
        {
            "profile": profile,
            "farm_grid": grid,
            "crop_plan": plan,
            "indicators": indicators,
        },
        indent=2,
    )


if __name__ == "__main__":
    mcp.run()
