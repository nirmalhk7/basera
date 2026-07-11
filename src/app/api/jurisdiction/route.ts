import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// Point-in-polygon ray-casting algorithm
function isPointInPolygon(point: [number, number], vs: [number, number][]): boolean {
  const x = point[0], y = point[1];
  let inside = false;
  for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
    const xi = vs[i][0], yi = vs[i][1];
    const xj = vs[j][0], yj = vs[j][1];
    const intersect = ((yi > y) !== (yj > y))
        && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

// Distance helper (Haversine)
function getDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Cache GeoJSON data in memory to make subsequent requests ultra-fast (sub-millisecond)
let cachedGeoJson: any = null;

function loadGeoJson() {
  if (cachedGeoJson) return cachedGeoJson;
  const filePath = path.join(process.cwd(), 'data', 'india_town_planner_jurisdictions.geojson');
  if (fs.existsSync(filePath)) {
    const raw = fs.readFileSync(filePath, 'utf8');
    cachedGeoJson = JSON.parse(raw);
    return cachedGeoJson;
  }
  return null;
}

// Curated database of verified official Master Plans / Development Plans for major Indian cities
const CURATED_PLANNING_DOCS: Record<string, { title: string; url: string }[]> = {
  "delhi": [
    { "title": "Delhi Master Plan 2021 PDF", "url": "https://dda.gov.in/pdf/jounal/MPD2021.pdf" },
    { "title": "Draft Master Plan for Delhi 2041 PDF", "url": "https://dda.gov.in/pdf/jounal/DMP2041.pdf" }
  ],
  "mumbai": [
    { "title": "Mumbai Regional Plan 2016-2036 PDF", "url": "https://mmrda.maharashtra.gov.in/documents/10180/7901235/Regional+Plan+Report.pdf" },
    { "title": "Mumbai Development Plan 2034 Portal", "url": "https://portal.mcgm.gov.in/irj/portal/anonymous/qldevelopementplan2" }
  ],
  "mumbai metropolitan region": [
    { "title": "Mumbai Regional Plan 2016-2036 PDF", "url": "https://mmrda.maharashtra.gov.in/documents/10180/7901235/Regional+Plan+Report.pdf" }
  ],
  "bengaluru": [
    { "title": "Bengaluru Revised Master Plan 2015 PDF", "url": "https://bdabangalore.org/uploads/files/RMP2015-Volume1.pdf" }
  ],
  "chennai": [
    { "title": "Chennai Second Master Plan (Volume I) PDF", "url": "https://www.cmdachennai.gov.in/VolumeI.pdf" },
    { "title": "Chennai Third Master Plan Vision Portal", "url": "https://www.cmdachennai.gov.in/ThirdMasterPlan.html" }
  ],
  "chennai corporation": [
    { "title": "Chennai Second Master Plan (Volume I) PDF", "url": "https://www.cmdachennai.gov.in/VolumeI.pdf" }
  ],
  "hyderabad": [
    { "title": "Hyderabad Metropolitan Plan 2031 PDF", "url": "https://www.hmda.gov.in/wp-content/uploads/2021/04/MDP-2031-Report.pdf" }
  ],
  "pune": [
    { "title": "Pune Metropolitan Regional Plan 2041 PDF", "url": "https://pmrda.gov.in/documents/10180/7901235/PMR-Draft-Development-Plan-Report-En.pdf" },
    { "title": "Pune Municipal Development Plan 2027 Portal", "url": "https://pmc.gov.in/en/development-plan" }
  ],
  "ahmedabad": [
    { "title": "Ahmedabad Draft Development Plan 2021 PDF", "url": "http://www.auda.org.in/uploads/auda-draft-dp-2021.pdf" }
  ],
  "jaipur": [
    { "title": "Jaipur Master Plan 2025 PDF", "url": "https://jda.urban.rajasthan.gov.in/content/dam/urban/development-authorities/jda-jaipur/pdf/masterplan2025/Master-Plan-2025-Report.pdf" }
  ],
  "noida": [
    { "title": "Noida Master Plan 2031 PDF", "url": "https://www.noidaauthorityonline.in/pdf/MasterPlan2031.pdf" }
  ],
  "gurugram": [
    { "title": "Gurgaon-Manesar Development Plan 2031 PDF", "url": "https://tcpharyana.gov.in/DevelopmentPlans/Gurgaon-Manesar-2031.pdf" }
  ],
  "faridabad": [
    { "title": "Faridabad Development Plan 2031 PDF", "url": "https://tcpharyana.gov.in/DevelopmentPlans/Faridabad-2031.pdf" }
  ],
  "lucknow": [
    { "title": "Lucknow Master Plan 2031 Portal", "url": "http://ldaonline.co.in/lucknow-master-plan-2031/" }
  ],
  "patna": [
    { "title": "Patna Master Plan 2031 PDF", "url": "https://state.bihar.gov.in/cache/urbandev/Patna_Master_Plan_2031.pdf" }
  ],
  "bhubaneswar": [
    { "title": "Bhubaneswar Comprehensive Dev Plan Portal", "url": "https://bda.gov.in/CDP-Bhubaneswar" }
  ],
  "kochi": [
    { "title": "Kochi Structure & Master Plan Portal", "url": "https://gcda.kerala.gov.in/pages/master-plan.html" }
  ],
  "thiruvananthapuram": [
    { "title": "Thiruvananthapuram Master Plan 2040 PDF", "url": "http://www.townplanning.kerala.gov.in/pdf/draft_tvm_mp_2040.pdf" }
  ],
  "srinagar": [
    { "title": "Srinagar Master Plan 2035 PDF", "url": "https://sdasrinagar.jk.gov.in/Srinagar-Master-Plan-2035.pdf" }
  ],
  "jammu": [
    { "title": "Jammu Master Plan 2032 PDF", "url": "http://jdajammu.in/MasterPlan2032.pdf" }
  ],
  "chandigarh": [
    { "title": "Chandigarh Master Plan 2031 Portal", "url": "https://chandigarh.gov.in/chandigarh-master-plan-2031" }
  ],
  "shimla": [
    { "title": "Shimla Development Plan 2041 PDF", "url": "https://tcp.hp.gov.in/pdf/Shimla_Development_Plan_2041.pdf" }
  ],
  "goa": [
    { "title": "Goa Regional Plan 2021 Portal", "url": "https://www.tcp.goa.gov.in/regional-plan-goa-2021" }
  ],
  "dehradun": [
    { "title": "Dehradun Master Plan 2025 Portal", "url": "https://mdda.info/dehradun-master-plan-2025" }
  ],
  "guwahati": [
    { "title": "Guwahati Master Plan 2025 Portal", "url": "https://gmda.assam.gov.in/portlets/guwahati-master-plan" }
  ],
  "visakhapatnam": [
    { "title": "Visakhapatnam Region Master Plan 2041 Portal", "url": "https://vmrda.gov.in/VMR-Master-Plan-2041.aspx" }
  ],
  "coimbatore": [
    { "title": "Coimbatore Master Plan Portal", "url": "https://www.dtcp.tn.gov.in/master-plans/coimbatore" }
  ],
  "madurai": [
    { "title": "Madurai Master Plan Portal", "url": "https://www.dtcp.tn.gov.in/master-plans/madurai" }
  ],
  "surat": [
    { "title": "Surat Revised Draft Dev Plan 2035 PDF", "url": "http://www.sudaonline.org/uploads/dp-2035-report.pdf" }
  ],
  "vadodara": [
    { "title": "Vadodara Draft Development Plan 2031 PDF", "url": "http://www.vuda.co.in/uploads/vuda-dp-2031.pdf" }
  ],
  "indore": [
    { "title": "Indore Development Plan 2021 Portal", "url": "https://mptownplan.gov.in/developmentplans/indore-2021.html" }
  ],
  "bhopal": [
    { "title": "Bhopal Development Plan 2031 Portal", "url": "https://mptownplan.gov.in/developmentplans/bhopal-2031.html" }
  ]
};

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const latStr = url.searchParams.get('lat');
  const lngStr = url.searchParams.get('lng');

  if (!latStr || !lngStr) {
    return NextResponse.json({ error: 'Missing lat or lng parameters' }, { status: 400 });
  }

  const lat = parseFloat(latStr);
  const lng = parseFloat(lngStr);

  if (isNaN(lat) || isNaN(lng)) {
    return NextResponse.json({ error: 'Invalid lat or lng parameters' }, { status: 400 });
  }

  const geojson = loadGeoJson();
  if (!geojson) {
    return NextResponse.json({ error: 'Jurisdiction boundaries GeoJSON data not found' }, { status: 500 });
  }

  const point: [number, number] = [lng, lat]; // GeoJSON uses [longitude, latitude]
  let bestMatch: any = null;
  let minDistance = Infinity;

  for (const feature of geojson.features) {
    const geom = feature.geometry;
    if (!geom) continue;

    if (geom.type === 'Polygon') {
      const coords = geom.coordinates;
      if (isPointInPolygon(point, coords[0])) {
        let insideHole = false;
        for (let h = 1; h < coords.length; h++) {
          if (isPointInPolygon(point, coords[h])) {
            insideHole = true;
            break;
          }
        }
        if (!insideHole) {
          bestMatch = feature;
          break; // Exact polygon match found!
        }
      }
    } else if (geom.type === 'MultiPolygon') {
      let matched = false;
      for (const polygon of geom.coordinates) {
        if (isPointInPolygon(point, polygon[0])) {
          let insideHole = false;
          for (let h = 1; h < polygon.length; h++) {
            if (isPointInPolygon(point, polygon[h])) {
              insideHole = true;
              break;
            }
          }
          if (!insideHole) {
            bestMatch = feature;
            matched = true;
            break;
          }
        }
      }
      if (matched) break; // Exact polygon match found!
    } else if (geom.type === 'Point') {
      const coords = geom.coordinates; // [lng, lat]
      const dist = getDistanceKm(lat, lng, coords[1], coords[0]);
      if (dist < 15 && dist < minDistance) {
        minDistance = dist;
        bestMatch = feature;
      }
    }
  }

  if (bestMatch) {
    const nameEn = bestMatch.properties.name_en || '';
    const nameEnLower = nameEn.toLowerCase().trim();
    let curatedDocs: { title: string; url: string }[] = [];

    // Fuzzy matching for city names inside our curated database
    for (const [cityKey, docs] of Object.entries(CURATED_PLANNING_DOCS)) {
      if (nameEnLower.includes(cityKey) || cityKey.includes(nameEnLower)) {
        curatedDocs = docs;
        break;
      }
    }

    // Construct search fallback URL
    const authorityName = bestMatch.properties.planning_authority || nameEn;
    const searchQuery = `${authorityName} master plan development plan filetype:pdf`;
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}`;

    return NextResponse.json({
      found: true,
      properties: {
        ...bestMatch.properties,
        planning_documents: curatedDocs,
        search_documents_url: searchUrl
      },
      geometry: bestMatch.geometry
    });
  }

  return NextResponse.json({ found: false });
}
