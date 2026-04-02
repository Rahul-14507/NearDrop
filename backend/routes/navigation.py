from __future__ import annotations

import asyncio
import logging
import os
from typing import List, Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from auth import get_current_user
from models import User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/navigation", tags=["navigation"])


class NavigationInstruction(BaseModel):
    instruction_text: str
    distance_m: int
    maneuver: str
    point_index: int
    lat: float
    lng: float


class RouteResponse(BaseModel):
    polyline: List[List[float]]
    total_distance_m: int
    total_time_s: int
    instructions: List[NavigationInstruction]


async def _fetch_nearby_poi(
    client: httpx.AsyncClient,
    lat: float,
    lng: float,
    key: str,
) -> Optional[str]:
    """Return POI name near the given coordinates, or None."""
    try:
        resp = await client.get(
            "https://atlas.microsoft.com/search/nearby/json",
            params={
                "api-version": "1.0",
                "lat": lat,
                "lon": lng,
                "radius": 50,
                "limit": 1,
                "subscription-key": key,
            },
            timeout=8.0,
        )
        resp.raise_for_status()
        data = resp.json()
        results = data.get("results", [])
        if results:
            return results[0].get("poi", {}).get("name") or results[0].get("address", {}).get("freeformAddress")
    except Exception as exc:
        logger.warning("POI lookup failed at (%.4f, %.4f): %s", lat, lng, exc)
    return None


@router.get("/route", response_model=RouteResponse)
async def get_route(
    origin_lat: float = Query(...),
    origin_lng: float = Query(...),
    dest_lat: float = Query(...),
    dest_lng: float = Query(...),
    current_user: User = Depends(get_current_user),
):
    """Return a driving route from Azure Maps with landmark-enriched instructions."""
    maps_key = os.getenv("AZURE_MAPS_SUBSCRIPTION_KEY")
    if not maps_key:
        logger.error("AZURE_MAPS_SUBSCRIPTION_KEY not configured")
        raise HTTPException(
            status_code=503,
            detail={"error": "mapping_service_unavailable"},
        )

    route_url = "https://atlas.microsoft.com/route/directions/json"

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(
                route_url,
                params={
                    "api-version": "1.0",
                    "query": f"{origin_lat},{origin_lng}:{dest_lat},{dest_lng}",
                    "routeType": "fastest",
                    "travelMode": "car",
                    "instructionsType": "tagged",
                    "language": "hi-IN",
                    "subscription-key": maps_key,
                },
            )
            resp.raise_for_status()
            route_data = resp.json()
    except httpx.HTTPStatusError as exc:
        logger.error(
            "Azure Maps route HTTP error %s: %s",
            exc.response.status_code,
            exc.response.text,
        )
        raise HTTPException(
            status_code=503,
            detail={"error": "mapping_service_unavailable"},
        )
    except Exception as exc:
        logger.error("Azure Maps route call failed: %s", exc)
        raise HTTPException(
            status_code=503,
            detail={"error": "mapping_service_unavailable"},
        )

    try:
        routes = route_data.get("routes", [])
        if not routes:
            raise HTTPException(
                status_code=503,
                detail={"error": "mapping_service_unavailable"},
            )

        route = routes[0]
        summary = route.get("summary", {})
        total_distance_m = int(summary.get("lengthInMeters", 0))
        total_time_s = int(summary.get("travelTimeInSeconds", 0))

        legs = route.get("legs", [])
        leg = legs[0] if legs else {}

        # Build polyline from leg points
        raw_points = leg.get("points", [])
        polyline = [[pt["latitude"], pt["longitude"]] for pt in raw_points]

        # Parse guidance instructions
        guidance = route.get("guidance", {})
        raw_instructions = guidance.get("instructions", [])

        parsed_instructions: List[dict] = []
        for inst in raw_instructions:
            point_idx = inst.get("routeOffsetInMeters", 0)
            point = inst.get("point", {})
            inst_lat = point.get("latitude", origin_lat)
            inst_lng = point.get("longitude", origin_lng)
            maneuver = inst.get("maneuver", "STRAIGHT")
            # Strip tagged markup from instruction text
            raw_text = inst.get("message", inst.get("combinedMessage", ""))
            # Azure tagged instructions may include <roadName> etc.; keep plain text
            inst_text = raw_text
            dist_m = int(inst.get("routeOffsetInMeters", 0))

            parsed_instructions.append({
                "instruction_text": inst_text,
                "distance_m": dist_m,
                "maneuver": maneuver,
                "point_index": point_idx,
                "lat": inst_lat,
                "lng": inst_lng,
            })
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Failed to parse Azure Maps route response: %s", exc)
        raise HTTPException(
            status_code=503,
            detail={"error": "mapping_service_unavailable"},
        )

    # Landmark enrichment: concurrently look up POI near each instruction point
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            poi_tasks = [
                _fetch_nearby_poi(client, inst["lat"], inst["lng"], maps_key)
                for inst in parsed_instructions
            ]
            poi_results = await asyncio.gather(*poi_tasks, return_exceptions=True)
    except Exception as exc:
        logger.warning("POI enrichment gather failed: %s", exc)
        poi_results = [None] * len(parsed_instructions)

    final_instructions: List[NavigationInstruction] = []
    for inst, poi in zip(parsed_instructions, poi_results):
        text = inst["instruction_text"]
        if poi and not isinstance(poi, Exception) and poi:
            text = f"{text} — {poi} के पास"
        final_instructions.append(
            NavigationInstruction(
                instruction_text=text,
                distance_m=inst["distance_m"],
                maneuver=inst["maneuver"],
                point_index=inst["point_index"],
                lat=inst["lat"],
                lng=inst["lng"],
            )
        )

    return RouteResponse(
        polyline=polyline,
        total_distance_m=total_distance_m,
        total_time_s=total_time_s,
        instructions=final_instructions,
    )
