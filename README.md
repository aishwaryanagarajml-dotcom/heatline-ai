# HeatLine AI

Hyperlocal heat-risk intelligence that helps outdoor workers plan safer working hours.

## What it does

HeatLine AI combines hourly weather data with job type and shift timing to calculate an MVP Heat Stress Index (HSI), classify each hour as LOW/MEDIUM/HIGH risk, and generate practical shift-planning guidance. Gemini can turn the forecast into a short operational briefing.

## MVP stack

- Frontend: React + Vite
- Backend: Python + FastAPI
- Weather: Open-Meteo hourly forecast API
- AI: Google Gemini API
- Deployment used for the prototype: Vercel
- Google Cloud technologies used during development: Google AI Studio/Gemini, Cloud Run, Cloud Build and Artifact Registry

## Run locally

### Backend

```bash
cd backend
python -m venv .venv
.venv\\Scripts\\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### Frontend

In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Optional frontend environment variable:

```text
VITE_API_URL=http://127.0.0.1:8000
```

For Gemini briefing generation, set `GEMINI_API_KEY` in the backend environment. Never commit a real API key.

## API

- `GET /health` and `GET /api/health`
- `POST /analyze` and `POST /api/analyze`

## HSI screening bands

- 0–39: LOW
- 40–69: MEDIUM
- 70–100: HIGH

HSI is an MVP screening/proxy indicator for planning and is not a medical diagnosis or a substitute for workplace heat-safety guidance.

## Project documentation

See `PROJECT.md` for the locked project specification, use cases, HSI formula, data sources and demo script.
