#!/usr/bin/env python3
"""
Fetch Indian Town/City Planner Jurisdictions via Nominatim API.

Strategy:
  Phase 1 – Overpass API: enumerate every OSM relation/node tagged as:
            - place=city or place=town
            - admin_level=7 or admin_level=8 (Municipal Corporations, Councils, Dev Authorities)
  Phase 2 – Nominatim /lookup: batch-fetch (50 IDs per call) full GeoJSON
            boundaries + address details. Resumes lookup at individual ID level.
            Strict 1-req-per-15-sec rate limit for long-running scripts.
  Phase 3 – Compile a FeatureCollection and write the .geojson file.

Output: data/india_town_planner_jurisdictions.geojson
"""

import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone

# ──────────────────────────── Config ────────────────────────────
NOMINATIM_LOOKUP = "https://nominatim.openstreetmap.org/lookup"
OVERPASS_URL = "https://overpass-api.de/api/interpreter"
USER_AGENT = "IndianTownPlannerGeoJSON/1.0 (research; github.com/nirmalhk7/basera)"
RATE_LIMIT_SECS = 16  # ≥15 s between Nominatim calls (long-running script policy)
BATCH_SIZE = 50       # max osm_ids per Nominatim /lookup call
OUTPUT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data")
OUTPUT_FILE = os.path.join(OUTPUT_DIR, "india_town_planner_jurisdictions.geojson")
CACHE_FILE = os.path.join(OUTPUT_DIR, ".overpass_cache.json")
PROGRESS_FILE = os.path.join(OUTPUT_DIR, ".nominatim_progress.json")

# Overpass query: all place=city|town, admin_level=7|8 in India
OVERPASS_QUERY = """
[out:json][timeout:900];
area["ISO3166-1"="IN"]["boundary"="administrative"]["admin_level"="2"]->.india;
(
  relation["place"~"^(city|town)$"](area.india);
  node["place"~"^(city|town)$"](area.india);
  relation["admin_level"~"^[78]$"](area.india);
);
out tags;
"""


def log(msg: str) -> None:
    ts = datetime.now().strftime("%H:%M:%S")
    print(f"[{ts}] {msg}", flush=True)


def http_get(url: str, timeout: int = 120) -> bytes:
    """GET with proper User-Agent."""
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read()


def http_post(url: str, data: dict, timeout: int = 900) -> bytes:
    """POST with proper User-Agent."""
    encoded = urllib.parse.urlencode(data).encode()
    req = urllib.request.Request(url, data=encoded, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read()


# ──────────────────── Phase 1: Overpass enumeration ─────────────────────
def fetch_overpass() -> list[dict]:
    """Return list of {type, id, tags} dicts for every city/town/authority in India."""
    if os.path.exists(CACHE_FILE):
        log(f"Loading cached Overpass results from {CACHE_FILE}")
        with open(CACHE_FILE) as f:
            return json.load(f)

    log("Phase 1 ▸ Querying Overpass API for all cities/towns/local authorities in India …")
    log("  (this may take 2-5 minutes)")
    raw = http_post(OVERPASS_URL, {"data": OVERPASS_QUERY})
    data = json.loads(raw)
    elements = data.get("elements", [])
    log(f"  Overpass returned {len(elements)} elements")

    os.makedirs(OUTPUT_DIR, exist_ok=True)
    with open(CACHE_FILE, "w") as f:
        json.dump(elements, f)
    log(f"  Cached to {CACHE_FILE}")
    return elements


# ──────────────── Phase 2: Nominatim /lookup in batches ─────────────────
def build_osm_id_str(elem: dict) -> str:
    """Convert Overpass element to Nominatim osm_ids format (R123 / N456)."""
    prefix = {"relation": "R", "way": "W", "node": "N"}.get(elem["type"], "")
    return f"{prefix}{elem['id']}"


def load_progress() -> dict:
    """Load progress state for resumability."""
    if os.path.exists(PROGRESS_FILE):
        with open(PROGRESS_FILE) as f:
            return json.load(f)
    return {"completed_batches": [], "features": []}


def save_progress(state: dict) -> None:
    with open(PROGRESS_FILE, "w") as f:
        json.dump(state, f)


def nominatim_lookup(osm_ids_str: str, retries: int = 3) -> list[dict]:
    """Call Nominatim /lookup and return list of GeoJSON features."""
    params = urllib.parse.urlencode({
        "osm_ids": osm_ids_str,
        "format": "geojson",
        "polygon_geojson": 1,
        "addressdetails": 1,
        "extratags": 1,
        "polygon_threshold": 0.001,  # simplify slightly to keep file size sane
    })
    url = f"{NOMINATIM_LOOKUP}?{params}"

    for attempt in range(1, retries + 1):
        try:
            raw = http_get(url, timeout=120)
            data = json.loads(raw)
            return data.get("features", [])
        except urllib.error.HTTPError as e:
            if e.code == 429:
                wait = RATE_LIMIT_SECS * attempt * 2
                log(f"    ⚠ Rate limited (429). Backing off {wait}s …")
                time.sleep(wait)
            else:
                log(f"    ⚠ HTTP {e.code} on attempt {attempt}/{retries}")
                time.sleep(RATE_LIMIT_SECS)
        except Exception as e:
            log(f"    ⚠ Error on attempt {attempt}/{retries}: {e}")
            time.sleep(RATE_LIMIT_SECS)

    return []


def fetch_nominatim_batches(elements: list[dict]) -> list[dict]:
    """Batch-fetch Nominatim data for all elements. Resumes by individual OSM ID."""
    # Deduplicate
    seen = set()
    unique = []
    for el in elements:
        key = (el["type"], el["id"])
        if key not in seen:
            seen.add(key)
            unique.append(el)
    log(f"Phase 2 ▸ {len(unique)} unique places to look up via Nominatim /lookup")

    # Prioritise relations (they have polygon boundaries) over nodes
    relations = [e for e in unique if e["type"] == "relation"]
    nodes = [e for e in unique if e["type"] == "node"]
    ordered = relations + nodes
    log(f"  {len(relations)} relations, {len(nodes)} nodes")

    # Load progress
    state = load_progress()
    all_features = list(state.get("features", []))

    # Reconstruct completed OSM IDs from already fetched features
    done_osm_ids = set()
    for f in all_features:
        props = f.get("properties", {})
        osm_type = props.get("osm_type")
        osm_id = props.get("osm_id")
        if osm_type and osm_id:
            prefix = {"relation": "R", "node": "N", "way": "W"}.get(osm_type, "")
            done_osm_ids.add(f"{prefix}{osm_id}")

    # Filter out already done elements
    pending = [e for e in ordered if build_osm_id_str(e) not in done_osm_ids]
    log(f"  Resuming: {len(done_osm_ids)} elements already done, {len(pending)} pending lookup")

    # Build batches for pending elements
    batches: list[list[dict]] = []
    for i in range(0, len(pending), BATCH_SIZE):
        batches.append(pending[i : i + BATCH_SIZE])

    total = len(batches)
    log(f"  {total} batches of up to {BATCH_SIZE} to fetch")

    if total == 0:
        log("  All elements already fetched!")
        return all_features

    est_remaining = total * RATE_LIMIT_SECS
    log(f"  Estimated time remaining: ~{est_remaining // 60}m {est_remaining % 60}s")

    for idx, batch in enumerate(batches):
        batch_key = ",".join(build_osm_id_str(e) for e in batch)
        log(f"  Batch {idx + 1}/{total}  ({len(all_features)} features so far)")
        features = nominatim_lookup(batch_key)

        if features:
            all_features.extend(features)
            log(f"    ✓ Got {len(features)} features")
        else:
            log(f"    ✗ No features returned")

        # Save progress every batch
        for e in batch:
            done_osm_ids.add(build_osm_id_str(e))
        state["completed_batches"] = list(done_osm_ids)
        state["features"] = all_features
        save_progress(state)

        # Respect rate limit
        time.sleep(RATE_LIMIT_SECS)

    return all_features


# ──────────────────── Phase 3: Compile GeoJSON ──────────────────────
def enrich_feature(feature: dict) -> dict:
    """Add town-planner-specific properties to a feature."""
    props = feature.get("properties") or {}
    address = props.get("address") or {}
    extra = props.get("extratags") or {}

    name = props.get("name", "")
    name_en = extra.get("name:en", name)
    state = address.get("state", "")
    district = address.get("county", address.get("state_district", ""))
    place_type = props.get("type", "")   # city / town / administrative
    osm_type = props.get("osm_type", "")
    osm_id = props.get("osm_id", "")
    population = extra.get("population", "")
    wikipedia = extra.get("wikipedia", "")
    wikidata = extra.get("wikidata", "")

    # Website extraction from OSM tags (bakes in local website)
    website = extra.get("website", extra.get("contact:website", extra.get("url", "")))
    if not website:
        website = props.get("website", "")

    # Clean website URL format
    if website and not website.startswith(("http://", "https://")):
        website = "https://" + website

    # Heuristic for the name of the planning authority / municipal body
    if "Municipal Corporation" in name or "Municipal Council" in name or "Development Authority" in name:
        planning_authority = name
    else:
        if place_type == "city":
            authority_type = "Municipal Corporation"
        else:
            authority_type = "Municipal Council / Nagar Panchayat"
        planning_authority = f"{name_en} {authority_type}"

    # State-level Chief Town Planner and Directorate Mapping Directory
    state_planners = {
        "Maharashtra": {
            "directorate": "Directorate of Town Planning, Maharashtra State",
            "town_planner": "Chief Town Planner / Director of Town Planning",
            "website": "https://dtp.maharashtra.gov.in",
            "email": "dir.tp@maharashtra.gov.in"
        },
        "Karnataka": {
            "directorate": "Department of Town and Country Planning, Karnataka",
            "town_planner": "Director of Town and Country Planning",
            "website": "https://tcp.karnataka.gov.in",
            "email": "dir.tcp-ka@nic.in"
        },
        "Tamil Nadu": {
            "directorate": "Directorate of Town and Country Planning (DTCP), Tamil Nadu",
            "town_planner": "Director of Town and Country Planning",
            "website": "https://www.dtcp.tn.gov.in",
            "email": "dtcp-tn@nic.in"
        },
        "Delhi": {
            "directorate": "Delhi Development Authority (DDA), Planning Department",
            "town_planner": "Commissioner (Planning), DDA",
            "website": "https://dda.gov.in",
            "email": "commrplanning@dda.org.in"
        },
        "Haryana": {
            "directorate": "Department of Town & Country Planning, Haryana",
            "town_planner": "Director General, Town & Country Planning",
            "website": "https://tcpharyana.gov.in",
            "email": "tcpharyana4@gmail.com"
        },
        "Uttar Pradesh": {
            "directorate": "Town & Country Planning Department, Uttar Pradesh",
            "town_planner": "Chief Town & Country Planner",
            "website": "http://uptcp.gov.in",
            "email": "ctp.up@gov.in"
        },
        "Gujarat": {
            "directorate": "Town Planning and Valuation Department, Gujarat",
            "town_planner": "Director of Town Planning",
            "website": "https://townplanning.gujarat.gov.in",
            "email": "dir-townplanning@gujarat.gov.in"
        },
        "Telangana": {
            "directorate": "Directorate of Town and Country Planning, Telangana",
            "town_planner": "Director of Town and Country Planning",
            "website": "https://dtcp.telangana.gov.in",
            "email": "dir-dtcp@telangana.gov.in"
        },
        "Andhra Pradesh": {
            "directorate": "Directorate of Town and Country Planning, Andhra Pradesh",
            "town_planner": "Director of Town and Country Planning",
            "website": "http://dtcp.ap.gov.in",
            "email": "dtcp.ap@ap.gov.in"
        },
        "Kerala": {
            "directorate": "Department of Town and Country Planning, Kerala",
            "town_planner": "Chief Town Planner",
            "website": "http://www.townplanning.kerala.gov.in",
            "email": "ctp.tcp@kerala.gov.in"
        },
        "West Bengal": {
            "directorate": "Urban Development & Municipal Affairs Department, West Bengal",
            "town_planner": "Special Secretary & Chief Town Planner",
            "website": "https://udma.wb.gov.in",
            "email": "secy.udma-wb@gov.in"
        },
        "Rajasthan": {
            "directorate": "Town Planning Department, Rajasthan",
            "town_planner": "Chief Town Planner",
            "website": "https://townplanning.rajasthan.gov.in",
            "email": "ctprajasthan@gmail.com"
        },
        "Madhya Pradesh": {
            "directorate": "Directorate of Town and Country Planning, Madhya Pradesh",
            "town_planner": "Director of Town and Country Planning",
            "website": "https://mptownplan.gov.in",
            "email": "mptownplan@mp.gov.in"
        },
        "Punjab": {
            "directorate": "Town & Country Planning Department, Punjab",
            "town_planner": "Chief Town Planner",
            "website": "https://www.puda.gov.in",
            "email": "ctp-pb@punjab.gov.in"
        },
        "Bihar": {
            "directorate": "Urban Development and Housing Department, Bihar",
            "town_planner": "Chief Town Planner",
            "website": "https://state.bihar.gov.in/urbandev",
            "email": "udhd-bih@gov.in"
        },
        "Odisha": {
            "directorate": "Directorate of Town Planning, Odisha",
            "town_planner": "Director of Town Planning",
            "website": "http://dtpodisha.nic.in",
            "email": "dtp.odisha@nic.in"
        },
        "Assam": {
            "directorate": "Directorate of Town and Country Planning, Assam",
            "town_planner": "Director of Town and Country Planning",
            "website": "https://tcp.assam.gov.in",
            "email": "dir.tcp-as@gov.in"
        },
        "Himachal Pradesh": {
            "directorate": "Town and Country Planning Department, Himachal Pradesh",
            "town_planner": "Director of Town and Country Planning",
            "website": "https://tcp.hp.gov.in",
            "email": "tcp-hp@nic.in"
        },
        "Uttarakhand": {
            "directorate": "Town and Country Planning Department, Uttarakhand",
            "town_planner": "Chief Town & Country Planner",
            "website": "https://tcpd.uk.gov.in",
            "email": "tcpd-uk@nic.in"
        },
        "Jammu and Kashmir": {
            "directorate": "Town Planning Organization, Jammu / Kashmir",
            "town_planner": "Chief Town Planner",
            "website": "http://tpoj.jk.gov.in",
            "email": "tpo.jammu@jk.gov.in"
        },
        "Goa": {
            "directorate": "Town and Country Planning Department, Goa",
            "town_planner": "Chief Town Planner (Planning)",
            "website": "https://www.tcp.goa.gov.in",
            "email": "dir-tcp.goa@nic.in"
        },
        "Puducherry": {
            "directorate": "Town and Country Planning Department, Puducherry",
            "town_planner": "Senior Town Planner",
            "website": "https://tcpd.py.gov.in",
            "email": "tcpd.pondy@nic.in"
        },
        "Chandigarh": {
            "directorate": "Urban Planning Department, Chandigarh Administration",
            "town_planner": "Chief Architect & Town Planning Officer",
            "website": "https://chandigarh.gov.in",
            "email": "arch-chd@nic.in"
        }
    }

    planner_info = state_planners.get(state, {
        "directorate": "State Department of Town and Country Planning",
        "town_planner": "Director / Chief Town Planner",
        "website": "https://itpi.org.in",
        "email": "info@itpi.org.in"
    })

    feature["properties"] = {
        "name": name,
        "name_en": name_en,
        "place_type": place_type,
        "state": state,
        "district": district,
        "planning_authority": planning_authority,
        "town_planner_jurisdiction": name_en,
        "website": website,
        "state_planning_directorate": planner_info["directorate"],
        "town_planner_designation": planner_info["town_planner"],
        "state_planning_website": planner_info["website"],
        "state_planning_email": planner_info["email"],
        "population": population,
        "osm_type": osm_type,
        "osm_id": osm_id,
        "wikipedia": wikipedia,
        "wikidata": wikidata,
        "display_name": props.get("display_name", ""),
    }
    return feature


def compile_geojson(features: list[dict]) -> dict:
    """Deduplicate, enrich, and wrap in a FeatureCollection."""
    seen_ids = set()
    unique = []
    for f in features:
        oid = f.get("properties", {}).get("osm_id")
        if oid and oid not in seen_ids:
            seen_ids.add(oid)
            unique.append(enrich_feature(f))

    # Sort: cities first, then towns; alphabetically within each group
    unique.sort(key=lambda f: (
        0 if f["properties"].get("place_type") in ("city", "administrative") else 1,
        f["properties"].get("state", ""),
        f["properties"].get("name_en", ""),
    ))

    polys = sum(1 for f in unique if f.get("geometry", {}).get("type") in ("Polygon", "MultiPolygon"))
    points = sum(1 for f in unique if f.get("geometry", {}).get("type") == "Point")

    log(f"Phase 3 ▸ Compiled {len(unique)} unique jurisdictions")
    log(f"  {polys} with polygon boundaries, {points} as point-only")

    return {
        "type": "FeatureCollection",
        "name": "India Town/City Planner Jurisdictions",
        "metadata": {
            "description": "Administrative boundaries, websites, and designations of town/city planning jurisdictions across India",
            "source": "OpenStreetMap via Nominatim API",
            "generated_utc": datetime.now(timezone.utc).isoformat(),
            "total_features": len(unique),
            "polygon_features": polys,
            "point_features": points,
            "license": "ODbL 1.0 — https://opendatacommons.org/licenses/odbl/",
        },
        "features": unique,
    }


# ──────────────────────────── Main ──────────────────────────────
def main():
    log("=" * 60)
    log("Indian Town/City Planner Jurisdictions — GeoJSON Builder")
    log("=" * 60)

    os.makedirs(OUTPUT_DIR, exist_ok=True)

    # Phase 1
    elements = fetch_overpass()
    if not elements:
        log("ERROR: Overpass returned 0 elements. Aborting.")
        sys.exit(1)

    # Phase 2
    features = fetch_nominatim_batches(elements)
    if not features:
        log("ERROR: No features returned from Nominatim. Aborting.")
        sys.exit(1)

    # Phase 3
    geojson = compile_geojson(features)

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(geojson, f, ensure_ascii=False, indent=2)

    size_mb = os.path.getsize(OUTPUT_FILE) / (1024 * 1024)
    log(f"✅  Saved to {OUTPUT_FILE} ({size_mb:.1f} MB)")
    log(f"✅  Total jurisdictions: {geojson['metadata']['total_features']}")
    log(f"    Polygons: {geojson['metadata']['polygon_features']}")
    log(f"    Points:   {geojson['metadata']['point_features']}")

    # Cleanup progress file
    if os.path.exists(PROGRESS_FILE):
        os.remove(PROGRESS_FILE)
        log("  Cleaned up progress file")

    log("Done!")


if __name__ == "__main__":
    main()
