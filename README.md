# ELD Route Planner

Small demo (React + Vite + Django/DRF) that plans a route and shows HOS stops.

## Prerequisites
- Python 3.11+ (we used 3.13)
- Node 18+ / pnpm|npm
- OpenRouteService API key (env `ORS_API_KEY`)
- (Optional) MapTiler key for nicer basemap (env `VITE_MAPTILER_KEY`)

## Dev Run

### Backend
```bash
cd backend
python -m venv .venv && . .venv/Scripts/activate  # Win
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver 0.0.0.0:8000
