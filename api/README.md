# Bulgarian Elections API

Self-contained FastAPI server for Bulgarian election data (National Assembly elections).

## Quick Start

```bash
# Create virtual environment and install dependencies
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Generate places.geojson (required on first run)
python process_places.py

# Run the server
uvicorn main:app --reload --port 8000
```

API will be available at `http://localhost:8000`

## Endpoints

All endpoints are prefixed with `/ns` (Народно събрание / National Assembly).

| Endpoint | Description |
|----------|-------------|
| `GET /ns/elections` | List available elections |
| `GET /ns/geo/municipalities` | Municipalities GeoJSON |
| `GET /ns/geo/settlements` | Settlements GeoJSON |
| `GET /ns/geo/places` | Places metadata |
| `GET /ns/parties` | All parties with colors |
| `GET /ns/data/{election_id}` | Election results |
| `GET /ns/stats/national/{election_id}` | National aggregated stats |
| `GET /ns/stats/top-parties` | Top parties from last N elections |

### Query Parameters

**`GET /ns/data/{election_id}`**
- `region_type`: `municipality` or `settlement` (default: `settlement`)
- `region_id`: Optional specific region ID
- `parties`: Optional comma-separated party names

**`GET /ns/stats/top-parties`**
- `n`: Number of recent elections to analyze (default: 3)

## Data Files

All data is self-contained in the `data/` directory:

```
data/
├── geo/
│   ├── municipalities.json   # Municipality boundaries
│   ├── places.geojson        # Settlement boundaries (generated)
│   ├── places.json           # Settlement metadata
│   ├── place_data.csv        # Source CSV for settlement names
│   └── settlements_simplified1pct.json  # Source GeoJSON for polygons
├── el_data/                  # Election CSVs (2013-2024)
├── mestni/                   # Local election data (for future /local endpoint)
└── parties.csv               # Party name/label mapping
```

## Data Scripts

### `process_places.py`

Generates `places.geojson` by merging settlement geometry with metadata:

```bash
cd api && python process_places.py
```

This script combines:
- `settlements_simplified1pct.json` - GeoJSON with simplified settlement polygons
- `place_data.csv` - settlement metadata (EKATTE codes, Bulgarian names, oblast, obshtina)

Run this script if you need to regenerate the places.geojson file.

## Integration with Frontend

The frontend (`izbori-ui`) is configured to proxy `/api/*` requests to this server:

```bash
# Terminal 1: Start API
cd api && source venv/bin/activate && uvicorn main:app --reload --port 8000

# Terminal 2: Start frontend
npm run dev
```

## Testing

```bash
cd api && source venv/bin/activate && python -m pytest tests/ -v
```

## API Documentation

Interactive docs available at:
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`
