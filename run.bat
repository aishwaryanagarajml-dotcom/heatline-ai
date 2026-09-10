@echo off
start "HeatLine Backend" cmd /k "cd backend && python -m venv .venv && .venv\Scripts\activate && pip install -r requirements.txt && uvicorn app.main:app --reload --port 8000"
start "HeatLine Frontend" cmd /k "cd frontend && npm install && npm run dev"
