import os
from datetime import datetime, timezone
from typing import Optional

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="HeatLine AI API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

OPEN_METEO_BASE_URL = os.getenv("OPEN_METEO_BASE_URL", "https://api.open-meteo.com/v1")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")

JOB_LOAD = {
    "delivery partner": 2.0,
    "construction": 4.0,
    "street vendor": 1.0,
}

class AnalyzeRequest(BaseModel):
    latitude: float
    longitude: float
    location: str
    job_type: str
    shift_start: str = Field(pattern=r"^\d{2}:\d{2}$")
    shift_end: str = Field(pattern=r"^\d{2}:\d{2}$")


def clamp(v, lo=0.0, hi=100.0):
    return max(lo, min(hi, v))


def hsi_score(temp, humidity, uv, apparent, job_type):
    # MVP screening/proxy score. It is intentionally not a medical diagnostic.
    heat_component = clamp((temp - 24.0) * 3.0, 0, 48)
    humidity_component = clamp((humidity - 45.0) * 0.55, 0, 30)
    uv_component = clamp(uv * 1.6, 0, 12)
    apparent_component = clamp((apparent - 26.0) * 1.0, 0, 10)
    workload = JOB_LOAD.get(job_type.lower(), 2.0)
    return round(clamp(heat_component + humidity_component + uv_component + apparent_component + workload), 1)


def risk_band(score):
    if score >= 70:
        return "HIGH"
    if score >= 40:
        return "MEDIUM"
    return "LOW"


def fallback_briefing(location, job_type, shift_start, shift_end, results):
    if not results:
        return "No hourly weather result was available. Continue normal heat-safety practices and use the forecast to plan work."
    peak = max(results, key=lambda x: x["hsi"])
    risky = [x for x in results if x["risk"] != "LOW"]
    risky_hours = ", ".join(x["time"][11:16] for x in risky[:5]) or "none"
    return (
        f"1. Riskiest hours: {risky_hours}. Peak exposure is around {peak['time'][11:16]} with an HSI of {peak['hsi']}. "
        f"2. Recommended shift actions: For the {job_type} shift in {location}, place the most demanding work outside the peak heat window where practical, and plan water, shade, and recovery breaks. "
        f"3. Heat-safety actions: Keep hydration available, use shaded or cool recovery areas, and follow workplace heat-safety guidance during the {shift_start}–{shift_end} window."
    )


async def gemini_briefing(location, job_type, shift_start, shift_end, results):
    if not GEMINI_API_KEY:
        return fallback_briefing(location, job_type, shift_start, shift_end, results)
    try:
        import google.generativeai as genai
        genai.configure(api_key=GEMINI_API_KEY)
        model = genai.GenerativeModel("gemini-1.5-flash")
        compact = [{"time": r["time"], "hsi": r["hsi"], "risk": r["risk"]} for r in results]
        prompt = (
            "You are HeatLine AI, an operational heat-risk planning assistant. "
            "Give a concise, practical briefing for an outdoor worker. This is a screening/proxy indicator, not medical advice. "
            "Return exactly three numbered sections: 1. Riskiest hours, 2. Recommended shift actions, 3. Heat-safety actions. "
            "Use bullets where helpful. Avoid diagnosis and avoid inventing weather facts.\n\n"
            f"Location: {location}\nJob: {job_type}\nShift: {shift_start}-{shift_end}\nHourly data: {compact}"
        )
        response = model.generate_content(prompt)
        text = getattr(response, "text", None)
        return text.strip() if text else fallback_briefing(location, job_type, shift_start, shift_end, results)
    except Exception:
        return fallback_briefing(location, job_type, shift_start, shift_end, results)


async def run_analysis(req: AnalyzeRequest):
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            params = {
                "latitude": req.latitude,
                "longitude": req.longitude,
                "hourly": "temperature_2m,relative_humidity_2m,apparent_temperature,uv_index",
                "forecast_days": 2,
                "timezone": "auto",
            }
            response = await client.get(f"{OPEN_METEO_BASE_URL}/forecast", params=params)
            response.raise_for_status()
            weather = response.json()
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Weather service unavailable: {exc}")

    hourly = weather.get("hourly", {})
    times = hourly.get("time", [])
    temps = hourly.get("temperature_2m", [])
    humidity = hourly.get("relative_humidity_2m", [])
    apparent = hourly.get("apparent_temperature", [])
    uv = hourly.get("uv_index", [])

    results = []
    for i, t in enumerate(times):
        try:
            score = hsi_score(float(temps[i]), float(humidity[i]), float(uv[i]), float(apparent[i]), req.job_type)
            results.append({
                "time": t,
                "temperature": round(float(temps[i]), 1),
                "humidity": round(float(humidity[i]), 1),
                "apparent_temperature": round(float(apparent[i]), 1),
                "uv_index": round(float(uv[i]), 1),
                "hsi": score,
                "risk": risk_band(score),
            })
        except (IndexError, TypeError, ValueError):
            continue

    briefing = await gemini_briefing(req.location, req.job_type, req.shift_start, req.shift_end, results)
    return {
        "location": req.location,
        "job_type": req.job_type,
        "shift": {"start": req.shift_start, "end": req.shift_end},
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "hourly_results": results,
        "briefing": briefing,
    }


@app.get("/health")
@app.get("/api/health")
async def health():
    return {"status": "ok"}


@app.post("/analyze")
@app.post("/api/analyze")
async def analyze(req: AnalyzeRequest):
    if req.shift_start >= req.shift_end:
        raise HTTPException(status_code=400, detail="Shift end time must be later than shift start time.")
    return await run_analysis(req)
