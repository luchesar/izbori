# Data Processing Documentation

This document describes how the place data is pre-processed for the Elections UI application.

## Data Sources

1.  **`place_data.csv`**: Contains the list of places (settlements) with their EKATTE codes, names, regions, and municipalities.
    -   Location: `public/assets/data/geo/place_data.csv`
2.  **`settlements_simplified1pct.json`**: A large GeoJSON file containing the polygon geometries for all settlements in Bulgaria.
    -   Location: `public/assets/data/geo/settlements_simplified1pct.json`

## Preprocessing Script

The script `process_places.py` is used to merge these two data sources and generate a lightweight GeoJSON file for the frontend.

### Logic
1.  Loads `settlements_simplified1pct.json` and creates a lookup map of geometries based on the `ncode` (which corresponds to EKATTE).
2.  Reads `place_data.csv`.
3.  For each row in the CSV:
    -   Matches the place using the `ekatte` code (padded to 5 digits).
    -   Extracts the polygon geometry from the GeoJSON.
    -   Creates a new GeoJSON Feature with the geometry and simplified properties:
        -   `ekatte`
        -   `name` (Place name)
        -   `oblast` (Region)
        -   `obshtina` (Municipality)
4.  Saves the result as `public/assets/data/geo/places.geojson`.

### Output
-   **`places.geojson`**: A FeatureCollection amenable to be loaded by Leaflet. It replaces the point-based `places.json`.

### How to Run
```bash
python3 process_places.py
```
