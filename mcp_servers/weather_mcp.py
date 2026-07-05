"""
Weather MCP Server - CropPulse AI
Connects to the Open-Meteo free API (no API key required).
Provides 3 tools: current weather, 7-day forecast, historical rain.
Includes a lookup table for Latin American cantons/municipalities.
"""

import json
from datetime import datetime, timedelta

import requests
from mcp.server.fastmcp import FastMCP

mcp = FastMCP("CropPulse Weather MCP Server")

# ---------------------------------------------------------------------------
# WMO Weather Interpretation Code → human-readable condition
# ---------------------------------------------------------------------------
WMO_CODES: dict[int, str] = {
    0: "Clear sky",
    1: "Mainly clear",
    2: "Partly cloudy",
    3: "Overcast",
    45: "Fog",
    48: "Depositing rime fog",
    51: "Light drizzle",
    53: "Moderate drizzle",
    55: "Dense drizzle",
    61: "Slight rain",
    63: "Moderate rain",
    65: "Heavy rain",
    71: "Slight snow",
    73: "Moderate snow",
    75: "Heavy snow",
    77: "Snow grains",
    80: "Slight rain showers",
    81: "Moderate rain showers",
    82: "Violent rain showers",
    85: "Slight snow showers",
    86: "Heavy snow showers",
    95: "Thunderstorm",
    96: "Thunderstorm with slight hail",
    99: "Thunderstorm with heavy hail",
}

# ---------------------------------------------------------------------------
# Latin America Location Lookup Table
# Format: {canonical_name: (latitude, longitude, country, province/dept)}
# ---------------------------------------------------------------------------
LOCATION_TABLE: dict[str, tuple[float, float, str, str]] = {
    # ── ECUADOR (24 provinces) ──────────────────────────────────────────────
    # Azuay
    "cuenca": (-2.9001, -79.0059, "Ecuador", "Azuay"),
    "giron": (-3.1608, -79.1537, "Ecuador", "Azuay"),
    "santa_isabel": (-3.3500, -79.3000, "Ecuador", "Azuay"),
    # Bolívar
    "guaranda": (-1.5941, -79.0014, "Ecuador", "Bolívar"),
    "chillanes": (-2.0000, -79.0500, "Ecuador", "Bolívar"),
    # Cañar
    "azogues": (-2.7392, -78.8467, "Ecuador", "Cañar"),
    "biblian": (-2.7167, -78.9000, "Ecuador", "Cañar"),
    "canar": (-2.5567, -78.9392, "Ecuador", "Cañar"),
    # Carchi
    "tulcan": (0.8117, -77.7178, "Ecuador", "Carchi"),
    "montufar": (0.6833, -77.7167, "Ecuador", "Carchi"),
    # Chimborazo
    "riobamba": (-1.6635, -78.6543, "Ecuador", "Chimborazo"),
    "alausi": (-2.2000, -78.8333, "Ecuador", "Chimborazo"),
    "chunchi": (-2.2833, -78.9167, "Ecuador", "Chimborazo"),
    # Cotopaxi
    "latacunga": (-0.9333, -78.6167, "Ecuador", "Cotopaxi"),
    "pujili": (-0.9583, -78.6953, "Ecuador", "Cotopaxi"),
    "salcedo": (-1.0500, -78.5917, "Ecuador", "Cotopaxi"),
    # El Oro
    "machala": (-3.2591, -79.9553, "Ecuador", "El Oro"),
    "santa_rosa": (-3.4500, -79.9667, "Ecuador", "El Oro"),
    "pasaje": (-3.3278, -79.8053, "Ecuador", "El Oro"),
    # Esmeraldas
    "esmeraldas": (0.9592, -79.6508, "Ecuador", "Esmeraldas"),
    "quininde": (0.3228, -79.4697, "Ecuador", "Esmeraldas"),
    "san_lorenzo": (1.2853, -78.8356, "Ecuador", "Esmeraldas"),
    # Galápagos
    "puerto_ayora": (-0.7393, -90.3129, "Ecuador", "Galápagos"),
    "puerto_baquerizo": (-0.9006, -89.6108, "Ecuador", "Galápagos"),
    # Guayas
    "guayaquil": (-2.1894, -79.8891, "Ecuador", "Guayas"),
    "duran": (-2.1711, -79.8297, "Ecuador", "Guayas"),
    "milagro": (-2.1344, -79.5919, "Ecuador", "Guayas"),
    "daule": (-1.8600, -79.9800, "Ecuador", "Guayas"),
    "samborondon": (-2.0650, -79.7372, "Ecuador", "Guayas"),
    # Imbabura
    "ibarra": (0.3519, -78.1222, "Ecuador", "Imbabura"),
    "otavalo": (0.2342, -78.2622, "Ecuador", "Imbabura"),
    "cotacachi": (0.3044, -78.2728, "Ecuador", "Imbabura"),
    "antonio_ante": (0.3300, -78.1900, "Ecuador", "Imbabura"),
    # Loja
    "loja": (-3.9931, -79.2042, "Ecuador", "Loja"),
    "catamayo": (-3.9850, -79.3550, "Ecuador", "Loja"),
    "macara": (-4.3667, -79.9500, "Ecuador", "Loja"),
    "cariamanga": (-4.3333, -79.5583, "Ecuador", "Loja"),
    # Los Ríos
    "babahoyo": (-1.8022, -79.5342, "Ecuador", "Los Ríos"),
    "quevedo": (-1.0228, -79.4622, "Ecuador", "Los Ríos"),
    "vinces": (-1.5500, -79.7500, "Ecuador", "Los Ríos"),
    # Manabí
    "portoviejo": (-1.0542, -80.4536, "Ecuador", "Manabí"),
    "manta": (-0.9333, -80.7333, "Ecuador", "Manabí"),
    "chone": (-0.6943, -80.0975, "Ecuador", "Manabí"),
    "el_carmen": (-0.2687, -79.4326, "Ecuador", "Manabí"),
    "pedernales": (0.0786, -80.0536, "Ecuador", "Manabí"),
    "jipijapa": (-1.3467, -80.5789, "Ecuador", "Manabí"),
    "montecristi": (-1.0444, -80.6583, "Ecuador", "Manabí"),
    "bahia_de_caraquez": (-0.5997, -80.4239, "Ecuador", "Manabí"),
    "rocafuerte": (-0.9167, -80.4667, "Ecuador", "Manabí"),
    # Morona Santiago
    "macas": (-2.3078, -78.1167, "Ecuador", "Morona Santiago"),
    "sucua": (-2.4667, -78.1667, "Ecuador", "Morona Santiago"),
    # Napo
    "tena": (-0.9929, -77.8131, "Ecuador", "Napo"),
    "archidona": (-0.9167, -77.8000, "Ecuador", "Napo"),
    # Orellana
    "francisco_de_orellana": (-0.4597, -76.9881, "Ecuador", "Orellana"),
    "loreto": (-0.6667, -77.3167, "Ecuador", "Orellana"),
    # Pastaza
    "puyo": (-1.4917, -78.0028, "Ecuador", "Pastaza"),
    # Pichincha
    "quito": (-0.2295, -78.5243, "Ecuador", "Pichincha"),
    "cayambe": (0.0403, -78.1472, "Ecuador", "Pichincha"),
    "mejia": (-0.5500, -78.5500, "Ecuador", "Pichincha"),
    "rumiñahui": (-0.3333, -78.4500, "Ecuador", "Pichincha"),
    "pedro_moncayo": (0.0833, -78.2333, "Ecuador", "Pichincha"),
    # Santa Elena
    "santa_elena": (-2.2272, -80.8592, "Ecuador", "Santa Elena"),
    "salinas": (-2.2167, -80.9667, "Ecuador", "Santa Elena"),
    "la_libertad": (-2.2333, -80.9000, "Ecuador", "Santa Elena"),
    # Santo Domingo de los Tsáchilas
    "santo_domingo": (-0.2543, -79.1716, "Ecuador", "Santo Domingo"),
    # Sucumbíos
    "lago_agrio": (0.0897, -76.8758, "Ecuador", "Sucumbíos"),
    "shushufindi": (-0.1833, -76.6500, "Ecuador", "Sucumbíos"),
    # Tungurahua
    "ambato": (-1.2400, -78.6197, "Ecuador", "Tungurahua"),
    "banos": (-1.3950, -78.4244, "Ecuador", "Tungurahua"),
    "pelileo": (-1.3333, -78.5333, "Ecuador", "Tungurahua"),
    # Zamora Chinchipe
    "zamora": (-4.0667, -78.9500, "Ecuador", "Zamora Chinchipe"),
    # ── COLOMBIA (major departments) ────────────────────────────────────────
    "bogota": (4.7110, -74.0721, "Colombia", "Cundinamarca"),
    "medellin": (6.2442, -75.5812, "Colombia", "Antioquia"),
    "cali": (3.4516, -76.5320, "Colombia", "Valle del Cauca"),
    "barranquilla": (10.9685, -74.7813, "Colombia", "Atlántico"),
    "cartagena": (10.3910, -75.4794, "Colombia", "Bolívar"),
    "cucuta": (7.8939, -72.5078, "Colombia", "Norte de Santander"),
    "bucaramanga": (7.1254, -73.1198, "Colombia", "Santander"),
    "pereira": (4.8087, -75.6906, "Colombia", "Risaralda"),
    "manizales": (5.0703, -75.5138, "Colombia", "Caldas"),
    "armenia": (4.5339, -75.6811, "Colombia", "Quindío"),
    "ibague": (4.4389, -75.2322, "Colombia", "Tolima"),
    "neiva": (2.9273, -75.2819, "Colombia", "Huila"),
    "villavicencio": (4.1420, -73.6266, "Colombia", "Meta"),
    "monteria": (8.7575, -75.8814, "Colombia", "Córdoba"),
    "pasto": (1.2136, -77.2811, "Colombia", "Nariño"),
    "valledupar": (10.4631, -73.2532, "Colombia", "Cesar"),
    "sincelejo": (9.3047, -75.3978, "Colombia", "Sucre"),
    "riohacha": (11.5444, -72.9072, "Colombia", "La Guajira"),
    "popayan": (2.4448, -76.6147, "Colombia", "Cauca"),
    "florencia": (1.6144, -75.6062, "Colombia", "Caquetá"),
    "san_andres": (12.5847, -81.7006, "Colombia", "San Andrés"),
    "leticia": (-4.2153, -69.9406, "Colombia", "Amazonas"),
    "yopal": (5.3378, -72.3950, "Colombia", "Casanare"),
    "mocoa": (1.1522, -76.6486, "Colombia", "Putumayo"),
    "mitu": (1.2536, -70.2339, "Colombia", "Vaupés"),
    # ── PERU (major departments) ─────────────────────────────────────────────
    "lima": (-12.0464, -77.0428, "Peru", "Lima"),
    "arequipa": (-16.4090, -71.5375, "Peru", "Arequipa"),
    "trujillo": (-8.1116, -79.0288, "Peru", "La Libertad"),
    "chiclayo": (-6.7714, -79.8409, "Peru", "Lambayeque"),
    "iquitos": (-3.7437, -73.2516, "Peru", "Loreto"),
    "piura": (-5.1945, -80.6328, "Peru", "Piura"),
    "cusco": (-13.5319, -71.9675, "Peru", "Cusco"),
    "huancayo": (-12.0651, -75.2049, "Peru", "Junín"),
    "puno": (-15.8402, -70.0219, "Peru", "Puno"),
    "tacna": (-18.0066, -70.2464, "Peru", "Tacna"),
    "cajamarca": (-7.1597, -78.5197, "Peru", "Cajamarca"),
    "ayacucho": (-13.1588, -74.2236, "Peru", "Ayacucho"),
    "chimbote": (-9.0853, -78.5783, "Peru", "Áncash"),
    "huaraz": (-9.5297, -77.5278, "Peru", "Áncash"),
    "ica": (-14.0678, -75.7286, "Peru", "Ica"),
    "huanuco": (-9.9289, -76.2422, "Peru", "Huánuco"),
    "pucallpa": (-8.3791, -74.5539, "Peru", "Ucayali"),
    "moyobamba": (-6.0340, -76.9714, "Peru", "San Martín"),
    "tarapoto": (-6.4850, -76.3620, "Peru", "San Martín"),
    "tumbes": (-3.5669, -80.4515, "Peru", "Tumbes"),
    "puerto_maldonado": (-12.5933, -69.1892, "Peru", "Madre de Dios"),
    "abancay": (-13.6394, -72.8811, "Peru", "Apurímac"),
    "moquegua": (-17.1942, -70.9353, "Peru", "Moquegua"),
    "cerro_de_pasco": (-10.6867, -76.2628, "Peru", "Pasco"),
    "huancavelica": (-12.7833, -74.9756, "Peru", "Huancavelica"),
}


def _resolve_coordinates(
    location: str,
) -> tuple[float, float, str | None, str | None]:
    """Try to resolve a location name to (lat, lon, country, province)."""
    key = location.lower().strip().replace(" ", "_").replace("-", "_")
    if key in LOCATION_TABLE:
        lat, lon, country, province = LOCATION_TABLE[key]
        return lat, lon, country, province
    return None, None, None, None


def _wmo_description(code: int) -> str:
    return WMO_CODES.get(code, f"Unknown weather code {code}")


# ---------------------------------------------------------------------------
# Tool 1: Current weather
# ---------------------------------------------------------------------------
@mcp.tool()
def get_current_weather(
    latitude: float,
    longitude: float,
    location_name: str = "",
) -> str:
    """Get the current weather conditions for a geographic location.

    Args:
        latitude: Latitude coordinate (e.g. -0.2687 for El Carmen, Ecuador).
        longitude: Longitude coordinate (e.g. -79.4326 for El Carmen, Ecuador).
        location_name: Optional name of the location (canton, city, province).
                       If provided, coordinates will be looked up automatically.

    Returns:
        JSON with temperature_celsius, humidity_percent, precipitation_mm,
        wind_speed_kmh, weather_condition, location metadata.
    """
    if location_name:
        lat, lon, _country, _province = _resolve_coordinates(location_name)
        if lat is not None:
            latitude, longitude = lat, lon

    url = (
        "https://api.open-meteo.com/v1/forecast"
        f"?latitude={latitude}&longitude={longitude}"
        "&current=temperature_2m,relative_humidity_2m,precipitation,"
        "weather_code,wind_speed_10m"
        "&timezone=auto"
    )
    try:
        resp = requests.get(url, timeout=15)
        resp.raise_for_status()
        data = resp.json()
        c = data.get("current", {})
        result = {
            "latitude": latitude,
            "longitude": longitude,
            "location_name": location_name or "custom coordinates",
            "timestamp": c.get("time", ""),
            "temperature_celsius": c.get("temperature_2m"),
            "humidity_percent": c.get("relative_humidity_2m"),
            "precipitation_mm": c.get("precipitation"),
            "wind_speed_kmh": c.get("wind_speed_10m"),
            "weather_code": c.get("weather_code"),
            "weather_condition": _wmo_description(c.get("weather_code", -1)),
        }
        return json.dumps(result, indent=2)
    except Exception as e:
        return json.dumps({"error": f"Failed to fetch current weather: {e!s}"})


# ---------------------------------------------------------------------------
# Tool 2: 7-day forecast
# ---------------------------------------------------------------------------
@mcp.tool()
def get_7day_forecast(
    latitude: float,
    longitude: float,
    location_name: str = "",
) -> str:
    """Get the 7-day daily weather forecast for a geographic location.

    Args:
        latitude: Latitude coordinate.
        longitude: Longitude coordinate.
        location_name: Optional location name for coordinate lookup.

    Returns:
        JSON with daily high/low temps, precipitation probability,
        humidity forecast, and weather condition per day.
    """
    if location_name:
        lat, lon, _c, _p = _resolve_coordinates(location_name)
        if lat is not None:
            latitude, longitude = lat, lon

    url = (
        "https://api.open-meteo.com/v1/forecast"
        f"?latitude={latitude}&longitude={longitude}"
        "&daily=temperature_2m_max,temperature_2m_min,"
        "precipitation_sum,precipitation_probability_max,"
        "relative_humidity_2m_max,weather_code"
        "&forecast_days=7"
        "&timezone=auto"
    )
    try:
        resp = requests.get(url, timeout=15)
        resp.raise_for_status()
        data = resp.json()
        daily = data.get("daily", {})
        dates = daily.get("time", [])
        days = []
        for i, date in enumerate(dates):
            days.append(
                {
                    "date": date,
                    "temp_max_celsius": daily.get("temperature_2m_max", [None] * 7)[i],
                    "temp_min_celsius": daily.get("temperature_2m_min", [None] * 7)[i],
                    "precipitation_mm": daily.get("precipitation_sum", [None] * 7)[i],
                    "precipitation_probability_pct": daily.get(
                        "precipitation_probability_max", [None] * 7
                    )[i],
                    "humidity_max_pct": daily.get(
                        "relative_humidity_2m_max", [None] * 7
                    )[i],
                    "weather_condition": _wmo_description(
                        daily.get("weather_code", [0] * 7)[i]
                    ),
                }
            )
        return json.dumps(
            {
                "latitude": latitude,
                "longitude": longitude,
                "location_name": location_name or "custom coordinates",
                "forecast_days": days,
            },
            indent=2,
        )
    except Exception as e:
        return json.dumps({"error": f"Failed to fetch 7-day forecast: {e!s}"})


# ---------------------------------------------------------------------------
# Tool 3: Historical rain (last N days)
# ---------------------------------------------------------------------------
@mcp.tool()
def get_historical_rain(
    latitude: float,
    longitude: float,
    days_back: int = 14,
    location_name: str = "",
) -> str:
    """Get cumulative precipitation for the past N days - useful for leaching risk.

    Args:
        latitude: Latitude coordinate.
        longitude: Longitude coordinate.
        days_back: Number of days to look back (1-92). Default 14.
        location_name: Optional location name for coordinate lookup.

    Returns:
        JSON with daily precipitation records, total accumulated rain,
        leaching_risk assessment (low/medium/high).
    """
    if location_name:
        lat, lon, _c, _p = _resolve_coordinates(location_name)
        if lat is not None:
            latitude, longitude = lat, lon

    days_back = max(1, min(days_back, 92))
    end_date = datetime.utcnow().date()
    start_date = end_date - timedelta(days=days_back)

    url = (
        "https://api.open-meteo.com/v1/forecast"
        f"?latitude={latitude}&longitude={longitude}"
        f"&daily=precipitation_sum"
        f"&start_date={start_date}&end_date={end_date}"
        "&timezone=auto"
    )
    try:
        resp = requests.get(url, timeout=15)
        resp.raise_for_status()
        data = resp.json()
        daily = data.get("daily", {})
        dates = daily.get("time", [])
        rain_vals = daily.get("precipitation_sum", [])

        records = [
            {"date": d, "precipitation_mm": r}
            for d, r in zip(dates, rain_vals, strict=False)
        ]
        total_mm = sum(r for r in rain_vals if r is not None)

        # Simple leaching risk heuristic
        if total_mm > 200:
            leaching_risk = "high"
        elif total_mm > 80:
            leaching_risk = "medium"
        else:
            leaching_risk = "low"

        return json.dumps(
            {
                "latitude": latitude,
                "longitude": longitude,
                "location_name": location_name or "custom coordinates",
                "period_start": str(start_date),
                "period_end": str(end_date),
                "days_analyzed": days_back,
                "total_precipitation_mm": round(total_mm, 1),
                "leaching_risk": leaching_risk,
                "daily_records": records,
            },
            indent=2,
        )
    except Exception as e:
        return json.dumps({"error": f"Failed to fetch historical rain: {e!s}"})


# ---------------------------------------------------------------------------
# Helper tool: resolve location name to coordinates
# ---------------------------------------------------------------------------
@mcp.tool()
def resolve_location(location_name: str) -> str:
    """Resolve a Latin American canton/municipality name to GPS coordinates.

    Args:
        location_name: Name of the canton, city, or municipality
                       (e.g. 'el_carmen', 'guayaquil', 'medellin').

    Returns:
        JSON with latitude, longitude, country, and province.
    """
    lat, lon, country, province = _resolve_coordinates(location_name)
    if lat is not None:
        return json.dumps(
            {
                "location_name": location_name,
                "latitude": lat,
                "longitude": lon,
                "country": country,
                "province_or_department": province,
            }
        )
    # Return available locations if not found
    available = sorted(LOCATION_TABLE.keys())
    return json.dumps(
        {
            "error": f"Location '{location_name}' not found.",
            "available_locations_count": len(available),
            "sample_locations": available[:30],
        }
    )


if __name__ == "__main__":
    mcp.run()
