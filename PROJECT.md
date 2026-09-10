# HeatLine AI — Locked Project Spec

**Status:** LOCKED for Patchamomma 2026 Build Phase  
**Team:** Solo — Aishwarya (logistics lead)  
**Build window:** Aug 21 – Sep 7, 2026

---

## One-liner

Hyperlocal heat-stress copilot for outdoor workers that predicts unsafe work windows and recommends actionable shift adjustments.

---

## Problem

Outdoor workers (delivery partners, construction labor, street vendors, warehouse staff) face rising heat-related health risks. Generic weather apps report temperature — they do not translate that into **personalized, shift-level guidance** (when to pause, hydrate, or reschedule).

---

## Solution

HeatLine AI combines:
1. Hyperlocal hourly weather (temp, humidity, UV, feels-like)
2. Worker profile (job type, shift hours, age band)
3. Evidence-based heat stress thresholds (WHO / NIOSH)
4. Gemini-powered plain-language briefings and action plans

---

## Target users

| Persona | Pain | Outcome |
|---------|------|---------|
| Delivery partner | Long midday routes in peak heat | Reschedule high-exposure hours |
| Construction supervisor | Crew heat exhaustion risk | Plan work-rest cycles |
| Street vendor | Fixed stall, no shade data | Know worst hours, prep mitigation |

---

## Data sources (no confidential data)

| Source | Purpose |
|--------|---------|
| [Open-Meteo API](https://open-meteo.com/) | Real-time hourly weather |
| BigQuery public weather datasets | Historical validation & trends |
| Synthetic worker profiles | Job type, shift, age band, break patterns |
| WHO / NIOSH heat guidelines | Risk thresholds & work-rest ratios |
| OpenStreetMap | Geo context (optional route exposure) |

---

## Google Cloud stack

| Service | Role |
|---------|------|
| **Google AI Studio** (Gemini API) | Risk briefings, recommendations, alert copy |
| **Agent Development Kit (ADK)** | Weather → Risk → Action agent pipeline |
| **BigQuery** | Weather history, session logs, analytics |
| **Cloud Run** | REST API + web backend |
| **Firestore** | User profiles, alert preferences, session state |
| **Looker Studio** | Demo dashboard (risk trends by location) |
| **Firebase Hosting** | Frontend (optional; Cloud Run can serve UI) |

---

## MVP scope (solo, 3 weeks)

### In scope
- [ ] Location + job type + shift input form
- [ ] Hourly Heat Stress Index (HSI) for next 24–48h
- [ ] High / medium / low risk bands with color coding
- [ ] Gemini-generated briefing: "Your 11 AM–2 PM shift is high risk because…"
- [ ] Recommended actions: breaks, hydration, reschedule windows
- [ ] Looker Studio dashboard with sample city data
- [ ] ADK multi-agent demo (Weather → Risk → Action)

### Out of scope (v2)
- Native mobile app
- Real-time IoT wearable integration
- Multi-language beyond English (stretch: Hindi)

---

## Heat Stress Index (HSI) — v1 formula

```
inputs:  temp_c, relative_humidity, uv_index, job_metabolic_load
proxy:   wet_bulb_approx = temp - ((100 - humidity) / 5)   # simplified
adjust:  feels_like = temp + metabolic_boost(job_type)
score:   HSI = weighted(temp, humidity, uv, job_load) → 0–100
bands:   0–39 LOW | 40–69 MEDIUM | 70–100 HIGH
```

Job metabolic load (example):
- Delivery rider: +2°C equivalent
- Construction: +4°C equivalent
- Street vendor (stationary): +1°C equivalent

---

## Success metrics (data-driven)

- % of shift hours flagged HIGH risk
- Estimated heat-exposure hours reducible per week
- Alert lead time (hours before peak risk window)
- User sessions with actionable recommendation accepted

---

## Form copy-paste (touchpoint form)

**Idea title:**  
HeatLine AI — Hyperlocal Heat-Stress Copilot for Outdoor Workers

**Use case:**  
Outdoor workers face rising heat-related health risks, but weather apps provide generic forecasts—not personalized work-shift guidance. HeatLine AI combines hyperlocal weather with job-type and shift profiles to compute hourly Heat Stress Index scores, flag unsafe work windows, and recommend actionable interventions (hydration breaks, shift rescheduling). Goal: reduce preventable heat exposure hours using data-driven, AI-generated briefings.

**Data source:**  
Open-Meteo API; BigQuery public weather datasets; synthetic worker shift profiles; WHO/NIOSH heat exposure guidelines; OpenStreetMap for geographic context.

**Technology:**  
Google AI Studio (Gemini API), Agent Development Kit (ADK), BigQuery, Cloud Run, Firestore, Looker Studio, Firebase Hosting.

**Team:**  
Solo — Aishwarya, [your-email@domain.com] (project logistics lead)

---

## Timeline (Patchamomma checkpoints)

| Date | Milestone |
|------|-----------|
| Aug 20 | Submit touchpoint form |
| Aug 21–27 | Weather ingest + HSI engine + Cloud Run API |
| Aug 28 | Second checkpoint — end-to-end demo path |
| Aug 29–Sep 4 | Gemini briefings + ADK agents + Looker dashboard |
| Sep 5 | Final checkpoint — polish + demo video |
| Sep 7 | Lock submission |
| Sep 10 | Results |
| Sep 24 | Finale |

---

## Demo script (3 min)

1. **Problem** (30s): Show generic weather app vs. no shift guidance
2. **Input** (30s): Enter city, "delivery partner", shift 10 AM–6 PM
3. **Output** (60s): Hourly HSI chart — flag 12–3 PM as HIGH
4. **AI briefing** (60s): Gemini explains why + recommends 11:30 AM break, shift heavy deliveries to 7–10 AM
5. **Dashboard** (30s): Looker weekly trend for the city
6. **Architecture** (30s): ADK agent flow diagram
