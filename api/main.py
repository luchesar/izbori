"""
Bulgarian Elections API

Self-contained FastAPI server for election data.
Endpoints are prefixed by election type:
- /ns - National Assembly (Народно събрание)
- (future) /local - Local elections
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers import ns

app = FastAPI(
    title="Bulgarian Elections API",
    description="API for Bulgarian election data including results, geographic data, and party information.",
    version="1.0.0",
)

# CORS middleware for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount routers
app.include_router(ns.router, prefix="/ns", tags=["National Assembly"])


@app.get("/")
async def root():
    """Health check endpoint."""
    return {
        "status": "ok",
        "message": "Bulgarian Elections API",
        "endpoints": ["/ns"],
    }
